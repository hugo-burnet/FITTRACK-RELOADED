# Les sons de la coche Cyber, v2 : de l'impact AU TÉLÉPHONE.
# Un haut-parleur de téléphone ne rend presque rien sous ~200 Hz : le corps du coup est donc placé
# entre 150 et 400 Hz, saturé (les harmoniques font entendre le grave), puis compressé et limité
# pour que le son tape fort sans écrêter. Presque pas de pièce : la réverbération amortit l'impact.
import sys, os, io, subprocess
import numpy as np, soundfile as sf
SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'sources')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)

def load(name):
    for root, _, files in os.walk(SRC):
        if name in files:
            wav = subprocess.run(['ffmpeg', '-v', 'error', '-i', os.path.join(root, name), '-ac', '1', '-ar', str(SR), '-f', 'wav', '-'], capture_output=True, check=True).stdout
            return sf.read(io.BytesIO(wav))[0].astype(np.float64)
    raise FileNotFoundError(name)

def rate(x, r):
    n = int(len(x) / r); return np.interp(np.arange(n) * r, np.arange(len(x)), x)

def trim(x, dur, fade=0.03):
    y = x[: int(SR * dur)].copy(); f = min(len(y), int(SR * fade)); y[-f:] *= np.linspace(1, 0, f); return y

def body(f0, f1, dur, gain):
    # Le coup : une sinusoïde qui plonge, au-dessus de 100 Hz, enveloppe très courte.
    t = np.arange(int(SR * dur)) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    env = np.exp(-t / (dur / 3.5)) * np.minimum(1, t / 0.0015)
    return gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * env

def click(gain, dur=0.006):
    # La pointe d'attaque : un souffle filtré de 2 à 6 kHz, six millisecondes.
    n = int(SR * dur); x = rng.standard_normal(n) * np.exp(-np.arange(n) / (n / 4))
    x = x - np.convolve(x, np.ones(9) / 9, 'same')  # passe-haut grossier
    return gain * x / np.abs(x).max()

def crush(x, bits=6):
    q = 2 ** (bits - 1); return np.round(x * q) / q

def biquad_hp(x, fc):
    # Passe-haut d'ordre 2 (RBJ) : retire le sous-grave que le téléphone ne joue pas et qui mange la marge.
    w = 2 * np.pi * fc / SR; a = np.sin(w) / (2 * 0.707); c = np.cos(w)
    b0, b1, b2 = (1 + c) / 2, -(1 + c), (1 + c) / 2; a0, a1, a2 = 1 + a, -2 * c, 1 - a
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        o = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        x2, x1, y2, y1 = x1, v, y1, o; y[i] = o
    return y

def mix(layers, total):
    buf = np.zeros(int(SR * total))
    for sig, at, g in layers:
        i = int(SR * at); seg = sig[: max(0, len(buf) - i)] * g
        buf[i: i + len(seg)] += seg
    return buf

def master(x, drive, hp=160):
    x = biquad_hp(x, hp)
    x = x / np.abs(x).max()
    x = np.tanh(drive * x) / np.tanh(drive)          # saturation : harmoniques et densité
    # Compresseur simple : on écrase ce qui dépasse -12 dB, attaque 1 ms, relâche 60 ms.
    env = np.zeros_like(x); a, r = np.exp(-1 / (SR * 0.001)), np.exp(-1 / (SR * 0.06)); e = 0
    for i, v in enumerate(np.abs(x)):
        e = a * e + (1 - a) * v if v > e else r * e + (1 - r) * v; env[i] = e
    thr = 10 ** (-20 / 20); gain = np.where(env > thr, (thr + (env - thr) / 6) / np.maximum(env, 1e-9), 1)
    x = x * gain
    x = x / np.abs(x).max() * 0.97
    x = np.tanh(x * 2.6) / np.tanh(2.6) * 0.97      # un limiteur doux : la pointe ne dicte plus le volume
    f = int(SR * 0.03); x[-f:] *= np.linspace(1, 0, f)
    return x

