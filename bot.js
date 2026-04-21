require('dotenv').config();
const { 
  Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events 
} = require('discord.js');
const { AssemblyAI } = require('assemblyai'); // AssemblyAI SDK
const schedule = require('node-schedule');
const http = require('http'); // For the Render Port
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

const CHANNEL_ID = process.env.CHANNEL_ID;

const TIMETABLE = {
  1: [ // Monday
    { name: 'Zero Period',  start: '09:25', end: '09:40', notes: false },
    { name: 'IT',           start: '09:40', end: '10:20', notes: false },
    { name: 'SST',          start: '10:25', end: '11:05', notes: true  },
    { name: 'Biology',      start: '11:15', end: '11:55', notes: true  },
    { name: 'SST',          start: '11:55', end: '12:35', notes: true  },
    { name: 'English',      start: '12:55', end: '13:35', notes: false },
    { name: 'Islamic/M.Sc', start: '13:35', end: '14:15', notes: false }
  ],
  // ... Add other days here if needed following the same format
};

// Helper to get current period
function getCurrentPeriod() {
  const now = new Date();
  const day = now.getDay();
  const time = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  if (!TIMETABLE[day]) return null;
  return TIMETABLE[day].find(p => time >= p.start && time <= p.end) || null;
}

client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // Detect Audio Files
  const audio = message.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  
  if (audio) {
    const current = getCurrentPeriod();
    const subjectName = current ? current.name : "Class Notes";
    
    const statusMsg = await message.reply(`🎙️ **10J Bot is processing ${subjectName} audio...**\nTranscribing with AssemblyAI...`);

    try {
      // 1. Transcription via AssemblyAI
      const transcript = await aai.transcripts.transcribe({ audio: audio.url });
      
      await statusMsg.edit("📝 **Transcription complete!**\nGenerating your PDF notes...");

      // 2. Generate PDF
      const pdfPath = path.join(__dirname, `Notes_${Date.now()}.pdf`);
      await generateNotesPDF({
        subject: subjectName,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        notesMarkdown: transcript.text || "No speech detected in audio.",
        pdfPath
      });

      // 3. Upload to Discord
      const file = new AttachmentBuilder(pdfPath);
      await message.reply({ 
        content: `✅ **Here are the notes for ${subjectName}!**`, 
        files: [file] 
      });

      // 4. Cleanup
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      await statusMsg.delete();

    } catch (err) {
      console.error(err);
      await statusMsg.edit("❌ **Error:** AssemblyAI or PDF generator failed.");
    }
  }

  // Basic Commands
  const content = message.content;
  if (content === '/timetable') {
    const now = new Date();
    const day = now.getDay();
    const todaySchedule = TIMETABLE[day];

    if (!todaySchedule) return message.reply("No classes scheduled for today!");

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📅 Today's Schedule (Day ${day})`)
      .setDescription(todaySchedule.map(p => `**${p.start} - ${p.end}**: ${p.name}`).join('\n'))
      .setFooter({ text: 'Class 10J • NIMS' });

    message.reply({ embeds: [embed] });
  }
});

// --- RENDER PORT BINDING (CRITICAL) ---
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('10J Bot Status: Online\n');
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 Health check server listening on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);
