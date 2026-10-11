'use client';

import { useEffect, useRef } from 'react';
import createGlobe from 'cobe';

const SPIN_SPEED = 0.002;
const TILT = 0.25;

function anglesFor(lat, lon) {
  return {
    phi: Math.PI - ((lon * Math.PI) / 180 - Math.PI / 2),
    theta: (lat * Math.PI) / 180,
  };
}

function colors() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return dark
    ? { dark: 1, baseColor: [0.32, 0.32, 0.32], glowColor: [0.06, 0.06, 0.06], mapBrightness: 5 }
    : { dark: 0, baseColor: [1, 1, 1], glowColor: [0.96, 0.96, 0.96], mapBrightness: 7 };
}

export default function Globe({ markers, arcs, focus, selectedId, onSelect }) {
  const canvasRef = useRef(null);
  const focusRef = useRef(focus);
  const drag = useRef({ start: null, offset: 0 });
  const view = useRef({ phi: 4.2, theta: TILT });

  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const width = canvas.offsetWidth;
    if (!width) return undefined;
    let frame;

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width,
      height: width,
      phi: view.current.phi,
      theta: view.current.theta,
      diffuse: 1.3,
      mapSamples: 16000,
      markerColor: [0.92, 0.45, 0.1],
      markerElevation: 0.01,
      markers: markers.map((m) => ({ location: [m.lat, m.lon], size: m.size, color: m.color, id: m.id })),
      arcs: arcs.map((a) => ({ from: a.from, to: a.to, id: a.id })),
      arcColor: [0.92, 0.45, 0.1],
      arcWidth: 0.6,
      arcHeight: 0.12,
      opacity: 0.9,
      ...colors(),
    });

    function animate() {
      const target = focusRef.current;
      const dragging = drag.current.start !== null;
      const now = view.current;
      if (target && !dragging) {
        const goal = anglesFor(target.lat, target.lon);
        const full = Math.PI * 2;
        const forward = (((goal.phi - now.phi) % full) + full) % full;
        now.phi += (forward < Math.PI ? forward : forward - full) * 0.06;
        now.theta += (goal.theta - now.theta) * 0.06;
      } else if (!dragging) {
        now.phi += SPIN_SPEED;
        now.theta += (TILT - now.theta) * 0.04;
      }
      globe.update({ phi: now.phi + drag.current.offset, theta: now.theta });
      frame = requestAnimationFrame(animate);
    }
    animate();
    canvas.style.opacity = '1';

    function onMove(e) {
      if (drag.current.start !== null) drag.current.offset = (e.clientX - drag.current.start) / 250;
    }
    function onUp() {
      if (drag.current.start === null) return;
      view.current.phi += drag.current.offset;
      drag.current = { start: null, offset: 0 };
      canvas.style.cursor = 'grab';
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      globe.destroy();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [markers, arcs]);

  function onPointerDown(e) {
    drag.current.start = e.clientX;
    focusRef.current = null;
    canvasRef.current.style.cursor = 'grabbing';
  }

  return (
    <div className="globe">
      <canvas ref={canvasRef} onPointerDown={onPointerDown} aria-label="Globe showing disruptions and supply-chain choke points" />
      {markers.map((m) => (
        <button
          key={m.id}
          className={`globe-dot ${selectedId === m.id ? 'selected' : ''}`}
          style={{ positionAnchor: `--cobe-${m.id}`, scale: `var(--cobe-visible-${m.id}, 0)` }}
          onClick={() => onSelect?.(m)}
          aria-label={m.name}
        >
          <span className="tip">{m.name}</span>
        </button>
      ))}
    </div>
  );
}
