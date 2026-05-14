# Account Router Schema Proposal

This schema is for an isolated prototype. Do not store real secrets in sample files.

```json
{
  "schemaVersion": 1,
  "accounts": [
    {
      "accountId": "acc_001",
      "displayName": "Grok Main",
      "maskedEmail": "u***@example.com",
      "status": "available",
      "priority": 10,
      "lastUsedAt": null,
      "cooldownUntil": null,
      "encryptedSecretRef": "grok-account-acc_001"
    }
  ],
  "routing": {
    "strategy": "round_robin",
    "activeAccountId": "acc_001",
    "maxSwitchesPerScene": 3
  }
}
```

## Account status values

- `available`
- `active`
- `cooldown`
- `limited`
- `login_required`
- `invalid`
- `disabled_by_user`

## Secret payload before encryption

```json
{
  "provider": "grok",
  "createdAt": "...",
  "updatedAt": "...",
  "sessionBundle": {
    "cookies": [],
    "localStorage": {}
  }
}
```

Do not save this plaintext payload to disk.
