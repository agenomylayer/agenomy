import { describe, it, expect } from 'vitest';
import { validateHandleFormat } from '../lib/handle';

describe('validateHandleFormat', () => {
  it('accepts a valid lowercase/dash/digit handle', () => {
    expect(validateHandleFormat('satoshi')).toEqual({ ok: true });
    expect(validateHandleFormat('a-1')).toEqual({ ok: true });
    expect(validateHandleFormat('agent-007-x')).toEqual({ ok: true });
  });

  it('rejects too short (<3)', () => {
    expect(validateHandleFormat('ab')).toEqual({ ok: false, reason: 'invalid_length' });
  });

  it('rejects too long (>32)', () => {
    expect(validateHandleFormat('a'.repeat(33))).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });

  it('rejects uppercase', () => {
    expect(validateHandleFormat('Satoshi')).toEqual({ ok: false, reason: 'invalid_charset' });
  });

  it('rejects disallowed characters (underscore, space, dot)', () => {
    expect(validateHandleFormat('a_b')).toEqual({ ok: false, reason: 'invalid_charset' });
    expect(validateHandleFormat('a b')).toEqual({ ok: false, reason: 'invalid_charset' });
    expect(validateHandleFormat('a.b')).toEqual({ ok: false, reason: 'invalid_charset' });
  });

  it('counts bytes not code points (multibyte char fails charset)', () => {
    expect(validateHandleFormat('café')).toEqual({ ok: false, reason: 'invalid_charset' });
  });
});
