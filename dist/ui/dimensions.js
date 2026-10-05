import { useEffect, useState } from 'react';
import { useStdout } from 'ink';
/** Live terminal size, updated on resize. */
export function useTerminalSize() {
    const { stdout } = useStdout();
    const [size, setSize] = useState({
        columns: stdout?.columns ?? 80,
        rows: stdout?.rows ?? 24,
    });
    useEffect(() => {
        if (!stdout)
            return;
        const onResize = () => setSize({ columns: stdout.columns ?? 80, rows: stdout.rows ?? 24 });
        stdout.on('resize', onResize);
        onResize();
        return () => {
            stdout.off('resize', onResize);
        };
    }, [stdout]);
    return size;
}
//# sourceMappingURL=dimensions.js.map