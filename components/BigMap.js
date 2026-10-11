'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SignalTag } from '@/components/Stocks';
import { Sparkline } from '@/components/charts';
import HandControl from '@/components/HandControl';
import MapVoice from '@/components/MapVoice';
import { bentPath, buildWeb } from '@/lib/web';

const LINE = { tailwind: '#0b7dc0', headwind: '#c2570c', hub: '#737373' };
const BEND = { tailwind: 0.16, headwind: -0.16, hub: 0.05 };
const STYLES = { light: 'https://tiles.openfreemap.org/styles/liberty', dark: 'https://tiles.openfreemap.org/styles/dark' };
const DASHES = [[0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]];
const FLOWING = ['web-tailwind', 'web-headwind'];
const PLANE_LAYER = {
  id: 'planes',
  type: 'symbol',
  source: 'planes',
  layout: {
    'icon-image': 'plane',
    'icon-rotate': ['get', 'heading'],
    'icon-rotation-alignment': 'map',
    'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.3, 4, 0.5, 8, 0.85],
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
    visibility: 'none',
  },
  paint: { 'icon-opacity': 0.8 },
};
const LAYERS = [['storms', 'Storms'], ['alerts', 'Weather alerts'], ['news', 'News'], ['planes', 'Planes'], ['ships', 'Cargo ships']];
const KIND_WORD = { ships: 'Ships', planes: 'Planes', airport: 'Airport' };

function planeIcon(color) {
  const size = 28;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [x, y] of [[14, 2], [16.5, 11], [26, 17], [26, 20], [16.5, 17.5], [16, 23], [19, 25.5], [19, 27], [14, 26], [9, 27], [9, 25.5], [12, 23], [11.5, 17.5], [2, 20], [2, 17], [11.5, 11]]) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function dot(className, title, label) {
  const el = document.createElement('div');
  el.className = className;
  if (title) el.title = title;
  if (label !== undefined) {
    el.appendChild(document.createElement('i'));
    const span = document.createElement('span');
    span.textContent = label;
    el.appendChild(span);
  }
  return el;
}

function CompanyRows({ companies, showEvent }) {
  return (
    <ul className="rows">
      {companies.map((c) => (
        <li key={`${c.eventId}-${c.ticker}`} className="web-company">
          <span>
            <b>{c.name}</b> <span className="ticker">{c.ticker}</span>
            <span className="muted small">{showEvent ? `From ${c.event}. ` : `${c.city}. `}{c.why}.</span>
          </span>
          <SignalTag direction={c.direction} score={c.score} />
        </li>
      ))}
    </ul>
  );
}

