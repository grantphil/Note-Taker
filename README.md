# Note-Taker

A lightweight web app for capturing meeting audio on your PC, transcribing it with OpenAI, and producing polished account-manager/project-manager style notes that are easy to paste into an email.

## Features

- Record microphone audio during live calls.
- Optional attempt to capture system/tab audio (browser permission required).
- One-click transcription of recorded audio.
- AI-generated structured notes with:
  - Meeting snapshot
  - Key topics
  - Decisions
  - Action items with owners and due dates
  - Risks/blockers
  - Open questions
  - Follow-up email draft
- Copy generated notes directly to clipboard.

## Requirements

- Node.js 18+
- An OpenAI API key
- A modern Chromium-based browser for best recording compatibility

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env file and add your API key:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env`:
   ```bash
   OPENAI_API_KEY=your_key_here
   PORT=3000
   ```
4. Start the app:
   ```bash
   npm start
   ```
5. Open `http://localhost:3000`.

## Usage

1. Enter optional meeting context (participants, customer, objective).
2. Click **Start Recording**.
3. If you need system audio, enable the checkbox before recording and allow screen/tab audio when prompted.
4. Click **Stop Recording** when the meeting or section ends.
5. Click **Transcribe Recording**.
6. Review/edit transcript.
7. Click **Generate Meeting Notes**.
8. Click **Copy Notes** and paste into your email.

## Notes on Teams audio capture

Browsers generally capture your microphone reliably. Capturing all Teams audio depends on OS/browser permissions and whether the browser exposes system audio from screen/tab share. If system audio is unavailable, use a virtual audio device or ensure Teams audio is routed to an input source the browser can access.

## Security

- API calls are proxied through the backend (`/api/transcribe`, `/api/summarize`), so your API key stays server-side.
- Do not commit your `.env` file.
