export type Mood = 'idle' | 'thinking' | 'coding' | 'celebrating' | 'concerned' | 'waiting';

export interface MoodMeta {
  label: string;
  blurb: string;
  /** Cute kaomoji face for the panel. */
  face: string;
  /** Decorative glyph shown next to the label. */
  glyph: string;
}

export const MOODS: Record<Mood, MoodMeta> = {
  idle: { label: 'idle', blurb: 'just vibing with you', face: '(˶ᵔ ᵕ ᵔ˶)', glyph: '\u2661' },
  thinking: { label: 'thinking', blurb: 'connecting the dots', face: '( ˘ ³˘)♡', glyph: '\u2665' },
  coding: { label: 'coding', blurb: 'typing at her laptop', face: '(๑˃ᴗ˂)ﻭ', glyph: '\u2699' },
  celebrating: { label: 'celebrating', blurb: 'we did it!', face: 'ヽ(o＾▽＾o)ノ', glyph: '\u2727' },
  concerned: { label: 'concerned', blurb: 'a little hiccup', face: '(｡•́︿•̀｡)', glyph: '!' },
  waiting: { label: 'waiting', blurb: 'your approval first', face: '(◕‿◕✿)', glyph: '?' },
};

const SPINNER = ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u2807', '\u280f'];

export function spinnerFrame(tick: number): string {
  return SPINNER[tick % SPINNER.length]!;
}

export function moodForState(state: 'idle' | 'thinking' | 'streaming' | 'tool' | 'approval' | 'done' | 'error'): Mood {
  switch (state) {
    case 'thinking':
      return 'thinking';
    case 'streaming':
      return 'idle';
    case 'tool':
      return 'coding';
    case 'approval':
      return 'waiting';
    case 'done':
      return 'celebrating';
    case 'error':
      return 'concerned';
    default:
      return 'idle';
  }
}
