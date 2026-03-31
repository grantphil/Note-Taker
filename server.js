const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN || '*';
const openAiApiKey = process.env.OPENAI_API_KEY || '';
const hasApiKey = Boolean(openAiApiKey);
const transcriptionModel = process.env.TRANSCRIPTION_MODEL || 'whisper-1';

if (!hasApiKey) {
  // eslint-disable-next-line no-console
  console.warn('OPENAI_API_KEY is not set. Transcription and summarization will fail.');
}

const client = new OpenAI({ apiKey: openAiApiKey });

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: hasApiKey
  });
});

function ensureApiKey(res) {
  if (hasApiKey) {
    return true;
  }

  res.status(503).json({
    error: 'OPENAI_API_KEY is missing on the backend server.',
    details: 'Set OPENAI_API_KEY in your backend environment and restart the server.'
  });

  return false;
}

async function transcribeBuffer(buffer, filename, mimetype) {
  const file = new File([buffer], filename || 'meeting.webm', {
    type: mimetype || 'audio/webm'
  });

  try {
    return await client.audio.transcriptions.create({
      file,
      model: transcriptionModel
    });
  } catch (primaryError) {
    if (transcriptionModel !== 'whisper-1') {
      return client.audio.transcriptions.create({
        file,
        model: 'whisper-1'
      });
    }

    throw primaryError;
  }
}

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!ensureApiKey(res)) {
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    const transcript = await transcribeBuffer(
      req.file.buffer,
      req.file.originalname || 'meeting.webm',
      req.file.mimetype || 'audio/webm'
    );

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

app.post('/api/transcribe-chunk', upload.single('audio'), async (req, res) => {
  try {
    if (!ensureApiKey(res)) {
      return;
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio chunk uploaded.' });
    }

    const transcript = await transcribeBuffer(
      req.file.buffer,
      req.file.originalname || 'chunk.webm',
      req.file.mimetype || 'audio/webm'
    );

    return res.json({
      chunkTranscript: transcript.text,
      sequence: req.body?.sequence || null
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({
      error: 'Failed to transcribe audio chunk.',
      details: error?.message || 'Unknown error'
    });
  }
});

app.post('/api/summarize', async (req, res) => {
  try {
    if (!ensureApiKey(res)) {
      return;
    }

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
