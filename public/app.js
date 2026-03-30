const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcribeBtn = document.getElementById('transcribeBtn');
const summarizeBtn = document.getElementById('summarizeBtn');
const copyBtn = document.getElementById('copyBtn');
const transcriptEl = document.getElementById('transcript');
const notesEl = document.getElementById('notes');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const contextEl = document.getElementById('context');
const captureSystemAudioEl = document.getElementById('captureSystemAudio');
const apiBaseUrlEl = document.getElementById('apiBaseUrl');

let mediaRecorder;
let mixedStream;
let micStream;
let displayStream;
let audioBlob;
let chunks = [];
let timerInterval;
let seconds = 0;

const API_BASE_STORAGE_KEY = 'note_taker_api_base_url';

function setStatus(text) {
  statusEl.textContent = text;
}

function normalizeApiBase(base) {
  const trimmed = (base || '').trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\/$/, '');
}

function buildApiUrl(pathname) {
  const configuredBase = normalizeApiBase(apiBaseUrlEl.value);
  if (!configuredBase) {
    return pathname;
  }

  if (!/^https?:\/\//.test(configuredBase)) {
    throw new Error('API base URL must start with http:// or https://');
  }

  return `${configuredBase}${pathname}`;
}

function saveApiBaseUrl() {
  localStorage.setItem(API_BASE_STORAGE_KEY, normalizeApiBase(apiBaseUrlEl.value));
}

function loadApiBaseUrl() {
  const saved = localStorage.getItem(API_BASE_STORAGE_KEY);
  if (saved) {
    apiBaseUrlEl.value = saved;
    setStatus(`Using API base: ${saved}`);
  }
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

apiBaseUrlEl.addEventListener('change', () => {
  saveApiBaseUrl();
  setStatus('API base URL saved');
});

startBtn.addEventListener('click', async () => {
  try {
    chunks = [];
    audioBlob = null;
    transcribeBtn.disabled = true;
    summarizeBtn.disabled = true;
    copyBtn.disabled = true;
    notesEl.textContent = '';

    mixedStream = await buildMixedStream();
    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: 'audio/webm' });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      audioBlob = new Blob(chunks, { type: 'audio/webm' });
      transcribeBtn.disabled = false;
      cleanupStreams();
    };

    mediaRecorder.start(1000);
    startBtn.disabled = true;
    stopBtn.disabled = false;
    setStatus('Recording...');
    startTimer();
  } catch (error) {
    console.error(error);
    setStatus(`Unable to start recording: ${error.message}`);
    cleanupStreams();
  }
});

stopBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return;
  }
  mediaRecorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus('Recording stopped');
  stopTimer();
});

transcribeBtn.addEventListener('click', async () => {
  if (!audioBlob) {
    return;
  }

  try {
    saveApiBaseUrl();
    setStatus('Transcribing audio...');
    transcribeBtn.disabled = true;

    const formData = new FormData();
    formData.append('audio', audioBlob, 'meeting.webm');

    const response = await fetch(buildApiUrl('/api/transcribe'), {
      method: 'POST',
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Transcription failed');
    }

    transcriptEl.value = data.transcript || '';
    summarizeBtn.disabled = !transcriptEl.value.trim();
    setStatus('Transcription complete');
  } catch (error) {
    console.error(error);
    setStatus(`Transcription failed: ${error.message}`);
    transcribeBtn.disabled = false;
  }
});

summarizeBtn.addEventListener('click', async () => {
  try {
    const transcript = transcriptEl.value.trim();
    if (!transcript) {
      setStatus('Transcript is empty.');
      return;
    }

    saveApiBaseUrl();
    setStatus('Generating meeting notes...');
    summarizeBtn.disabled = true;

    const response = await fetch(buildApiUrl('/api/summarize'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript,
        meetingContext: contextEl.value.trim()
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Summarization failed');
    }

    notesEl.textContent = data.notes || '';
    copyBtn.disabled = !notesEl.textContent.trim();
    setStatus('Notes ready');
  } catch (error) {
    console.error(error);
    setStatus(`Failed to generate notes: ${error.message}`);
  } finally {
    summarizeBtn.disabled = false;
  }
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

loadApiBaseUrl();
