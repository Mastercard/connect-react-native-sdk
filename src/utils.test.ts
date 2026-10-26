import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { DEFAULT_REDIRECT_URL } from './constants';
import { isSafeExternalNavigationUrl, validateUrl } from './utils';

describe('validateUrl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('isSafeExternalNavigationUrl', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    test('blocks web URLs when host allowlist is not configured', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeExternalNavigationUrl('https://example.com/path')).toBe(
        false
      );
      expect(warn).toHaveBeenCalledWith('Blocked external URL host policy');
    });

    test('allows valid https URLs for trusted hosts', () => {
      expect(
        isSafeExternalNavigationUrl('https://example.com/path', {
          allowedHosts: ['example.com']
        })
      ).toBe(true);
    });

    test('blocks dangerous schemes', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeExternalNavigationUrl('intent://malicious')).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL scheme');
    });

    test('enforces allowed hosts when configured', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(
        isSafeExternalNavigationUrl('https://trusted.example.com/path', {
          allowedHosts: ['trusted.example.com']
        })
      ).toBe(true);

      expect(
        isSafeExternalNavigationUrl('https://evil.example.com/path', {
          allowedHosts: ['trusted.example.com']
        })
      ).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL host');
    });

    test('allows only trusted custom URL prefixes', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(
        isSafeExternalNavigationUrl('bankapp://authorize', {
          allowedCustomUrlPrefixes: ['bankapp://authorize']
        })
      ).toBe(true);

      expect(
        isSafeExternalNavigationUrl('walletapp://authorize', {
          allowedCustomUrlPrefixes: ['bankapp://authorize']
        })
      ).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL custom prefix');
    });

    test('blocks custom URLs when no trusted prefix policy is configured', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeExternalNavigationUrl('bankapp://authorize')).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL custom policy');
    });

    test('blocks custom URLs that try userinfo authority confusion', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(
        isSafeExternalNavigationUrl(
          'bankapp://authorize@evil.example/callback',
          {
            allowedCustomUrlPrefixes: ['bankapp://authorize']
          }
        )
      ).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL custom auth');
    });

    test('allows custom URLs only when host, port, and path boundary match', () => {
      expect(
        isSafeExternalNavigationUrl('bankapp://fi.oauth/launch/callback', {
          allowedCustomUrlPrefixes: ['bankapp://fi.oauth/launch']
        })
      ).toBe(true);

      expect(
        isSafeExternalNavigationUrl('bankapp://fi.oauth-attacker/launch', {
          allowedCustomUrlPrefixes: ['bankapp://fi.oauth/launch']
        })
      ).toBe(false);
    });
  });

  test('returns the default redirect URL for empty values', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(validateUrl()).toBe(DEFAULT_REDIRECT_URL);
    expect(validateUrl('')).toBe(DEFAULT_REDIRECT_URL);
    expect(warn).toHaveBeenCalledWith('Invalid URL: empty/null');
  });

  test('returns the default redirect URL for invalid formats', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(validateUrl('not-a-url')).toBe(DEFAULT_REDIRECT_URL);
    expect(validateUrl('https://')).toBe(DEFAULT_REDIRECT_URL);
    expect(warn).toHaveBeenCalledWith('Invalid URL format');
  });

  test('accepts valid universal links and deeplinks', () => {
    expect(validateUrl('https://example.com/path')).toBe(
      'https://example.com/path'
    );
    expect(validateUrl('http://example.com')).toBe('http://example.com');
    expect(validateUrl('connect://maob/redirect')).toBe(
      'connect://maob/redirect'
    );
  });

  test('rejects unsupported schemes', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(validateUrl('mailto:test@example.com')).toBe(DEFAULT_REDIRECT_URL);
    expect(warn).toHaveBeenCalledWith('Unsupported URL scheme');
  });

  test('falls back to the default redirect URL on unexpected validation errors', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const originalUrl = global.URL;

    global.URL = jest.fn(() => ({
      protocol: {
        replace: () => {
          throw new Error('boom');
        }
      }
    })) as unknown as typeof URL;

    expect(validateUrl('https://example.com')).toBe(DEFAULT_REDIRECT_URL);
    expect(warn).toHaveBeenCalledWith(
      'URL validation error:',
      expect.any(Error)
    );

    global.URL = originalUrl;
  });
});
