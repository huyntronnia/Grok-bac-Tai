# Dev sandbox: Grok Account Router

External-dev task folder for designing/prototyping Grok multi-account routing.

## What this folder owns
This folder owns the design for **Grok accounts used by the main video/motion batch pipeline**.
It does not own 9Router, OpenAI, Gemini, Anthropic, or prompt API accounts.

The production app currently links to this folder from the **Grok Account Router** card under the API key field. That link is only a bridge; the full router still needs to be designed here first.

## Read first
1. `CODE_RULES.md`
2. `implementation_plan.md`
3. `account_router_design.md`
4. `account_security_model.md`
5. `TESTING.md`
6. `DONE_CHECKLIST.md`

## Review flow
A reviewer should be able to answer:
- What is an account-wide Grok limit?
- How is it different from a canvas-local limit?
- Which account state should be assigned after each error?
- Which account is selected next?
- How are secrets protected?
- How does the pipeline resume after switching account?

## Quick smoke test
From repo root:
```powershell
npm start
```
Then:
1. Find **Grok Account Router** under API key.
2. Click **Mở folder router**.
3. Confirm this folder opens.
4. Change Active Grok account and Routing policy.
5. Confirm the app does not crash.

## Done signal
The task is ready for review when `DONE_CHECKLIST.md` is filled and all required tests in `TESTING.md` pass.
