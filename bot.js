require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, Events } = require('discord.js');
const { AssemblyAI } = require('assemblyai');
const fs = require('fs');
const path = require('path');
const { generateNotesPDF } = require('./pdfGenerator');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const aaiClient = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

async function handleAudio(message, attachment) {
  const processingMsg = await message.reply("⏳ Processing audio... (Step 1/3: Transcribing)");

  try {
    // 1. Transcribe with AssemblyAI
    const transcript = await aaiClient.transcripts.transcribe({ audio: attachment.url });
    
    await processingMsg.edit("⏳ Generating notes... (Step 2/3)");
    // 2. Generate Notes via Gemini (or AssemblyAI LeMUR)
    const notesMarkdown = await generateNotes(transcript.text);

    await processingMsg.edit("⏳ Creating PDF... (Step 3/3)");
    const pdfPath = path.join(__dirname, `notes_${Date.now()}.pdf`);
    await generateNotesPDF({
      subject: "Class Notes",
      time: "Current Session",
      date: new Date().toLocaleDateString(),
      notesMarkdown,
      pdfPath,
    });

    // 3. Send Files
    const pdf = new AttachmentBuilder(pdfPath);
    await message.channel.send({ content: "✅ Notes Ready!", files: [pdf] });
    fs.unlinkSync(pdfPath);
    await processingMsg.delete();
  } catch (err) {
    console.error(err);
    await processingMsg.edit("❌ Error processing audio.");
  }
}

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot) return;
  const audio = msg.attachments.find(a => /\.(mp3|wav|m4a)$/i.test(a.name));
  if (audio) await handleAudio(msg, audio);
});

client.login(process.env.DISCORD_TOKEN);
