require('dotenv').config();
const {
  Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder, Events
} = require('discord.js');
const schedule = require('node-schedule');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { generateNotesPDF } = require('./pdfGenerator');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('10J Bot is running! 🚀');
});

app.listen(port, () => {
  console.log(`Web server listening on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CHANNEL_ID    = process.env.CHANNEL_ID;
const OPENAI_KEY    = process.env.OPENAI_API_KEY;
// GEMINI_API_KEY is read inline in generateNotes()

// ─── TIMETABLE ────────────────────────────────────────────────────────────────
// dayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
const TIMETABLE = {
  1: [ // Monday
    { name: 'Zero Period',  start: '09:25', end: '09:40', notes: false },
    { name: 'IT',           start: '09:40', end: '10:20', notes: false },
    { name: 'SST',          start: '10:25', end: '11:05', notes: true  },
    { name: 'Biology',      start: '11:15', end: '11:55', notes: true  },
    { name: 'SST',          start: '11:55', end: '12:35', notes: true  },
    { name: 'English',      start: '12:55', end: '13:35', notes: false },
    { name: 'Islamic/M.Sc', start: '13:35', end: '14:15', notes: false },
    { name: '2nd Language', start: '14:20', end: '15:00', notes: false },
  ],
  2: [ // Tuesday
    { name: 'Zero Period',  start: '09:25', end: '09:40', notes: false },
    { name: 'SST',          start: '09:40', end: '10:20', notes: true  },
    { name: '2nd Language', start: '10:25', end: '11:05', notes: false },
    { name: 'IT',           start: '11:15', end: '11:55', notes: false },
    { name: 'Chemistry',    start: '11:55', end: '12:35', notes: true  },
    { name: 'Islamic/M.Sc', start: '12:55', end: '13:35', notes: false },
    { name: 'SST',          start: '13:35', end: '14:15', notes: true  },
    { name: 'Math',         start: '14:20', end: '15:00', notes: 'summary' },
  ],
  3: [ // Wednesday
    { name: 'Zero Period',  start: '09:25', end: '09:40', notes: false },
    { name: 'Math',         start: '09:40', end: '10:20', notes: 'summary' },
    { name: 'Islamic/M.Sc', start: '10:25', end: '11:05', notes: false },
    { name: 'English',      start: '11:15', end: '11:55', notes: false },
    { name: '2nd Language', start: '11:55', end: '12:35', notes: false },
    { name: 'Math',         start: '12:55', end: '13:35', notes: 'summary' },
    { name: 'Reading',      start: '13:35', end: '14:15', notes: false },
    { name: 'Physics',      start: '14:20', end: '15:00', notes: true  },
  ],
  4: [ // Thursday
    { name: 'Zero Period',  start: '09:25', end: '09:40', notes: false },
    { name: 'SST',          start: '09:40', end: '10:20', notes: true  },
    { name: 'Chemistry',    start: '10:25', end: '11:05', notes: true  },
    { name: 'Math',         start: '11:15', end: '11:55', notes: 'summary' },
    { name: '2nd Language', start: '11:55', end: '12:35', notes: false },
    { name: 'Biology',      start: '12:55', end: '13:35', notes: true  },
    { name: 'English',      start: '13:35', end: '14:15', notes: false },
    { name: 'HPE',          start: '14:20', end: '15:00', notes: false },
  ],
  5: [ // Friday
    { name: 'English',      start: '09:30', end: '10:00', notes: false },
    { name: 'Physics',      start: '10:00', end: '10:30', notes: true  },
    { name: 'Math',         start: '10:30', end: '11:00', notes: 'summary' },
    { name: 'Biology',      start: '11:10', end: '11:40', notes: true  },
    { name: '2nd Language', start: '11:40', end: '12:10', notes: false },
    { name: 'Math',         start: '12:10', end: '12:40', notes: 'summary' },
    { name: 'English',      start: '12:40', end: '13:10', notes: false },
  ],
};

const SUBJECT_COLORS = {
  'SST':            0xE74C3C,
  'Math':           0x3498DB,
  'IT':             0x2ECC71,
  'Biology':        0x27AE60,
  'Chemistry':      0x9B59B6,
  'Physics':        0xF39C12,
  'English':        0x1ABC9C,
  'Islamic/M.Sc':   0xE67E22,
  '2nd Language':   0xEC407A,
  'Reading':        0x00BCD4,
  'HPE':            0xFF5722,
  'Zero Period':    0x607D8B,
};

const SUBJECT_EMOJIS = {
  'SST':            '🌍',
  'Math':           '📐',
  'IT':             '💻',
  'Biology':        '🧬',
  'Chemistry':      '⚗️',
  'Physics':        '⚡',
  'English':        '📖',
  'Islamic/M.Sc':   '📿',
  '2nd Language':   '🗣️',
  'Reading':        '📚',
  'HPE':            '🏃',
  'Zero Period':    '🌅',
};

// ─── STATE ────────────────────────────────────────────────────────────────────
// key: "dayNum-subject-start" → { messageId, period, status, teacherName, notes }
const periodState = {};

function getISTNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
}

function getPeriodKey(dayNum, name, start) {
  return `${dayNum}-${name}-${start}`;
}

function findActivePeriod() {
  const ist = getISTNow();
  const dayNum = ist.getDay();
  const hhmm = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;
  const periods = TIMETABLE[dayNum];
  if (!periods) return null;
  for (const p of periods) {
    if (hhmm >= p.start && hhmm < p.end) {
      return { key: getPeriodKey(dayNum, p.name, p.start), period: p, dayNum };
    }
  }
  return null;
}

// ─── POST PERIOD CARD ─────────────────────────────────────────────────────────
async function postPeriodCard(period, dayNum) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;

  const key = getPeriodKey(dayNum, period.name, period.start);
  const emoji = SUBJECT_EMOJIS[period.name] || '📋';
  const color = SUBJECT_COLORS[period.name] || 0x95A5A6;

  let notesHint = '';
  if (period.notes === true) notesHint = '📎 Upload audio after class for full notes + PDF';
  else if (period.notes === 'summary') notesHint = '📎 Upload audio after class for a summary';
  else notesHint = 'No notes needed for this period';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji}  ${period.name.toUpperCase()}`)
    .setDescription(`**${period.start} – ${period.end} IST**`)
    .addFields(
      { name: '👤 Teacher',  value: '⏳ Not yet logged', inline: true },
      { name: '📋 Status',   value: '🟡 In Progress',   inline: true },
      { name: '📝 Notes',    value: notesHint,           inline: false },
    )
    .setFooter({ text: 'Class 10J • New Indian Model School • Type /help for commands' })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });
  periodState[key] = {
    messageId: msg.id,
    period,
    dayNum,
    status: 'ongoing',
    teacherName: null,
    notesPosted: false,
  };
  console.log(`📌 Period card posted: ${period.name} (${period.start})`);
}

