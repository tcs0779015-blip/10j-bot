require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios'); // Add this at the top
const { generateNotesPDF } = require('./pdfGenerator');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

let sessionData = { teachers: {}, proxies: new Set() };

const TIMETABLE = {
  1: [ /* Monday */ ],
  2: [ /* Tuesday */ ],
  // ... rest of your timetable
};

function getDubaiNow() {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"}));
}

function getCurrentPeriod() {
  const now = getDubaiNow();
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  if (!TIMETABLE[day]) return null;
  const period = TIMETABLE[day].find(p => currentTime >= p.start && currentTime <= p.end);
  return period ? { ...period, dayNum: day } : null;
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getCurrentPeriod();
    const periodKey = current ? `${current.dayNum}-${current.name}` : null;
    const teacher = sessionData.teachers[periodKey] || "Unknown";
    const proxyTag = sessionData.proxies.has(periodKey) ? " (PROXY)" : "";
    const subjectLabel = current ? `${current.name} with ${teacher}${proxyTag}` : "General Notes";

    const statusMsg = await message.reply(`🎙️ **Downloading & Processing ${subjectLabel}...**`);

    try {
      // STEP 1: Download audio to a buffer (This fixes the "fails to transcript" issue)
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const audioBuffer = Buffer.from(response.data);

      // STEP 2: Transcribe the buffer directly
      const transcript = await aai.transcripts.transcribe({ audio: audioBuffer });
      
      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      await statusMsg.edit("📝 **Transcription complete!**\nGenerating PDF...");

      // STEP 3: Generate PDF
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      await generateNotesPDF({
        subject: subjectLabel,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "No speech detected.",
        pdfPath
      });

      await message.reply({ 
        content: `✅ **Notes for ${subjectLabel}**`, 
        files: [new AttachmentBuilder(pdfPath)] 
      });

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await statusMsg.delete();

    } catch (err) {
      console.error("TRANSCRIPTION ERROR:", err);
      // This will show you exactly why it failed in Discord
      await statusMsg.edit(`❌ **Transcription Failed:** \`${err.message}\``);
    }
  }

  // ... (Include your /timetable, /period, /teacher, /proxy commands here)
});

// Render Health Check Server
const server = http.createServer((req, res) => { res.writeHead(200); res.end('Online'); });
server.listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN);
