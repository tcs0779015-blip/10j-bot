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

// Session memory for teacher/proxy tracking
let sessionData = { teachers: {}, proxies: new Set() };

// Exact Timetable from PDF (All times IST)
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

// Helper: Current IST time
function getISTNow() {
  const istTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
  const now = new Date(istTime);
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  
  if (!TIMETABLE[day]) return null;
  const period = TIMETABLE[day].find(p => currentTime >= p.start && currentTime <= p.end);
  return period ? { ...period, dayNum: day } : null;
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.split(' ');
  const command = args[0].toLowerCase();

  // AUDIO TRANSCRIPTION LOGIC
  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getISTNow();
    const periodKey = current ? `${current.dayNum}-${current.name}` : null;
    const teacher = sessionData.teachers[periodKey] || "Unknown";
    const proxyTag = sessionData.proxies.has(periodKey) ? " (PROXY)" : "";
    const subjectLabel = current ? `${current.name} with ${teacher}${proxyTag}` : "General Notes";

    const statusMsg = await message.reply(`🎙️ **Downloading audio for ${subjectLabel}...**`);

    try {
      // Step 1: Securely download audio buffer
      const response = await axios.get(audio.url, { responseType: 'arraybuffer' });
      const audioBuffer = Buffer.from(response.data);

      await statusMsg.edit("📝 **Transcribing with AssemblyAI...**");

      // Step 2: High-accuracy transcription
      const transcript = await aai.transcripts.transcribe({ 
        audio: audioBuffer,
        boost_param: "high" // Enhances accuracy for school terms
      });
      
      if (transcript.status === 'error') throw new Error(transcript.error);

      await statusMsg.edit("📝 **Generating PDF Class Notes...**");

      // Step 3: PDF Creation
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      await generateNotesPDF({
        subject: subjectLabel,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "Silence detected.",
        pdfPath
      });

      await message.reply({ 
        content: `✅ **Notes for ${subjectLabel} Ready!**`, 
        files: [new AttachmentBuilder(pdfPath)] 
      });

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await statusMsg.delete();
    } catch (err) {
      await statusMsg.edit(`❌ **Transcription Error:** \`${err.message}\``);
    }
  }

  // COMMANDS
  if (command === '/timetable') {
    const ist = getISTNow();
    const day = ist ? ist.dayNum : new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getDay();
    const daySchedule = TIMETABLE[day];

    if (!daySchedule) return message.reply("No classes today!");

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle(`📅 10J Timetable (IST)`)
      .setDescription(daySchedule.map(p => `**${p.start} - ${p.end}**: ${p.name}`).join('\n'));

    message.reply({ embeds: [embed] });
  }

  if (command === '/period') {
    const current = getISTNow();
    if (!current) return message.reply("No active period right now.");
    message.reply(`📍 **Current Period:** ${current.name}\n⏰ **IST Time:** ${current.start} - ${current.end}`);
  }

  // Teacher & Proxy commands as previously defined
  if (command === '/teacher') {
    const current = getISTNow();
    const name = args.slice(1).join(' ');
    if (!current || !name) return message.reply("Use during a class: `/teacher [Name]`");
    sessionData.teachers[`${current.dayNum}-${current.name}`] = name;
    message.reply(`✅ Marked **${name}** for ${current.name}.`);
  }

  if (command === '/proxy') {
    const current = getISTNow();
    if (!current) return message.reply("No class to mark as proxy.");
    sessionData.proxies.add(`${current.dayNum}-${current.name}`);
    message.reply(`⚠️ Current ${current.name} marked as **PROXY**.`);
  }
});

const server = http.createServer((req, res) => { res.writeHead(200); res.end('Online'); });
server.listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN);
