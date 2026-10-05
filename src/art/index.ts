import { MOODS, type Mood } from './moods.js';

/**
 * Aurora's face for a mood — a cute kaomoji rather than a pixel portrait.
 * These read cleanly in any monospace font and stay on-theme.
 */
export function auroraFace(mood: Mood): string {
  return (MOODS[mood] ?? MOODS.idle).face;
}

export { MOODS, type Mood } from './moods.js';
export { type MoodMeta } from './moods.js';
