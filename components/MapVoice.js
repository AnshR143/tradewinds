'use client';

import { useEffect, useRef, useState } from 'react';

const OPENING = 'Give me the updates on the map right now.';
const PAUSE_ENDS = 1100;
const WAIT_FOR_SPEECH = 8000;
const LONGEST = 15000;
const WAKE = /\b(?:hey|hay|hi|okay|ok)[\s,]+(?:windy|wendy|windie|windi|windee|whindy|wind e|win d)\b/i;

export default function MapVoice({ looking, onOpen, onLayers }) {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState('idle');
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [level, setLevel] = useState(0);
  const [hears, setHears] = useState(false);
  const run = useRef(null);
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

  const [wake, setWake] = useState(false);
  const waker = useRef(null);
  const latest = useRef({ on, mode });
  latest.current = { on, mode };
  const woken = useRef(null);
  woken.current = (said) => {
    const question = said.split(/\s+/).filter(Boolean).length >= 2 ? said.slice(0, 300) : '';
    const r = run.current;
    if (!latest.current.on || !r) return start(question, !question);
    if (latest.current.mode === 'thinking' || latest.current.mode === 'listening') return;
    quiet(r);
    send(r, question ? { text: question } : { greet: true });
  };

  function startWake() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition || waker.current) return;
    const w = { rec: null, wanted: true, last: 0 };
    waker.current = w;
    const begin = () => {
      if (!w.wanted) return;
      const rec = new Recognition();
      w.rec = rec;
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const text = e.results[i][0].transcript;
          const hit = text.match(WAKE);
          if (!hit || Date.now() - w.last < 2500) continue;
          w.last = Date.now();
          woken.current(text.slice(hit.index + hit[0].length).replace(/^[\s,.!?]+/, '').trim());
        }
      };
      rec.onerror = (e) => {
        if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) {
          w.wanted = false;
          setWake(false);
        }
      };
      rec.onend = () => { if (w.wanted) setTimeout(begin, 300); };
      try {
        rec.start();
        setWake(true);
      } catch {
        w.wanted = false;
      }
    };
    begin();
  }

  useEffect(() => {
    navigator.permissions?.query({ name: 'microphone' }).then((p) => { if (p.state === 'granted') startWake(); }).catch(() => {});
    return () => {
      const w = waker.current;
      waker.current = null;
      if (w) {
        w.wanted = false;
        w.rec?.abort();
      }
      stop();
    };
  }, []);

  async function speak(r, text, audio, done) {
    setMode('speaking');
    const finish = () => { if (run.current === r) done(); };
    let sound = null;
    if (audio && r.context) {
      try {
        const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
        sound = await r.context.decodeAudioData(bytes.buffer);
        await Promise.race([r.context.resume(), new Promise((go) => setTimeout(go, 800))]);
        if (r.context.state !== 'running') sound = null;
      } catch {
        sound = null;
      }
      if (run.current !== r) return;
    }
    if (sound) {
      const source = r.context.createBufferSource();
      source.buffer = sound;
      source.connect(r.context.destination);
      source.onended = finish;
      r.player = { pause: () => { source.onended = null; try { source.stop(); } catch {} } };
      source.start();
    } else if (window.speechSynthesis) {
      const words = new SpeechSynthesisUtterance(text);
      words.onend = finish;
      words.onerror = finish;
      window.speechSynthesis.speak(words);
    } else {
      finish();
    }
  }

  async function send(r, { recording, text, greet }) {
    setMode('thinking');
    if (!greet && text !== OPENING) setNote('');
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
        body = JSON.stringify(greet ? { greet: true } : { question: text, earlier: r.earlier, looking: view.current.looking || '' });
      }
      const res = await fetch('/api/voice', { method: 'POST', headers, body });
      const data = await res.json();
      if (run.current !== r) return;
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      if (!data.say) return listen(r);

      setHeard(greet || text === OPENING ? '' : data.heard);
      setReply(data.say);
      if (!greet) r.earlier = [...r.earlier, { q: data.heard, a: data.say }].slice(-3);
      if (data.layers) view.current.onLayers(data.layers);
      if (data.open) view.current.onOpen(data.open);
      speak(r, data.say, data.audio, () => listen(r));
    } catch (err) {
      if (run.current !== r) return;
      setNote(err.message || 'Something went wrong.');
      setMode('idle');
    }
  }

  function listen(r) {
    r.waiting = !r.stream;
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

  async function start(question = '', greet = false) {
    const r = { stream: null, context: null, analyser: null, recorder: null, frame: 0, player: null, earlier: [], waiting: false };
    run.current = r;
    setOn(true);
    setHears(false);
    setHeard('');
    setReply('');
    setNote('');
    try {
      r.context = new (window.AudioContext || window.webkitAudioContext)();
      r.context.resume();
    } catch {
      r.context = null;
    }
    send(r, greet ? { greet: true } : { text: question || OPENING });
    try {
      if (typeof MediaRecorder === 'undefined' || !r.context) throw new Error('no recorder');
      const { voice } = await fetch('/api/voice').then((res) => res.json());
      if (!voice) throw new Error('no key');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (run.current !== r) return void stream.getTracks().forEach((track) => track.stop());
      r.stream = stream;
      r.analyser = r.context.createAnalyser();
      r.analyser.fftSize = 1024;
      r.context.createMediaStreamSource(r.stream).connect(r.analyser);
      setHears(true);
      startWake();
      if (r.waiting) listen(r);
    } catch (err) {
      if (run.current !== r) return;
      r.stream = null;
      setNote(err?.name === 'NotAllowedError' ? 'The microphone is blocked for this site, so type your questions below.' : err?.message === 'no key' ? 'The voice is not set up yet, so type your questions below.' : 'No microphone was found, so type your questions below.');
    }
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

  function mic() {
    const r = run.current;
    if (!r?.stream) return;
    if (mode === 'listening') r.end?.(true);
    else if (mode !== 'thinking') listen(r);
  }

  const status = mode === 'listening' ? 'Listening' : mode === 'thinking' ? 'Thinking' : mode === 'speaking' ? 'Speaking' : wake ? 'Paused. Say "Hey Windy"' : 'Paused';
  const canHear = on && hears;
  return (
    <>
      <button className={`btn voice-toggle${on ? ' primary' : ''}`} onClick={toggle} aria-pressed={on}>
        {on ? 'Talk to the map: on' : wake ? 'Talk to the map, or say "Hey Windy"' : 'Talk to the map'}
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
