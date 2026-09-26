# Baseline verification

- HEAD: a82fcc082bb3268fef11be83fca0c9d3428197d8, identical to task audit baseline.
- Branch created: fix/manual-mode-primary-workflow.
- Initial tracked worktree clean. User task file initially untracked and preserved.
- npm ci: PASS, 316 packages installed from lockfile. npm reports 16 existing dependency advisories (15 high, 1 critical); no dependency upgrades made.
- npm test: PASS, all 77 test files. Output saved outside repository in the system temporary directory as vidora-manual-baseline-tests.log.
- node electron/chatgptAutomation.test.js: PASS.
- node electron/chatgptRecovery.test.js: PASS.
- Default runner does not include the two electron tests; final validation must run them explicitly.
- GitHub CLI prepared outside repository. Existing Git credential manager authentication can access GitHub API; no credentials written into repository or reports.
