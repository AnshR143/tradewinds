'use client';

import { useEffect, useRef, useState } from 'react';
import { createGestures } from '@/lib/gestures';

const ENGINE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const SNAP = 70;
const POINTS = '.bigmap .web-event, .bigmap .web-place, .bigmap .web-ship, .bigmap .web-airport';
const BUTTONS = '.web-events button, .web-patterns button, .layer-chips button, .bigmap-panel .chip';
const GLIDE = 85;

function problem(err) {
  if (err?.name === 'NotAllowedError') return 'The camera is blocked for this site. Allow it in the browser’s address bar, then try again.';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (err?.name === 'NotReadableError') return 'Another app is using the camera. Close it and try again.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use the camera here.';
  return 'Could not start the hand tracker. Check the internet connection and try again.';
}

function targetAt(x, y) {
  const under = document.elementFromPoint(x, y);
  const button = under?.closest(BUTTONS);
  if (button) return button;
  if (under?.closest('.bigmap-panel, .bigmap-tools')) return null;
  let best = null;
  let bestGap = SNAP;
  for (const el of document.querySelectorAll(POINTS)) {
    const r = el.getBoundingClientRect();
    const gap = Math.hypot(Math.max(r.left - x, 0, x - r.right), Math.max(r.top - y, 0, y - r.bottom));
    if (gap < bestGap) { bestGap = gap; best = el; }
  }
  return best;
}

