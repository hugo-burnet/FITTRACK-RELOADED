# Les sons de la coche Cyber, v3 : percutants. Courts, attaque très forte, écrêtés.
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


def lowpass1(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); p = 0.0
    for i, v in enumerate(x): p = (1 - a) * v + a * p; y[i] = p
    return y

def noise(dur, tau):
    n = int(SR * dur); return rng.standard_normal(n) * np.exp(-np.arange(n) / (SR * tau))

def band(x, lo, hi):
    return lowpass1(biquad_hp(x, lo), hi)

def punch(x, drive, hp=150, decay=0.07, total=None):
    """Le mastering « percutant » : passe-haut, une enveloppe qui meurt vite, puis un écrêtage franc
    (c'est lui qui donne la densité sur un petit haut-parleur), adouci au-dessus de 9 kHz."""
    x = biquad_hp(x, hp)
    t = np.arange(len(x)) / SR
    x = x * np.where(t < 0.012, 1.0, np.exp(-(t - 0.012) / decay))
    x = x / np.abs(x).max()
    x = np.clip(x * drive, -1, 1)
    x = lowpass1(x, 9000)
    x = x / np.abs(x).max() * 0.98
    f = int(SR * 0.02); x[-f:] *= np.linspace(1, 0, f)
    return x

scifi = load('impactMetal_004.ogg'); scifi0 = load('impactMetal_000.ogg')
generic = load('impactGeneric_light_000.ogg'); pun = load('impactPunch_heavy_002.ogg')
heavy = load('impactMetal_heavy_000.ogg'); latch = load('metalLatch.ogg'); tick = load('impactMetal_light_002.ogg')
crunch = load('explosionCrunch_000.ogg'); glitch = load('glitch_004.ogg')

sounds = {
  # Détonation : le « PAF » d'une arme. Une craque de 4 ms très forte, un souffle médium qui meurt en
  # 50 ms, un coup qui plonge, le métal de la culasse juste derrière.
  'detonation': punch(mix([
      (band(noise(0.006, 0.0015), 2500, 12000), 0.0, 3.0),
      (band(noise(0.12, 0.03), 350, 2500), 0.0, 1.6),
      (body(260, 110, 0.07, 1.4), 0.0, 1.0),
      (trim(heavy, 0.12), 0.002, 0.7),
      (trim(latch, 0.1), 0.045, 0.35),
  ], 0.2), drive=4.5, decay=0.045),
  # Marteau : métal lourd sur métal, un seul coup, rien qui traîne.
  'marteau': punch(mix([
      (band(noise(0.005, 0.0012), 2000, 11000), 0.0, 2.2),
      (trim(heavy, 0.15), 0.0, 1.0), (trim(scifi, 0.15), 0.0, 0.9), (generic, 0.0, 0.8),
      (body(300, 150, 0.08, 1.3), 0.0, 1.0),
  ], 0.18), drive=4.0, decay=0.05),
  # Frappe : le coup de poing sur une plaque, resserré et écrêté.
  'frappe': punch(mix([
      (band(noise(0.005, 0.0012), 2000, 10000), 0.0, 1.8),
      (trim(scifi, 0.18), 0.0, 1.0), (generic, 0.0, 0.8), (trim(rate(pun, 1.3), 0.15), 0.0, 0.7),
      (body(300, 165, 0.09, 1.3), 0.0, 1.0),
  ], 0.2), drive=3.5, decay=0.06),
  # Surcharge : l'impact numérique, son éclat de crunch en 5 bits, deux miettes de glitch.
  'surcharge': punch(mix([
      (band(noise(0.005, 0.0012), 2000, 10000), 0.0, 1.8),
      (trim(scifi0, 0.18), 0.0, 1.0), (body(280, 150, 0.09, 1.3), 0.0, 1.0),
      (crush(trim(crunch, 0.2, 0.08), 5), 0.004, 0.7), (glitch, 0.015, 0.6), (glitch, 0.045, 0.35),
  ], 0.22), drive=4.0, decay=0.07),
  # Décocher : le verrou à l'envers, sec.
  'decocher': punch(mix([(latch[::-1][-int(SR * 0.1):], 0.0, 0.6), (band(noise(0.004, 0.001), 2000, 9000), 0.1, 0.8)], 0.13), drive=2.0, hp=300, decay=0.08) * 0.55,
}
for name, x in sounds.items():
    save(x, name)
    h = x[: int(SR * 0.03)]
    phone = biquad_hp(biquad_hp(x, 250), 250)
    keep = np.sqrt((phone ** 2).mean() / (x ** 2).mean()) * 100
    print(f'{name:10} {len(x)/SR:.2f} s  RMS 30 ms {20*np.log10(np.sqrt((h**2).mean())):5.1f} dBFS  crête/RMS {np.abs(h).max()/np.sqrt((h**2).mean()):4.1f}  gardé au téléphone {keep:4.0f} %')
