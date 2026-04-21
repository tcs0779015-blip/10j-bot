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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Timetable logic remains the same...
// getISTNow function remains the same...

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;

  const audio = msg.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getISTNow();
    const label = current ? current.name : "Class Notes";
    const status = await msg.reply(`🎙️ **Step 1: Transcribing ${label} with AssemblyAI...**`);

    try {
      // 1. Transcription
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const transcript = await aai.transcripts.transcribe({ 
        audio: Buffer.from(response.data),
        speech_models: ["universal-3-pro"] 
      });

      if (transcript.status === 'error') throw new Error(transcript.error);

      // 2. Gemini 2.5 Flash Processing
      await status.edit(`🧠 **Step 2: Gemini 2.5 Flash is organizing detailed notes...**`);
      
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Updated to 2.5 Flash
      
      const prompt = `You are an expert academic scribe for Class 10J. 
      I will provide a raw transcript of a ${label} lecture. 
      Your goal is to create highly detailed, structured study notes.
      
      STRICT REQUIREMENTS:
      - Capture EVERY point, definition, and example mentioned. Do not summarize so much that information is lost.
      - Use professional Markdown formatting:
        # Main Topic
        ## Sub-topics
        - Use bullet points for lists
        - Use **bold** for key terms and formulas
      - If the teacher mentions specific homework or dates, highlight them in a "TASKS" section.
      - Add a "Quick Summary" at the very end.

      Transcript: ${transcript.text}`;
      
      const result = await model.generateContent(prompt);
      const organizedNotes = result.response.text();

      // 3. PDF Generation
      await status.edit(`📄 **Step 3: Creating your PDF...**`);
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      
      await generateNotesPDF({
        subject: label,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: organizedNotes,
        pdfPath
      });

      await msg.reply({ 
        content: `✅ **Smart Notes for ${label} are ready! (Powered by Gemini 2.5 Flash)**`, 
        files: [new AttachmentBuilder(pdfPath)] 
      });

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await status.delete();

    } catch (e) {
      await status.edit(`❌ **Error:** ${e.message}`);
      console.error(e);
    }
  }
});

http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(process.env.PORT || 10000);
client.login(process.env.DISCORD_TOKEN);
