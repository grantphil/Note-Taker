const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const copyBtn = document.getElementById('copyBtn');
const transcriptEl = document.getElementById('transcript');
const notesEl = document.getElementById('notes');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const contextEl = document.getElementById('context');
const captureSystemAudioEl = document.getElementById('captureSystemAudio');

let mediaRecorder;
let mixedStream;
let micStream;
let displayStream;
let chunks = [];
let timerInterval;
let seconds = 0;
let recognition;
let liveTranscriptFinal = '';

function resolveApiBase() {
  const queryValue = new URLSearchParams(window.location.search).get('api_base') || '';
  const configValue = window.NOTE_TAKER_API_BASE || '';
  return (queryValue || configValue).replace(/\/$/, '');
}

const API_BASE = resolveApiBase();

function apiUrl(pathname) {
  return API_BASE ? `${API_BASE}${pathname}` : pathname;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function formatTime(totalSec) {
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerInterval);
  seconds = 0;
  timerEl.textContent = formatTime(seconds);
  timerInterval = setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function formatFetchError(error) {
  const isNetworkError = error instanceof TypeError && error.message.toLowerCase().includes('fetch');
  if (!isNetworkError) {
    return error.message;
  }

  return [
    'Cannot reach transcription API.',
    'If running locally, start backend with npm start and open http://localhost:3000.',
    'If using GitHub Pages, set window.NOTE_TAKER_API_BASE in public/config.js or use ?api_base=https://your-backend.'
  ].join(' ');
}

function parseJsonSafely(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (_error) {
    return null;
  }
}

function formatNonJsonApiError(endpoint, rawText) {
  const sample = (rawText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  return `Received non-JSON response from ${endpoint}. This usually means NOTE_TAKER_API_BASE points to a website/HTML page instead of your backend API. Sample: ${sample}`;
}

async function ensureApiReachable() {
  try {
    const response = await fetch(apiUrl('/api/health'));
    if (!response.ok) {
      return {
        ok: false,
        message: 'Health endpoint is unavailable. Continuing anyway...'
      };
    }

    const rawText = await response.text();
    const health = parseJsonSafely(rawText);

    if (!health) {
      return {
        ok: false,
        message: formatNonJsonApiError('/api/health', rawText)
      };
    }

    if (!health.apiKeyConfigured) {
      throw new Error(
        'Backend is reachable, but OPENAI_API_KEY is missing. Add OPENAI_API_KEY to backend env and restart.'
      );
    }

    return { ok: true };
  } catch (error) {
    const isNetworkError = error instanceof TypeError && error.message.toLowerCase().includes('fetch');

    if (isNetworkError) {
      throw error;
    }

    return {
      ok: false,
      message: error.message
    };
  }
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '';

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        liveTranscriptFinal = `${liveTranscriptFinal} ${text}`.trim();
      } else {
        interim += text;
      }
    }

    transcriptEl.value = `${liveTranscriptFinal} ${interim}`.trim();
  };

  recognition.onerror = () => {
    setStatus('Live browser speech transcription unavailable; final backend transcription will still run.');
  };

  recognition.onend = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      recognition.start();
    }
  };
}

function startSpeechRecognition() {
  if (!recognition) {
    return;
  }

  try {
    recognition.start();
  } catch (_error) {
    // no-op for redundant starts
  }
}

function stopSpeechRecognition() {
  if (!recognition) {
    return;
  }

  recognition.onend = null;

  try {
    recognition.stop();
  } catch (_error) {
    // no-op
  }
}

async function buildMixedStream() {
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(destination);

  if (captureSystemAudioEl.checked) {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const displayAudioTracks = displayStream.getAudioTracks();
    if (displayAudioTracks.length > 0) {
      const displayAudioOnly = new MediaStream(displayAudioTracks);
      const displaySource = audioContext.createMediaStreamSource(displayAudioOnly);
      displaySource.connect(destination);
    }
  }

  return destination.stream;
}

function cleanupStreams() {
  [micStream, displayStream, mixedStream].forEach((stream) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  });
}

async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'meeting.webm');

  const response = await fetch(apiUrl('/api/transcribe'), {
    method: 'POST',
    body: formData
  });

  const rawText = await response.text();
  const data = parseJsonSafely(rawText);

  if (!data) {
    throw new Error(formatNonJsonApiError('/api/transcribe', rawText));
  }

  if (!response.ok) {
    throw new Error(`${data.error || 'Transcription failed'} ${data.details || ''}`.trim());
  }

  return data.transcript || '';
}

async function summarizeTranscript(transcript) {
  const response = await fetch(apiUrl('/api/summarize'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      meetingContext: contextEl.value.trim()
    })
  });

  const rawText = await response.text();
  const data = parseJsonSafely(rawText);

  if (!data) {
    throw new Error(formatNonJsonApiError('/api/summarize', rawText));
  }

  if (!response.ok) {
    throw new Error(`${data.error || 'Summarization failed'} ${data.details || ''}`.trim());
  }

  return data.notes || '';
}

async function processRecording() {
  try {
    setStatus('Checking API connection...');
    const health = await ensureApiReachable();

    if (!health.ok) {
      setStatus(health.message);
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setStatus('Running full transcription from captured audio (mic + desktop)...');
    const audioBlob = new Blob(chunks, { type: 'audio/webm' });
    const transcript = await transcribeAudio(audioBlob);
    transcriptEl.value = transcript;

    setStatus('Generating notes...');
    const notes = await summarizeTranscript(transcript);
    notesEl.textContent = notes;
    copyBtn.disabled = !notes.trim();

    setStatus('Done. Notes ready to copy.');
  } catch (error) {
    console.error(error);
    setStatus(`Processing failed: ${formatFetchError(error)}`);
  } finally {
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

startBtn.addEventListener('click', async () => {
  try {
    chunks = [];
    liveTranscriptFinal = '';
    transcriptEl.value = '';
    notesEl.textContent = '';
    copyBtn.disabled = true;

    mixedStream = await buildMixedStream();
    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stopSpeechRecognition();
      cleanupStreams();
      await processRecording();
    };

    initSpeechRecognition();
    startSpeechRecognition();

    mediaRecorder.start(1000);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus('Recording + live browser transcription...');
    startTimer();
  } catch (error) {
    console.error(error);
    setStatus(`Unable to start recording: ${error.message}`);
    stopSpeechRecognition();
    cleanupStreams();
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

stopBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return;
  }

  setStatus('Stopping recording...');
  mediaRecorder.stop();
  stopBtn.disabled = true;
  stopTimer();
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(notesEl.textContent);
    setStatus('Notes copied to clipboard');
  } catch (error) {
    console.error(error);
    setStatus('Could not copy notes.');
  }
});

if (API_BASE) {
  setStatus(`Ready (API base: ${API_BASE})`);
}
