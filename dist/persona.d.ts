export type PersonaMode = 'playful' | 'warm' | 'focused';
export declare function personaPrompt(mode?: PersonaMode, extra?: string): string;
export declare const GREETINGS: string[];
export declare function greeting(index?: number): string;
