require('dotenv').config();
const { 
  Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events 
} = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateNotesPDF } = require('./pdfGenerator');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// Initialize AssemblyAI with the key from Render Environment Variables
const aai = new AssemblyAI({ 
  apiKey: process.env.ASSEMBLYAI_API_KEY 
});

// Session memory (resets on bot restart)
let sessionData = {
  teachers: {}, // Key: "day-SubjectName"
  proxies: new Set() // Stores "day-SubjectName"
};

const TIMETABLE = {
  1: [ // Monday
    { name: 'Zero Period',  start: '09:25', end: '09:40' },
    { name: 'IT',           start: '09:40', end: '10:20' },
    { name: 'SST',          start: '10:25', end: '11:05' },
    { name: 'Biology',      start: '11:15', end: '11:55' },
    { name: 'SST',          start: '11:55', end: '12:35' },
    { name: 'English',      start: '12:55', end: '13:35' },
    { name: 'Islamic/M.Sc', start: '13:35', end: '14:15' }
  ],
  2: [ // Tuesday
    { name: 'Math',         start: '09:25', end: '10:05' },
    { name: 'Physics',      start: '10:10', end: '10:50' },
    { name: 'Chemistry',    start: '11:00', end: '11:40' }
  ],
  3: [ // Wednesday
    { name: 'Wednesday Class', start: '09:25', end: '10:05' }
  ],
  4: [ // Thursday
    { name: 'Thursday Class', start: '09:25', end: '10:05' }
  ]
};

// Helper: Get Current Period based on Dubai School Time
function getCurrentPeriod() {
  const dubaiTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"});
  const now = new Date(dubaiTime);
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  
  if (!TIMETABLE[day]) return null;
  const period = TIMETABLE[day].find(p => currentTime >= p.start && currentTime <= p.end);
  return period ? { ...period, dayNum: day } : null;
}

// Helper: Convert Dubai Time String (HH:mm) to IST String
function convertToIST(dubaiTimeStr) {
  const [h, m] = dubaiTimeStr.split(':').map(Number);
  let totalMinutes = h * 60 + m + 90; // Add 1h 30m
  let istH = Math.floor(totalMinutes / 60) % 24;
  let istM = totalMinutes % 60;
  return `${istH.toString().padStart(2, '0')}:${istM.toString().padStart(2, '0')} IST`;
}

client.once(Events.ClientReady, () => {
  console.log(`✅ 10J Bot Online. Timezone sync: Dubai/IST enabled.`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.split(' ');
  const command = args[0].toLowerCase();

  // --- AUDIO & TRANSCRIPTION LOGIC ---
  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getCurrentPeriod();
    const periodKey = current ? `${current.dayNum}-${current.name}` : null;
    const teacher = sessionData.teachers[periodKey] || "Unknown";
    const proxyTag = sessionData.proxies.has(periodKey) ? " (PROXY)" : "";
    const subjectLabel = current ? `${current.name} with ${teacher}${proxyTag}` : "General Notes";

    const statusMsg = await message.reply(`🎙️ **Processing ${subjectLabel}...**`);

    try {
      // Transcribe via URL (fixes local disk errors)
      const transcript = await aai.transcripts.transcribe({ audio: audio.url });
      if (transcript.status === 'error') throw new Error(transcript.error);

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
      console.error(err);
      await statusMsg.edit(`❌ **Transcription Failed:** \`${err.message}\``);
    }
  }

  // --- COMMANDS ---
  if (command === '/timetable' || command === '/timetableist') {
    const showIST = command === '/timetableist';
    const dubaiDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"}));
    const day = dubaiDate.getDay();
    const daySchedule = TIMETABLE[day];

    if (!daySchedule) return message.reply("No classes today!");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📅 10J Schedule (${showIST ? 'IST' : 'GST'})`)
      .setDescription(daySchedule.map(p => {
        const timeDisplay = showIST ? convertToIST(p.start) : `${p.start} GST`;
        const periodKey = `${day}-${p.name}`;
        const t = sessionData.teachers[periodKey] ? ` | 🧑‍🏫 ${sessionData.teachers[periodKey]}` : "";
        const pr = sessionData.proxies.has(periodKey) ? " | ⚠️ PROXY" : "";
        return `**${timeDisplay}**: ${p.name}${t}${pr}`;
      }).join('\n'));

    message.reply({ embeds: [embed] });
  }

  if (command === '/period') {
    const current = getCurrentPeriod();
    if (!current) return message.reply("No active class right now.");
    const periodKey = `${current.dayNum}-${current.name}`;
    const teacher = sessionData.teachers[periodKey] || "Not marked";
    const proxy = sessionData.proxies.has(periodKey) ? " (Proxy)" : "";
    message.reply(`📍 **Current Period:** ${current.name}\n🧑‍🏫 **Teacher:** ${teacher}${proxy}\n⏰ **Ends at:** ${current.end} GST`);
  }

  if (command === '/teacher') {
    const current = getCurrentPeriod();
    const name = args.slice(1).join(' ');
    if (!current || !name) return message.reply("Usage: `/teacher [Name]` during a class.");
    sessionData.teachers[`${current.dayNum}-${current.name}`] = name;
    message.reply(`✅ Marked **${name}** for ${current.name}.`);
  }

  if (command === '/proxy') {
    const current = getCurrentPeriod();
    if (!current) return message.reply("No active class to mark as proxy.");
    sessionData.proxies.add(`${current.dayNum}-${current.name}`);
    message.reply(`⚠️ Current ${current.name} period marked as **PROXY**.`);
  }
});

// --- RENDER HEALTH SERVER ---
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('10J Bot Status: Online');
});
server.listen(process.env.PORT || 10000, '0.0.0.0', () => {
  console.log('🚀 Port 10000 bound successfully.');
});

client.login(process.env.DISCORD_TOKEN);
