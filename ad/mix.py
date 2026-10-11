import glob, os, re, subprocess, sys, tempfile
import numpy as np

VIDEO, OUT = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3] if len(sys.argv) > 3 else ''
A = 'audio/'
RATE = 48000
LOUDNESS = -15

def load(path, channels=1):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', str(channels), '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def db(x):
    return 20 * np.log10(x + 1e-9)

def measure(path, quiet=0.08):
    x = load(path)
    env = np.sqrt(np.convolve(x * x, np.ones(480) / 480, mode='same'))
    loud = np.nonzero(env > env.max() * quiet)[0]
    body = x[loud[0]:loud[-1] + 1]
    return {'start': loud[0] / RATE, 'end': loud[-1] / RATE, 'peak': np.argmax(env) / RATE, 'db': db(np.abs(x).max()), 'rms': db(np.sqrt(np.mean(body * body)))}

CUES = [
    ('boom-take1', 'start', 0.05, -5), ('shimmer-data-take1', 'start', 0.45, -15), ('shimmer-data-take1', 'start', 2.30, -17),
    ('whoosh-take3', 'peak', 4.92, -8), ('impact-take2', 'peak', 5.02, -5), ('scan-take3', 'start', 5.50, -13, 4.3),
    ('impact-take4', 'peak', 10.05, -5), ('thunder-jet-take1', 'start', 10.15, -9, 4.75),
    ('impact-take1', 'peak', 15.09, -5), ('ship-horn-take1', 'start', 15.50, -12, 4.2),
    ('connect-take1', 'start', 20.20, -9), ('whoosh-take1', 'peak', 22.38, -8),
    ('typing-take1', 'start', 22.83, -13, 0.95), ('click-take2', 'peak', 24.09, -8), ('pops-take2', 'start', 24.60, -11),
    ('counter-take1', 'start', 24.90, -16), ('swell-take1', 'peak', 25.95, -10), ('click-take2', 'peak', 27.15, -8),
    ('pop-take1', 'start', 27.41, -13), ('pop-take1', 'start', 27.67, -13), ('pop-take1', 'start', 27.93, -13),
    ('swell-take1', 'peak', 29.20, -11), ('whoosh-take1', 'peak', 30.40, -8),
    ('zip-take1', 'start', 30.96, -13), ('zip-take1', 'start', 31.20, -13), ('zip-take1', 'start', 31.44, -13), ('zip-take1', 'start', 31.68, -13),
    ('pop-take1', 'start', 31.51, -14), ('pop-take1', 'start', 31.75, -14), ('pop-take1', 'start', 31.99, -14), ('pop-take1', 'start', 32.23, -14),
    ('swell-take1', 'peak', 34.50, -10), ('whoosh-take1', 'peak', 36.40, -8),
    ('pop-take1', 'start', 36.98, -12), ('pop-take1', 'start', 37.11, -12), ('pop-take1', 'start', 37.24, -12), ('counter-take1', 'start', 36.95, -12),
    ('whoosh-take1', 'peak', 40.90, -8), ('pops-take2', 'start', 41.31, -11), ('counter-take1', 'start', 41.50, -12), ('shimmer-take1', 'start', 43.15, -11),
    ('whoosh-take1', 'peak', 44.90, -8), ('pop-take1', 'start', 45.32, -12), ('pop-take1', 'start', 45.44, -12), ('counter-take1', 'start', 45.45, -12),
    ('swell-take1', 'peak', 46.00, -10), ('shimmer-take1', 'start', 47.70, -11), ('whoosh-take1', 'peak', 48.90, -8),
    ('click-take2', 'peak', 50.45, -8), ('slide-take2', 'start', 51.55, -12), ('swell-take1', 'peak', 52.85, -10),
    ('whoosh-take1', 'peak', 53.85, -8), ('logo-sting-take1', 'start', 54.00, -4), ('pop-take1', 'start', 54.85, -13), ('shimmer-take1', 'start', 55.45, -11),
]
VOICE = {
    1: (0.20, 4.90), 2: (5.25, 10.00), 3: (10.25, 15.05), 4: (15.45, 19.75), 5: (20.05, 24.05), 6: (24.40, 30.30),
    7: (30.70, 36.38), 8: (36.70, 41.10), 9: (41.45, 45.10), 10: (45.40, 48.90), 11: (49.40, 53.80), 12: (54.70, 59.20),
}
FASTEST = 1.12
SHORTEST_PAUSE = 0.28
CUT_AT = [0, 5.14, 10.61, 16.08, 20.41, 24.93, 31.20, 37.55, 42.54, 45.80, 49.72, 54.22]

