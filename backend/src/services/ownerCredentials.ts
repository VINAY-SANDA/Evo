import { timingSafeEqual } from 'node:crypto';

export function getOwnerPasscode(): string | undefined {
  return process.env.EVO_MASTER_PASSCODE
    || process.env.MASTER_PASSWORD
    || (process.env.NODE_ENV === 'production' ? undefined : 'Vinay@2026');
}

export function isValidOwnerPasscode(value: unknown): boolean {
  const configuredPasscode = getOwnerPasscode();
  if (!configuredPasscode || typeof value !== 'string') return false;
  const supplied = Buffer.from(value.trim());
  const expected = Buffer.from(configuredPasscode);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
