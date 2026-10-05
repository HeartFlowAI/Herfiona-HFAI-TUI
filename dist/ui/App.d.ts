import { type ReactNode } from 'react';
import { type Config } from '../config.js';
import type { ModelAdapter } from '../agent/types.js';
interface Props {
    config: Config;
    adapter: ModelAdapter;
    locality: string;
    truecolor: boolean;
}
export default function App({ config, adapter, locality, truecolor }: Props): ReactNode;
export {};
