# Testing: Project Session Sandbox

## Scope
These tests validate the `.grokproj` project/session design and the current production smoke context. They do not require real API keys or Grok credentials.

## Test 1: Sample project file is valid
Open:
```txt
tests/sample.grokproj
```

Pass criteria:
- File is valid JSON.
- Top-level `schemaVersion` exists.
- Top-level `project` exists.
- Top-level `runtime` exists.
- `project.scenes` is an array if present.
- No API key, bearer token, cookie, password, or Grok session token exists.

Optional PowerShell check from repo root:
```powershell
node -e "const fs=require('fs'); const p='dev_sandbox_project_session/tests/sample.grokproj'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if(!j.schemaVersion||!j.project||!j.runtime) throw new Error('bad grokproj fixture'); console.log('grokproj fixture ok')"
```

## Test 2: Schema completeness review
Open `project_session_schema.md`.

Pass criteria:
- It documents `.grokproj` extension.
- It includes `schemaVersion`.
- It includes project fields.
- It includes runtime fields:
  - active batch ids
  - paused state
  - output folder
  - selected provider/account/model
  - video platform
  - skip review
- It includes video config.
- It includes final preview metadata.
- It includes scene object fields.
- It excludes secrets.

## Test 3: Save/Open/New plan review
Open `implementation_plan.md`.

Pass criteria:
- New Project reset behavior is clear.
- Save Project payload behavior is clear.
- Open Project validation/restore behavior is clear.
- Missing asset reconciliation is documented.
- Migration/versioning is documented.
- Security rules are documented.

## Test 4: Production smoke test
From repo root:
```powershell
npm start
```

Pass criteria:
- Electron app starts.
- Existing Save Session button still works if tested.
- New/Open Project placeholders or approved implementation do not crash.
- Existing pipeline UI still renders.

## Test 5: Optional prototype behavior
If `prototype/` contains a runnable demo, document its command here.

Expected simulated cases:
- Save a sample state into `.grokproj` JSON.
- Load the same file.
- Confirm project name, story, scenes, active batch, runtime config, and final preview metadata match.
- Load a file with missing asset paths.
- Confirm the loader reports warnings but does not crash.
- Load a malformed file.
- Confirm the loader rejects it with a clear error.

## Recording results
After testing, update `DONE_CHECKLIST.md` with:
- date/time
- tester
- exact tests run
- pass/fail
- notes and risks