inputs, filters = [], []
sfx, voice, music = [], [], []
def add(group, path, at, gain_db, keep=None, fade_out=0.35, fade_in=0.0, skip=0.0, tempo=1.0):
    i = len(inputs) // 2
    inputs.extend(['-i', path])
    chain = [f'[{i + 1}:a]aresample={RATE}', 'aformat=sample_fmts=fltp:channel_layouts=stereo']
    if skip > 0:
        chain += [f'atrim=start={skip:.3f}', 'asetpts=PTS-STARTPTS']
    if tempo != 1:
        chain.append(f'atempo={tempo:.4f}')
    if keep:
        chain += [f'atrim=0:{keep:.3f}', f'afade=t=out:st={max(0, keep - fade_out):.3f}:d={fade_out}']
    if fade_in:
        chain.append(f'afade=t=in:st=0:d={fade_in}')
    ms = max(0, round(at * 1000))
    chain += [f'volume={gain_db:.2f}dB', f'adelay={ms}|{ms}']
    filters.append(','.join(chain) + f'[a{i}]')
    group.append(f'[a{i}]')

song = next((p for p in (A + 'music.wav', A + 'music.mp3') if os.path.exists(p)), None)
voice_files = sorted(glob.glob(A + 'vo*.mp3') + glob.glob(A + 'vo*.wav'))
has_voice = bool(voice_files)
SMALL = ('click', 'typing', 'pop', 'zip', 'counter', 'slide', 'swell', 'shimmer')

cache = {}
for name, anchor, at, level, *rest in CUES:
    path = f'{A}{name}.mp3'
    m = cache.setdefault(path, measure(path))
    lift = 3 if (song or has_voice) and name.startswith(SMALL) else 0
    add(sfx, path, at - m[anchor], level + lift + (-1 - m['db']), keep=(rest[0] + m['start']) if rest else None)

PAUSE = 0.75
def lines_in(path, count=None, cut_at=None):
    x = load(path)
    env = np.sqrt(np.convolve(x * x, np.ones(480) / 480, mode='same'))
    edges = np.flatnonzero(np.diff(np.concatenate(([0], (env > env.max() * 0.04).astype(np.int8), [0]))))
    sounds = [(a, b) for a, b in zip(edges[::2], edges[1::2]) if cut_at or env[a:b].max() > env.max() * 0.15]
    if cut_at:
        marks = [int(np.searchsorted(cut_at, a / RATE, side='right')) for a, b in sounds]
    else:
        gaps = sorted((b[0] - a[1] for a, b in zip(sounds, sounds[1:])), reverse=True)
        pause = gaps[count - 2] if count and len(gaps) >= count - 1 else PAUSE * RATE
        marks = np.cumsum([0] + [b[0] - a[1] >= pause for a, b in zip(sounds, sounds[1:])]).tolist()
    lines = {}
    for mark, (a, b) in zip(marks, sounds):
        phrases = lines.setdefault(mark, [])
        if phrases and a - phrases[-1][1] < 0.25 * RATE:
            phrases[-1][1] = b
        else:
            phrases.append([a, b])
    return [(path, [(a / RATE, b / RATE) for a, b in p], db(np.sqrt(np.mean(np.concatenate([x[a:b] for a, b in p]) ** 2)))) for p in lines.values()]

one_take = len(voice_files) == 1
takes = [take for path in voice_files for take in lines_in(path, cut_at=CUT_AT if one_take else None)]
if one_take and not CUT_AT and len(takes) != len(VOICE):
    takes = lines_in(voice_files[0], count=len(VOICE))
