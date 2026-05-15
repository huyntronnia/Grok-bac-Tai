# Grok Account Router Design

## Goal
Allow users to add multiple Grok accounts and let the pipeline automatically switch accounts when one account hits an account-wide generation limit.

## Account limit vs canvas limit

### Canvas-local limit
Handled by creating a new canvas and restoring context assets.

### Account-wide limit
Requires switching Grok identity/session. Creating a new canvas will not solve it.

## Proposed account states

- `available`
- `active`
- `cooldown`
- `limited`
- `login_required`
- `invalid`
- `disabled_by_user`

## Routing flow

1. Select active Grok account.
2. Run scene generation.
3. Detect limit type.
4. If canvas-local limit: create new canvas and restore context.
5. If account-wide limit:
   - Mark account `limited` or `cooldown`.
   - Save current scene recovery checkpoint.
   - Switch to next `available` account.
   - Ensure login/session is valid.
   - Create/enter canvas.
   - Restore project context assets.
   - Re-upload current keyframe.
   - Re-send motion prompt.

## Account selection policy

Initial policy: round-robin among `available` accounts.

Future policies:
- priority order
- least recently used
- quota-aware
- user-selected fallback group

## Testing and done proof

Before handoff, use `TESTING.md` to prove:
- `account_limit` switches accounts.
- `canvas_limit` keeps the same account.
- `login_required` pauses and requests login.
- no available accounts causes a safe pause.

Record results in `DONE_CHECKLIST.md`.
