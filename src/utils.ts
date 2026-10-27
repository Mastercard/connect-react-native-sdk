import 'react-native-url-polyfill/auto';

import { DEFAULT_REDIRECT_URL } from './constants';

const BLOCKED_EXTERNAL_URL_SCHEMES = new Set([
  'about',
  'content',
  'data',
  'file',
  'intent',
  'javascript'
]);

export const validateUrl = (url: string = DEFAULT_REDIRECT_URL) => {
  try {
    if (!url) {
      console.warn('Invalid URL: empty/null');
      return DEFAULT_REDIRECT_URL;
    }

    // Must be a valid URL format (supports https/http and custom deep links like myapp://)
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      console.warn('Invalid URL format');
      return DEFAULT_REDIRECT_URL;
    }

    const scheme = parsedUrl.protocol.replace(':', '');

    // Universal links (http / https)
    if (scheme === 'http' || scheme === 'https') {
      const httpsRegex =
        /^(https?):\/\/([\w-]+(\.[\w-]+)+)(:[0-9]{1,5})?(\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?$/i;

      if (httpsRegex.test(url)) {
        return url;
      }
    }

    // Deeplinks (myapp://, connect://, etc.)
    const deeplinkRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//;

    if (deeplinkRegex.test(url)) {
      return url;
    }

    console.warn('Unsupported URL scheme');
    return DEFAULT_REDIRECT_URL;
  } catch (error) {
    console.warn('URL validation error:', error);
    return DEFAULT_REDIRECT_URL;
  }
};

export const isSafeExternalNavigationUrl = (url: string) => {
  try {
    if (!url) {
      console.warn('Invalid external URL: empty/null');
      return false;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      console.warn('Invalid external URL format');
      return false;
    }

    const scheme = parsedUrl.protocol.replace(':', '').toLowerCase();
    if (!scheme || BLOCKED_EXTERNAL_URL_SCHEMES.has(scheme)) {
      console.warn('Blocked external URL scheme');
      return false;
    }

    if (parsedUrl.username || parsedUrl.password) {
      console.warn('Blocked external URL custom auth');
      return false;
    }
    return true;
  } catch (error) {
    console.warn('External URL validation error:', error);
    return false;
  }
};
