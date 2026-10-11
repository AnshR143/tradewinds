// Every scene is driven by seek(t): the page shows exactly what second t looks like, so a
// renderer can step through it frame by frame. The scene is picked by the address, e.g.
// index.html#ask or index.html#ov-label:sat:5.
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const NS = 'http://www.w3.org/2000/svg';
const [name, arg, arg2] = location.hash.slice(1).split(':');
const tl = gsap.timeline({ paused: true });
// Work done on every frame, on top of the timeline.
const ticks = [];
// The "camera" of the current scene, and how blurred it is.
let rig = null;
const fx = { blur: 0 };

// A fixed "random" number generator, so every render comes out the same.
function seeded(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function common(id) {
  rig = $(`#${id} .rig`);
  const stars = $(`#${id} .stars`);
  ticks.push((t) => {
    if (stars) stars.style.backgroundPosition = `${-t * 16}px ${t * 7}px, ${40 - t * 10}px ${60 + t * 4}px`;
    rig.style.filter = fx.blur > 0.05 ? `blur(${fx.blur.toFixed(2)}px)` : 'none';
  });
}

// A scene arrives by flying toward the camera and leaves by flying through it, so a plain
// cut between two scenes reads as one continuous move.
function enter(id, at = 0, flyRig = true, superAt = at) {
  if (flyRig) tl.fromTo(rig, { scale: 0.72, opacity: 0, rotationX: 12, y: 70, transformPerspective: 2400 }, { scale: 1, opacity: 1, rotationX: 0, y: 0, duration: 0.6, ease: 'expo.out' }, at);
  tl.fromTo(fx, { blur: 18 }, { blur: 0, duration: 0.45, ease: 'power2.out' }, at)
    .from(`#${id} .glow`, { opacity: 0, scale: 0.7, duration: 0.9, ease: 'power2.out' }, at)
    .from(`#${id} .super .tagk`, { opacity: 0, x: -26, duration: 0.45, ease: 'power3.out' }, superAt + 0.05)
    .from(`#${id} .super .w`, { opacity: 0, y: 40, duration: 0.55, stagger: 0.06, ease: 'power3.out' }, superAt + 0.12);
}
// The headline steps aside while the camera is pushed in, so it never sits on top of the window.
function hideSuper(id, from, to) {
  tl.to(`#${id} .super`, { opacity: 0, y: -16, duration: 0.3, ease: 'power2.in' }, from);
  if (to) tl.to(`#${id} .super`, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, to);
}
function leave(id, at) {
  tl.to(rig, { scale: 1.55, opacity: 0, duration: 0.3, ease: 'expo.in' }, at)
    .to(fx, { blur: 20, duration: 0.3, ease: 'power2.in' }, at)
    .to(`#${id} .super`, { opacity: 0, y: -20, duration: 0.25, ease: 'power2.in' }, at)
    .to(`#${id} .glow`, { opacity: 0, duration: 0.3 }, at);
}

// A number that counts up to its value.
function count(el, at, dur = 0.9) {
  const to = Number(el.dataset.n);
  const from = Number(el.dataset.from || 0);
  const pre = el.dataset.prefix || '';
  const suf = el.dataset.suffix || '';
  const p = { v: 0 };
  tl.to(p, { v: 1, duration: dur, ease: 'power2.out' }, at);
  ticks.push(() => {
    const n = Math.round(from + (to - from) * p.v);
    el.textContent = `${n < 0 ? '−' : pre}${Math.abs(n).toLocaleString('en-US')}${suf}`;
  });
}

// A band of light that crosses a card once.
function sweep(el, at, width) {
  gsap.set(el, { skewX: -18 });
  tl.fromTo(el, { x: -320, opacity: 0 }, { x: width + 320, opacity: 1, duration: 0.9, ease: 'power2.inOut', immediateRender: true }, at);
}

// ---- The map used in two scenes ----------------------------------------------------------------
const PANEL = `
  <div class="mpanel">
    <div class="ph">What is connected right now</div>
    <div class="chips"><span class="chip on">Storms</span><span class="chip" data-chip="planes">Planes</span><span class="chip" data-chip="ships">Cargo ships</span></div>
    <div class="pl">Patterns right now</div>
    <div class="pi"><b>Strait of Hormuz</b><span>Ship traffic <em>down 97%</em></span></div>
    <div class="pi"><b>Hurricane Rachel</b><span><em>No planes</em> within 460 km</span></div>
    <div class="pl">Events</div>
    <div class="pi on"><b>Hurricane Simon</b><span>5 companies in 4 places</span></div>
    <div class="pi"><b>Panama earthquake</b><span>2 companies in 2 places</span></div>
  </div>`;
const PANEL_CSS = `
  .mpanel { position: absolute; left: 0; top: 0; width: 470px; height: 100%; padding: 30px 32px; background: #fff; border-right: 2px solid var(--line); z-index: 5; }
  .ph { font-family: 'DM Sans'; font-size: 37px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
  .mpanel .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0 4px; }
  .mpanel .chip { padding: 6px 16px; font-size: 19px; }
  .pl { margin-top: 20px; font-family: 'DM Sans'; font-size: 22px; font-weight: 500; color: var(--muted); }
  .pi { padding: 11px 0; border-bottom: 2px solid var(--line); }
  .pi b { display: block; font-size: 25px; font-weight: 500; }
  .pi span { font-size: 21px; color: var(--muted); }
  .pi em { font-style: normal; font-weight: 600; color: var(--down); }
  .pi.on { background: var(--up-bg); margin: 6px -14px 0; padding: 11px 14px; border-radius: 14px; border-bottom-color: transparent; }
  .maparea { position: absolute; left: 470px; top: 0; width: 1090px; height: 760px; overflow: hidden; }`;

// Builds the panel and the map inside a window. Returns handles to everything that moves.
async function buildMap(win) {
  const W = 1090, H = 760;
  document.head.insertAdjacentHTML('beforeend', `<style>${PANEL_CSS}</style>`);
  win.querySelector('.mapchips')?.remove();
  win.insertAdjacentHTML('afterbegin', PANEL);
  const area = document.createElement('div');
  area.className = 'maparea';
  const move = win.querySelector('.mapmove');
  area.appendChild(move);
  win.appendChild(area);
  move.innerHTML = `<svg width="${W}" height="${H}"><g class="lands"></g><g class="lines"></g></svg><div class="planes"></div><div class="tags"></div>`;

  const world = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json')).json();
  const countries = topojson.feature(world, world.objects.countries);
  const projection = d3.geoMercator().fitExtent([[40, 40], [W - 40, H - 30]], { type: 'MultiPoint', coordinates: [[-126, 55], [-66, 55], [-126, 10], [-66, 10]] });
  const path = d3.geoPath(projection);
  $('.lands', move).innerHTML = countries.features.map((f) => `<path class="land" d="${path(f) || ''}"/>`).join('');

  const P = (lon, lat) => projection([lon, lat]);
  const storm = P(-104.8, 17.3);
  const COLOR = { up: '#0b7dc0', down: '#c2570c' };
  const targets = [
    { key: 'guadalajara', at: P(-103.35, 20.67), dir: 'down', scores: [['Pacific Airports', '−77']], side: 'left', bend: -0.5 },
    { key: 'monterrey', at: P(-100.31, 25.67), dir: 'up', scores: [['Cemex', '+37']], side: 'right', bend: 0.34 },
    { key: 'miami', at: P(-80.19, 25.77), dir: 'down', scores: [['Norwegian', '−77'], ['Carnival', '−76']], side: 'right', bend: 0.2 },
    { key: 'calgary', at: P(-114.07, 51.05), dir: 'down', scores: [['Canadian Pacific', '−32']], side: 'right', bend: -0.16 },
  ];
  const lineLayer = $('.lines', move);
  const tags = $('.tags', move);
  const mk = (attrs) => {
    const p = document.createElementNS(NS, 'path');
    for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
    lineLayer.appendChild(p);
    return p;
  };

  const rings = [0, 1].map(() => { const r = document.createElement('div'); r.className = 'ring'; tags.appendChild(r); gsap.set(r, { x: storm[0], y: storm[1] }); return r; });
  const stormTag = document.createElement('div');
  stormTag.className = 'tag storm';
  stormTag.innerHTML = '<span>Hurricane Simon</span>';
  tags.appendChild(stormTag);
  gsap.set(stormTag, { x: storm[0] - 6, y: storm[1] + 36, xPercent: -100, transformOrigin: '100% 50%' });
  const stormDot = document.createElement('div');
  stormDot.className = 'tag storm';
  stormDot.innerHTML = '<i></i>';
  tags.appendChild(stormDot);
  gsap.set(stormDot, { x: storm[0], y: storm[1], transformOrigin: '0 0' });

  const items = targets.map((t) => {
    const [x1, y1] = storm;
    const [x2, y2] = t.at;
    const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2 - (y2 - y1) * t.bend} ${(y1 + y2) / 2 + (x2 - x1) * t.bend} ${x2} ${y2}`;
    const casing = mk({ d, fill: 'none', stroke: '#ffffff', 'stroke-width': 11, 'stroke-linecap': 'round' });
    const solid = mk({ d, fill: 'none', stroke: COLOR[t.dir], 'stroke-width': 5, 'stroke-linecap': 'round' });
    const flow = mk({ d, fill: 'none', stroke: COLOR[t.dir], 'stroke-width': 5, 'stroke-linecap': 'round', 'stroke-dasharray': '16 13', opacity: 0 });
    const length = solid.getTotalLength();
    const tag = document.createElement('div');
    tag.className = 'tag city';
    const names = t.scores.map(([who, score]) => `<span class="score ${t.dir}">${who}<b>${score}</b></span>`).join('');
    tag.innerHTML = t.side === 'left' ? `<div class="names" style="align-items:flex-end">${names}</div><i style="margin:-11px -11px 0 0"></i>` : `<i></i><div class="names">${names}</div>`;
    tags.appendChild(tag);
    gsap.set(tag, { x: x2, y: y2, xPercent: t.side === 'left' ? -100 : 0, transformOrigin: t.side === 'left' ? '100% 0%' : '0% 0%' });
    return { ...t, casing, solid, flow, length, tag };
  });

  const random = seeded(7);
  const planeBox = $('.planes', move);
  const planes = Array.from({ length: 30 }, () => {
    const el = document.createElement('div');
    el.className = 'plane';
    el.innerHTML = '<svg viewBox="0 0 28 28" width="26" height="26"><path fill="#3f4a5a" d="M14 2 L16.5 11 26 17 26 20 16.5 17.5 16 23 19 25.5 19 27 14 26 9 27 9 25.5 12 23 11.5 17.5 2 20 2 17 11.5 11 Z"/></svg>';
    planeBox.appendChild(el);
    return { el, x: 40 + random() * (W - 80), y: 40 + random() * (H - 220), heading: random() * 360, speed: 16 + random() * 16 };
  });

  // What keeps moving on its own: the dashes, the storm's rings and the planes.
  const tick = (t, ringsFrom = 0.4) => {
    items.forEach((it) => { it.flow.style.strokeDashoffset = -t * 44; });
    rings.forEach((r, i) => {
      const phase = (t * 0.6 + i * 0.5) % 1;
      gsap.set(r, { scale: 1 + phase * 3.4, opacity: t < ringsFrom ? 0 : 0.75 * (1 - phase) });
    });
    for (const p of planes) {
      const rad = ((p.heading - 90) * Math.PI) / 180;
      const x = p.x + Math.cos(rad) * p.speed * t;
      const y = p.y + Math.sin(rad) * p.speed * t;
      gsap.set(p.el, { x, y, rotation: p.heading, opacity: clamp((Math.hypot(x - storm[0], y - storm[1]) - 100) / 60) * 0.85 });
    }
  };
  return { W, H, move, storm, stormTag, stormDot, items, planeBox, tick };
}

// ---- Hands, drawn the way the app's camera view draws them ---------------------------------------
// 21 points of an open right hand, palm centre at 0,0, in pixels.
const OPEN = [[0, 74], [-40, 50], [-66, 22], [-84, -6], [-98, -32], [-32, -8], [-38, -52], [-41, -80], [-43, -104], [-8, -14], [-8, -62], [-8, -94], [-8, -120], [16, -10], [20, -54], [22, -84], [23, -106], [38, 2], [46, -32], [50, -56], [52, -76]];
// The same hand with thumb and index tips together.
const PINCH = OPEN.map((p, i) => ({ 3: [-70, -14], 4: [-56, -42], 7: [-50, -70], 8: [-54, -46] }[i] || p));
const BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
function makeHand(svg, flip) {
  const g = document.createElementNS(NS, 'g');
  const lines = BONES.map(() => { const l = document.createElementNS(NS, 'line'); l.setAttribute('stroke-width', '5'); l.setAttribute('stroke-linecap', 'round'); g.appendChild(l); return l; });
  const dots = OPEN.map(() => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', '6.5'); g.appendChild(c); return c; });
  svg.appendChild(g);
  return (h) => {
    const colour = h.p > 0.5 ? '#f08a24' : '#1cb0f6';
    const pts = OPEN.map((o, i) => [h.x + (flip ? -1 : 1) * (o[0] + (PINCH[i][0] - o[0]) * h.p) * 1.55, h.y + (o[1] + (PINCH[i][1] - o[1]) * h.p) * 1.55]);
    g.setAttribute('opacity', h.o);
    lines.forEach((l, i) => { const [a, b] = BONES[i]; l.setAttribute('x1', pts[a][0]); l.setAttribute('y1', pts[a][1]); l.setAttribute('x2', pts[b][0]); l.setAttribute('y2', pts[b][1]); l.setAttribute('stroke', colour); });
    dots.forEach((c, i) => { c.setAttribute('cx', pts[i][0]); c.setAttribute('cy', pts[i][1]); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', colour); c.setAttribute('stroke-width', '3'); });
  };
}

const SCENES = {
  // The opening: a dotted globe turning, with trade routes drawing between real cities.
  async globe() {
    const world = await (await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json')).json();
    const land = topojson.feature(world, world.objects.land);
    const canvas = $('#globe canvas');
    const ctx = canvas.getContext('2d');
    const CX = 1350, CY = 548, R = 400, RAD = Math.PI / 180, TILT = 20 * RAD;
    const vec = (lon, lat) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
    // Turn the globe, then tip the north pole toward the viewer.
    const turn = ([x, y, z], spin) => {
      const x1 = x * Math.cos(spin) + z * Math.sin(spin);
      const z1 = -x * Math.sin(spin) + z * Math.cos(spin);
      return [x1, y * Math.cos(TILT) - z1 * Math.sin(TILT), y * Math.sin(TILT) + z1 * Math.cos(TILT)];
    };
    const dots = [];
    for (let lat = -80; lat <= 84; lat += 1.45) {
      const step = 1.45 / Math.max(0.14, Math.cos(lat * RAD));
      for (let lon = -180; lon < 180; lon += step) if (d3.geoContains(land, [lon, lat])) dots.push(vec(lon, lat));
    }
    const C = { shanghai: [121.5, 31.2], la: [-118.2, 34], rotterdam: [4.5, 51.9], ny: [-74, 40.7], dubai: [55.3, 25.2], santos: [-46.3, -23.9], houston: [-95.4, 29.8], lagos: [3.4, 6.5], capetown: [18.4, -33.9], panama: [-79.5, 9], london: [-0.1, 51.5], tokyo: [139.7, 35.7], mumbai: [72.9, 19], vancouver: [-123.1, 49.3], lima: [-77, -12], miami: [-80.2, 25.8], dakar: [-17.4, 14.7], lisbon: [-9.1, 38.7], buenos: [-58.4, -34.6] };
    const ROUTES = [['rotterdam', 'ny'], ['santos', 'rotterdam'], ['lagos', 'houston'], ['capetown', 'santos'], ['london', 'lagos'], ['dubai', 'rotterdam'], ['ny', 'panama'], ['dakar', 'miami'], ['lisbon', 'buenos'], ['panama', 'la'], ['houston', 'rotterdam'], ['lima', 'la'], ['mumbai', 'capetown'], ['shanghai', 'la'], ['vancouver', 'tokyo'], ['miami', 'santos']];
    const routes = ROUTES.map(([from, to], i) => {
      const a = C[from], b = C[to];
      const along = d3.geoInterpolate(a, b);
      const lift = 0.05 + 0.34 * (d3.geoDistance(a, b) / Math.PI);
      const points = Array.from({ length: 73 }, (_, k) => {
        const s = k / 72;
        const v = vec(...along(s));
        const h = 1 + lift * Math.sin(Math.PI * s);
        return [v[0] * h, v[1] * h, v[2] * h];
      });
      return { points, start: 0.2 + i * 0.2, phase: (i * 0.37) % 1 };
    });
    const random = seeded(11);
    const stars = Array.from({ length: 150 }, () => ({ x: random() * 1920, y: random() * 1080, r: 0.6 + random() * 1.3, p: random() * 6.28 }));
    const state = { zoom: 1, fade: 0 };
    tl.fromTo('#globe .black', { opacity: 1 }, { opacity: 0, duration: 0.6, ease: 'power2.out' }, 0)
      .fromTo(state, { zoom: 1 }, { zoom: 1.13, duration: 4.5, ease: 'power1.in' }, 0)
      .from('#globe .kicker', { opacity: 0, y: 26, duration: 0.6, ease: 'power3.out' }, 0.85)
      .from('#globe .word', { opacity: 0, y: 44, duration: 0.8, ease: 'power3.out' }, 1.0)
      .from('#globe .line', { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out' }, 1.45)
      .to('#globe .block', { opacity: 0, x: -60, duration: 0.4, ease: 'power2.in' }, 4.05)
      // The last half second dives into the globe, which is where the next shot picks up.
      .to(state, { zoom: 3.1, duration: 0.5, ease: 'expo.in' }, 4.5)
      .to(state, { fade: 1, duration: 0.3, ease: 'power2.in' }, 4.7);

    const place = ([x, y, z], k) => [CX + R * k * x, CY - R * k * y, z];
    ticks.push((t) => {
      const spin = (18 + 11.5 * t) * RAD;
      const k = state.zoom;
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, 1920, 1080);
      const sky = ctx.createRadialGradient(CX, CY, 100, CX, CY, 1300);
      sky.addColorStop(0, '#0c2440');
      sky.addColorStop(1, '#06121f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, 1920, 1080);
      for (const st of stars) {
        ctx.globalAlpha = 0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * 1.4 + st.p));
        ctx.fillStyle = '#cfe9ff';
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const air = ctx.createRadialGradient(CX, CY, R * k * 0.96, CX, CY, R * k * 1.32);
      air.addColorStop(0, 'rgba(28,176,246,0.42)');
      air.addColorStop(1, 'rgba(28,176,246,0)');
      ctx.fillStyle = air;
      ctx.beginPath(); ctx.arc(CX, CY, R * k * 1.32, 0, 6.3); ctx.fill();
      const ball = ctx.createRadialGradient(CX - R * k * 0.35, CY - R * k * 0.4, R * k * 0.1, CX, CY, R * k);
      ball.addColorStop(0, '#12385f');
      ball.addColorStop(1, '#07182b');
      ctx.fillStyle = ball;
      ctx.beginPath(); ctx.arc(CX, CY, R * k, 0, 6.3); ctx.fill();
      ctx.strokeStyle = 'rgba(120,214,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#1cb0f6'; ctx.shadowBlur = 38;
      ctx.beginPath(); ctx.arc(CX, CY, R * k, 0, 6.3); ctx.stroke();
      ctx.shadowBlur = 0;
      for (const d of dots) {
        const [x, y, z] = place(turn(d, spin), k);
        if (z <= 0.02) continue;
        ctx.globalAlpha = 0.22 + 0.78 * z;
        ctx.fillStyle = '#58c6fb';
        ctx.beginPath(); ctx.arc(x, y, 1.9 * k, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.lineCap = 'round';
      for (const route of routes) {
        const drawn = clamp((t - route.start) / 1.1);
        if (drawn <= 0) continue;
        const last = Math.floor(drawn * 72);
        const pts = route.points.map((p) => place(turn(p, spin), k));
        const seen = (p) => p[2] > 0 || Math.hypot(p[0] - CX, p[1] - CY) > R * k * 1.005;
        for (const [width, colour] of [[7, 'rgba(28,176,246,0.16)'], [2.2, 'rgba(170,232,255,0.95)']]) {
          ctx.strokeStyle = colour;
          ctx.lineWidth = width * Math.min(k, 1.6);
          ctx.beginPath();
          let pen = false;
          for (let i = 0; i <= last; i++) {
            if (!seen(pts[i])) { pen = false; continue; }
            if (pen) ctx.lineTo(pts[i][0], pts[i][1]); else ctx.moveTo(pts[i][0], pts[i][1]);
            pen = true;
          }
          ctx.stroke();
        }
        ctx.shadowColor = '#9fe3ff'; ctx.shadowBlur = 16;
        ctx.fillStyle = '#ffffff';
        for (const end of [pts[0], drawn >= 1 ? pts[72] : null]) {
          if (end && end[2] > 0) { ctx.beginPath(); ctx.arc(end[0], end[1], 4.2, 0, 6.3); ctx.fill(); }
        }
        const bead = drawn < 1 ? pts[last] : pts[Math.floor((((t - route.start) * 0.42 + route.phase) % 1) * 72)];
        if (seen(bead)) { ctx.beginPath(); ctx.arc(bead[0], bead[1], 5.2, 0, 6.3); ctx.fill(); }
        ctx.shadowBlur = 0;
      }
      if (state.fade > 0) { ctx.globalAlpha = state.fade; ctx.fillStyle = '#bfe6ff'; ctx.fillRect(0, 0, 1920, 1080); ctx.globalAlpha = 1; }
    });
  },

  // The caption on each sky shot. It opens with a flash, which hides the cut underneath.
  'ov-label'() {
    const LABELS = {
      sat: ['Satellites', 'Storms, spotted the moment they form.', 'From NASA, around the clock'],
      air: ['Flight tracking', 'Every plane in the sky, steering around the storm.', 'From the OpenSky Network, live'],
      sea: ['Ship traffic', 'Cargo slowing at the world’s choke points.', 'From the IMF’s PortWatch, 28 choke points'],
    };
    const [kicker, headline, source] = LABELS[arg];
    const length = Number(arg2) || 5;
    $('#ov-label .k').textContent = kicker;
    $('#ov-label .headline').innerHTML = headline.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
    $('#ov-label .source').textContent = source;
    tl.fromTo('#ov-label .flash', { opacity: 0.85 }, { opacity: 0, duration: 0.32, ease: 'power2.out' }, 0)
      .from('#ov-label .scrim', { opacity: 0, duration: 0.6 }, 0.25)
      .from('#ov-label .tagk', { opacity: 0, x: -26, duration: 0.5, ease: 'power3.out' }, 0.35)
      .from('#ov-label .headline .w', { opacity: 0, y: 44, duration: 0.55, stagger: 0.055, ease: 'power3.out' }, 0.45)
      .from('#ov-label .source', { opacity: 0, y: 14, duration: 0.5, ease: 'power3.out' }, 1.0)
      .to('#ov-label .block, #ov-label .scrim', { opacity: 0, duration: 0.35, ease: 'power2.in' }, length - 0.6);
  },

  // Three feeds flow into one point.
  converge() {
    common('converge');
    const svg = $('#converge svg');
    svg.style.filter = 'drop-shadow(0 0 10px rgba(28,176,246,0.85))';
    const center = [960, 450];
    const lines = [[-40, 150], [-40, 450], [-40, 750]].map(([x, y]) => {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M ${x} ${y} C ${x + 560} ${y}, ${center[0] - 460} ${center[1]}, ${center[0]} ${center[1]}`);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#1cb0f6');
      p.setAttribute('stroke-width', '4');
      p.setAttribute('stroke-linecap', 'round');
      svg.appendChild(p);
      const length = p.getTotalLength();
      p.style.strokeDasharray = length;
      p.style.strokeDashoffset = length;
      return { p, length, at: { v: 0 } };
    });
    const feeds = $$('#converge .feed');
    gsap.set(rig, { transformOrigin: '960px 450px' });
    tl.fromTo(fx, { blur: 10 }, { blur: 0, duration: 0.3 }, 0)
      .to(lines.map((l) => l.p), { strokeDashoffset: 0, duration: 0.8, ease: 'power2.inOut', stagger: 0.08 }, 0.02)
      .to(lines.map((l) => l.at), { v: 1, duration: 1.2, ease: 'power2.inOut', stagger: 0.1 }, 0.08)
      .from('#converge .core', { scale: 0, opacity: 0, duration: 0.5, ease: 'back.out(1.8)' }, 0.45)
      .from('#converge .say', { opacity: 0, y: 34, duration: 0.5, ease: 'power3.out' }, 0.7)
      .to('#converge .core', { scale: 1.25, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.32)
      .fromTo('#converge .ringout', { scale: 1, opacity: 0.9 }, { scale: 9, opacity: 0, duration: 0.8, ease: 'power2.out', immediateRender: false }, 1.36)
      .fromTo(rig, { scale: 1 }, { scale: 1.06, duration: 2.2, ease: 'none' }, 0)
      .to(rig, { scale: 3.2, opacity: 0, duration: 0.34, ease: 'expo.in' }, 2.24)
      .to(fx, { blur: 22, duration: 0.34, ease: 'power2.in' }, 2.24);
    ticks.push(() => {
      feeds.forEach((el, i) => {
        const { p, length, at } = lines[i];
        const point = p.getPointAtLength(at.v * length);
        const fade = clamp(at.v / 0.08) * clamp((1 - at.v) / 0.16);
        gsap.set(el, { x: point.x, y: point.y, xPercent: -50, yPercent: -50, opacity: fade, scale: 0.6 + 0.4 * clamp((1 - at.v) / 0.3) });
      });
    });
  },

  // Ask a question, get the answer, zoom into the scores, open the reason.
  ask() {
    common('ask');
    const full = 'Hurricane Simon is heading for Mexico';
    const win = $('#ask .win');
    const typed = $('#ask .typed');
    const caret = $('#ask .caret');
    const reply = $('#ask .reply');
    const more = $('#ask .more');
    const cursor = $('#ask .cursor');
    const click = $('#ask .click');

    // Measure where things end up before anything is animated.
    const closed = reply.getBoundingClientRect().height;
    more.style.height = 'auto';
    const opened = more.getBoundingClientRect().height;
    more.style.height = '0px';
    const see = $('#see').getBoundingClientRect();
    const send = $('#ask .send').getBoundingClientRect();
    const pick = $('#pick').getBoundingClientRect();
    const aim = { x: see.left + see.width * 0.45, y: see.top + see.height * 0.5 };
    gsap.set(reply, { opacity: 0 });
    gsap.set(rig, { transformOrigin: `1150px ${pick.top + 60}px` });

    enter('ask', 0);
    tl.fromTo(cursor, { x: 1500, y: 700, opacity: 0 }, { opacity: 1, duration: 0.2 }, 1.2)
      .to(cursor, { x: send.left + 22, y: send.top + 24, duration: 0.45, ease: 'power2.inOut' }, 1.2)
      .to('#ask .send', { scale: 0.82, duration: 0.08, yoyo: true, repeat: 1 }, 1.68)
      .fromTo(click, { x: send.left + 30, y: send.top + 30, scale: 0.3, opacity: 0.9 }, { scale: 1.2, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, 1.7)
      .to('#ask .compose', { opacity: 0, y: -24, duration: 0.22, ease: 'power2.in' }, 1.82)
      .to(cursor, { opacity: 0, duration: 0.2 }, 1.85)
      .to(win, { height: closed, duration: 0.55, ease: 'expo.out' }, 1.95)
      .to(reply, { opacity: 1, duration: 0.2 }, 2.05)
      .from('#ask .bottom', { opacity: 0, y: 16, duration: 0.4, ease: 'power2.out' }, 2.08)
      .from('#ask .group, #ask .row', { opacity: 0, x: 36, duration: 0.4, stagger: 0.09, ease: 'power3.out' }, 2.22)
      // Push in on the scores.
      .to(rig, { scale: 1.46, duration: 0.9, ease: 'power3.inOut' }, 3.2)
      .to(win, { rotationY: -5, rotationX: 2, duration: 0.9, ease: 'power3.inOut' }, 3.2)
      .fromTo(cursor, { x: aim.x + 260, y: aim.y + 200 }, { opacity: 1, duration: 0.2, immediateRender: false }, 4.2)
      .to(cursor, { x: aim.x - 6, y: aim.y - 4, duration: 0.5, ease: 'power2.inOut' }, 4.2)
      .to(cursor, { scale: 0.86, duration: 0.08, yoyo: true, repeat: 1, transformOrigin: '10% 10%' }, 4.74)
      .fromTo(click, { x: aim.x, y: aim.y, scale: 0.3, opacity: 0.9 }, { scale: 1.2, opacity: 0, duration: 0.45, ease: 'power2.out', immediateRender: false }, 4.78)
      .to(more, { height: opened, duration: 0.5, ease: 'expo.out' }, 4.86)
      .to(win, { height: closed + opened, duration: 0.5, ease: 'expo.out' }, 4.86)
      .from('#ask .step, #ask .arrow', { opacity: 0, x: -18, scale: 0.9, duration: 0.35, stagger: 0.13, ease: 'back.out(1.6)' }, 5.0)
      .from('#ask .math', { opacity: 0, y: 10, duration: 0.4 }, 5.75)
      .to(cursor, { x: aim.x + 180, y: aim.y + 260, opacity: 0, duration: 0.6, ease: 'power2.in' }, 5.3)
      // Pull back out.
      .to(rig, { scale: 1, duration: 1.0, ease: 'power3.inOut' }, 6.35)
      .to(win, { rotationY: 4, rotationX: 0, duration: 1.0, ease: 'power3.inOut' }, 6.35);
    hideSuper('ask', 3.12, 6.8);
    $$('#ask .n').forEach((el, i) => count(el, 2.45 + i * 0.1, 0.8));
    leave('ask', 7.68);
    ticks.push((t) => {
      const typing = clamp((t - 0.42) / 0.85);
      typed.textContent = full.slice(0, Math.round(typing * full.length));
      caret.style.opacity = typing > 0 && typing < 1 ? 1 : Math.floor(t * 2.4) % 2 ? 0 : 1;
    });
  },

  // The app's map: start on the storm, then pull back as its lines shoot out to each place.
  async mapweb() {
    common('mapweb');
    const win = $('#mapweb .win');
    const m = await buildMap(win);
    const sx = 180 + 470 + m.storm[0];
    const sy = 262 + m.storm[1];
    gsap.set(rig, { transformOrigin: `${sx}px ${sy}px` });
    for (const it of m.items) for (const p of [it.casing, it.solid]) { p.style.strokeDasharray = it.length; p.style.strokeDashoffset = it.length; }
    gsap.set(m.planeBox, { opacity: 0 });

    enter('mapweb', 0, false, 2.1);
    hideSuper('mapweb', 3.42, 0);
    tl.fromTo(rig, { scale: 2.7, opacity: 0 }, { opacity: 1, duration: 0.3, ease: 'power2.out' }, 0)
      .from(m.stormDot, { scale: 0, opacity: 0, duration: 0.4, ease: 'back.out(2)' }, 0.1)
      .from(m.stormTag, { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(1.7)' }, 0.25)
      .to(rig, { scale: 1, duration: 1.9, ease: 'expo.inOut' }, 0.6)
      .from('#mapweb .mpanel > *', { opacity: 0, x: -24, duration: 0.45, stagger: 0.07, ease: 'power3.out' }, 1.5)
      .to(m.planeBox, { opacity: 1, duration: 0.6 }, 2.7);
    m.items.forEach((it, i) => {
      const start = 0.55 + i * 0.24;
      tl.to([it.casing, it.solid], { strokeDashoffset: 0, duration: 0.75, ease: 'power2.inOut' }, start)
        .from(it.tag, { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' }, start + 0.55)
        .to(it.solid, { opacity: 0, duration: 0.35 }, start + 0.8)
        .to(it.flow, { opacity: 1, duration: 0.35 }, start + 0.8);
    });
    // Second move: lean in on the cruise lines in Miami.
    const miami = m.items.find((it) => it.key === 'miami').at;
    gsap.set(win, { transformOrigin: `${470 + miami[0] - 120}px ${miami[1]}px` });
    tl.to(win, { scale: 1.42, rotationY: -7, rotationX: 3, duration: 1.4, ease: 'power3.inOut' }, 3.5);
    leave('mapweb', 5.66);
    const planesChip = $('#mapweb [data-chip="planes"]');
    const shipsChip = $('#mapweb [data-chip="ships"]');
    ticks.push((t) => {
      planesChip.classList.toggle('on', t >= 2.6);
      shipsChip.classList.toggle('on', t >= 3.1);
      m.tick(t, 0.3);
    });
  },

  // Three patterns, each with its number and its reason.
  patterns() {
    common('patterns');
    const cards = $$('#patterns .stat');
    // The middle card's little picture: a ring of planes with nothing inside it.
    const radar = $('#patterns .radar');
    const dots = [];
    radar.innerHTML = '<circle cx="237" cy="60" r="30" fill="#fdf0e6" stroke="#c2570c" stroke-width="3" stroke-dasharray="7 7"/><circle cx="237" cy="60" r="56" fill="none" stroke="#e6e6e6" stroke-width="2"/>';
    const random = seeded(5);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.283 + random() * 0.3;
      const r = 58 + random() * 150;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', 237 + Math.cos(a) * r * 1.5);
      c.setAttribute('cy', 60 + Math.sin(a) * Math.min(r, 56) * 0.95);
      c.setAttribute('r', '5.5');
      c.setAttribute('fill', '#3f4a5a');
      radar.appendChild(c);
      dots.push(c);
    }
    $('#patterns .stat:nth-child(2) .n').dataset.from = '59';
    const paths = $$('#patterns .draw');
    for (const p of paths) { const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len; }

    enter('patterns', 0, false);
    tl.fromTo(rig, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0)
      .from(cards, { y: 150, rotationX: 46, scale: 0.78, opacity: 0, duration: 0.7, stagger: 0.13, ease: 'back.out(1.25)', transformPerspective: 1800 }, 0.08)
      .to(paths, { strokeDashoffset: 0, duration: 0.95, ease: 'power2.inOut', stagger: 0.26 }, 0.7)
      .from(dots, { scale: 0, opacity: 0, duration: 0.3, stagger: 0.03, ease: 'back.out(2)', transformOrigin: '50% 50%' }, 0.85)
      .from('#patterns .y', { opacity: 0, y: 16, duration: 0.45, stagger: 0.13, ease: 'power3.out' }, 1.5)
      .fromTo(rig, { x: 26, scale: 1 }, { x: -26, scale: 1.05, duration: 4.2, ease: 'none' }, 0)
      // Each card lifts in turn.
      .to(cards, { y: -18, duration: 0.3, stagger: 0.28, ease: 'power2.out', yoyo: true, repeat: 1 }, 2.35);
    $$('#patterns .n').forEach((el, i) => count(el, 0.5 + i * 0.13, 0.95));
    leave('patterns', 4.16);
  },

  // The Top stocks page.
  board() {
    common('board');
    const win = $('#board .win');
    const UP = [['Home Depot', 'HD', 48], ['Lowe’s', 'LOW', 47], ['Cemex', 'CX', 37], ['Matson', 'MATX', 36]];
    const DOWN = [['Norwegian Cruise', 'NCLH', -77], ['Pacific Airports', 'PAC', -77], ['Carnival', 'CCL', -76], ['Canadian Pacific', 'CP', -32]];
    const fill = (col, list, dir) => {
      for (const [who, ticker, score] of list) {
        $(`#board .col.${dir}`).insertAdjacentHTML('beforeend', `<div class="brow"><div class="name">${who} <span class="tick">${ticker}</span></div><div class="track"><div class="fill ${dir}" data-w="${Math.abs(score) / 100}"></div></div><div class="num ${dir}"><span class="n" data-n="${score}" data-prefix="${score > 0 ? '+' : ''}"></span></div></div>`);
      }
    };
    fill('up', UP, 'up');
    fill('down', DOWN, 'down');
    const fills = $$('#board .fill');
    enter('board', 0);
    tl.fromTo(win, { rotationY: -15 }, { rotationY: 6, duration: 4, ease: 'power1.inOut' }, 0)
      .from('#board h3, #board .sub, #board .group', { opacity: 0, y: 18, duration: 0.4, stagger: 0.06, ease: 'power3.out' }, 0.25)
      .from('#board .brow', { opacity: 0, x: 44, duration: 0.42, stagger: 0.06, ease: 'power3.out' }, 0.4)
      .fromTo(rig, { scale: 1 }, { scale: 1.06, duration: 3.6, ease: 'none', immediateRender: false }, 0.6);
    fills.forEach((el, i) => tl.fromTo(el, { scaleX: 0 }, { scaleX: Number(el.dataset.w), duration: 0.8, ease: 'expo.out' }, 0.6 + i * 0.06));
    $$('#board .n').forEach((el, i) => count(el, 0.6 + i * 0.06, 0.8));
    sweep($('#board .sweep'), 2.2, 1500);
    leave('board', 3.66);
  },

  // The reader's own holdings, in dollars.
  portfolio() {
    common('portfolio');
    gsap.set(rig, { transformOrigin: '960px 520px' });
    enter('portfolio', 0);
    tl.from('#portfolio h3, #portfolio .sub', { opacity: 0, y: 18, duration: 0.4, stagger: 0.07, ease: 'power3.out' }, 0.25)
      .from('#portfolio .tile', { opacity: 0, scale: 0.84, y: 30, duration: 0.55, stagger: 0.12, ease: 'back.out(1.5)' }, 0.38)
      .to(rig, { scale: 1.24, duration: 0.8, ease: 'power3.inOut' }, 0.75)
      .to(rig, { scale: 1, duration: 0.85, ease: 'power3.inOut' }, 1.85)
      .from('#portfolio .frow', { opacity: 0, y: 26, duration: 0.5, stagger: 0.2, ease: 'power3.out' }, 1.95)
      .fromTo('#portfolio .win', { rotationY: 5 }, { rotationY: -5, duration: 4, ease: 'power1.inOut' }, 0);
    hideSuper('portfolio', 0.7, 2.4);
    $$('#portfolio .n').forEach((el, i) => count(el, 0.5 + i * 0.12, 1.0));
    sweep($('#portfolio .sweep'), 2.75, 1320);
    leave('portfolio', 3.66);
  },

  // Hand control: point at the storm and pinch to pick it, drag the map, then zoom with two hands.
  async hand() {
    common('hand');
    const win = $('#hand .win');
    const m = await buildMap(win);
    for (const it of m.items) { it.solid.setAttribute('opacity', 0); it.flow.setAttribute('opacity', 1); }
    $$('#hand .chip').forEach((c) => c.classList.add('on'));
    const ox = 180 + 470, oy = 262;
    const storm = [ox + m.storm[0], oy + m.storm[1]];
    const svg = $('#hand .hands');
    const draw1 = makeHand(svg, false);
    const draw2 = makeHand(svg, true);
    const h1 = { x: 1500, y: 900, p: 0, o: 0 };
    const h2 = { x: 900, y: 700, p: 1, o: 0 };
    const map = { x: 0, y: 0, s: 1 };
    const pointer = $('#hand .pointer');
    const click = $('#hand .click');
    const grab = [storm[0] + 520, storm[1] - 250];
    const dragTo = [grab[0] - 250, grab[1] + 40];

    enter('hand', 0);
    tl.to(h1, { o: 1, duration: 0.25 }, 0.5)
      .to(h1, { x: storm[0] + 6, y: storm[1] + 4, duration: 0.8, ease: 'power2.inOut' }, 0.5)
      .to(m.stormTag, { scale: 1.12, duration: 0.2, ease: 'power2.out' }, 1.25)
      .to(h1, { p: 1, duration: 0.12, ease: 'power2.in' }, 1.42)
      .fromTo(click, { x: storm[0], y: storm[1], scale: 0.3, opacity: 0.95 }, { scale: 1.5, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, 1.54)
      .to(h1, { p: 0, duration: 0.12 }, 1.9)
      .to(m.stormTag, { scale: 1, duration: 0.2 }, 1.9)
      .to(h1, { x: grab[0], y: grab[1], duration: 0.45, ease: 'power2.inOut' }, 2.0)
      .to(h1, { p: 1, duration: 0.1, ease: 'power2.in' }, 2.5)
      .to(h1, { x: dragTo[0], y: dragTo[1], duration: 0.75, ease: 'power2.inOut' }, 2.64)
      .to(map, { x: dragTo[0] - grab[0], y: dragTo[1] - grab[1], duration: 0.75, ease: 'power2.inOut' }, 2.64)
      .to(h2, { o: 1, duration: 0.2 }, 3.3)
      .fromTo(h2, { x: dragTo[0] - 200, y: dragTo[1] + 60 }, { x: dragTo[0] - 330, y: dragTo[1] + 90, duration: 0.8, ease: 'power2.inOut', immediateRender: true }, 3.55)
      .to(h1, { x: dragTo[0] + 300, y: dragTo[1] - 30, duration: 0.8, ease: 'power2.inOut' }, 3.55)
      .to(map, { s: 1.5, duration: 0.8, ease: 'power2.inOut' }, 3.55)
      .to([h1, h2], { p: 0, duration: 0.12 }, 4.42)
      .to([h1, h2], { o: 0, duration: 0.25 }, 4.5)
      .to('#hand .flash', { opacity: 1, duration: 0.3, ease: 'power2.in' }, 4.7);
    leave('hand', 4.62);
    ticks.push((t) => {
      m.tick(t + 3, 0);
      m.stormTag.classList.toggle('picked', t >= 1.54);
      // Zoom around the point halfway between the two hands.
      const mid = [(dragTo[0] - 200 + dragTo[0]) / 2 - ox, dragTo[1] + 30 - oy];
      const tx = mid[0] - map.s * (mid[0] - map.x);
      const ty = mid[1] - map.s * (mid[1] - map.y);
      m.move.style.transform = `translate(${tx}px, ${ty}px) scale(${map.s})`;
      draw1(h1);
      draw2(h2);
      gsap.set(pointer, { x: h1.x, y: h1.y, opacity: h1.o, scale: h1.p > 0.5 ? 0.7 : 1 });
      pointer.style.borderColor = h1.p > 0.5 ? '#f08a24' : '#1cb0f6';
    });
  },

  // The closing card, with the mascot floating.
  end() {
    rig = $('#end .rig');
    const mascot = $('#end .mascot');
    const bob = document.createElement('div');
    bob.style.position = 'relative';
    while (mascot.firstChild) bob.appendChild(mascot.firstChild);
    mascot.appendChild(bob);
    gsap.set(rig, { transformOrigin: '960px 540px' });
    tl.fromTo('#end .white', { opacity: 1 }, { opacity: 0, duration: 0.45, ease: 'power2.out' }, 0)
      .fromTo(rig, { scale: 1.1 }, { scale: 1, duration: 2.6, ease: 'expo.out' }, 0)
      .from('#end .dots', { opacity: 0, duration: 1.2 }, 0)
      .from('#end .kicker', { opacity: 0, y: 24, duration: 0.6, ease: 'power3.out' }, 0.25)
      .from('#end .word', { opacity: 0, y: 46, duration: 0.85, ease: 'power3.out' }, 0.4)
      .from('#end .line', { opacity: 0, y: 26, duration: 0.7, ease: 'power3.out' }, 0.85)
      .from('#end .small', { opacity: 0, duration: 0.7 }, 1.45)
      .from(mascot, { opacity: 0, y: 110, scale: 0.9, duration: 1.0, ease: 'back.out(1.5)' }, 0.5)
      .from('#end .shadow', { opacity: 0, duration: 0.8 }, 0.9)
      .fromTo(rig, { scale: 1 }, { scale: 1.035, duration: 5, ease: 'none', immediateRender: false }, 2.6);
    sweep($('#end .sweep'), 1.5, 900);
    const shadow = $('#end .shadow');
    const dots = $('#end .dots');
    ticks.push((t) => {
      const lift = Math.sin(t * 1.5) * 13;
      gsap.set(bob, { y: lift });
      gsap.set(shadow, { scaleX: 1 - lift / 110 });
      dots.style.backgroundPosition = `${t * 9}px ${t * 4}px`;
    });
  },
};

(async () => {
  document.getElementById(name).classList.add('on');
  await Promise.all(['600 40px "DM Sans"', '500 40px "DM Sans"', '700 40px "DM Sans"', '400 20px Inter', '500 20px Inter', '600 20px Inter'].map((f) => document.fonts.load(f)));
  await Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  await SCENES[name]();
  window.seek = (t) => {
    tl.time(Math.min(t, tl.duration()), false);
    for (const tick of ticks) tick(t);
  };
  window.seek(0);
  window.ready = true;
})().catch((err) => { window.failed = String((err && err.stack) || err); });
