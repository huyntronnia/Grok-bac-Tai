// Prototype placeholder only. Do not use real Grok credentials here.
export function pickNextAccount(accounts, currentAccountId) {
  const available = accounts.filter((account) => account.status === 'available');
  if (!available.length) return null;
  const currentIndex = available.findIndex((account) => account.accountId === currentAccountId);
  return available[(currentIndex + 1 + available.length) % available.length];
}
