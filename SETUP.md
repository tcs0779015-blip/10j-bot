# 🤖 Class 10J Bot — Complete Setup Guide

Everything is free. Setup takes about 20–30 minutes.
Follow every step carefully.

---

## WHAT YOU'LL GET

- Bot auto-posts a period card at the start of every class (IST)
- You upload an audio file after class → bot automatically:
  1. Transcribes it using OpenAI Whisper (handles Indian English accent)
  2. Sends transcript to Claude AI for structured notes
  3. Generates a formatted PDF and posts it in Discord
- `/proxy` marks a period as empty
- `/teacher Mr. Khan` logs who joined
- `/timetable` shows today's schedule

---

## PART 1 — GET YOUR API KEYS (All Free)

### Step 1.1 — Discord Bot Token

1. Go to https://discord.com/developers/applications
2. Click **New Application** → name it `10J Bot` → click Create
3. In the left menu click **Bot**
4. Click **Reset Token** → Copy the token → save it somewhere safe
5. Scroll down to **Privileged Gateway Intents**
6. Turn ON: **Server Members Intent** and **Message Content Intent**
7. Click **Save Changes**
8. Now go to **OAuth2 → URL Generator** in the left menu
9. Under Scopes tick: `bot`
10. Under Bot Permissions tick: `Send Messages`, `Read Messages/View Channels`,
    `Embed Links`, `Attach Files`, `Read Message History`
11. Copy the URL at the bottom → open it in browser → add bot to your server

### Step 1.2 — Get Your Channel ID

1. Open Discord
2. Go to **Settings → Advanced → turn on Developer Mode**
3. Right-click the channel you want the bot to use
4. Click **Copy Channel ID** → save it

### Step 1.3 — OpenAI API Key (for Whisper transcription)

1. Go to https://platform.openai.com/signup
2. Sign up with email (NO credit card needed for free $5 credit)
3. Once logged in go to https://platform.openai.com/api-keys
4. Click **Create new secret key** → name it `10J Bot`
5. Copy the key (starts with `sk-...`) → save it

> 💡 The $5 free credit = ~833 minutes of transcription.
> A 40-min class costs about ₹20. You won't run out for weeks.

### Step 1.4 — Google Gemini API Key (for AI notes — FREE, no credit card)

1. Go to https://aistudio.google.com
2. Sign in with your Google account
3. Click **Get API Key** (top left)
4. Click **Create API key** → select **Create API key in new project**
5. Copy the key → save it

> 💡 Gemini 2.5 Flash-Lite is completely free — 1,000 requests/day, no credit card.
> You'll use maybe 5-6 per day. This will never run out.

---

## PART 2 — PUT THE FILES ON GITHUB

You need a GitHub account. It's free.

1. Go to https://github.com and sign up if you don't have an account
2. Click **+** (top right) → **New repository**
3. Name it `10j-bot` → set to **Private** → click **Create repository**
4. You'll see a page with instructions. Click **uploading an existing file**
5. Upload ALL 6 files:
   - `bot.js`
   - `pdfGenerator.js`
   - `make_pdf.py`
   - `package.json`
   - `requirements.txt`
   - `nixpacks.toml`
6. Click **Commit changes**

---

## PART 3 — DEPLOY ON RAILWAY (Free, Runs 24/7)

1. Go to https://railway.app
2. Click **Login with GitHub** → authorize Railway
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your `10j-bot` repository
5. Railway will detect it and start building

### Add Environment Variables

6. Click on your project → click the service box
7. Go to the **Variables** tab
8. Add these one by one (click **+ New Variable** each time):

| Variable Name       | Value                          |
|---------------------|--------------------------------|
| `DISCORD_TOKEN`     | your Discord bot token         |
| `CHANNEL_ID`        | your Discord channel ID        |
| `OPENAI_API_KEY`    | your OpenAI key (sk-...)       |
| `GEMINI_API_KEY`    | your Gemini API key            |

9. After adding all 4, click **Deploy** (or it auto-deploys)

### Check it's running

10. Go to the **Logs** tab
11. You should see:
    ```
    ✅ Logged in as 10J Bot#1234
    ✅ All period cards scheduled (IST)
    ```

If you see errors, double check your variable names are exactly as shown above.

---

## PART 4 — RECORD AUDIO ON YOUR FRIEND'S LAPTOP

### Install the browser

1. Download **Microsoft Edge** (lighter than Chrome on 4GB RAM)
   → https://www.microsoft.com/edge
2. Open Edge → go to Google Meet as normal

### Record the class audio

**Option A — Use Edge's built-in tab audio recording:**
1. Join Google Meet in Edge
2. Press **F12** (DevTools) → Console tab
3. (This is optional — see Option B below)

**Option B — Simplest method (recommended):**
1. Install this free Chrome/Edge extension:
   **"Record, Transcribe & ChatGPT for Google Meet"**
   → Search it in the Edge Add-ons store (Edge supports Chrome extensions)
2. Join your Meet class
3. Click the extension → click **Record**
4. After class → click **Stop** → **Download audio**
5. You'll get an `.mp3` or `.webm` file

**Option C — If the extension doesn't work:**
Use **Audacity** (free, very light):
1. Download from https://www.audacityteam.org
2. Set recording source to "Stereo Mix" or "What U Hear"
3. Press record when class starts, stop when it ends
4. File → Export → Export as MP3

---

## PART 5 — USING THE BOT

### At the start of each period
The bot automatically posts a period card. Nothing to do.

### During class
- If teacher joins → type `/teacher Mr. Khan` (use actual name)
- If no teacher → type `/proxy` after the period starts

### After a notes-required period (SST, Physics, Chemistry, Biology)
1. Take the audio file from your friend's laptop
2. Send it to your phone via WhatsApp/Telegram/USB
3. Open Discord on your tablet
4. Go to the class channel
5. Upload the audio file (drag and drop or attach)
6. The bot automatically:
   - Downloads the file
   - Sends to Whisper for transcription
   - Sends transcript to Claude for notes
   - Posts a PDF + transcript in the channel
   - Updates the period card

### After a Math period
Same process — but Claude generates a short summary instead of full notes.

### Commands
| Command | What it does |
|---|---|
| Upload audio file | Triggers full notes pipeline automatically |
| `/teacher [name]` | Log teacher attendance |
| `/proxy` | Mark period as empty |
| `/timetable` | Show today's schedule |
| `/help` | Show all commands |

---

## TROUBLESHOOTING

**Bot not posting period cards?**
→ Check the CHANNEL_ID is correct
→ Check logs on Railway for errors

**Audio upload does nothing?**
→ Make sure the file ends in .mp3 / .m4a / .wav / .webm / .ogg
→ Make sure the file is under 25MB (about 2.5 hours of audio)

**"Error processing audio"?**
→ Check your OPENAI_API_KEY is correct
→ Check you still have API credits at https://platform.openai.com/usage

**Notes seem wrong / missing content?**
→ The teacher's accent may have confused Whisper in parts
→ You can read the raw `_Transcript.txt` file to see what was captured
→ Over time Whisper handles Indian accents reasonably well for classroom speech

**Railway free tier limits?**
→ Railway free tier gives $5/month credit which is more than enough for a bot
   that mostly just waits and schedules jobs

---

## COST SUMMARY

| Service | Cost |
|---|---|
| Discord bot | Free forever |
| Railway hosting | Free ($5/month credit, bot uses ~$0.50) |
| OpenAI Whisper | Free for first 833 minutes, then ~₹0.50/period |
| Google Gemini (notes) | Free forever (1000 requests/day, no card) |
| **Total** | **Free for weeks, then pennies just for Whisper** |
