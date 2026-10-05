import { MOODS } from './moods.js';
/**
 * Aurora's face for a mood — a cute kaomoji rather than a pixel portrait.
 * These read cleanly in any monospace font and stay on-theme.
 */
export function auroraFace(mood) {
    return (MOODS[mood] ?? MOODS.idle).face;
}
export { MOODS } from './moods.js';
export {} from './moods.js';
//# sourceMappingURL=index.js.map