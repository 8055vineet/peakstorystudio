import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  assertLocalTarget,
  exitUnlessLocalTarget,
  isLocalSupabaseUrl,
  ALLOW_REMOTE_DB_VAR,
} from '../lib/assert-local-target.mjs';

const HOSTED = 'https://abcdefghijklmnop.supabase.co';

describe('isLocalSupabaseUrl', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://127.0.0.1:54321/',
    'http://localhost:54321',
    'http://localhost',
    'https://localhost/rest/v1',
    'http://LOCALHOST:54321',
    '  http://127.0.0.1:54321  ',
  ])('accepts the local stack: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(true);
  });

  it.each([
    HOSTED,
    'http://0.0.0.0:54321',
    'http://192.168.1.20:54321',
    'http://127.0.0.1.evil.example:54321',
    'http://localhost.evil.example',
    'http://evil.example/http://127.0.0.1',
    'ftp://127.0.0.1',
    '',
    undefined,
    null,
    42,
  ])('rejects anything else: %s', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });
});

describe('assertLocalTarget', () => {
  it('returns quietly for the local stack', () => {
    expect(() => assertLocalTarget({ SUPABASE_URL: 'http://127.0.0.1:54321' })).not.toThrow();
  });

  it('throws, naming the script and the target, for a hosted project', () => {
    expect(() => assertLocalTarget({ SUPABASE_URL: HOSTED }, { scriptName: 'seed-db' }))
      .toThrow(/^seed-db: refusing to run against https:\/\/abcdefghijklmnop\.supabase\.co/);
  });

  it('throws when SUPABASE_URL is unset', () => {
    expect(() => assertLocalTarget({})).toThrow(/\(unset SUPABASE_URL\)/);
  });

  it('tells the operator the exact override', () => {
    expect(() => assertLocalTarget({ SUPABASE_URL: HOSTED })).toThrow(`${ALLOW_REMOTE_DB_VAR}=yes`);
  });

  it('lets ALLOW_REMOTE_DB=yes through, and nothing looser', () => {
    expect(() => assertLocalTarget({ SUPABASE_URL: HOSTED, ALLOW_REMOTE_DB: 'yes' })).not.toThrow();
    for (const value of ['YES', 'true', '1', '', ' yes']) {
      expect(() => assertLocalTarget({ SUPABASE_URL: HOSTED, ALLOW_REMOTE_DB: value })).toThrow();
    }
  });
});

describe('exitUnlessLocalTarget', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing for the local stack', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitUnlessLocalTarget('seed-db', { SUPABASE_URL: 'http://localhost:54321' });
    expect(exit).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('prints the refusal and exits 2 for a hosted project', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitUnlessLocalTarget('load-real-content', { SUPABASE_URL: HOSTED });
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^load-real-content: refusing to run against/));
    expect(exit).toHaveBeenCalledWith(2);
  });
});
