# Local strategy package inspection

Adapter prepared for public draft review; runtime acceptance remains pending.

Run `npm run build`, then use `/strategy "C:\path\exported-rule-package.json"` in the TUI while idle. Relative paths resolve against the selected workspace. The command opens a separate paged inspection view; arrows or p/n scroll, Escape closes. The file is not added to chat, saved sessions, Agent messages or model context.

The vendored HeartFlow rule reader accepts only v1 data-only rule packages, checks fields/spec/rules/capabilities/hashes and limits reads to a regular local file of 128 KB. It never evals/imports package content, starts a build, activates a bot or connects to a workspace database. Hash validity proves integrity consistency, not trusted authorship or profitability. Runtime behavior remains unverified.

`src/companion/reader.cjs` is generated from workspace-owned source, with base revision and bundle hash in provenance.json. The build copies the reader, provenance and READER-LICENSE.txt into dist/companion so packaged CLI entry points can find them. Companion copies must be refreshed together from the same reviewed source; do not hand-edit the bundle.

TUI TypeScript compilation and companion-file copying passed. No tests, interactive launch, actual file inspection, installed-package launch, Windows/Mac interaction, malicious artifact or recovery checks ran. Model calls and custom execution are not part of this adapter. Founder authorized public draft publication. The shared reader is MIT licensed in READER-LICENSE.txt, consistent with the TUI. Owner: requesting founder; reviewer: other founder, names not recorded.

