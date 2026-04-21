require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events } = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const http = require('http');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
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
  1: [ // Monday
    { name: 'Zero Period', start: '09:25', end: '09:40' },
    { name: 'IT', start: '09:40', end: '10:20' },
    { name: 'SST', start: '10:25', end: '11:05' },
    { name: 'Biology', start: '11:15', end: '11:55' },
    { name: 'SST', start: '11:55', end: '12:35' },
    { name: 'English', start: '12:55', end: '13:35' },
    { name: 'Islamic/M.Sc', start: '13:35', end: '14:15' },
    { name: '2nd Language', start: '14:20', end: '15:00' }
  ],
  2: [ // Tuesday
    { name: 'Zero Period', start: '09:25', end: '09:40' },
    { name: 'SST', start: '09:40', end: '10:20' },
    { name: '2nd Language', start: '10:25', end: '11:05' },
    { name: 'IT', start: '11:15', end: '11:55' },
    { name: 'Chemistry', start: '11:55', end: '12:35' },
    { name: 'Islamic/M.Sc', start: '12:55', end: '13:35' },
    { name: 'SST', start: '13:35', end: '14:15' },
    { name: 'Math', start: '14:20', end: '15:00' }
  ],
  3: [ // Wednesday
    { name: 'Zero Period', start: '09:25', end: '09:40' },
    { name: 'Math', start: '09:40', end: '10:20' },
    { name: 'Islamic/M.Sc', start: '10:25', end: '11:05' },
    { name: 'English', start: '11:15', end: '11:55' },
    { name: '2nd Language', start: '11:55', end: '12:35' },
    { name: 'Math', start: '12:55', end: '13:35' },
    { name: 'Reading', start: '13:35', end: '14:15' },
    { name: 'Physics', start: '14:20', end: '15:00' }
  ],
  4: [ // Thursday
    { name: 'Zero Period', start: '09:25', end: '09:40' },
    { name: 'SST', start: '09:40', end: '10:20' },
    { name: 'Chemistry', start: '10:25', end: '11:05' },
    { name: 'Math', start: '11:15', end: '11:55' },
    { name: '2nd Language', start: '11:55', end: '12:35' },
    { name: 'Biology', start: '12:55', end: '13:35' },
    { name: 'English', start: '13:35', end: '14:15' },
    { name: 'HPE', start: '14:20', end: '15:00' }
  ],
  5: [ // Friday
    { name: 'English', start: '09:30', end: '10:00' },
    { name: 'Physics', start: '10:00', end: '10:30' },
    { name: 'Math', start: '10:30', end: '11:00' },
    { name: 'Biology', start: '11:10', end: '11:40' },
    { name: '2nd Language', start: '11:40', end: '12:10' },
    { name: 'Math', start: '12:10', end: '12:40' },
    { name: 'English', start: '12:40', end: '13:10' }
  ]
};

function getISTNow() {
  const istTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
  const now = new Date(istTime);
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  if (!TIMETABLE[day]) return null;
  return TIMETABLE[day].find(p => currentTime >= p.start && currentTime <= p.end) || null;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.split(' ');
  const command = args[0].toLowerCase();

  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getISTNow();
    const subjectLabel = current ? current.name : "General Notes";
    const statusMsg = await message.reply(`🎙️ **Processing ${subjectLabel}...**`);

    try {
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const transcript = await aai.transcripts.transcribe({ 
        audio: Buffer.from(response.data),
        speech_models: ["universal-3-pro"] // FIXED MODEL KEY
      });
      
      if (transcript.status === 'error') throw new Error(transcript.error);

      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      await generateNotesPDF({
        subject: subjectLabel,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "No speech detected.",
        pdfPath
      });

      await message.reply({ files: [new AttachmentBuilder(pdfPath)] });
      fs.unlinkSync(pdfPath);
      await statusMsg.delete();
    } catch (err) {
      await statusMsg.edit(`❌ **Error:** \`${err.message}\``);
    }
  }

  // Basic command check
  if (command === '/timetable') {
    const day = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getDay();
    const daySchedule = TIMETABLE[day];
    if (!daySchedule) return message.reply("No classes today!");
    const embed = new EmbedBuilder().setColor(0x00FF00).setTitle(`📅 10J Timetable (IST)`).setDescription(daySchedule.map(p => `**${p.start} - ${p.end}**: ${p.name}`).join('\n'));
    message.reply({ embeds: [embed] });
  }
});

// Vital for Render
http.createServer((req, res) => { res.writeHead(200); res.end('Running'); }).listen(process.env.PORT || 10000);
client.login(process.env.DISCORD_TOKEN);