export default function HandControl({ getMap }) {
  const [state, setState] = useState('off');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState('idle');
  const video = useRef(null);
  const canvas = useRef(null);
  const pointers = useRef([]);
  const run = useRef(null);

  function stop() {
    const r = run.current;
    run.current = null;
    if (!r) return;
    cancelAnimationFrame(r.frame);
    r.stream?.getTracks().forEach((track) => track.stop());
    r.tracker?.close();
    r.aimed?.forEach((el) => el?.classList.remove('hand-hover'));
    pointers.current.forEach((el) => { if (el) el.style.opacity = 0; });
  }

  useEffect(() => stop, []);

  function draw(hands, tracked) {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    ctx.clearRect(0, 0, el.width, el.height);
    hands.forEach((landmarks, i) => {
      ctx.strokeStyle = ctx.fillStyle = tracked[i]?.pinching ? '#c2570c' : '#1cb0f6';
      ctx.lineWidth = 2;
      for (const [a, b] of BONES) {
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * el.width, landmarks[a].y * el.height);
        ctx.lineTo(landmarks[b].x * el.width, landmarks[b].y * el.height);
        ctx.stroke();
      }
      for (const p of landmarks) {
        ctx.beginPath();
        ctx.arc(p.x * el.width, p.y * el.height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  async function start() {
    setState('starting');
    setNote('');
    const r = { stream: null, tracker: null, frame: 0, aimed: [null, null] };
    run.current = r;
    try {
      let read;
      let aspect = 4 / 3;
      const madeUp = process.env.NODE_ENV !== 'production' && typeof window.__handsForTesting === 'function' ? window.__handsForTesting : null;
      if (madeUp) {
        let last = 0;
        read = (now) => (now - last < 33 ? null : ((last = now), madeUp(now)));
      } else {
        r.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, frameRate: { ideal: 60 }, facingMode: 'user' }, audio: false });
        if (run.current !== r) return void r.stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = r.stream;
        await video.current.play();

        const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
        const files = await FilesetResolver.forVisionTasks(ENGINE);
        r.tracker = await HandLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2 });
        if (run.current !== r) return void r.tracker.close();

        let lastTime = -1;
        read = (now) => {
          const v = video.current;
          if (!v || v.readyState < 2 || v.currentTime === lastTime) return null;
          lastTime = v.currentTime;
          aspect = v.videoWidth / v.videoHeight || 4 / 3;
          return r.tracker.detectForVideo(v, now).landmarks || [];
        };
      }

      const gestures = createGestures();
      const owed = { dx: 0, dy: 0, zoom: 0, x: 0, y: 0 };
      const drawn = [null, null];
      const wanted = [null, null];
      let lastMode = 'idle';
      let lastFrame = performance.now();

      const see = (hands, now) => {
        const out = gestures.update(hands, { width: window.innerWidth, height: window.innerHeight, aspect }, now);
        for (const action of out.actions) {
          if (action.type === 'pan') {
            owed.dx += action.dx;
            owed.dy += action.dy;
          } else {
            owed.zoom += action.delta;
            owed.x = action.x;
            owed.y = action.y;
          }
        }

        for (let i = 0; i < 2; i++) {
          const hand = out.hands[i];
          wanted[i] = hand || null;
          const aim = hand && out.hands.length === 1 && (!hand.pinching || hand.pressed) ? targetAt(hand.x, hand.y) : null;
          if (aim !== r.aimed[i]) {
            r.aimed[i]?.classList.remove('hand-hover');
            aim?.classList.add('hand-hover');
            r.aimed[i] = aim;
          }
          if (hand?.pressed && aim) {
            gestures.block(hand.id);
            aim.click();
          }
          const el = pointers.current[i];
          if (el) {
            el.classList.toggle('pinching', Boolean(hand?.pinching));
            el.classList.toggle('aiming', Boolean(aim) && !hand?.pinching);
          }
        }
        draw(hands, out.hands);
        if (out.mode !== lastMode) setMode((lastMode = out.mode));
      };

      const tick = () => {
        if (run.current !== r) return;
        r.frame = requestAnimationFrame(tick);
        const now = performance.now();
        const share = 1 - Math.exp(-Math.min(100, now - lastFrame) / GLIDE);
        lastFrame = now;

        const hands = read(now);
        if (hands) see(hands, now);

        const map = getMap();
        if (map) {
          const dx = owed.dx * share;
          const dy = owed.dy * share;
          if (Math.abs(dx) + Math.abs(dy) > 0.02) {
            map.panBy([-dx, -dy], { animate: false });
            owed.dx -= dx;
            owed.dy -= dy;
          }
          const zoom = owed.zoom * share;
          if (Math.abs(zoom) > 0.0004) {
            const to = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), map.getZoom() + zoom));
            map.easeTo({ zoom: to, around: map.unproject([owed.x, owed.y]), duration: 0 });
            owed.zoom -= zoom;
          }
        }

        pointers.current.forEach((el, i) => {
          if (!el) return;
          const want = wanted[i];
          if (!want) {
            el.style.opacity = 0;
            drawn[i] = null;
            return;
          }
          drawn[i] = drawn[i] ? { x: drawn[i].x + (want.x - drawn[i].x) * share, y: drawn[i].y + (want.y - drawn[i].y) * share } : { x: want.x, y: want.y };
          el.style.opacity = 1;
          el.style.transform = `translate(${drawn[i].x}px, ${drawn[i].y}px)`;
        });
      };
      setState('on');
      tick();
    } catch (err) {
      console.error('Hand control could not start:', err?.name || '', err?.message || err);
      const message = problem(err);
      stop();
      setState('error');
      setNote(message);
    }
  }

  function toggle() {
    if (state === 'on' || state === 'starting') {
      stop();
      setState('off');
      setMode('idle');
    } else {
      start();
    }
  }

  const live = state === 'on' || state === 'starting';
  return (
    <>
      <button className={`btn hand-toggle${state === 'on' ? ' primary' : ''}`} onClick={toggle} aria-pressed={state === 'on'}>
        {state === 'on' ? 'Hand control: on' : state === 'starting' ? 'Starting camera…' : 'Hand control'}
      </button>

      <div className="hand-box" hidden={!live && state !== 'error'}>
        <div className="hand-view" hidden={!live}>
          <video ref={video} playsInline muted />
          <canvas ref={canvas} width={320} height={240} />
          <span className="hand-mode">{state === 'starting' ? 'Loading' : mode === 'pan' ? 'Dragging' : mode === 'zoom' ? 'Zooming' : 'Show a hand'}</span>
        </div>
        {state === 'error' && <p className="error small" role="alert">{note}</p>}
        {live && (
          <ul className="hand-help">
            <li><b>Click:</b> with one hand up, move the ring onto an event or city until it lights up, then pinch.</li>
            <li><b>Drag:</b> pinch on empty map, then move your hand.</li>
            <li><b>Zoom:</b> hold up both hands, pinch with both, then pull apart or push together.</li>
          </ul>
        )}
        {live && <p className="muted small">The video stays on this device.</p>}
      </div>

      {[0, 1].map((i) => <div key={i} ref={(el) => { pointers.current[i] = el; }} className="hand-pointer" aria-hidden="true" />)}
    </>
  );
}
