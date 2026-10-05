export interface Size {
    columns: number;
    rows: number;
}
/** Live terminal size, updated on resize. */
export declare function useTerminalSize(): Size;
