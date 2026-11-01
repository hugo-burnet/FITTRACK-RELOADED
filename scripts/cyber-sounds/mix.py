# Les sons de la coche Cyber : des recettes à couches, tirées des packs CC0 de Kenney.
# Chaque recette : des échantillons (retard, gain, vitesse), un corps grave synthétisé, une pièce courte.
import sys, subprocess, os, io
import numpy as np, soundfile as sf
SR = 48000
DL = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'sources')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), 'out')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

def load(rel):
    path = os.path.join(DL, rel)
    wav = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'wav', '-'], capture_output=True, check=True).stdout
    x, _ = sf.read(io.BytesIO(wav)); return x.astype(np.float64)

def rate(x, r):
    # Vitesse r : plus aigu et plus court si r > 1.
    n = int(len(x) / r); return np.interp(np.arange(n) * r, np.arange(len(x)), x)

def thump(f0, f1, dur, gain):
    t = np.arange(int(SR * dur)) / SR
    f = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-t / (dur / 4)) * np.minimum(1, t / 0.002)
    return gain * np.sin(ph) * env

def room(x, wet=0.16, length=0.32):
    n = int(SR * length); t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-t / (length / 5))
    # Une pièce sombre : on adoucit les aigus de la réponse.
    k = 12; ir = np.convolve(ir, np.ones(k) / k, 'same'); ir /= np.abs(ir).sum() ** 0.5 * 6
    y = np.convolve(x, ir)[: len(x) + n]
    out = np.zeros(len(y)); out[: len(x)] += x
    return out + wet * y

def mix(layers, total):
    buf = np.zeros(int(SR * total))
    for sig, at, g in layers:
        i = int(SR * at); seg = sig[: max(0, len(buf) - i)] * g
        buf[i: i + len(seg)] += seg
    return buf

def finish(x, name, wet=0.16):
    y = room(x, wet)
    # Fin propre : un fondu sur les 40 dernières ms.
    f = int(SR * 0.04); y[-f:] *= np.linspace(1, 0, f)
    y = y / np.abs(y).max() * 0.89
    path = os.path.join(OUT, name + '.mp3')
    wav = io.BytesIO(); sf.write(wav, y, SR, format='WAV'); wav.seek(0)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'wav', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '96k', path], input=wav.read(), check=True)
    print(name, f'{len(y)/SR:.2f} s', os.path.getsize(path), 'octets')

def find(_prefix, name):
    return name  # les sources sont à plat dans sources/

A = I = U = R = C = ''
latch = load(find(R, 'metalLatch.ogg'))
tick = load(find(A, 'impactMetal_light_002.ogg'))
body = load(find(A, 'impactMetal_medium_002.ogg'))
tin = load(find(A, 'impactMetal_light_003.ogg'))
tin2 = load(find(A, 'impactTin_medium_002.ogg'))
chips = load(find(C, 'chips-stack-4.ogg'))
chipLow = load(find(C, 'chip-lay-3.ogg'))
sw = load(find(U, 'switch38.ogg'))
punch = load(find(A, 'impactPunch_medium_000.ogg'))
glitch = load(find(I, 'glitch_003.ogg'))
glitch2 = load(find(I, 'glitch_004.ogg'))
clickS = load(find(U, 'click4.ogg'))

# 1. Culasse : « tchk-TCHAK ». Un petit cran métallique, puis le verrou qui claque sur un corps grave.
finish(mix([
    (rate(tick, 1.3), 0.000, 0.35),
    (latch, 0.065, 1.0),
    (body, 0.066, 0.55),
    (thump(95, 42, 0.16, 0.9), 0.066, 1.0),
    (glitch2, 0.085, 0.18),
], 0.55), 'culasse')

# 2. Douille : le clic, puis l'étui qui tinte, rebondit deux fois, plus haut et plus court à chaque fois.
finish(mix([
    (clickS, 0.000, 0.7),
    (thump(140, 70, 0.08, 0.45), 0.000, 1.0),
    (tin, 0.020, 0.9),
    (rate(tin2, 1.15), 0.150, 0.45),
    (rate(tin, 1.32), 0.235, 0.28),
    (rate(tin2, 1.5), 0.290, 0.14),
], 0.75), 'douille', wet=0.2)

# 3. Jeton : la pile de jetons qu'on pose, nette et pleine, l'ASMR le plus connu.
finish(mix([
    (chips, 0.000, 1.0),
    (chipLow, 0.004, 0.6),
    (thump(160, 80, 0.07, 0.4), 0.000, 1.0),
    (glitch, 0.040, 0.12),
], 0.45), 'jeton', wet=0.12)

# 4. Interrupteur : un gros inverseur qui « thock », sourd et franc, avec une miette numérique.
finish(mix([
    (sw, 0.000, 1.0),
    (rate(punch, 1.4), 0.000, 0.35),
    (thump(120, 55, 0.12, 0.8), 0.002, 1.0),
    (glitch, 0.030, 0.2),
], 0.5), 'interrupteur', wet=0.14)

# Décocher : le verrou à l'envers, doux, sans corps.
finish(mix([(latch[::-1][-int(SR * 0.18):], 0.0, 0.45), (rate(clickS, 0.8), 0.17, 0.4)], 0.3), 'decocher', wet=0.08)
