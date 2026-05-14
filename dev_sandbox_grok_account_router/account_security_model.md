# Account Security Model

## Non-negotiable requirements

- No plaintext passwords, cookies, session tokens, or refresh tokens on disk.
- No secrets in logs.
- No secrets in `.grokproj` project files.
- UI must mask account identifiers.

## Preferred storage

Use OS-protected credential storage:

- Windows Credential Manager / DPAPI
- macOS Keychain
- Linux Secret Service / libsecret

Electron implementation candidates for later integration:

- `safeStorage` for encrypting small secrets.
- `keytar` if dependency is approved.
- OS userData directory only for encrypted metadata.

## Suggested split storage

### Plain metadata file
Stores non-secret information:

- accountId
- displayName
- maskedEmail
- status
- cooldownUntil
- lastUsedAt
- priority

### Encrypted secret store
Stores sensitive information:

- cookies/session bundle if allowed
- auth profile reference
- optional credential material

## Logging rules

Allowed:

- accountId
- maskedEmail like `g***@domain.com`
- status changes

Forbidden:

- password
- cookies
- localStorage auth data
- bearer tokens
- full email if user disables it

## Threat model

Protect against:

- accidental leakage through logs
- project file sharing leakage
- plaintext disk exposure
- dev accidentally committing secrets

Not guaranteed:

- protection from a fully compromised OS user account
