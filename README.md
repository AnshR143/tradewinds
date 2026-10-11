# TradeWinds

Say what you noticed. See who it helps, who it hurts, and why.

Built at hackPHS 2026 for the theme "Into the Skies."

## What it does

1. **Detect.** Satellite and weather feeds report storms, fires and other physical events. Or you type or say what you noticed.
2. **Map.** Fixed rules match the event to a kind of disruption and flag any ports, fuel hubs, chip hubs or farm regions within 700 km.
3. **Check.** It pulls recent news on the event and the odds prediction markets are giving.
4. **Explain.** The AI picks the links that fit from a hand-built impact map and explains each in plain words. It does not invent the companies.

Each answer opens with a one-sentence bottom line, then a short list of stocks under "Likely to go up" and "Likely to go down". Each stock shows one line of why and a score. "See why" opens the cause-and-effect chain, how far the price has already moved, what would prove it wrong, and the math behind the score. Next steps, the evidence (with a "Find more news" button) and bonds sit behind tabs that start closed. Asking an open question such as "what is likely to go up right now?" returns every stock that events happening now point at, built from the map with no AI.

### From the news to stocks

Under every list of news there is a box titled "What this news means for stocks". One AI call reads the latest headlines and says which links on our impact map each one sets off, using the place and each link's "does not apply if" rule. The AI never names a stock: the companies come from the map and the scores from `lib/score.js`. The matches are saved in Tiger Data, so the AI is asked again only when the headlines change. When no headline fits the map, the box says so.

### Patterns in planes and ships

The full-screen map compares what planes and ships are doing with what is normal, and looks for the reason. All of it is counting and comparing in `lib/patterns.js`. No AI.

- **Cargo ships.** The IMF's PortWatch counts the ships passing 28 choke points each day. We compare the past week with the two months before it, and with a typical year. A gap of 20% or more in a week, or 35% or more from a typical year, is listed. The data runs about a week behind.
- **Planes.** The OpenSky Network gives every plane in the air. For each storm we count the planes within 460 km and in the ring of sky around that. A storm with far fewer planes than the ring would suggest is listed. Every half hour the counts are saved in Tiger Data, so the map can also say "fewer than earlier today". Open ocean has fewer flights anyway, and the map says so.
- **Airports.** The FAA lists delays at US airports with its own reason for each, which we put in plain words.

For the reason, it checks in this order: a storm or alert within 700 km, a known reroute (ships avoiding the Red Sea go around Africa), then a news story that names the place. When none fits it says so.

## The pages

- **Home**: the landing page.
- **Log in**: log in, create an account, or continue as a guest. An account keeps your own history; guests share one.
- **Ask**: a chat. Follow-up questions carry the earlier answer with them.
- **Top stocks**: what is likely to go up or down from events happening right now, strongest first. No AI; it reads the impact map.
- **Geopolitical**: one section at a time, picked from the sidebar: storms, weather alerts, conflicts, disasters, health and diplomacy.
- **Politics and odds**: prediction market odds on world affairs, elections and the economy, one at a time with arrows, plus political news. Each topic has its own "See all" page.
- **Impact map**: a globe of every disruption caught, filtered by region. Click a dot to see what it touches. "Expand map" opens a detailed map across the whole screen, with a line from each event to the head office of every company it touches (blue for likely helped, orange for likely hurt) and to the ports and hubs within 700 km. Click an event or a city to see only its lines. "Hand control" on that map switches on the camera. Move the ring onto an event or a city until it lights up and pinch to click it; pinch on empty map and move your hand to drag; pinch with both hands and pull them apart or together to zoom. The video is read on the device and never sent anywhere. Switches on that map show or hide storms, weather alerts, news, planes and cargo ships, and a "Patterns right now" list says what looks unusual and gives the likely reason for each (see below). The full hand-built map is below the globe.
- **History**: earlier questions and answers, by day.
- **Settings**: upload a portfolio as a text file (see `sample-portfolio.txt`), and switch off kinds of events, regions, market topics, or anything that mentions a word. Saved in the browser and applied to every page.

### The signal score

Every company in an answer gets a score from -100 (likely down) to +100 (likely up). It is plain arithmetic in `lib/score.js`, with no AI and no randomness, so the same inputs always give the same score. "Show the math" on each card lists the factors:

| Factor | Value |
| --- | --- |
| How direct the link is on the impact map | 70, 50 or 25 points |
| How strong the event is (wind speed, number of alerts, size of the price rise) | x0.6 to x1.4 |
| How many live events point the same way | x1.0, x1.1 or x1.2 |
| How much of the move the price has already made this week | x0.5 to x1.0 |
| Whether Wall Street analysts agree, where we have ratings | x0.9, x1.0 or x1.1 |

The score measures how strong the signal is. It is not a forecast of the price and not an instruction to buy or sell.

### The calculator

The "What you can do" tab has a calculator. You pick a company and type the most you are willing to lose, or an amount you are thinking about. It uses the last close and the biggest fall that stock had in the past month to work out what that fall would cost you. It only does the arithmetic on numbers you type; it does not choose an amount for you.