def save(x, name):
    path = os.path.join(OUT, name + '.mp3')
    w = io.BytesIO(); sf.write(w, x, SR, format='WAV'); w.seek(0)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'wav', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '128k', path], input=w.read(), check=True)

scifi = load('impactMetal_004.ogg'); scifi3 = load('impactMetal_003.ogg'); scifi0 = load('impactMetal_000.ogg')
generic = load('impactGeneric_light_000.ogg'); punch = load('impactPunch_heavy_002.ogg')
heavy = load('impactMetal_heavy_000.ogg'); latch = load('metalLatch.ogg'); tick = load('impactMetal_light_002.ogg')
crunch = load('explosionCrunch_000.ogg'); glitch = load('glitch_004.ogg')
bell = load('impactBell_heavy_004.ogg'); stone = load('stoneHit4.ogg')
latchRev = latch[::-1]

sounds = {
  # 1. Frappe : un coup de poing sur une plaque de métal. Tout dans les 10 premières ms.
  'frappe': master(mix([
      (click(0.5), 0.0, 1.0), (trim(scifi, 0.3), 0.0, 1.0), (generic, 0.0, 0.8),
      (trim(rate(punch, 1.25), 0.25), 0.0, 0.55), (body(300, 165, 0.11, 1.2), 0.0, 1.0),
  ], 0.34), drive=4.0),
  # 2. Culasse : « tchk… TCHAK », le verrou cette fois posé sur un vrai coup.
  'culasse': master(mix([
      (rate(tick, 1.3), 0.0, 0.5),
      (click(0.5), 0.06, 1.0), (latch, 0.06, 0.9), (heavy, 0.06, 0.9), (trim(scifi3, 0.28), 0.06, 0.75),
      (body(320, 170, 0.1, 1.3), 0.06, 1.0),
  ], 0.42), drive=3.5),
  # 3. Surcharge : l'impact numérique, avec un éclat de crunch écrasé en 6 bits et une miette de glitch.
  'surcharge': master(mix([
      (click(0.5), 0.0, 1.0), (trim(scifi0, 0.25), 0.0, 1.0), (body(280, 150, 0.12, 1.2), 0.0, 1.0),
      (crush(trim(crunch, 0.3, 0.12), 6), 0.005, 0.55), (glitch, 0.02, 0.5), (glitch, 0.055, 0.3),
  ], 0.38), drive=4.5),
  # 4. Enclume : un coup lourd qui sonne, une cloche de métal courte sur une pierre.
  'enclume': master(mix([
      (click(0.45), 0.0, 1.0), (bell, 0.0, 0.9), (stone, 0.0, 0.7), (body(340, 190, 0.1, 1.1), 0.0, 1.0),
  ], 0.36), drive=3.0),
  # Décocher : le verrou à l'envers, plus sec qu'avant, sans corps.
  'decocher': master(mix([(latchRev[-int(SR * 0.12):], 0.0, 0.6), (click(0.5, 0.004), 0.12, 1.0)], 0.2), drive=1.6, hp=300) * 0.6,
}
for name, x in sounds.items():
    save(x, name)
    head = x[: int(SR * 0.03)]
    X = np.abs(np.fft.rfft(x)); fr = np.fft.rfftfreq(len(x), 1 / SR)
    phone = biquad_hp(biquad_hp(x, 250), 250)  # un haut-parleur de téléphone, grossièrement
    keep = np.sqrt((phone ** 2).mean() / (x ** 2).mean()) * 100
    rms = 20 * np.log10(np.sqrt((head ** 2).mean()))
    crest = np.abs(head).max() / np.sqrt((head ** 2).mean())
    pk = np.argmax(np.abs(x) > 0.5 * np.abs(x).max()) / SR * 1000
    print(f'{name:10} {len(x)/SR:.2f} s  attaque {pk:4.1f} ms  RMS 30 ms {rms:5.1f} dBFS  crête/RMS {crest:4.1f}  200-800 Hz {X[(fr>200)&(fr<800)].sum()/X.sum()*100:4.1f} %  gardé au téléphone {keep:4.0f} %')
