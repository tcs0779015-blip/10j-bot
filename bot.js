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

// Initialize AssemblyAI
const aai = new AssemblyAI({ 
  apiKey: process.env.ASSEMBLYAI_API_KEY 
});

// Timetable synced to Dubai School Hours
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
  2: [ // Tuesday (Add your Tuesday subjects here)
    { name: 'Math',         start: '09:25', end: '10:05' },
    { name: 'Physics',      start: '10:10', end: '10:50' },
    { name: 'Chemistry',    start: '11:00', end: '11:40' }
  ],
  3: [ // Wednesday (Add subjects here)
    { name: 'Wednesday Class', start: '09:25', end: '10:05' }
  ],
  4: [ // Thursday (Add subjects here)
    { name: 'Thursday Class', start: '09:25', end: '10:05' }
  ]
};

// Helper: Always gets current period based on Dubai Time
function getCurrentPeriod() {
  const dubaiTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"});
  const now = new Date(dubaiTime);
  
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;
  const day = now.getDay();
  
  if (!TIMETABLE[day]) return null;
  return TIMETABLE[day].find(p => currentTime >= p.start && currentTime <= p.end) || null;
}

client.once(Events.ClientReady, () => {
  console.log(`✅ 10J Bot is live. System Time: ${new Date().toString()}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  
  if (audio) {
    const current = getCurrentPeriod();
    const subjectName = current ? current.name : "Extra-Curricular / General";
    
    const statusMsg = await message.reply(`🎙️ **Processing ${subjectName}...**\nTranscribing with AssemblyAI...`);

    try {
      const transcript = await aai.transcripts.transcribe({ audio: audio.url });
      await statusMsg.edit("📝 **Transcription complete!**\nGenerating PDF...");

      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      
      // PDF Timestamps are generated in IST for you
      await generateNotesPDF({
        subject: subjectName,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
        notesMarkdown: transcript.text || "No speech detected.",
        pdfPath
      });

      const file = new AttachmentBuilder(pdfPath);
      await message.reply({ 
        content: `✅ **Notes for ${subjectName}**\nGenerated at: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (IST)`, 
        files: [file] 
      });

      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await statusMsg.delete();

    } catch (err) {
      console.error("Transcription Error:", err);
      await statusMsg.edit("❌ **Error processing audio.** Make sure AssemblyAI API key is valid.");
    }
  }

  if (message.content === '/timetable') {
    const dubaiTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Dubai"});
    const now = new Date(dubaiTime);
    const day = now.getDay();
    const todaySchedule = TIMETABLE[day];

    if (!todaySchedule) return message.reply("No classes scheduled for today in Dubai!");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📅 Today's Schedule (Dubai School Time)`)
      .setDescription(todaySchedule.map(p => `**${p.start} - ${p.end}**: ${p.name}`).join('\n'))
      .setFooter({ text: 'Times are shown in Dubai Local Time (GST)' });

    message.reply({ embeds: [embed] });
  }
});

// --- RENDER PORT BINDING ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('10J Bot Status: Online\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Health check server listening on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