export default function BigMap({ signals, loading, onPick, onClose }) {
  const mapEl = useRef(null);
  const gl = useRef(null);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [newsStocks, setNewsStocks] = useState(null);
  const [board, setBoard] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showHubs, setShowHubs] = useState(true);
  const [layers, setLayers] = useState({ storms: true, alerts: true, news: true, planes: false, ships: true });
  const [patterns, setPatterns] = useState(null);
  const [planes, setPlanes] = useState(null);
  const [allPatterns, setAllPatterns] = useState(false);
  const [full, setFull] = useState(true);
  const close = useRef(onClose);
  close.current = onClose;
  const flown = useRef('');
  const voicePin = useRef(null);

  useEffect(() => {
    fetch('/api/news-stocks').then((r) => r.json()).then(setNewsStocks).catch(() => {});
    fetch('/api/board').then((r) => r.json()).then(setBoard).catch(() => {});
    fetch('/api/patterns').then((r) => r.json()).then(setPatterns).catch(() => {});
  }, []);

  useEffect(() => {
    if (layers.planes && !planes) fetch('/api/planes').then((r) => r.json()).then(setPlanes).catch(() => setPlanes({ planes: [], asOf: null }));
  }, [layers.planes, planes]);

  const shown = useMemo(() => signals && {
    ...signals,
    sky: (signals.sky || []).filter((s) => (s.kind === 'weather' ? layers.alerts : layers.storms)),
    news: layers.news ? signals.news : [],
  }, [signals, layers.storms, layers.alerts, layers.news]);

  const web = useMemo(() => {
    const scores = new Map();
    for (const s of [...(newsStocks?.stocks || []), ...(board?.bullish || []), ...(board?.bearish || [])]) scores.set(s.ticker, s.score);
    return buildWeb(shown, newsStocks, scores);
  }, [shown, newsStocks, board]);

  useEffect(() => {
    let gone = false;
    let frame = 0;
    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (gone || !mapEl.current) return;
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const map = new maplibregl.Map({ container: mapEl.current, style: dark ? STYLES.dark : STYLES.light, center: [-40, 25], zoom: 2, minZoom: 1.2, attributionControl: { compact: true } });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
      gl.current = { maplibregl, map, markers: [], dark };

      map.on('load', () => {
        if (gone) return;
        const casing = dark ? '#0a0a0a' : '#ffffff';
        const lit = (yes, no) => ['case', ['get', 'on'], yes, no];
        try {
          map.addImage('plane', planeIcon(dark ? '#e5e5e5' : '#27272a'));
          map.addSource('planes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map.addLayer(PLANE_LAYER);
        } catch (err) {
          console.error('Could not set up the plane layer:', err.message);
        }
        map.addSource('web', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'web-casing', type: 'line', source: 'web', filter: ['!=', ['get', 'direction'], 'hub'], layout: { 'line-cap': 'round' }, paint: { 'line-color': casing, 'line-width': 6, 'line-opacity': lit(0.85, 0.12) } });
        map.addLayer({ id: 'web-hub', type: 'line', source: 'web', filter: ['==', ['get', 'direction'], 'hub'], paint: { 'line-color': LINE.hub, 'line-width': 1.5, 'line-opacity': lit(0.9, 0.15), 'line-dasharray': [1, 3] } });
        for (const direction of ['tailwind', 'headwind']) {
          map.addLayer({ id: `web-${direction}`, type: 'line', source: 'web', filter: ['==', ['get', 'direction'], direction], paint: { 'line-color': LINE[direction], 'line-width': lit(2.8, 1.3), 'line-opacity': lit(0.95, 0.16), 'line-dasharray': DASHES[0] } });
        }
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          let step = 0;
          const flow = (time) => {
            const next = Math.floor(time / 70) % DASHES.length;
            if (next !== step) {
              step = next;
              for (const id of FLOWING) map.setPaintProperty(id, 'line-dasharray', DASHES[step]);
            }
            frame = requestAnimationFrame(flow);
          };
          frame = requestAnimationFrame(flow);
        }
        setReady(true);
      });
    })();
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      gl.current?.map.remove();
      gl.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close.current(); };
    const onFullscreen = () => {
      setFull(Boolean(document.fullscreenElement));
      gl.current?.map.resize();
    };
    onFullscreen();
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    const scroll = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.body.style.overflow = scroll;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!ready || !gl.current) return;
    const { map } = gl.current;
    if (!map.getLayer('planes')) return;
    map.setLayoutProperty('planes', 'visibility', layers.planes ? 'visible' : 'none');
    if (!layers.planes || !planes) return;
    map.getSource('planes').setData({
      type: 'FeatureCollection',
      features: planes.planes.map(([lon, lat, heading, callsign]) => ({ type: 'Feature', properties: { heading, callsign }, geometry: { type: 'Point', coordinates: [lon, lat] } })),
    });
  }, [ready, planes, layers.planes]);

  useEffect(() => {
    if (!ready || !gl.current) return;
    const { maplibregl, map, markers } = gl.current;
    markers.splice(0).forEach((m) => m.remove());
    const pin = (el, [lat, lon], options = {}) => {
      markers.push(new maplibregl.Marker({ element: el, ...options }).setLngLat([lon, lat]).addTo(map));
      return el;
    };
    const lit = (line) => !selected || (selected.type === 'event' ? line.eventId === selected.id : selected.type === 'place' ? line.place === selected.id : false);
    const features = [];
    const reach = [];
    const hubs = new Map();

    for (const line of web.lines) {
      const isHub = line.direction === 'hub';
      if (isHub && !showHubs) continue;
      const on = lit(line);
      const path = bentPath(line.from, line.to, BEND[line.direction]);
      features.push({ type: 'Feature', properties: { direction: line.direction, on }, geometry: { type: 'LineString', coordinates: path.map(([lat, lon]) => [lon, lat]) } });
      const end = path[path.length - 1];
      if (isHub) hubs.set(line.hub, { name: line.hub, why: line.why, at: end });
      if (on) reach.push(line.from, end);
    }
    map.getSource('web').setData({ type: 'FeatureCollection', features });

    for (const hub of hubs.values()) pin(dot('web-hub', `${hub.name}: ${hub.why}`), hub.at);

    if (layers.ships) {
      for (const point of patterns?.ships.points || []) {
        const pct = point.typical >= 5 ? point.typicalPct : 0;
        const tone = pct <= -20 ? ' down' : pct >= 20 ? ' up' : '';
        const picked = selected?.type === 'ship' && selected.id === point.id;
        const el = pin(dot(`web-ship${tone}${picked ? ' picked' : ''}`, `${point.name}: ${point.perDay} ships a day`, tone ? `${point.name} ${pct > 0 ? '+' : ''}${pct}%` : point.name), [point.lat, point.lon], { anchor: 'left', offset: [-7, 0] });
        el.addEventListener('click', (e) => { e.stopPropagation(); setSelected({ type: 'ship', id: point.id }); });
        if (picked) reach.push([point.lat, point.lon]);
      }
    }
    if (layers.planes) {
      for (const airport of patterns?.airports || []) {
        if (airport.lat === null) continue;
        const picked = selected?.type === 'airport' && selected.id === airport.id;
        const el = pin(dot(`web-airport${picked ? ' picked' : ''}`, `${airport.name}: ${airport.kind}`, airport.code), [airport.lat, airport.lon], { anchor: 'left', offset: [-7, 0] });
        el.addEventListener('click', (e) => { e.stopPropagation(); setSelected({ type: 'airport', id: airport.id }); });
        if (picked) reach.push([airport.lat, airport.lon]);
      }
    }

    for (const place of web.places) {
      const on = !selected || (selected.type === 'place' ? selected.id === place.id : place.companies.some((c) => c.eventId === selected.id));
      const names = [...new Set(place.companies.map((c) => c.name))];
      const el = pin(dot(`web-place${on ? '' : ' dim'}${selected?.type === 'place' && selected.id === place.id ? ' picked' : ''}`, `${place.city}: ${names.join(', ')}`), [place.lat, place.lon]);
      const size = 12 + Math.min(names.length, 5) * 2;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.addEventListener('click', (e) => { e.stopPropagation(); setSelected({ type: 'place', id: place.id }); });
    }

    for (const event of web.events) {
      const on = !selected || (selected.type === 'event' ? selected.id === event.id : event.companies.some((c) => c.city === selected.id));
      const el = pin(dot(`web-event${on ? '' : ' dim'}${selected?.type === 'event' && selected.id === event.id ? ' picked' : ''}`, '', event.title), [event.lat, event.lon], { anchor: 'left', offset: [-9, 0] });
      el.addEventListener('click', (e) => { e.stopPropagation(); setSelected({ type: 'event', id: event.id }); });
      if (!selected || (selected.type === 'event' && selected.id === event.id)) reach.push([event.lat, event.lon]);
    }

    const flew = selected && flown.current === `${selected.type}:${selected.id}`;
    if (!selected) flown.current = '';
    if (flew) fitted.current = true;
    else if (reach.length && (selected || !fitted.current)) {
      const lats = reach.map((p) => p[0]);
      const lons = reach.map((p) => p[1]);
      const wide = window.innerWidth > 900;
      map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
        padding: { left: wide ? 410 : 40, top: 80, right: 70, bottom: 70 },
        maxZoom: selected ? (selected.type === 'ship' || selected.type === 'airport' ? 5 : 6) : 4.5,
        duration: fitted.current ? 900 : 0,
      });
      fitted.current = true;
    }
  }, [ready, web, selected, showHubs, layers.ships, layers.planes, patterns]);

  const event = selected?.type === 'event' ? web.events.find((e) => e.id === selected.id) : null;
  const place = selected?.type === 'place' ? web.places.find((p) => p.id === selected.id) : null;
  const ship = selected?.type === 'ship' ? patterns?.ships.points.find((p) => p.id === selected.id) : null;
  const airport = selected?.type === 'airport' ? patterns?.airports.find((a) => a.id === selected.id) : null;
  const linked = web.events.filter((e) => e.placeCount > 0);
  const other = web.events.filter((e) => e.placeCount === 0);
  const findings = (patterns?.findings || []).filter((f) => (f.kind === 'ships' ? layers.ships : layers.planes || f.kind === 'ships'));
  const findingFor = (kind, ref) => patterns?.findings.find((f) => f.kind === kind && f.ref === ref);
  const planesNear = event && patterns?.planes.nearStorms.find((c) => c.id === event.id);
  const nothingPicked = !event && !place && !ship && !airport;
  const day = (text) => (text ? new Date(`${String(text).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

  const toggleLayer = (id) => setLayers((now) => ({ ...now, [id]: !now[id] }));
  function openFinding(finding) {
    if (finding.kind === 'ships') setSelected({ type: 'ship', id: finding.ref });
    else if (finding.kind === 'airport') setSelected({ type: 'airport', id: finding.ref });
    else setSelected({ type: 'event', id: finding.ref });
  }
  function openFromVoice(item) {
    const map = gl.current?.map;
    const here = typeof item.lat === 'number' && typeof item.lon === 'number';
    let known = false;
    if (item.type === 'ship' && patterns?.ships.points.some((p) => p.id === item.id)) {
      setLayers((now) => ({ ...now, ships: true }));
      known = true;
    } else if (item.type === 'airport' && patterns?.airports.some((a) => a.id === item.id)) {
      setLayers((now) => ({ ...now, planes: true }));
      known = true;
    } else if (item.type === 'event' && web.events.some((e) => e.id === item.id)) {
      known = true;
    }
    if (known) {
      flown.current = here ? `${item.type}:${item.id}` : '';
      setSelected({ type: item.type, id: item.id });
    }
    voicePin.current?.remove();
    voicePin.current = null;
    if (!map || !here) return;
    if (!known) voicePin.current = new gl.current.maplibregl.Marker({ element: dot('web-event picked', '', item.name || ''), anchor: 'left', offset: [-9, 0] }).setLngLat([item.lon, item.lat]).addTo(map);
    map.flyTo({ center: [item.lon, item.lat], zoom: item.type === 'ship' || item.type === 'airport' ? 6 : 5.5, offset: [window.innerWidth > 900 ? 190 : 0, 0], duration: 1800 });
  }
  const ask = (finding) => { onClose(); onPick({ prompt: finding.prompt, scenario: finding.scenario || '', title: finding.title }); };
  const back = <button className="chip" onClick={() => setSelected(null)}>Back to the list</button>;

  return createPortal(
    <div className="bigmap">
      <div className="bigmap-map" ref={mapEl} />
      <div className="bigmap-tools">
        <MapVoice looking={event?.title || ship?.name || airport?.name || place?.city || ''} onOpen={openFromVoice} onLayers={(change) => setLayers((now) => ({ ...now, ...change }))} />
        <HandControl getMap={() => gl.current?.map} />
        {!full && <button className="btn" onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}>Full screen</button>}
        <button className="btn primary" onClick={onClose}>Close map</button>
      </div>

      <aside className="bigmap-panel">
        {nothingPicked && (
          <>
            <h2>What is connected right now</h2>
            <div className="layer-chips" role="group" aria-label="Show on the map">
              {LAYERS.map(([id, label]) => (
                <button key={id} className={layers[id] ? 'on' : ''} aria-pressed={layers[id]} onClick={() => toggleLayer(id)}>{label}</button>
              ))}
            </div>
            {layers.planes && (
              <p className="muted small">
                {!planes ? 'Loading planes…' : planes.planes.length ? `${planes.planes.length.toLocaleString('en-US')} planes in the air, as of ${new Date(planes.asOf).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.` : 'The plane feed is not answering right now.'}
              </p>
            )}

            <div className="panel-head">Patterns right now <span className="muted">{patterns ? findings.length : ''}</span></div>
            {!patterns && <p className="muted small">Looking at planes and ships&hellip;</p>}
            {patterns && findings.length === 0 && <p className="muted small">Nothing unusual in what is switched on.</p>}
            <ul className="web-patterns">
              {(allPatterns ? findings : findings.slice(0, 4)).map((f) => (
                <li key={f.id}>
                  <button onClick={() => openFinding(f)}>
                    <span className="kind">{KIND_WORD[f.kind]}</span>
                    <strong>{f.title}</strong>
                    <span className="muted small">Why: {f.reason}</span>
                  </button>
                </li>
              ))}
            </ul>
            {findings.length > 4 && !allPatterns && <button className="chip" onClick={() => setAllPatterns(true)}>Show all {findings.length}</button>}

            <div className="panel-head">Events and what they touch</div>
            <p className="muted small">A line runs from each event to the head office of a company it touches.</p>
            {!signals && <p className="muted" style={{ marginTop: 10 }}>Loading events&hellip;</p>}
            {signals && linked.length === 0 && <p className="muted small" style={{ marginTop: 8 }}>Nothing switched on touches a company on our map right now.</p>}
            <ul className="web-events">
              {linked.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelected({ type: 'event', id: e.id })}>
                    <strong>{e.title}</strong>
                    <span className="muted small">{e.companies.length} {e.companies.length === 1 ? 'company' : 'companies'} in {e.placeCount} {e.placeCount === 1 ? 'place' : 'places'}</span>
                  </button>
                </li>
              ))}
            </ul>
            {other.length > 0 && <p className="muted small" style={{ marginTop: 10 }}>{other.length} more {other.length === 1 ? 'event is' : 'events are'} on the map with no company linked yet.</p>}

            <ul className="web-key">
              <li><i className="line" style={{ background: LINE.tailwind }} />Likely helped</li>
              <li><i className="line" style={{ background: LINE.headwind }} />Likely hurt</li>
              <li><i className="dot event" />Event</li>
              <li><i className="dot office" />Head office</li>
            </ul>
            <label className="check" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={showHubs} onChange={() => setShowHubs(!showHubs)} />
              Ports and hubs within 700 km
            </label>
          </>
        )}

        {event && (
          <>
            {back}
            <h2>{event.title}</h2>
            <p className="small">{event.detail}</p>
            {event.near.length > 0 && <p className="muted small">Within reach: {event.near.map((h) => `${h.name} (${h.km} km)`).join(', ')}.</p>}
            {planesNear && (
              <p className="small" style={{ marginTop: 8 }}>
                <b>Planes:</b> {planesNear.inside} within 460 km right now, {planesNear.ring} in the ring of sky around that.
                {findingFor('planes', event.id) && <span className="muted"> {findingFor('planes', event.id).reason}</span>}
              </p>
            )}
            {event.companies.length === 0 && <p className="muted" style={{ marginTop: 10 }}>No company on our map is linked to this one yet.</p>}
            {['tailwind', 'headwind'].map((direction) => {
              const companies = event.companies.filter((c) => c.direction === direction);
              if (!companies.length) return null;
              return (
                <div key={direction} className={`stock-group ${direction}`}>
                  <div className="group-head">{direction === 'tailwind' ? 'Likely to go up' : 'Likely to go down'}</div>
                  <CompanyRows companies={companies} />
                </div>
              );
            })}
            <button className="btn primary small" style={{ marginTop: 14 }} disabled={loading} onClick={() => { onClose(); onPick(event.item); }}>Ask what follows</button>
          </>
        )}

        {place && (
          <>
            {back}
            <h2>{place.city}</h2>
            <p className="muted small">Head offices here, and what is reaching them now.</p>
            <CompanyRows companies={place.companies} showEvent />
          </>
        )}

        {ship && (
          <>
            {back}
            <div className="kind">Cargo ships, counted up to {day(patterns.ships.asOf)}</div>
            <h2>{ship.name}</h2>
            <p className="big-number"><b>{ship.perDay}</b> ships a day over the past week</p>
            <dl className="facts">
              <div><dt>Two months before</dt><dd>{ship.usual} a day ({ship.changePct > 0 ? '+' : ''}{ship.changePct}%)</dd></div>
              <div><dt>A typical year</dt><dd>{ship.typical} a day ({ship.typicalPct > 0 ? '+' : ''}{ship.typicalPct}%)</dd></div>
              <div><dt>Of which</dt><dd>{ship.tankers} tankers and {ship.containers} container ships a day</dd></div>
            </dl>
            <div style={{ marginTop: 12 }}>
              <Sparkline series={ship.series} positive={ship.typicalPct >= 0} width={300} height={56} />
              <div className="muted small">Ships each day, past nine weeks</div>
            </div>
            <p className="small" style={{ marginTop: 12 }}><b>Why:</b> {findingFor('ships', ship.id)?.reason || 'Traffic here is close to normal, so there is nothing to explain.'}</p>
            {findingFor('ships', ship.id)?.prompt && (
              <button className="btn primary small" style={{ marginTop: 12 }} disabled={loading} onClick={() => ask(findingFor('ships', ship.id))}>Ask what follows</button>
            )}
            <p className="muted small" style={{ marginTop: 12 }}>Counts are from the IMF&rsquo;s PortWatch and run about a week behind.</p>
          </>
        )}

        {airport && (
          <>
            {back}
            <div className="kind">Airport, from the FAA</div>
            <h2>{airport.name} ({airport.code})</h2>
            <p>{airport.kind}, {airport.detail}.</p>
            <p className="small" style={{ marginTop: 10 }}><b>Why:</b> {airport.reason}.</p>
            {findingFor('airport', airport.id)?.prompt && (
              <button className="btn primary small" style={{ marginTop: 12 }} disabled={loading} onClick={() => ask(findingFor('airport', airport.id))}>Ask what follows</button>
            )}
          </>
        )}
      </aside>
    </div>,
    document.body,
  );
}
