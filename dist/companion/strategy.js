import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const reader = require('./reader.cjs');
export async function inspectStrategy(path) { return reader.inspectionLines(await reader.inspectRuleFile(path)); }
//# sourceMappingURL=strategy.js.map