// ─── UPDATE PERIOD CARD ───────────────────────────────────────────────────────
async function updatePeriodCard(key) {
  const state = periodState[key];
  if (!state) return;
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) return;
  const msg = await channel.messages.fetch(state.messageId).catch(() => null);
  if (!msg) return;

  const { period, status, teacherName, notesPosted } = state;
  const emoji = SUBJECT_EMOJIS[period.name] || '📋';
  const color = status === 'proxy' ? 0x95A5A6 : (SUBJECT_COLORS[period.name] || 0x95A5A6);

  const statusText = status === 'proxy'   ? '🔴 Proxy / Empty Class'
                   : status === 'done'    ? '✅ Completed'
                   :                        '🟡 In Progress';

  const teacherText = status === 'proxy'  ? '❌ Did not join'
                    : teacherName         ? `✅ ${teacherName}`
                    :                       '⏳ Not yet logged';

  let notesText = notesPosted ? '✅ Notes PDF posted below' : 'Awaiting audio upload...';
  if (status === 'proxy') notesText = '—';
  if (!period.notes) notesText = 'Not required for this period';

  const titleSuffix = status === 'proxy' ? '  *(Proxy)*' : '';

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${emoji}  ${period.name.toUpperCase()}${titleSuffix}`)
    .setDescription(`**${period.start} – ${period.end} IST**`)
    .addFields(
      { name: '👤 Teacher', value: teacherText, inline: true },
      { name: '📋 Status',  value: statusText,  inline: true },
      { name: '📝 Notes',   value: notesText,   inline: false },
    )
    .setFooter({ text: 'Class 10J • New Indian Model School' })
    .setTimestamp();

  await msg.edit({ embeds: [embed] });
}

// ─── TRANSCRIBE WITH WHISPER ──────────────────────────────────────────────────
async function transcribeAudio(filePath) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('model', 'whisper-1');
  form.append('language', 'en');

  const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
    headers: { ...form.getHeaders(), Authorization: `Bearer ${OPENAI_KEY}` },
    maxBodyLength: Infinity,
  });
  return res.data.text;
}

// ─── GENERATE NOTES WITH GEMINI (FREE TIER) ───────────────────────────────────
async function generateNotes(transcript, subjectName, notesType) {
  const isFullNotes = notesType === true;

  const prompt = isFullNotes
    ? `You are a student note-taker for Class 10. Below is a transcript of a ${subjectName} class.