With a portfolio uploaded, every answer gets a "Your stocks" tab. It lists your holdings under "Likely to go up" and "Likely to go down", shows how many dollars you hold on each side, and for each holding works out what a move like its biggest this month would add or take off (shares x last close x that percentage). That check reads the impact map and does arithmetic on your own share counts; the AI does not write it, and it does not tell you how many shares to buy or sell. The file stays in the browser, and only ticker symbols are sent with a question. Holdings that are not on the impact map (a broad fund such as VOO, for example) get one sentence from the AI under "Your other holdings", labeled as the AI's own read and not checked.

TradeWinds gives ideas to research, not financial advice.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3210.

## Keys

The app runs with no keys. Each key turns one part from a stand-in into the real thing.
Copy `.env.example` to `.env.local` and fill in what you have. Never commit `.env.local`.

| Variable | What it turns on | Without it |
|---|---|---|
| `GROQ_API_KEY` | Real AI analysis | A fixed sample answer, clearly labeled |
| `NVIDIA_API_KEY` or `DEEPSEEK_API_KEY` | Backup AI if Groq fails | No backup |
| `ALPHAVANTAGE_API_KEY` | Oil and natural gas prices as automatic signals | No energy price signals |
| `FMP_API_KEY` | Wall Street analyst ratings on covered companies, and the gold price | No analyst line, no gold signal |
| `TWELVEDATA_API_KEY` | Price moves, stored in Tiger Data, and ticker checking | "Not connected yet" on each idea |
| `ELEVENLABS_API_KEY` | Talk to the map: it hears your question and answers out loud (needs Text to Speech, Speech to Text and Voices: Read) | You type questions and the browser's own voice reads the answers |
| `PERPLEXITY_API_KEY` | Live web news search | News from Wikipedia's daily world-events page |
| `DATABASE_URL` | History saved in Tiger Data | History kept in memory until restart |

## Data sources

| Source | What it gives | Key |
|---|---|---|
| NASA EONET | Storms, wildfires and volcanoes tracked by satellite | None |
| US National Weather Service | Active severe weather alerts | None |
| Wikipedia Current Events | Recent world events with source links | None |
| Polymarket | Prediction market odds (read only) | None |
| OpenSky Network | Every plane in the air, for the map and for counting planes near storms | None. About 100 whole-world lookups a day |
| IMF PortWatch | Daily ship counts through 28 choke points | None. About a week behind |
| FAA airport status | Delays at US airports and the FAA's reason | None |
| OpenFreeMap | The detailed map behind "Expand map", built from OpenStreetMap data | None |
| Alpha Vantage | Daily oil and natural gas prices | Free key, 25 requests a day |
| Financial Modeling Prep | Analyst buy/hold/sell counts and price targets, gold price | Free key, 250 requests a day, some companies only |
| Twelve Data | Stock and fund prices | Free key |

## How the code is laid out

- `data/impact-graph.js` is the impact map: each kind of disruption, its cause-and-effect chains, and the companies on each chain.
- `data/chokepoints.js` lists the ports, canals, fuel hubs and farm regions we watch.
- `lib/rules.js` holds the fixed rules that match a signal to the map and find nearby choke points.
- `lib/feeds` holds the sky feeds.
- `lib/news.js`, `lib/markets.js`, `lib/prices.js` are the other data sources.
- `lib/ai.js` hands the map to the AI and checks its reply against the map.
- `lib/store.js` saves signals, answers and prices by time in Tiger Data, plus the last good copy of NASA's feed for when it is down.
- `lib/warm.js` is the background job that keeps a month of prices in Tiger Data for every company in the map.
- `app/api/analyze` runs one question from start to finish.
- `app/api/signals` gathers what is happening right now.
- `app/api/history` lists earlier answers.
- `app/page.js` is the frame: the sidebar, the chat's messages, and which section is showing.
- `components/tabs.js` holds the Geopolitical, Politics and odds, Impact map and History pages.
- `components/Home.js` is the landing page. The mascot floats using the `motion` library.
- `lib/score.js` works out the signal score. `lib/board.js` builds the list of every live bullish and bearish signal. `lib/analysts.js` fetches analyst ratings.
- `components/Stocks.js` is the stock list with "See why", used in every answer and on the Top stocks page (`app/api/board`).
- `lib/newsStocks.js` turns the latest news into stocks (`app/api/news-stocks`); the AI step is `matchNews` in `lib/ai.js`.
- `components/Sizer.js` is the calculator.
- `lib/portfolio.js` reads an uploaded portfolio file and checks it against the impact map.
- `lib/sections.js` sorts events into sections and applies the reader's Settings, so the sidebar and every page agree.
- `data/places.js` holds rough map positions for countries and US states, used to place news events on the globe and sort them by region.
- `lib/auth.js` holds accounts and sessions; `app/api/auth` has the sign-up, log-in, log-out and who-am-I routes; `components/Login.js` is the page.
- `components/BigMap.js` is the full-screen map, built on the `maplibre-gl` library. `lib/web.js` works out the lines, and `data/company-places.js` lists each company's head office (written by hand; the team should check it).
- `components/HandControl.js` runs the camera and Google's MediaPipe hand tracker (`@mediapipe/tasks-vision`, which fetches its engine and model the first time it is switched on). `lib/gestures.js` turns hand positions into drags, zooms and clicks, and has no camera or map code in it so it can be tested alone.
- `lib/feeds/planes.js`, `lib/feeds/ships.js` and `lib/feeds/airports.js` are the plane, ship and airport feeds. `lib/patterns.js` compares them with normal and finds the reason (`app/api/patterns`, `app/api/planes`).
- `ad/` holds the source of the ad's motion-graphics scenes: `index.html` and `scenes.js` draw each scene for any given second, and `render.cjs` saves them as frames with Playwright.
- `components/Answer.js` is the tabbed answer. `components/Globe.js` is the globe, built on the `cobe` library.
- `components/charts.js` holds the hand-drawn SVG/CSS charts: price lines, prediction-odds bars, and the impact-map overview bars. Storm strength bars are drawn inline in the Geopolitical page's storm list. No chart library.
- `components/Chat.js` is the Ask page: a chat with the message box docked at the bottom. Follow-up messages carry the previous question and answer so they make sense.

