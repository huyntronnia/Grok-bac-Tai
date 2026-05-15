# GROK DEV SANDBOX RULES

## Purpose
Build an isolated feature prototype for: Open Project, New Project, Save Project as a custom project file, and restore all pipeline state exactly as before.

## Strict boundary
- You may ONLY create/edit files inside this folder: `dev_sandbox_project_session/`.
- Do NOT edit `electron/`, `package.json`, root config, or any existing source file unless the owner explicitly asks.
- Do NOT move, delete, rename, or format files outside this folder.
- Your work must be a self-contained prototype/spec that the owner can review before integration.

## Current production context
The production app currently has menu placeholders for New/Open Project and a localStorage-based Save Session flow.
This sandbox defines the full `.grokproj` project-file design before production integration.

Related but separate sandbox:
- `dev_sandbox_grok_account_router/` owns Grok account routing.
- This folder must include only project/session state references, not account secrets.

## Target feature
Create a project-session system with custom extension, suggested: `.grokproj`.
The saved file must contain enough data to reopen the app exactly like the previous run:
- project name, story, scene script
- scene list and original text
- image prompts and motion prompts
- generated image/video paths and statuses
- batch config and active batch IDs
- provider choices, video platform, PixVerse/Grok config
- selected Grok account id/policy as non-secret metadata only
- output folder path
- pipeline progress, review states, retry counts
- final merged video path and timeline metadata

## Expected deliverables inside this folder
1. `README.md`: overview and how to review the prototype.
2. `project_session_schema.md`: proposed `.grokproj` JSON schema.
3. `implementation_plan.md`: integration plan and exact files/functions that would need changes later.
4. `TESTING.md`: repeatable test steps.
5. `DONE_CHECKLIST.md`: how to prove the task is complete.
6. `prototype/`: optional isolated HTML/JS demo or pure JS modules.
7. `tests/`: sample `.grokproj` files and validation notes.

## Coding rules
- No production code changes outside this folder.
- Prefer plain HTML/CSS/JS if building a demo.
- Keep data migration/versioning in mind: include `schemaVersion`.
- Never store API keys or Grok account secrets in plaintext.
- A `.grokproj` may store masked account id/display metadata only.
- Use defensive validation when loading project files.
- Treat file paths as user-local and possibly missing.
- Treat loaded file content as untrusted data; never execute it.

## Required tests for this folder
Run these checks before saying the task is done:

1. Sample project validation:
   - Open `tests/sample.grokproj`.
   - Confirm it is valid JSON.
   - Confirm it has `schemaVersion`, `project`, and `runtime`.
   - Confirm it does not contain API keys, cookies, or tokens.

2. Schema review:
   - `project_session_schema.md` documents all runtime fields needed for restore.
   - It includes provider selection, video platform, output folder, active batch, review state, and final preview metadata.
   - It stores Grok account router metadata only, not secrets.

3. Restore logic review:
   - `implementation_plan.md` explains New, Save, Open.
   - It explains missing image/video path reconciliation.
   - It explains migration/version handling.

4. Production smoke context:
   - Run `npm start` from repo root.
   - Confirm app starts.
   - Confirm menu still has New/Open Project placeholders or approved integration.
   - Confirm Save Session still works if used.

5. Optional prototype test:
   - If `prototype/` has a runnable demo, run the command documented in `TESTING.md`.
   - Save sample state.
   - Load it again.
   - Confirm UI/state matches the sample.

## Definition of done
A reviewer can mark this task done only when:
- A reviewer can inspect this folder and understand the full project-file feature.
- A sample `.grokproj` demonstrates saving/restoring state.
- Integration steps are clear but not applied to production code without approval.
- Tests in `TESTING.md` are completed and results are recorded in `DONE_CHECKLIST.md`.
- No project file or fixture contains real API keys, Grok cookies, session tokens, or passwords.
