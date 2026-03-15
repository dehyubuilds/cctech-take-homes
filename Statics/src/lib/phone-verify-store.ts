/** In-memory store for phone verification codes. Use Redis/Dynamo in production. */
const pendingCodes = new Map<string, { code: string; expiresAt: number }>();

export function setPendingCode(userId: string, code: string, expiresAt: number): void {
  pendingCodes.set(userId, { code, expiresAt });
}

export function getPendingCode(userId: string): { code: string; expiresAt: number } | null {
  const entry = pendingCodes.get(userId);
  if (!entry || Date.now() > entry.expiresAt) {
    pendingCodes.delete(userId);
    return null;
  }
  return entry;
}

export function clearPendingCode(userId: string): void {
  pendingCodes.delete(userId);
}
