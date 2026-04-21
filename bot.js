require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateNotesPDF } = require('./pdfGenerator');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

const TIMETABLE = {
  1: [{ name: 'IT', start: '09:40', end: '10:20' }, { name: 'SST', start: '10:25', end: '11:05' }, { name: 'Biology', start: '11:15', end: '11:55' }, { name: 'SST', start: '11:55', end: '12:35' }, { name: 'English', start: '12:55', end: '13:35' }, { name: 'Islamic/M.Sc', start: '13:35', end: '14:15' }, { name: '2nd Lang', start: '14:20', end: '15:00' }],
  2: [{ name: 'SST', start: '09:40', end: '10:20' }, { name: '2nd Lang', start: '10:25', end: '11:05' }, { name: 'IT', start: '11:15', end: '11:55' }, { name: 'Chemistry', start: '11:55', end: '12:35' }, { name: 'Islamic/M.Sc', start: '12:55', end: '13:35' }, { name: 'SST', start: '13:35', end: '14:15' }, { name: 'Math', start: '14:20', end: '15:00' }],
  3: [{ name: 'Math', start: '09:40', end: '10:20' }, { name: 'Islamic/M.Sc', start: '10:25', end: '11:05' }, { name: 'English', start: '11:15', end: '11:55' }, { name: '2nd Lang', start: '11:55', end: '12:35' }, { name: 'Math', start: '12:55', end: '13:35' }, { name: 'Reading', start: '13:35', end: '14:15' }, { name: 'Physics', start: '14:20', end: '15:00' }],
  4: [{ name: 'SST', start: '09:40', end: '10:20' }, { name: 'Chemistry', start: '10:25', end: '11:05' }, { name: 'Math', start: '11:15', end: '11:55' }, { name: '2nd Lang', start: '11:55', end: '12:35' }, { name: 'Biology', start: '12:55', end: '13:35' }, { name: 'English', start: '13:35', end: '14:15' }, { name: 'HPE', start: '14:20', end: '15:00' }],
  5: [{ name: 'English', start: '09:30', end: '10:00' }, { name: 'Physics', start: '10:00', end: '10:30' }, { name: 'Math', start: '10:30', end: '11:00' }, { name: 'Biology', start: '11:10', end: '11:40' }, { name: '2nd Lang', start: '11:40', end: '12:10' }, { name: 'Math', start: '12:10', end: '12:40' }, { name: 'English', start: '12:40', end: '13:10' }]
};

function getISTNow() {
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  return TIMETABLE[day]?.find(p => time >= p.start && time <= p.end) || null;
}

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  const audio = msg.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getISTNow();
    const label = current ? current.name : "General Notes";
    const status = await msg.reply(`🎙️ **Processing ${label}...**`);
    try {
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const transcript = await aai.transcripts.transcribe({ 
        audio: Buffer.from(response.data),
        speech_models: ["universal-3-pro"] 
      });
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      await generateNotesPDF({
        subject: label,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "No speech.",
        pdfPath
      });
      await msg.reply({ files: [new AttachmentBuilder(pdfPath)] });
      fs.unlinkSync(pdfPath);
      await status.delete();
    } catch (e) { await status.edit(`❌ Error: ${e.message}`); }
  }
});

http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(process.env.PORT || 10000);
client.login(process.env.DISCORD_TOKEN);
