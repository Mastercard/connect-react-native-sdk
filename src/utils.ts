import 'react-native-url-polyfill/auto';

import { DEFAULT_REDIRECT_URL } from './constants';

type ExternalNavigationValidationOptions = {
  allowedHosts?: string[];
  allowedCustomUrlPrefixes?: string[];
};

const BLOCKED_EXTERNAL_URL_SCHEMES = new Set([
  'about',
  'content',
  'data',
  'file',
  'intent',
  'javascript'
]);

const WEB_URL_SCHEMES = new Set(['http', 'https']);

const normalizeItems = (values: string[] = []) =>
  values.map(value => value.trim().toLowerCase()).filter(Boolean);

const normalizeCustomPrefixes = (values: string[] = []) =>
  values.map(value => value.trim()).filter(Boolean);

const isAllowedHost = (host: string, allowedHost: string) =>
  host === allowedHost || host.endsWith(`.${allowedHost}`);

const normalizePath = (path: string) => path || '/';

const hasPathBoundaryMatch = (candidatePath: string, allowedPath: string) => {
  const normalizedCandidatePath = normalizePath(candidatePath);
  const normalizedAllowedPath = normalizePath(allowedPath);
  if (normalizedCandidatePath === normalizedAllowedPath) {
    return true;
  }

  const allowedPathPrefix = normalizedAllowedPath.endsWith('/')
    ? normalizedAllowedPath
    : `${normalizedAllowedPath}/`;
  return normalizedCandidatePath.startsWith(allowedPathPrefix);
};

const matchesAllowedCustomPrefix = (parsedUrl: URL, allowedPrefix: string) => {
  try {
    const allowedUrl = new URL(allowedPrefix);
    if (allowedUrl.username || allowedUrl.password) {
      return false;
    }

    const parsedScheme = parsedUrl.protocol.replace(':', '').toLowerCase();
    const allowedScheme = allowedUrl.protocol.replace(':', '').toLowerCase();
    if (parsedScheme !== allowedScheme) {
      return false;
    }

    if (
      parsedUrl.hostname.toLowerCase() !== allowedUrl.hostname.toLowerCase()
    ) {
      return false;
    }

    if ((parsedUrl.port || '') !== (allowedUrl.port || '')) {
      return false;
    }

    return hasPathBoundaryMatch(parsedUrl.pathname, allowedUrl.pathname);
  } catch {
    return false;
  }
};

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

export const isSafeExternalNavigationUrl = (
  url: string,
  options: ExternalNavigationValidationOptions = {}
) => {
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

    if (WEB_URL_SCHEMES.has(scheme)) {
      const allowedHosts = normalizeItems(options.allowedHosts);
      if (allowedHosts.length === 0) {
        console.warn('Blocked external URL host policy');
        return false;
      }

      const host = parsedUrl.hostname.toLowerCase();
      const isHostTrusted = allowedHosts.some(allowedHost =>
        isAllowedHost(host, allowedHost)
      );

      if (!isHostTrusted) {
        console.warn('Blocked external URL host');
      }

      return isHostTrusted;
    }

    if (parsedUrl.username || parsedUrl.password) {
      console.warn('Blocked external URL custom auth');
      return false;
    }

    const allowedCustomUrlPrefixes = normalizeCustomPrefixes(
      options.allowedCustomUrlPrefixes
    );
    if (allowedCustomUrlPrefixes.length === 0) {
      console.warn('Blocked external URL custom policy');
      return false;
    }

    const isSchemeTrusted = allowedCustomUrlPrefixes.some(allowedPrefix =>
      matchesAllowedCustomPrefix(parsedUrl, allowedPrefix)
    );

    if (!isSchemeTrusted) {
      console.warn('Blocked external URL custom prefix');
    }

    return isSchemeTrusted;
  } catch (error) {
    console.warn('External URL validation error:', error);
    return false;
  }
};
