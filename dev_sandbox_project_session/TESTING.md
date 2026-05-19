# Testing: Project Session Sandbox

## Command

Run from the sandbox folder:

```powershell
cd Grok-bac-Tai/dev_sandbox_project_session
node tests/projectSession.test.mjs
```

or:

```powershell
npm test
```

## Automated coverage

`tests/projectSession.test.mjs` verifies:

- `tests/sample.grokproj` is valid JSON.
- The sample has `schemaVersion`, `runtime`, `project.scenes`, at least 3 scenes, relative assets, final preview timeline, and Grok router metadata only.
- Secret scanner reports no secrets in the sample.
- Validator rejects missing `schemaVersion`.
- Validator rejects non-array `project.scenes`.
- Validator rejects unsupported future schema versions.
- Validator rejects secret-like keys/values and sanitizer strips or redacts them.
- Opening a project never auto-runs and waits for user Start.
- Missing assets return warnings rather than crashing.
- Unknown compatible top-level fields are preserved as inert `extensions.unknownTopLevel` data.
- New Project asks for confirmation when unsaved changes exist.
- New Project clears active batch, preview, and pipeline logs while preserving explicit global settings and secure credential refs.
- Save Project includes prompts, config, scenes, assets, runtime, preview timeline, and router metadata.
- Save Project excludes account/API/session secrets and full private emails.
- Restore recovers current batch index, current scene, paused state, and router id/policy/labels only.
- `.grokproj` extension validation is enforced by the open helper.
- Missing linked media does not remove scenes, raw scene text, image prompts, motion prompts, statuses, runtime, or preview timeline metadata.
- Portable package export creates manifest metadata and asset warnings.
- Portable package export rewrites existing asset paths to package-relative paths.
- Portable package export preserves scene data and motion prompts when some assets are missing.
- Portable package open restores scenes and motion prompts.
- Portable package open rewrites package-relative asset paths to extracted local paths.
- Portable package open does not auto-run.
- Portable package open rejects path traversal, encoded traversal, double-encoded traversal, absolute paths, and duplicate entries.
- Portable package open skips executable package entries.
- Portable package open verifies listed SHA256 checksums; mismatched assets are skipped with warnings and scene data is preserved.
- Portable package warnings from untrusted manifests are sanitized before display.
- `.grokproj` JSON open still works unchanged.

## Manual review checklist

- Read `implementation_plan.md` and confirm New/Open/Save behavior is represented.
- Read `grokproj_schema.md` and confirm saved fields and excluded secret fields are documented.
- Inspect `tests/sample.grokproj` for realistic but non-secret data.
- Confirm `.grokpkg` package docs describe `manifest.json`, `project.grokproj`, `assets/images`, `assets/videos`, `assets/final`, and optional `checksums.json`.
- Confirm `.grokpkg` extracts only `.png`, `.jpg`, `.jpeg`, `.webp`, `.mp4`, `.mov`, `.webm`, `.wav`, and `.mp3` media under `assets/`.
- Confirm package checksum mismatch skips the asset, shows a warning, and keeps scenes/prompts visible.
- Confirm no API keys, cookies, passwords, session tokens, refresh tokens, bearer tokens, raw browser storage, full private emails, or account-router secrets are saved in package data.
- Confirm no files outside `dev_sandbox_project_session/` were modified for this Phase 1 sandbox.

## Manual portable package QA

- Create a project with 2-3 scenes.
- Generate image and video assets.
- Export `.grokpkg`.
- Move `.grokpkg` to another folder or machine.
- Open `.grokpkg`.
- Confirm all scenes, raw text, image prompts, motion prompts, runtime, and final preview metadata restore.
- Confirm bundled assets restore and package-relative paths are rewritten to local extracted paths.
- Confirm open never auto-runs and waits for user Start.
- Confirm missing or corrupt assets show warnings without deleting scene data.
- Confirm no secrets appear in `manifest.json`, `project.grokproj`, or `checksums.json`.

## Production smoke test

Not required for Phase 1 sandbox because production files are intentionally untouched. Run `npm start` only during Phase 2 production integration approval.
