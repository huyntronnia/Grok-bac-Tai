# Project Session Sandbox

This sandbox prototypes Project Session workflows for `.grokproj` and `.grokpkg`.

- `.grokproj` is a lightweight JSON project-state file.
- `.grokpkg` is a portable ZIP-style package containing project state plus referenced media assets.

## Implemented in Phase 1

- Schema documentation for `.grokproj` version 1 in `grokproj_schema.md`.
- A safe sample project file in `tests/sample.grokproj`.
- Pure JavaScript helpers in `prototype/projectSession.js` for creating, saving, validating, migrating, sanitizing, opening, reconciling, packaging, and restoring project state.
- Node tests in `tests/projectSession.test.mjs`.

## File formats

`.grokproj`:

- JSON only.
- Preserves scene data, raw scene text, image prompts, motion prompts, config, runtime, final preview metadata, and non-secret router metadata.
- Does not embed heavy image/video assets.

`.grokpkg`:

- ZIP-style portable package.
- Contains `manifest.json`, `project.grokproj`, linked assets under `assets/images/`, `assets/videos/`, `assets/final/`, and optional `checksums.json`.
- Rewrites linked asset paths to package-relative paths during export.
- Restores package-relative asset paths to extracted local paths during open.
- Writes SHA256 checksums for bundled assets and verifies listed checksums during open; mismatched assets are skipped with warnings while scene data remains.

## Portable package workflow

- Export Portable Package when moving a project to another machine.
- Open Portable Package to restore project state and bundled media assets.
- Missing package assets are warnings only; scene data and prompts are preserved.

## Security boundary

`.grokproj` files and `.grokpkg` packages are untrusted input. Loading must never execute code and must never auto-run a project. A loaded project is restored into `waiting-for-user-start` state.

Allowed router data is metadata only:

- `accountRouterEnabled`
- `selectedGrokAccountId`
- `routingPolicy`
- provider/model/account labels after redaction
- safe status/checkpoint labels

The prototype rejects or strips API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, and full private emails. `.grokpkg` input also rejects path traversal and ignores executable/script entries.

Package open extracts only media files under `assets/` with these extensions: `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4`, `.mov`, `.webm`, `.wav`, `.mp3`. Executable/script entries such as `.exe`, `.bat`, `.cmd`, `.ps1`, `.js`, `.vbs`, `.sh`, `.dll`, `.msi`, and `.scr` are skipped. Path traversal, encoded traversal, absolute paths, and duplicate entries are rejected. Extracted files are written to an app-managed package asset folder; package contents are never executed.

## Manual QA

- Create a project with 2-3 scenes.
- Generate images and videos.
- Export a `.grokpkg`.
- Move the `.grokpkg` to another folder or machine.
- Open the `.grokpkg`.
- Confirm scenes, raw text, image prompts, motion prompts, runtime, and assets restore.
- Confirm the project does not auto-run after open.
- Confirm missing or corrupt assets produce non-destructive warnings.
- Confirm no secrets are present in `manifest.json`, `project.grokproj`, or `checksums.json`.

## Run tests

```powershell
cd Grok-bac-Tai/dev_sandbox_project_session
node tests/projectSession.test.mjs
```

or:

```powershell
npm test
```

## Limitations

- `.grokpkg` is not encrypted.
- Secure credential storage is intentionally outside project/package files.
- Future work: optional encrypted package export if needed.
