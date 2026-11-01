import { loadAnnouncerMode } from '@/stores/announcer';
import type { AnnouncerMode } from './announcer';
import { audioBus } from './context';
import { createImpactPack, impactPack } from './impactPack';
import { playTone } from './tones';

export function screenGlitchUrl(): string {
  return `${import.meta.env.BASE_URL}audio/screen-glitch.mp3`;
}

/** Le même lecteur que l'impact de la cadence : un fichier, chargé et décodé une fois, joué sec. */
const glitch = createImpactPack(async () => {
  const response = await fetch(screenGlitchUrl());
  if (!response.ok) throw new Error(`screen glitch: ${String(response.status)}`);
  return response.arrayBuffer();
});

/**
 * Charge d'avance les deux sons du thème Cyber — le glitch d'écran et l'impact de la coche —, pour
 * que le premier ne sonne pas en retard. Sans bus audio (avant le premier geste), ne fait rien.
 */
export function warmUpCyberSounds(): void {
  const bus = audioBus();
  if (bus === null) return;
  void glitch.warmUp(bus);
  void impactPack.warmUp(bus);
}

/**
 * Le son d'un écran qui arrive, dans le thème Cyber. C'est un son, pas une voix : le silence et la
 * « voix seule » le taisent, comme ils taisent les tons.
 */
export function playScreenGlitch(mode: AnnouncerMode = loadAnnouncerMode()): boolean {
  if (mode === 'silence' || mode === 'voice-only') return false;
  const bus = audioBus();
  if (bus === null) return false;
  return glitch.play(bus);
}

/**
 * L'impact d'une série validée, dans le thème Cyber : le son de la cadence, à chaque validation. Le
 * silence le tait ; la « voix seule » ne le tait pas, parce qu'elle ne retire que le battement des
 * répétitions, et que ce coup-ci est la réponse à un geste. Tant que l'enregistrement n'est pas
 * décodé, le ton synthétique de la cadence le remplace : jamais une validation muette.
 */
export function playSetImpact(mode: AnnouncerMode = loadAnnouncerMode()): boolean {
  if (mode === 'silence') return false;
  const bus = audioBus();
  if (bus === null) return false;
  if (!impactPack.play(bus)) playTone(bus, 'repTap');
  return true;
}
