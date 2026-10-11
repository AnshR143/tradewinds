// The map's voice. ElevenLabs turns what you say into text, and the answer into speech.
// The key stays on the server and is never sent to the browser.

const API = 'https://api.elevenlabs.io/v1';
// A stock ElevenLabs voice, used when the account has no voice by the name we look for.
const STOCK_VOICE = '21m00Tcm4TlvDq8ikWAM';

const key = () => process.env.ELEVENLABS_API_KEY;

export function hasVoiceKey() {
  return Boolean(key());
}

// The voice to speak in: ELEVENLABS_VOICE_ID if set. Otherwise the account's voice whose name
// starts with ELEVENLABS_VOICE_NAME, which defaults to the narrator of our ad.
let found;
async function voiceId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (found) return found;
  const want = (process.env.ELEVENLABS_VOICE_NAME || 'Hope').toLowerCase();
  try {
    const res = await fetch(`${API}/voices`, { headers: { 'xi-api-key': key() }, signal: AbortSignal.timeout(8000) });
    const voices = res.ok ? (await res.json()).voices || [] : [];
    found = voices.find((v) => String(v.name).toLowerCase().startsWith(want))?.voice_id || STOCK_VOICE;
  } catch {
    found = STOCK_VOICE;
  }
  return found;
}

// A recording of someone speaking, as text.
export async function hear(audio) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', 'en');
  // Without this it also writes down sounds, like "(laughter)".
  form.append('tag_audio_events', 'false');
  form.append('file', audio, 'question.webm');
  const res = await fetch(`${API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key() }, body: form, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`ElevenLabs speech-to-text returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return String((await res.json()).text || '').trim();
}

// Text as speech: an MP3, using the fastest model so the answer starts quickly.
export async function say(text) {
  const res = await fetch(`${API}/text-to-speech/${await voiceId()}?output_format=mp3_44100_64`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`ElevenLabs text-to-speech returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}