if voice_files and len(takes) != len(VOICE):
    sys.exit(f'Found {len(takes)} voice lines but the script has {len(VOICE)}:\n' + '\n'.join(f'  {os.path.basename(p)} {ph[0][0]:.2f}s to {ph[-1][1]:.2f}s' for p, ph, _ in takes))

spoken = []
for (n, (at, by)), (path, phrases, level) in zip(VOICE.items(), takes):
    pauses = [b[0] - a[1] for a, b in zip(phrases, phrases[1:])]
    natural = phrases[-1][1] - phrases[0][0]
    spare = natural - (by - at)
    if spare <= 0:
        phrases, pauses = [(phrases[0][0], phrases[-1][1])], []
    for i in sorted(range(len(pauses)), key=lambda i: -pauses[i]):
        cut = min(max(0, pauses[i] - SHORTEST_PAUSE), max(0, spare))
        pauses[i] -= cut
        spare -= cut
    length = sum(b - a for a, b in phrases) + sum(pauses)
    tempo = min(FASTEST, max(1.0, length / (by - at)))
    t = at
    for (a, b), pause in zip(phrases, pauses + [0]):
        lead = max(0, a - 0.04)
        add(voice, path, t - (a - lead) / tempo, -17 - level, skip=lead, tempo=tempo, keep=(b - lead + 0.1) / tempo, fade_out=0.08, fade_in=0.02)
        t += (b - a + pause) / tempo
    spoken.append((n, at, length, tempo, at + length / tempo - by, phrases[0][0], natural - length))

if song:
    add(music, song, 0, -20 - measure(song)['rms'], keep=60.0, fade_out=0.5, fade_in=0.03)

def bus(labels, name, then=''):
    mix = f'amix=inputs={len(labels)}:normalize=0:duration=longest' if len(labels) > 1 else 'anull'
    return ''.join(labels) + mix + then + f'[{name}]'

layers = {'sfx': '[sfx]'}
filters.append(bus(sfx, 'sfx', ',volume=2dB' if song or voice else ''))
if voice:
    filters += [bus(voice, 'said'), '[said]asplit[vox][cue]', '[cue]apad=whole_dur=61[key]']
    layers['voice'] = '[vox]'
if song:
    filters.append(f'{music[0]}[key]sidechaincompress=threshold=0.07:ratio=3:attack=30:release=600[mus]' if voice else f'{music[0]}anull[mus]')
    layers['music'] = '[mus]'
heard = [label for name, label in layers.items() if not ONLY or name == ONLY]
filters += [f'{label}anullsink' for name, label in layers.items() if ONLY and name != ONLY]
filters.append(bus(heard, 'mix', ',apad=whole_dur=60,atrim=0:60'))

rough = tempfile.mktemp(suffix='.wav')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VIDEO] + inputs + ['-filter_complex', ';'.join(filters), '-map', '[mix]', '-c:a', 'pcm_f32le', '-ar', str(RATE), rough], check=True)

def loudness(path):
    report = subprocess.run(['ffmpeg', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', report)[-1])

before = loudness(rough)
peak = db(np.abs(load(rough, channels=2)).max())
gain = 0.0 if ONLY else float(min(LOUDNESS - before, 2 - peak))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', VIDEO, '-i', rough, '-map', '0:v', '-map', '1:a', '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=disabled',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', str(RATE), '-movflags', '+faststart', '-t', '60', OUT], check=True)
os.remove(rough)

print('sounds placed:', len(CUES), '| voice lines:', len(spoken), '| music:', 'yes' if song else 'no', '| only:', ONLY or 'everything')
print(f'loudness {before:.1f} LUFS, peak {peak:.1f} dB, turned {gain:+.1f} dB -> {loudness(OUT):.1f} LUFS')
for n, at, length, tempo, over, found, trimmed in spoken:
    note = f', still {over:.2f}s too long: shorten the line' if over > 0.05 else ''
    fitted = (f', pauses shortened by {trimmed:.2f}s' if trimmed > 0.005 else '') + (f', sped up {(tempo - 1) * 100:.1f}%' if tempo > 1 else '')
    print(f'  line {n:2d} (at {found:.2f}s in the recording) starts {at}s, ends {at + length / tempo:.2f}s' + fitted + note)