Generate detailed, well-structured class notes including:
- **Main Topics Covered** (as headings)
- **Key Points** under each topic (bullet points)
- **Important Dates, Names, Events** (if any — especially for SST)
- **Processes / Steps / Reactions** (especially for Chemistry, Biology, Physics)
- **Definitions** of any new terms
- **Summary** at the end (3-5 lines)

Keep language simple and clear, suitable for a Class 10 student.
Format using Markdown.

TRANSCRIPT:
${transcript}`

    : `You are a student note-taker for Class 10. Below is a transcript of a ${subjectName} class.

Generate a concise summary including:
- **Topics Covered** (brief list)
- **Key Concepts** (2-4 bullet points)
- **What to Review** (1-2 lines)

Keep it short — this is just a quick summary.
Format using Markdown.

TRANSCRIPT:
${transcript}`;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 2000 }
    },
    { headers: { 'Content-Type': 'application/json' } }
  );

  return res.data.candidates[0].content.parts[0].text;
}

// ─── HANDLE AUDIO UPLOAD ──────────────────────────────────────────────────────
async function handleAudioUpload(message, attachment) {
  const active = findActivePeriod();
  const channel = message.channel;

  // Try to match to a recent period (within last 2 hours) if no active period
  let key, period, dayNum;
  if (active) {
    key = active.key; period = active.period; dayNum = active.dayNum;
  } else {
    // Find last period of today
    const ist = getISTNow();
    const d = ist.getDay();
    const periods = TIMETABLE[d];
    if (!periods) return channel.send('❌ No periods found for today.');
    const hhmm = `${String(ist.getHours()).padStart(2,'0')}:${String(ist.getMinutes()).padStart(2,'0')}`;
    // get last period that already ended
    const past = periods.filter(p => p.end <= hhmm);
    if (!past.length) return channel.send('❌ Could not match audio to a period.');
    period = past[past.length - 1];
    dayNum = d;
    key = getPeriodKey(d, period.name, period.start);
  }

  if (!period.notes) {
    return channel.send(`ℹ️ **${period.name}** doesn't need notes. If this is the wrong period, let me know.`);
  }

  const processingMsg = await channel.send(`⏳ Processing audio for **${period.name}**...\n\`Step 1/3\` Downloading audio...`);

  // Download audio
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  const ext = attachment.name.split('.').pop() || 'mp3';
  const tmpFile = path.join(tmpDir, `audio_${Date.now()}.${ext}`);

  try {
    const audioRes = await axios.get(attachment.url, { responseType: 'arraybuffer' });
    fs.writeFileSync(tmpFile, Buffer.from(audioRes.data));

    await processingMsg.edit(`⏳ Processing audio for **${period.name}**...\n\`Step 2/3\` Transcribing with Whisper (Indian accent optimised)...`);

    // Transcribe
    const transcript = await transcribeAudio(tmpFile);
    fs.unlinkSync(tmpFile); // clean up

    await processingMsg.edit(`⏳ Processing audio for **${period.name}**...\n\`Step 3/3\` Generating notes with Claude AI...`);

    // Generate notes
    const notesMarkdown = await generateNotes(transcript, period.name, period.notes);

    // Generate PDF
    const pdfPath = path.join(tmpDir, `notes_${period.name}_${Date.now()}.pdf`);
    await generateNotesPDF({
      subject: period.name,
      time: `${period.start} – ${period.end} IST`,
      date: getISTNow().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      notesMarkdown,
      pdfPath,
    });

    // Post to Discord
    const pdfAttachment = new AttachmentBuilder(pdfPath, { name: `${period.name}_Notes.pdf` });
    const transcriptAttachment = new AttachmentBuilder(
      Buffer.from(transcript, 'utf8'),
      { name: `${period.name}_Transcript.txt` }
    );

    await processingMsg.delete().catch(() => {});

    const emoji = SUBJECT_EMOJIS[period.name] || '📋';
    const color = SUBJECT_COLORS[period.name] || 0x95A5A6;

    // Post summary embed
    const summaryLines = notesMarkdown.split('\n').slice(0, 12).join('\n');
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${emoji} ${period.name} — Notes Ready`)
      .setDescription(`\`\`\`\n${summaryLines.replace(/[*#`]/g, '').trim()}\n...\`\`\``)
      .addFields(
        { name: '📄 Files', value: '• `Notes PDF` — full formatted notes\n• `Transcript TXT` — raw Whisper transcript', inline: false }
      )
      .setFooter({ text: 'Class 10J • New Indian Model School' })
      .setTimestamp();

    await channel.send({ embeds: [embed], files: [pdfAttachment, transcriptAttachment] });

    // Clean up PDF
    fs.unlinkSync(pdfPath);

    // Update period card
    if (periodState[key]) {
      periodState[key].notesPosted = true;
      periodState[key].status = 'done';
      await updatePeriodCard(key);
    }

  } catch (err) {
    console.error('Audio processing error:', err.response?.data || err.message);
    fs.existsSync(tmpFile) && fs.unlinkSync(tmpFile);
    await processingMsg.edit(`❌ Error processing audio: ${err.response?.data?.error?.message || err.message}\n\nMake sure the audio file is under 25MB.`);
  }
}

