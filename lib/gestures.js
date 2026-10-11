const WRIST = 0;
const THUMB = 4;
const INDEX = 8;
const KNUCKLE = 9;
const PALM = [0, 5, 9, 13, 17];

const PINCH_ON = 0.32;
const PINCH_OFF = 0.5;
const REACH = 0.7;
const PAN_GAIN = 1.15;
const ZOOM_GAIN = 1.5;
const DRAG_START = 8;
const JOIN_WAIT = 350;
const LOST_FOR = 300;

function steady(minCutoff = 1.1, beta = 0.012) {
  let last = null;
  let lastSpeed = 0;
  let lastTime = 0;
  const share = (cutoff, dt) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return (value, seconds) => {
    if (last === null) {
      last = value;
      lastTime = seconds;
      return value;
    }
    const dt = Math.max(0.001, seconds - lastTime);
    const speed = lastSpeed + ((value - last) / dt - lastSpeed) * share(1, dt);
    last += (value - last) * share(minCutoff + beta * Math.abs(speed), dt);
    lastSpeed = speed;
    lastTime = seconds;
    return last;
  };
}

function readHand(landmarks, view) {
  const gap = (a, b) => Math.hypot((a.x - b.x) * view.aspect, a.y - b.y);
  const size = gap(landmarks[WRIST], landmarks[KNUCKLE]) || 1e-6;
  const stretch = (v) => Math.min(1, Math.max(0, (v - (1 - REACH) / 2) / REACH));
  const palmX = PALM.reduce((sum, i) => sum + landmarks[i].x, 0) / PALM.length;
  const palmY = PALM.reduce((sum, i) => sum + landmarks[i].y, 0) / PALM.length;
  return {
    ratio: gap(landmarks[THUMB], landmarks[INDEX]) / size,
    x: stretch(1 - palmX) * view.width,
    y: stretch(palmY) * view.height,
  };
}

export function createGestures() {
  let tracked = [];
  let nextId = 1;
  let mode = 'idle';
  let anchor = null;
  let lastGap = 0;

  function update(hands, view, now) {
    const actions = [];
    const seconds = now / 1000;
    const free = [...tracked];
    const next = [];

    for (const landmarks of hands) {
      const hand = readHand(landmarks, view);
      let best = -1;
      let bestGap = Infinity;
      free.forEach((t, i) => {
        const d = Math.hypot(t.x - hand.x, t.y - hand.y);
        if (d < bestGap) { bestGap = d; best = i; }
      });
      const prev = best >= 0 && bestGap < view.width * 0.35 ? free.splice(best, 1)[0] : null;

      const filters = prev?.filters || { x: steady(), y: steady() };
      const ratio = prev ? prev.ratio + (hand.ratio - prev.ratio) * 0.6 : hand.ratio;
      const pinching = ratio < (prev?.pinching ? PINCH_OFF : PINCH_ON);
      next.push({
        id: prev?.id || nextId++,
        x: filters.x(hand.x, seconds),
        y: filters.y(hand.y, seconds),
        ratio,
        filters,
        pinching,
        pressed: pinching && !prev?.pinching,
        blocked: pinching && Boolean(prev?.pinching && prev.blocked),
        since: pinching ? (prev?.pinching ? prev.since : now) : 0,
        zoomed: pinching && Boolean(prev?.pinching && prev.zoomed),
        seen: now,
      });
    }
    tracked = [...next, ...free.filter((t) => now - t.seen < LOST_FOR)];

    const pinched = next.filter((t) => t.pinching && !t.blocked);
    if (pinched.length >= 2) {
      const [a, b] = pinched;
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      if (mode === 'zoom' && gap > 40 && lastGap > 40) {
        const delta = Math.log2(gap / lastGap) * ZOOM_GAIN;
        if (Math.abs(delta) > 0.001) actions.push({ type: 'zoom', delta, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      mode = 'zoom';
      lastGap = gap;
      anchor = null;
      a.zoomed = true;
      b.zoomed = true;
    } else if (pinched.length === 1 && pinched[0].zoomed) {
      mode = 'zoom';
      lastGap = 0;
      anchor = null;
    } else if (pinched.length === 1 && next.length > 1 && now - pinched[0].since < JOIN_WAIT) {
      mode = 'idle';
      anchor = null;
    } else if (pinched.length === 1) {
      const hand = pinched[0];
      if (mode === 'pan' && anchor?.id === hand.id) {
        const dx = hand.x - anchor.x;
        const dy = hand.y - anchor.y;
        if (anchor.dragging) {
          if (Math.hypot(dx, dy) > 0.05) actions.push({ type: 'pan', dx: dx * PAN_GAIN, dy: dy * PAN_GAIN });
          anchor = { id: hand.id, x: hand.x, y: hand.y, dragging: true };
        } else if (Math.hypot(dx, dy) > DRAG_START) {
          anchor = { id: hand.id, x: hand.x, y: hand.y, dragging: true };
        }
      } else {
        anchor = { id: hand.id, x: hand.x, y: hand.y, dragging: false };
      }
      mode = 'pan';
    } else {
      mode = 'idle';
      anchor = null;
      lastGap = 0;
    }

    return { actions, hands: next, mode };
  }

  function block(id) {
    const hand = tracked.find((t) => t.id === id);
    if (hand) hand.blocked = true;
    if (anchor?.id === id) anchor = null;
  }

  return { update, block };
}
