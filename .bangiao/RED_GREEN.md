# Red/green evidence

## WP1 red

- Command: `node tests/manual-primary-workflow.test.js`
- Result: **FAIL**, as expected before production implementation.
- First failure: `Cannot find module '../electron/main/state/workflow_mode'`.
- Behavioral coverage introduced before production edits: canonical mode guard, Request 1/2 and NV1/NV2 bundle semantics, durable active receipt across controller restart, repeated arm baseline stability, conversation mismatch rejection, owned assistant capture, disk-derived readiness, strict N/N VeoUp gate, forced `allowPartial:false`, and deletion detected by pre-submit re-audit.

The suite is executed directly with Node and therefore does not use `tests/normalize-hook.js`.
