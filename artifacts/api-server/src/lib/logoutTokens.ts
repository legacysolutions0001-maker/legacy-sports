const logoutAllTimestamps = new Map<number, number>();

export function setLogoutAllTimestamp(userId: number): void {
  logoutAllTimestamps.set(userId, Date.now());
}

export function getLogoutAllTimestamp(userId: number): number {
  return logoutAllTimestamps.get(userId) ?? 0;
}
