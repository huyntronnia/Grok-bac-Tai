# GROK ACCOUNT ROUTER DEV SANDBOX

## Strict boundary
- Work ONLY inside dev_sandbox_grok_account_router/.
- Do NOT edit electron/, package.json, existing source, or other dev sandbox folders.
- This is an isolated external-dev task folder.

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
   - Tool must switch to a different Grok account/session.

## Security requirements
- Encrypt all user account data at rest.
- Never store raw password/session token/cookie in plaintext.
- Prefer OS keychain/credential vault where possible.
- If using local encryption, keys must not be stored beside encrypted data unprotected.
- Mask account identifiers in UI/logs.
- Do not write secrets into app logs.
- Do not export account secrets into project files.

## Deliverables inside this folder
1. README.md overview.
2. CODE_RULES.md and CODE_RULES.pdf.
3. account_router_design.md.
4. account_security_model.md.
5. account_router_schema.md.
6. implementation_plan.md.
7. prototype/ optional isolated demo.
8. tests/ sample encrypted/placeholder fixtures only, no real secrets.

## Definition of done
- Clear account state machine.
- Clear account limit detector proposal.
- Clear encrypted storage design.
- Clear account switch/resume flow.
- No production code changed.
