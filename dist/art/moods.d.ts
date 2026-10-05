export type Mood = 'idle' | 'thinking' | 'coding' | 'celebrating' | 'concerned' | 'waiting';
export interface MoodMeta {
    label: string;
    blurb: string;
    /** Cute kaomoji face for the panel. */
    face: string;
    /** Decorative glyph shown next to the label. */
    glyph: string;
}
export declare const MOODS: Record<Mood, MoodMeta>;
export declare function spinnerFrame(tick: number): string;
export declare function moodForState(state: 'idle' | 'thinking' | 'streaming' | 'tool' | 'approval' | 'done' | 'error'): Mood;
