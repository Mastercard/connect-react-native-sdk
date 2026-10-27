import { DEFAULT_REDIRECT_URL } from './constants';
import { validateUrl } from './utils';

describe('validateUrl', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
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
