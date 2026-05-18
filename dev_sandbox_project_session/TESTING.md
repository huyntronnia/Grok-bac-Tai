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

## Manual review checklist

- Read `implementation_plan.md` and confirm New/Open/Save behavior is represented.
- Read `grokproj_schema.md` and confirm saved fields and excluded secret fields are documented.
- Inspect `tests/sample.grokproj` for realistic but non-secret data.
- Confirm no files outside `dev_sandbox_project_session/` were modified for this Phase 1 sandbox.

## Production smoke test

Not required for Phase 1 sandbox because production files are intentionally untouched. Run `npm start` only during Phase 2 production integration approval.
