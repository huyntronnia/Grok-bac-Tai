# Dev sandbox: Project session feature

This folder is intentionally isolated. Build/prototype the Open/New/Save Project feature here only.

## What this folder owns
This folder owns the `.grokproj` project/session file design:
- save current project state
- reopen project state later
- restore scene prompts, statuses, asset paths, active batch, review state, and final preview metadata

It does not own Grok account secrets. Grok account routing is documented separately in:
```txt
dev_sandbox_grok_account_router/
```

A `.grokproj` may reference selected Grok account metadata, but must not store cookies, tokens, passwords, or raw API keys.

## Read first
1. `CODE_RULES.md`
2. `implementation_plan.md`
3. `project_session_schema.md`
4. `TESTING.md`
5. `DONE_CHECKLIST.md`

## Quick smoke test
From repo root:
```powershell
npm start
```
Then confirm the app starts and project/session menu or save-session flow still works.

## Review flow
A reviewer should be able to answer:
- What fields are saved into `.grokproj`?
- What fields are intentionally excluded for security?
- How does Open Project validate and migrate files?
- What happens if saved image/video paths are missing?
- How do New/Open/Save affect current pipeline state?

## Done signal
The task is ready for review when `DONE_CHECKLIST.md` is filled and all required tests in `TESTING.md` pass.
