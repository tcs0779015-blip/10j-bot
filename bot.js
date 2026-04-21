require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateNotesPDF } = require('./pdfGenerator');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Timetable Configuration (IST) ---
const TIMETABLE = {
  1: [ // Monday
    { name: 'Zero Period', start: '09:25', end: '09:40' }, { name: 'IT', start: '09:40', end: '10:20' },
    { name: 'SST', start: '10:25', end: '11:05' }, { name: 'Biology', start: '11:15', end: '11:55' },
    { name: 'SST', start: '11:55', end: '12:35' }, { name: 'English', start: '12:55', end: '13:35' },
    { name: 'Islamic/M.Sc', start: '13:35', end: '14:15' }, { name: '2nd Language', start: '14:20', end: '15:00' }
  ],
  2: [ // Tuesday
    { name: 'Zero Period', start: '09:25', end: '09:40' }, { name: 'SST', start: '09:40', end: '10:20' },
    { name: '2nd Language', start: '10:25', end: '11:05' }, { name: 'IT', start: '11:15', end: '11:55' },
    { name: 'Chemistry', start: '11:55', end: '12:35' }, { name: 'Islamic/M.Sc', start: '12:55', end: '13:35' },
    { name: 'SST', start: '13:35', end: '14:15' }, { name: 'Math', start: '14:20', end: '15:00' }
  ],
  3: [ // Wednesday
    { name: 'Zero Period', start: '09:25', end: '09:40' }, { name: 'Math', start: '09:40', end: '10:20' },
    { name: 'Islamic/M.Sc', start: '10:25', end: '11:05' }, { name: 'English', start: '11:15', end: '11:55' },
    { name: '2nd Language', start: '11:55', end: '12:35' }, { name: 'Math', start: '12:55', end: '13:35' },
    { name: 'Reading', start: '13:35', end: '14:15' }, { name: 'Physics', start: '14:20', end: '15:00' }
  ],
  4: [ // Thursday
    { name: 'Zero Period', start: '09:25', end: '09:40' }, { name: 'SST', start: '09:40', end: '10:20' },
    { name: 'Chemistry', start: '10:25', end: '11:05' }, { name: 'Math', start: '11:15', end: '11:55' },
    { name: '2nd Language', start: '11:55', end: '12:35' }, { name: 'Biology', start: '12:55', end: '13:35' },
    { name: 'English', start: '13:35', end: '14:15' }, { name: 'HPE', start: '14:20', end: '15:00' }
  ],
  5: [ // Friday
    { name: 'English', start: '09:30', end: '10:00' }, { name: 'Physics', start: '10:00', end: '10:30' },
    { name: 'Math', start: '10:30', end: '11:00' }, { name: 'Biology', start: '11:10', end: '11:40' },
    { name: '2nd Language', start: '11:40', end: '12:10' }, { name: 'Math', start: '12:10', end: '12:40' },
    { name: 'English', start: '12:40', end: '13:10' }
  ]
};

// --- Helper Functions ---
function getISTNow() {
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  
  if (!TIMETABLE[day]) return null;
  return TIMETABLE[day].find(p => time >= p.start && time <= p.end) || null;
}

// --- Bot Events ---
client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;

  // Check for audio attachments
  const audio = msg.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  
  if (audio) {
    const current = getISTNow();
    const label = current ? current.name : "General Class";
    const status = await msg.reply(`🎙️ **Step 1: Transcribing ${label}...**`);

    try {
      // 1. Transcription via AssemblyAI
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const transcript = await aai.transcripts.transcribe({ 
        audio: Buffer.from(response.data),
        speech_models: ["universal-3-pro"] 
      });

      if (transcript.status === 'error') throw new Error(transcript.error);

      // 2. AI Processing via Gemini 2.5 Flash
      await status.edit(`🧠 **Step 2: Gemini 2.5 Flash is organizing notes...**`);
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are an expert academic scribe for Class 10J. 
      Rewrite this raw transcript of a ${label} lecture into comprehensive, high-quality study notes. 
      Capture EVERY point, definition, and example mentioned. Do not miss information. 
      Use clear Markdown headings, bullet points, and **bold** key terms.
      Transcript: ${transcript.text}`;
      
      const result = await model.generateContent(prompt);
      const organizedNotes = result.response.text();

      // 3. PDF Generation
      await status.edit(`📄 **Step 3: Creating PDF...**`);
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      
      await generateNotesPDF({
        subject: label,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: organizedNotes,
        pdfPath
      });

      // 4. Send the file
      await msg.reply({ 
        content: `✅ **Smart Notes for ${label} are ready!** (Powered by Gemini 2.5 Flash)`, 
        files: [new AttachmentBuilder(pdfPath)] 
      });

      // Cleanup
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await status.delete();

    } catch (e) {
      console.error(e);
      await status.edit(`❌ **Error:** ${e.message}`);
    }
  }
});

// --- Server Setup for Render ---
const server = http.createServer((req, res) => { 
  res.writeHead(200); 
  res.end('Bot is active'); 
});

server.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log(`Server running on port ${process.env.PORT || 10000}`);
});

client.login(process.env.DISCORD_TOKEN);
