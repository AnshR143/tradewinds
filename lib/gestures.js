// Turns hand positions from the camera into map actions. No camera or map code in here, so
// it can be tested on its own.
//
// The gestures:
// - Pinch thumb and index finger together and move the hand: drag the map.
// - Pinch with both hands and pull them apart or push them together: zoom in or out.
// - Pinching while the pointer is on something clickable is a click. The caller decides
//   what is clickable: it sees `pressed` on the hand and calls block() to stop that pinch
//   from also dragging the map.

// Hand landmark numbers, from MediaPipe: 0 wrist, 4 thumb tip, 8 index tip, and the four
// knuckles 5, 9, 13, 17.
const WRIST = 0;
const THUMB = 4;
const INDEX = 8;
const KNUCKLE = 9;
// The pointer sits at the middle of the palm. Fingertips jump when you pinch; the palm does not.
const PALM = [0, 5, 9, 13, 17];

// The gap between thumb and index, as a share of the hand's size. Two numbers so the pinch
// does not flicker on and off at the edge.
const PINCH_ON = 0.32;
const PINCH_OFF = 0.5;
// Only the middle of the camera's view is used, so the pointer can reach the screen edges
// without the hand leaving the picture.
const REACH = 0.7;
const PAN_GAIN = 1.15;
const ZOOM_GAIN = 1.5;
// A pinch has to travel this many pixels before it starts dragging, so holding a pinch
// still does not make the map creep.
const DRAG_START = 8;

// The "one euro" filter: it smooths hard when the hand is nearly still, which removes the
// shake, and lets go when the hand moves fast, which removes the lag.
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
  // The camera picture is wider than it is tall, so sideways distances are scaled to match.
  const gap = (a, b) => Math.hypot((a.x - b.x) * view.aspect, a.y - b.y);
  const size = gap(landmarks[WRIST], landmarks[KNUCKLE]) || 1e-6;
  const stretch = (v) => Math.min(1, Math.max(0, (v - (1 - REACH) / 2) / REACH));
  const palmX = PALM.reduce((sum, i) => sum + landmarks[i].x, 0) / PALM.length;
  const palmY = PALM.reduce((sum, i) => sum + landmarks[i].y, 0) / PALM.length;
  return {
    ratio: gap(landmarks[THUMB], landmarks[INDEX]) / size,
    // Flipped left to right, so the pointer moves the way a mirror would show it.
    x: stretch(1 - palmX) * view.width,
    y: stretch(palmY) * view.height,
  };
}

export function createGestures() {
  let tracked = [];
  let nextId = 1;
  let mode = 'idle'; // idle | pan | zoom
  let anchor = null; // where the dragging hand was last frame
  let lastGap = 0; // distance between the two hands last frame

  // hands: one list of 21 landmarks per hand, each { x, y } from 0 to 1.
  // view: { width, height } of the screen in pixels and `aspect` of the camera picture.
  // now: milliseconds.
  // Returns { actions, hands, mode }. Actions are { type: 'pan', dx, dy } and
  // { type: 'zoom', delta, x, y }. Each hand is { id, x, y, pinching, pressed, blocked };
  // `pressed` is true only on the frame the pinch begins.
  function update(hands, view, now) {
    const actions = [];
    const seconds = now / 1000;
    const free = [...tracked];
    const next = [];

    for (const landmarks of hands) {
      const hand = readHand(landmarks, view);
      // The camera does not say which hand is which from frame to frame, so each one is
      // matched to the nearest hand from the last frame.
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
        // A pinch that was used as a click stays out of dragging until it is let go.
        blocked: pinching && Boolean(prev?.pinching && prev.blocked),
      });
    }
    tracked = next;

    const pinched = next.filter((t) => t.pinching && !t.blocked);
    if (pinched.length >= 2) {
      const [a, b] = pinched;
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      // Hands almost touching give a wild ratio, so those frames are skipped.
      if (mode === 'zoom' && gap > 40 && lastGap > 40) {
        const delta = Math.log2(gap / lastGap) * ZOOM_GAIN;
        if (Math.abs(delta) > 0.001) actions.push({ type: 'zoom', delta, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
      mode = 'zoom';
      lastGap = gap;
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
          // Start from here, so the map does not jump by the distance already travelled.
          anchor = { id: hand.id, x: hand.x, y: hand.y, dragging: true };
        }
      } else {
        anchor = { id: hand.id, x: hand.x, y: hand.y, dragging: false };
      }
      mode = 'pan';
    } else {
      mode = 'idle';
      anchor = null;
    }

    return { actions, hands: next, mode };
  }

  // Call this when a pinch was used to click something, so it does not also drag the map.
  function block(id) {
    const hand = tracked.find((t) => t.id === id);
    if (hand) hand.blocked = true;
    if (anchor?.id === id) anchor = null;
  }

  return { update, block };
}
