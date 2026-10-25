export function getOwnerPasscode(): string | undefined {
  return process.env.EVO_MASTER_PASSCODE
    || process.env.MASTER_PASSWORD
    || (process.env.NODE_ENV === 'production' ? undefined : 'Vinay@2026');
}

export function isValidOwnerPasscode(value: unknown): boolean {
  const configuredPasscode = getOwnerPasscode();
  return Boolean(
    configuredPasscode
    && typeof value === 'string'
    && value.trim() === configuredPasscode
  );
}
