import 'react-native-url-polyfill/auto';

import { DEFAULT_REDIRECT_URL } from './constants';

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
