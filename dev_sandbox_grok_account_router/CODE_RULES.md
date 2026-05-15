# GROK ACCOUNT ROUTER DEV SANDBOX

## Strict boundary
- Work ONLY inside `dev_sandbox_grok_account_router/`.
- Do NOT edit `electron/`, `package.json`, existing source, or other dev sandbox folders unless the owner explicitly asks.
- This folder is an isolated external-dev task area. Production integration must be proposed here first.

## Current production link
The main app now has a visible **Grok Account Router** section under the 9Router/API key UI.

Linked production files already pass metadata only:
- `electron/index.html`: UI card under API key.
- `electron/style.css`: UI styling.
- `electron/renderer.js`: sends `videoAccount` and `routingPolicy` to pipeline.
- `electron/preload.js`: exposes `openGrokRouterFolder()`.
- `electron/main.js`: opens this sandbox folder and logs router metadata.

Important: this is not full account switching yet. It is a UI/link/metadata bridge so this sandbox can define the real router safely.

## Task
Design/prototype Grok account routing:
- User can add multiple Grok accounts to the tool.
- System detects account-level limit, different from canvas-only limit.
- If one account has account-wide limit, automatically roll to another available account.
- Preserve current scene/prompt/job state while switching account.
- Resume generation after account switch.

## Important limit distinction
1. Canvas-local limit:
   - Current production logic can handle by creating a new canvas.
   - Do not confuse this with account limit.

2. Account-wide limit:
   - Changing canvas is not enough.
   - Tool must switch to a different Grok account/session/profile.

## Security requirements
- Encrypt all user account data at rest.
- Never store raw password/session token/cookie in plaintext.
- Prefer OS keychain/credential vault where possible.
- If using local encryption, keys must not be stored beside encrypted data unprotected.
- Mask account identifiers in UI/logs.
- Do not write secrets into app logs.
- Do not export account secrets into project files.
- Test fixtures must use fake/placeholder values only.

## Deliverables inside this folder
1. `README.md` overview and reviewer instructions.
2. `CODE_RULES.md` and optional `CODE_RULES.pdf`.
3. `account_router_design.md`.
4. `account_security_model.md`.
5. `account_router_schema.md`.
6. `implementation_plan.md`.
7. `TESTING.md` with repeatable test steps.
8. `DONE_CHECKLIST.md` showing how to prove the task is complete.
9. `prototype/` optional isolated demo.
10. `tests/` sample encrypted/placeholder fixtures only, no real secrets.

## Required tests for this folder
Run these checks before saying the task is done:

1. Documentation completeness:
   - `README.md` explains what this router owns.
   - `implementation_plan.md` lists exact future production touch points.
   - `account_security_model.md` forbids plaintext secrets.
   - `account_router_schema.md` includes account states, routing strategy, and fake fixture format.

2. Fixture validation:
   - Open `tests/sample_account_router.json`.
   - Confirm it is valid JSON.
   - Confirm it has `schemaVersion`, `accounts`, and `routing`.
   - Confirm no real email/password/cookie/token exists.

3. UI link smoke test from production app:
   - Run `npm start` from repo root.
   - In Provider Router, find **Grok Account Router** under API key.
   - Click **Mở folder router**.
   - Confirm Windows opens `dev_sandbox_grok_account_router`.
   - Change Active Grok account and Routing policy.
   - Click Start pipeline or Save session if needed; confirm app does not crash.

4. Router behavior prototype test, if `prototype/` contains code:
   - Run the prototype command documented in `TESTING.md`.
   - Simulate `account_limit`.
   - Confirm router selects the next available account.
   - Simulate `canvas_limit`.
   - Confirm router does not switch account.

## Definition of done
A reviewer can mark this task done only when:
- The account state machine is clear.
- Account limit vs canvas limit detection is clear.
- Encrypted storage/security model is clear.
- Account switch/resume flow is clear.
- Tests in `TESTING.md` are completed and results are recorded in `DONE_CHECKLIST.md`.
- No real secrets are present anywhere in this folder.
- Any production changes are explicitly listed as proposals unless already approved by the owner.
