export type HandleCheck = { ok: true } | { ok: false; reason: 'invalid_length' | 'invalid_charset' };

/**
 * Mirrors the contract's _validateHandle (pure): byte length 3..32; each byte
 * must be [a-z] (0x61..0x7a), [0-9] (0x30..0x39), or '-' (0x2d). Lowercase only.
 */
export function validateHandleFormat(handle: string): HandleCheck {
  const bytes = new TextEncoder().encode(handle);
  if (bytes.length < 3 || bytes.length > 32) {
    return { ok: false, reason: 'invalid_length' };
  }
  for (const b of bytes) {
    const isLower = b >= 0x61 && b <= 0x7a;
    const isDigit = b >= 0x30 && b <= 0x39;
    const isDash = b === 0x2d;
    if (!isLower && !isDigit && !isDash) {
      return { ok: false, reason: 'invalid_charset' };
    }
  }
  return { ok: true };
}
