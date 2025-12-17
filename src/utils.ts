import 'react-native-url-polyfill/auto';

import { DEFAULT_REDIRECT_URL } from './constants';

export const validateUrl = (url: string = '') => {
  try {
    if (!url) {
      console.warn('Invalid URL: URL is empty/null/undefined');
      return DEFAULT_REDIRECT_URL;
    }

    const urlPattern = /^https:\/\//i;
    if (!urlPattern.test(url)) {
      console.warn('Invalid URL: Must start with https://');
      return DEFAULT_REDIRECT_URL;
    }

    return url;
  } catch (error) {
    console.warn('Error parsing URL:', error);
    return DEFAULT_REDIRECT_URL;
  }
};
