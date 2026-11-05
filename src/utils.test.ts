import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { DEFAULT_REDIRECT_URL } from './constants';
import { isSafeOAuthExternalNavigationUrl, validateUrl } from './utils';

describe('validateUrl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('isSafeOAuthExternalNavigationUrl', () => {
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    test('allows HTTPS URLs', () => {
      expect(isSafeOAuthExternalNavigationUrl('https://example.com/path')).toBe(
        true
      );
      expect(isSafeOAuthExternalNavigationUrl('HTTPS://example.com/path')).toBe(
        true
      );
    });

    test('blocks HTTP URLs and custom app deep links', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeOAuthExternalNavigationUrl('http://example.com/path')).toBe(
        false
      );
      expect(isSafeOAuthExternalNavigationUrl('bankapp://authorize')).toBe(
        false
      );
      expect(isSafeOAuthExternalNavigationUrl('https:example.com')).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL scheme');
    });

    test('blocks dangerous schemes', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeOAuthExternalNavigationUrl('intent://malicious')).toBe(
        false
      );
      expect(warn).toHaveBeenCalledWith('Blocked external URL scheme');
    });

    test('blocks malformed URLs', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(isSafeOAuthExternalNavigationUrl('https://')).toBe(false);
      expect(warn).toHaveBeenCalledWith('Invalid external URL format');
    });

    test('blocks HTTPS URLs that contain userinfo', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

      expect(
        isSafeOAuthExternalNavigationUrl(
          'https://authorize@evil.example/callback'
        )
      ).toBe(false);
      expect(warn).toHaveBeenCalledWith('Blocked external URL custom auth');
    });

    test('allows Mastercard legal privacy URL', () => {
      expect(
        isSafeOAuthExternalNavigationUrl(
          'https://www.mastercard.com/us/en/mastercard-open-finance-legal-privacy.html'
        )
      ).toBe(true);
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