## How Tiger Data is used

Four hypertables (Tiger's time-series tables):

- `prices`: daily closing prices for every company in the impact map. A background job refreshes them, so the "already moved" check is one SQL query and never waits on the price feed, which only allows 8 lookups a minute.
- `signals`: every storm, fire and weather alert we saw, with its time.
- `analyses`: every answer we gave, with its time, so it can be checked later against what prices did.

- `plane_counts`: how many planes were near each storm, every half hour.

Two plain tables hold accounts:

- `users`: an email and a password hash. Passwords are hashed with scrypt and a random salt; the password itself is never stored.
- `sessions`: logging in sets a random token in an http-only cookie, and only its SHA-256 hash is stored here, with an expiry 30 days out.

Each row in `analyses` also records whose question it was, so History shows a signed-in reader only their own.

## How Solana is used

When TradeWinds gives an answer, it writes a fingerprint of that answer to Solana's devnet (the free test network) as a short memo. The fingerprint is a SHA-256 hash of the question, the summary and the companies named.

- The History page links each answer to its stamp, and "Check it" recomputes the fingerprint from the database and compares it with the one on the chain.
- If anyone edited a saved answer afterwards, the two would no longer match. So the track record cannot be quietly rewritten.
- Solana fits because a stamp costs a tiny fraction of a cent and confirms in about a second, so every single answer can be stamped.

Solana does not make the answers better. It makes them provable. The code is in `lib/solana.js` and `app/api/verify`.

## Deploying

`npm run build` then `npm start`. The start command uses the `PORT` the host provides, so it runs on DigitalOcean App Platform as a standard Node app. Set the keys as environment variables there.

## AI use

hackPHS requires AI use to be documented.

- **Claude Code (Anthropic)** helped brainstorm the pitch and wrote the first version of this codebase from the team's direction, including the first draft of the impact map and choke-point list. The team chose the idea, the data sources and the features, and reviews and edits the code and the map.
- **Groq** (running the open model `gpt-oss-120b`) picks and explains links from the impact map inside the app. **NVIDIA** (`nemotron-3-super-120b`) is the backup when Groq's free limit is reached.
- **Higgsfield** made the three sky shots in the one-minute ad (a satellite scanning a hurricane, flight paths bending around a storm, cargo ships backed up at a strait), using its Nano Banana image model for the key frames and Seedance 2.0 Mini to animate them. Everything else in the ad (the rotating globe, the captions, and the scenes showing Ask, the map, Patterns, Top stocks, Your stocks and hand control) is motion graphics written with Claude Code in `ad/` and rendered frame by frame in Higgsfield's sandbox. Those scenes are a simplified version of the site's screens drawn for the ad, using real numbers from the app. The ad has no sound.
- **ElevenLabs** is the voice of "Talk to the map" on the full-screen map: its speech-to-text hears the question and its text-to-speech reads the answer (`lib/voice.js`). The answer itself comes from the same AI as the rest of the app, given only what the map is showing (`answerAloud` in `lib/ai.js`), and it can zoom the map to what it is talking about.
- **ElevenLabs** also generated the ad's sound effects from text prompts the team wrote, and its voice-over (the "Hope" voice reading a script written with Claude). `ad/mix.py` cuts the voice recording into its lines and places each line and each sound on the video at its exact time, with the music turned down while the voice speaks.
- **MediaPipe (Google)** hand tracking, an on-device machine-learning model, reads hand positions for the map's hand control.
- **Muse (Meta)** added the charts: price lines on each idea, prediction-odds bars, and the impact-map overview. Its signals-per-day chart was replaced with a storm strength chart, because the data behind it only held each signal's latest update time.

Update this section as the team changes or adds to the code.
