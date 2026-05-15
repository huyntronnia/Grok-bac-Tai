# Testing: Grok Account Router Sandbox

## Scope
These tests validate the sandbox design and the current production UI link. They do not require real Grok credentials.

## Test 1: JSON fixture is valid
Open:
```txt
tests/sample_account_router.json
```
Pass criteria:
- File is valid JSON.
- Top-level `schemaVersion` exists.
- Top-level `accounts` is an array.
- Top-level `routing` exists.
- No real email, password, cookie, bearer token, or session token is present.

Optional PowerShell check from repo root:
```powershell
node -e "const fs=require('fs'); const p='dev_sandbox_grok_account_router/tests/sample_account_router.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); if(!j.schemaVersion||!Array.isArray(j.accounts)||!j.routing) throw new Error('bad router fixture'); console.log('router fixture ok')"
```

## Test 2: Account state machine review
Open `account_router_design.md`.

Pass criteria:
- It lists all account statuses.
- It explains `available`, `active`, `cooldown`, `limited`, and `login_required`.
- It explains what event moves an account into each status.
- It explains how a disabled account is skipped.

## Test 3: Limit classifier review
Open `implementation_plan.md`.

Pass criteria:
- `canvas_limit` is documented as not switching accounts.
- `account_limit` is documented as switching accounts.
- `login_required` pauses for user login.
- `network_error` does not burn/disable an account immediately.

## Test 4: Routing algorithm review
Open `account_router_schema.md` and `account_router_design.md`.

Pass criteria:
- Routing strategy exists, e.g. `round_robin`, `manual`, or `first_available`.
- Active account is recorded.
- Max switches per scene is defined.
- If all accounts are unavailable, the expected action is pause + show message.

## Test 5: Production UI link smoke test
From repo root:
```powershell
npm start
```

Steps:
1. In the Electron app, find Provider Router.
2. Under API key, find **Grok Account Router**.
3. Change **Active Grok account**.
4. Change **Routing policy**.
5. Click **Mở folder router**.

Pass criteria:
- This folder opens in Windows Explorer.
- The app does not crash.
- The UI clearly says this is for Grok batch account routing, separate from 9Router/API key.

## Test 6: Optional prototype behavior
If `prototype/` contains a runnable demo, document its command here.

Expected simulated cases:
- Input: account 1 receives `account_limit`.
  - Expected: account 1 becomes `limited` or `cooldown`, account 2 becomes active.
- Input: account 1 receives `canvas_limit`.
  - Expected: active account remains account 1.
- Input: account 1 receives `login_required`.
  - Expected: account 1 becomes `login_required`, pipeline pauses for login.

## Recording results
After testing, update `DONE_CHECKLIST.md` with:
- date/time
- tester
- exact tests run
- pass/fail
- notes and risks
