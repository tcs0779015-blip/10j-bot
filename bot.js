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

const aai = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

// This object tracks teachers and proxies for the current session
let sessionData = {
  teachers: {}, // Format: { "Monday-IT": "Mr. Smith" }
  proxies: new Set() // Format: "Monday-IT"
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
  ]
  // Add 3, 4, 5 here...
};

function getDubaiNow() {
  return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"}));
}

function getCurrentPeriod() {
  const now = getDubaiNow();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  const day = now.getDay();
  if (!TIMETABLE[day]) return null;
  const period = TIMETABLE[day].find(p => time >= p.start && time <= p.end);
  if (period) return { ...period, day };
  return null;
}

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  const args = message.content.split(' ');
  const command = args[0].toLowerCase();

  // 1. AUDIO HANDLING (AssemblyAI + PDF)
  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) {
    const current = getCurrentPeriod();
    const periodId = current ? `${current.day}-${current.name}` : null;
    const teacher = sessionData.teachers[periodId] || "Unknown Teacher";
    const isProxy = sessionData.proxies.has(periodId) ? " (PROXY)" : "";
    
    const subjectLabel = current ? `${current.name} with ${teacher}${isProxy}` : "General Notes";
    const statusMsg = await message.reply(`🎙️ **Processing ${subjectLabel}...**`);

    try {
      const transcript = await aai.transcripts.transcribe({ audio: audio.url });
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      
      await generateNotesPDF({
        subject: subjectLabel,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "No speech detected.",
        pdfPath
      });

      await message.reply({ content: `✅ **Notes for ${subjectLabel}**`, files: [new AttachmentBuilder(pdfPath)] });
      fs.unlinkSync(pdfPath);
      await statusMsg.delete();
    } catch (err) {
      await statusMsg.edit("❌ Error processing transcription.");
    }
  }

  // 2. TIMETABLE COMMANDS
  if (command === '/timetable' || command === '/timetableist') {
    const useIST = command.includes('ist');
    const dubaiNow = getDubaiNow();
    const day = dubaiNow.getDay();
    const schedule = TIMETABLE[day];

    if (!schedule) return message.reply("No classes today!");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📅 10J Schedule (${useIST ? 'IST' : 'GST'})`)
      .setDescription(schedule.map(p => {
          let timeStr = `${p.start} - ${p.end}`;
          if (useIST) {
              // Simple math: GST + 1.5 hours = IST
              const [h, m] = p.start.split(':').map(Number);
              let totalM = h * 60 + m + 90;
              let istH = Math.floor(totalM / 60) % 24;
              let istM = totalM % 60;
              timeStr = `${istH.toString().padStart(2, '0')}:${istM.toString().padStart(2, '0')} IST`;
          }
          const periodId = `${day}-${p.name}`;
          const tea = sessionData.teachers[periodId] ? ` | 🧑‍🏫 ${sessionData.teachers[periodId]}` : "";
          const pro = sessionData.proxies.has(periodId) ? " | ⚠️ PROXY" : "";
          return `**${timeStr}**: ${p.name}${tea}${pro}`;
      }).join('\n'));

    message.reply({ embeds: [embed] });
  }

  // 3. PERIOD TRACKING COMMANDS
  if (command === '/period') {
    const current = getCurrentPeriod();
    if (!current) return message.reply("No active period right now.");
    const periodId = `${current.day}-${current.name}`;
    const teacher = sessionData.teachers[periodId] || "Not marked";
    const proxy = sessionData.proxies.has(periodId) ? " (Proxy)" : "";
    message.reply(`📍 **Current Period:** ${current.name}\n🧑‍🏫 **Teacher:** ${teacher}${proxy}\n⏰ **Ends at:** ${current.end} GST`);
  }

  if (command === '/teacher') {
    const current = getCurrentPeriod();
    if (!current) return message.reply("You can only mark a teacher during a class!");
    const teacherName = args.slice(1).join(' ');
    if (!teacherName) return message.reply("Usage: `/teacher [Name]`");
    
    sessionData.teachers[`${current.day}-${current.name}`] = teacherName;
    message.reply(`✅ Marked **${teacherName}** for the ${current.name} period.`);
  }

  if (command === '/proxy') {
    const current = getCurrentPeriod();
    if (!current) return message.reply("No active period to mark as proxy.");
    const periodId = `${current.day}-${current.name}`;
    sessionData.proxies.add(periodId);
    message.reply(`⚠️ The current ${current.name} period is now marked as a **PROXY**.`);
  }
});

// Render Health Check
const server = http.createServer((req, res) => { res.writeHead(200); res.end('Online'); });
server.listen(process.env.PORT || 10000, '0.0.0.0');

client.login(process.env.DISCORD_TOKEN);
