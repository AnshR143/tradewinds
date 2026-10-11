'use client';

// Talk to the map. Switch it on and it reads out what is happening, then listens: ask a
// question out loud and it answers from what the map is showing, and can zoom to what it is
// talking about. ElevenLabs does the hearing and the speaking (on the server, see
// app/api/voice); without a key the browser's own voice reads the answer and you type.
import { useEffect, useRef, useState } from 'react';

const OPENING = 'Give me the updates on the map right now.';
// How long a pause ends your question, how long it waits for you to start, and the longest
// question it records, in milliseconds.
const PAUSE_ENDS = 1100;
const WAIT_FOR_SPEECH = 8000;
const LONGEST = 15000;

export default function MapVoice({ looking, onOpen, onLayers }) {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState('idle'); // idle | listening | thinking | speaking
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [level, setLevel] = useState(0);
  const run = useRef(null); // { stream, context, analyser, recorder, end, frame, player, earlier }
  const view = useRef({ looking, onOpen, onLayers });
  view.current = { looking, onOpen, onLayers };

  function quiet(r) {
    cancelAnimationFrame(r.frame);
    if (r.recorder?.state === 'recording') {
      r.recorder.onstop = null;
      r.recorder.stop();
    }
    r.player?.pause();
    r.player = null;
    window.speechSynthesis?.cancel();
  }

  function stop() {
    const r = run.current;
    run.current = null;
    if (!r) return;
    quiet(r);
    r.stream?.getTracks().forEach((track) => track.stop());
    r.context?.close();
  }

  useEffect(() => stop, []);

  // Reads the answer out, then calls done. Uses the ElevenLabs recording when there is one.
  function speak(r, text, audio, done) {
    setMode('speaking');
    const finish = () => { if (run.current === r) done(); };
    if (audio) {
      r.player = new Audio(`data:audio/mpeg;base64,${audio}`);
      r.player.onended = finish;
      r.player.onerror = finish;
      r.player.play().catch(finish);
    } else if (window.speechSynthesis) {
      const words = new SpeechSynthesisUtterance(text);
      words.onend = finish;
      words.onerror = finish;
      window.speechSynthesis.speak(words);
    } else {
      finish();
    }
  }

  // Sends a question (a recording or typed text), then shows and speaks the answer.
  async function send(r, { recording, text }) {
    setMode('thinking');
    // The note from switching on (such as "type your questions") stays through the opening.
    if (text !== OPENING) setNote('');
    try {
      let body;
      let headers;
      if (recording) {
        body = new FormData();
        body.append('audio', recording, 'question.webm');
        body.append('earlier', JSON.stringify(r.earlier));
        body.append('looking', view.current.looking || '');
      } else {
        headers = { 'Content-Type': 'application/json' };
        body = JSON.stringify({ question: text, earlier: r.earlier, looking: view.current.looking || '' });
      }
      const res = await fetch('/api/voice', { method: 'POST', headers, body });
      const data = await res.json();
      if (run.current !== r) return;
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      if (!data.say) return listen(r); // Nothing was said. Keep listening.

      if (text !== OPENING) setHeard(data.heard);
      setReply(data.say);
      r.earlier = [...r.earlier, { q: data.heard, a: data.say }].slice(-3);
      if (data.layers) view.current.onLayers(data.layers);
      if (data.open) view.current.onOpen(data.open);
      speak(r, data.say, data.audio, () => listen(r));
    } catch (err) {
      if (run.current !== r) return;
      setNote(err.message || 'Something went wrong.');
      setMode('idle');
    }
  }

  // Records one question. It ends when you stop talking, and gives up if you never start.
  function listen(r) {
    if (!r.stream) return setMode('idle');
    quiet(r);
    setMode('listening');
    const chunks = [];
    const recorder = new MediaRecorder(r.stream);
    r.recorder = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const began = performance.now();
    const samples = new Float32Array(r.analyser.fftSize);
    let floor = 0.01;
    let spokeFor = 0;
    let lastSound = 0;
    let last = began;

    const end = (keep) => {
      cancelAnimationFrame(r.frame);
      setLevel(0);
      recorder.onstop = () => {
        if (run.current !== r) return;
        if (keep) send(r, { recording: new Blob(chunks, { type: recorder.mimeType }) });
        else setMode('idle');
      };
      recorder.stop();
    };
    r.end = end;
    const tick = () => {
      if (run.current !== r) return;
      r.frame = requestAnimationFrame(tick);
      const now = performance.now();
      r.analyser.getFloatTimeDomainData(samples);
      const loud = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      // The room's own noise is measured in the first moments and speech must rise above it.
      if (now - began < 350) floor = Math.max(floor, loud * 1.2);
      const speaking = loud > Math.max(0.018, floor * 2.5);
      if (speaking) {
        spokeFor += now - last;
        lastSound = now;
      }
      last = now;
      setLevel(Math.round(Math.min(1, loud * 9) * 10) / 10);
      const spoke = spokeFor > 180;
      if (spoke && now - lastSound > PAUSE_ENDS) end(true);
      else if (now - began > LONGEST) end(spoke);
      else if (!spoke && now - began > WAIT_FOR_SPEECH) end(false);
    };
    recorder.start();
    tick();
  }

  async function start() {
    const r = { stream: null, context: null, analyser: null, recorder: null, frame: 0, player: null, earlier: [] };
    run.current = r;
    setOn(true);
    setHeard('');
    setReply('');
    setNote('');
    // The microphone is asked for inside the click. Without it you can still type.
    try {
      if (typeof MediaRecorder === 'undefined') throw new Error('no recorder');
      const { voice } = await fetch('/api/voice').then((res) => res.json());
      if (!voice) throw new Error('no key');
      r.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (run.current !== r) return void r.stream.getTracks().forEach((track) => track.stop());
      r.context = new AudioContext();
      r.analyser = r.context.createAnalyser();
      r.analyser.fftSize = 1024;
      r.context.createMediaStreamSource(r.stream).connect(r.analyser);
    } catch (err) {
      if (run.current !== r) return;
      r.stream = null;
      setNote(err?.name === 'NotAllowedError' ? 'The microphone is blocked for this site, so type your questions below.' : err?.message === 'no key' ? 'The voice is not set up yet, so type your questions below.' : 'No microphone was found, so type your questions below.');
    }
    send(r, { text: OPENING });
  }

  function toggle() {
    if (on) {
      stop();
      setOn(false);
      setMode('idle');
    } else {
      start();
    }
  }

  function ask(e) {
    e.preventDefault();
    const r = run.current;
    const text = typed.trim();
    if (!r || !text) return;
    quiet(r);
    setTyped('');
    send(r, { text });
  }

  // The one button: stop the answer and listen, or stop listening and send, or listen again.
  function mic() {
    const r = run.current;
    if (!r?.stream) return;
    if (mode === 'listening') r.end?.(true);
    else if (mode !== 'thinking') listen(r);
  }

  const status = mode === 'listening' ? 'Listening' : mode === 'thinking' ? 'Thinking' : mode === 'speaking' ? 'Speaking' : 'Paused';
  const canHear = Boolean(run.current?.stream);
  return (
    <>
      <button className={`btn voice-toggle${on ? ' primary' : ''}`} onClick={toggle} aria-pressed={on}>
        {on ? 'Talk to the map: on' : 'Talk to the map'}
      </button>

      {on && (
        <div className="voice-box" role="region" aria-label="Talk to the map">
          <div className="voice-top">
            <span className={`voice-status ${mode}`} aria-live="polite">{status}</span>
            {mode === 'listening' && <span className="voice-level" aria-hidden="true"><span style={{ transform: `scaleX(${level})` }} /></span>}
            {canHear && mode !== 'thinking' && (
              <button className="chip" onClick={mic}>{mode === 'listening' ? 'Done talking' : mode === 'speaking' ? 'Stop and listen' : 'Ask something'}</button>
            )}
          </div>
          {heard && <p className="voice-heard">You: {heard}</p>}
          {reply && <p className="voice-reply">{reply}</p>}
          {!reply && mode === 'thinking' && <p className="muted small">Reading the map&hellip;</p>}
          {note && <p className="error small" role="alert">{note}</p>}
          <form className="voice-type" onSubmit={ask}>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300} placeholder={canHear ? 'Or type a question' : 'Type a question'} aria-label="Type a question for the map" />
            <button className="btn" disabled={!typed.trim() || mode === 'thinking'}>Ask</button>
          </form>
        </div>
      )}
    </>
  );
}
