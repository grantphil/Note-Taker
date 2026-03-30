const express = require('express');
const multer = require('multer');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = process.env.PORT || 3000;

if (!process.env.OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('OPENAI_API_KEY is not set. API routes will fail until configured.');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const file = new File([req.file.buffer], req.file.originalname || 'meeting.webm', {
      type: req.file.mimetype || 'audio/webm'
    });

    const transcript = await client.audio.transcriptions.create({
      file,
      model: 'gpt-4o-mini-transcribe'
    });

    return res.json({ transcript: transcript.text });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      error: 'Failed to transcribe audio.',
      details: error?.message || 'Unknown error'
    });
  }
});

app.post('/api/summarize', async (req, res) => {
  try {
    const { transcript, meetingContext } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required.' });
    }

    const prompt = `You are an expert Account Manager and Project Manager note taker.

Create polished, concise, and highly actionable call notes from the transcript.

Output in Markdown with these sections exactly:
1) Meeting Snapshot
   - Date/Time (if known)
   - Participants (best effort)
   - Objective
2) Key Discussion Topics (use clear subheadings)
3) Decisions Made
4) Action Items (table with columns: Item | Owner | Due Date | Priority | Status)
5) Risks / Blockers
6) Open Questions
7) Follow-Up Email Draft

Instructions:
- Resolve unclear references where possible.
- Highlight ownership explicitly; if unknown, write "Unassigned".
- Keep language professional and easy to paste into an email.
- Preserve important technical/commercial detail.
- If due dates are missing, label as "TBD".
- Include bullet points for readability.

Meeting Context from user:
${meetingContext || 'No additional context provided.'}

Transcript:
${transcript}`;

    const completion = await client.responses.create({
      model: 'gpt-4.1-mini',
      input: prompt
    });

    const summary = completion.output_text?.trim();

    return res.json({
      notes: summary || 'No summary returned. Please retry.'
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      error: 'Failed to summarize transcript.',
      details: error?.message || 'Unknown error'
    });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Note-Taker app listening at http://localhost:${port}`);
});
