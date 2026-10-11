'use client';

// The Ask page: a chat. Your messages sit on the right, TradeWinds answers on the left,
// and the box you type in stays at the bottom.
import { useEffect, useRef, useState } from 'react';
import Answer from '@/components/Answer';
import { KIND, Skeleton } from '@/components/bits';

const EXAMPLES = ['Gold is getting expensive in India', 'Steel prices are going up', 'Eggs cost more at my store'];

// Types each example into the empty box, pauses, clears it, and moves to the next.
function useTypedHint(active) {
  const [hint, setHint] = useState('');
  useEffect(() => {
    if (!active) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHint(EXAMPLES[0]);
      return undefined;
    }
    let example = 0;
    let length = 0;
    let timer;
    function step() {
      const text = EXAMPLES[example];
      if (length < text.length) {
        length += 1;
        setHint(text.slice(0, length));
        timer = setTimeout(step, 45);
      } else {
        timer = setTimeout(() => {
          length = 0;
          example = (example + 1) % EXAMPLES.length;
          setHint('');
          timer = setTimeout(step, 400);
        }, 2600);
      }
    }
    step();
    return () => clearTimeout(timer);
  }, [active]);
  return hint;
}

function Composer({ onSend, busy, showHint }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [note, setNote] = useState('');
  const box = useRef(null);
  const hint = useTypedHint(showHint && !text);

  function grow() {
    const el = box.current;
    // The box is swapped for a new one when the first message is sent.
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function send() {
    const message = text.trim();
    if (!message || busy) return;
    onSend(message);
    setText('');
    requestAnimationFrame(grow);
  }

  function listen() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNote('This browser cannot listen. Try Chrome, or type instead.');
      return;
    }
    const mic = new Recognition();
    mic.lang = 'en-US';
    mic.onstart = () => setListening(true);
    mic.onend = () => setListening(false);
    mic.onerror = () => setListening(false);
    mic.onresult = (event) => onSend(event.results[0][0].transcript);
    mic.start();
  }

  return (
    <div className="dock">
      <div className="composer">
        <textarea
          ref={box}
          rows={1}
          value={text}
          maxLength={600}
          aria-label="What have you noticed?"
          placeholder={showHint ? hint || ' ' : 'Ask a follow-up, or tell me something new'}
          onChange={(e) => { setText(e.target.value); grow(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <div className="composer-actions">
          <button className="btn small" onClick={listen} disabled={busy || listening}>{listening ? 'Listening…' : 'Speak'}</button>
          <button className="send" onClick={send} disabled={busy || !text.trim()} aria-label="Send">↑</button>
        </div>
      </div>
      {note && <p className="fine error">{note}</p>}
      <p className="fine">TradeWinds gives ideas to research, not financial advice.</p>
    </div>
  );
}

function Thinking() {
  return (
    <div className="card" aria-label="Working on it">
      <Skeleton width={150} height={10} />
      <Skeleton width="78%" height={20} style={{ margin: '12px 0' }} />
      <Skeleton width="46%" height={12} />
    </div>
  );
}

export default function Chat({ messages, busy, signals, portfolio, onSend, onPick, onReset, speakingId, onSpeak }) {
  const lastAsk = useRef(null);
  const empty = messages.length === 0;
  const lastAskId = messages.filter((m) => m.role === 'user').pop()?.id;
  const topSignals = (signals?.sky || []).slice(0, 3);

  // Keep the newest question at the top of the screen, with its answer below it.
  useEffect(() => {
    lastAsk.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages.length, busy]);

  return (
    <div className="chat">
      <div className="chat-top">
        {!empty && <button className="btn small" onClick={onReset} disabled={busy}>New chat</button>}
      </div>

      {empty ? (
        <div className="chat-empty">
          <h1>What have you noticed?</h1>
          <p className="lead">Tell me a change you&rsquo;ve seen. I&rsquo;ll show who it helps, who it hurts, and why.</p>
          <Composer onSend={onSend} busy={busy} showHint />
          <div className="starters">
            <div className="label">Try one</div>
            <div className="row">
              <button className="chip" onClick={() => onSend('What is likely to go up right now?')} disabled={busy}>What is likely to go up right now?</button>
              {EXAMPLES.map((example) => (
                <button key={example} className="chip" onClick={() => onSend(example)} disabled={busy}>{example}</button>
              ))}
            </div>
            <div className="label">Or start from something happening now</div>
            <div className="grid-3">
              {!signals && [0, 1, 2].map((i) => (
                <div className="tile" key={i} aria-hidden="true">
                  <Skeleton width={70} height={10} />
                  <Skeleton width="70%" height={16} style={{ margin: '10px 0' }} />
                  <Skeleton width="90%" height={11} />
                </div>
              ))}
              {topSignals.map((s) => (
                <button key={s.id} className="pick" disabled={busy} onClick={() => onPick(s)}>
                  <span className="kind">{KIND[s.kind] || s.kind}</span>
                  <strong>{s.title}</strong>
                  <span>{s.detail}.</span>
                  {s.near?.length > 0 && <span>Near the {s.near[0].name}.</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="thread" aria-live="polite">
            {messages.map((m) => (
              m.role === 'user' ? (
                <div key={m.id} ref={m.id === lastAskId ? lastAsk : null} className="msg-user">{m.label || m.text}</div>
              ) : (
                <div key={m.id} className="msg-bot">
                  <div className="from">TradeWinds</div>
                  {m.status === 'loading' && <Thinking />}
                  {m.status === 'error' && <div className="card"><p className="error">{m.error}</p></div>}
                  {m.status === 'done' && (
                    <Answer
                      result={m.result}
                      portfolio={portfolio}
                      speaking={speakingId === m.id}
                      onSpeak={() => onSpeak(m)}
                      onAnswer={(option) => onSend(option)}
                    />
                  )}
                </div>
              )
            ))}
          </div>
          <Composer onSend={onSend} busy={busy} />
        </>
      )}
    </div>
  );
}