// ─── MESSAGE HANDLER ──────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== CHANNEL_ID) return;

  const content = message.content.trim();

  // Audio file uploaded?
  const audioAttachment = message.attachments.find(a =>
    /\.(mp3|mp4|m4a|wav|ogg|webm|flac|aac)$/i.test(a.name)
  );
  if (audioAttachment) {
    return handleAudioUpload(message, audioAttachment);
  }

  // /proxy
  if (content.toLowerCase() === '/proxy') {
    const active = findActivePeriod();
    if (!active) return message.reply('❌ No active period right now.');
    if (!periodState[active.key]) {
      periodState[active.key] = { messageId: null, period: active.period, dayNum: active.dayNum, status: 'proxy', teacherName: null, notesPosted: false };
    }
    periodState[active.key].status = 'proxy';
    await updatePeriodCard(active.key);
    return message.reply(`🔴 **${active.period.name}** marked as Proxy / Empty class.`);
  }

  // /teacher [name]
  if (content.toLowerCase().startsWith('/teacher')) {
    const name = content.slice(8).trim() || 'Teacher';
    const active = findActivePeriod();
    if (!active) return message.reply('❌ No active period right now.');
    if (!periodState[active.key]) {
      periodState[active.key] = { messageId: null, period: active.period, dayNum: active.dayNum, status: 'ongoing', teacherName: name, notesPosted: false };
    }
    periodState[active.key].teacherName = name;
    await updatePeriodCard(active.key);
    return message.reply(`✅ Logged **${name}** as present for **${active.period.name}**.`);
  }

  // /timetable
  if (content.toLowerCase() === '/timetable') {
    const ist = getISTNow();
    const dayNum = ist.getDay();
    const periods = TIMETABLE[dayNum];
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    if (!periods) return message.reply('📅 No classes today!');
    const lines = periods.map(p => {
      const emoji = SUBJECT_EMOJIS[p.name] || '📋';
      const tag = p.notes === true ? ' *(notes)*' : p.notes === 'summary' ? ' *(summary)*' : '';
      return `${emoji} **${p.name}**${tag} — ${p.start}–${p.end}`;
    }).join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📅 Today's Timetable — ${dayNames[dayNum]}`)
      .setDescription(lines)
      .setFooter({ text: 'Class 10J • Times in IST' });
    return message.reply({ embeds: [embed] });
  }

  // /help
  if (content.toLowerCase() === '/help') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🤖 10J Bot — Commands')
      .addFields(
        { name: '🎵 Upload audio file',    value: 'Just drag & drop any `.mp3 .m4a .wav` etc. — bot auto-detects the period and processes it', inline: false },
        { name: '/teacher [name]',          value: 'Log who joined this period (e.g. `/teacher Mr. Khan`)', inline: false },
        { name: '/proxy',                   value: 'Mark current period as proxy / empty class', inline: false },
        { name: '/timetable',               value: 'Show today\'s full schedule', inline: false },
        { name: '/help',                    value: 'Show this message', inline: false },
      )
      .setFooter({ text: 'Class 10J • New Indian Model School' });
    return message.reply({ embeds: [embed] });
  }
});

// ─── SCHEDULE ALL PERIOD CARDS ────────────────────────────────────────────────
function scheduleAllPeriods() {
  for (const [dayStr, periods] of Object.entries(TIMETABLE)) {
    const dayNum = parseInt(dayStr);
    for (const period of periods) {
      const [hour, minute] = period.start.split(':').map(Number);
      schedule.scheduleJob(
        { hour, minute, dayOfWeek: dayNum, tz: 'Asia/Kolkata' },
        () => postPeriodCard(period, dayNum)
      );
    }
  }
  console.log('✅ All period cards scheduled (IST).');
}

// ─── READY ────────────────────────────────────────────────────────────────────
client.once(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  scheduleAllPeriods();
});

client.login(process.env.DISCORD_TOKEN);
