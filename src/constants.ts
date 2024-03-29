import data from '../package.json';

export const CONNECT_SDK_VERSION = data.version;
export const SDK_PLATFORM = 'reactNative';
export const PING_TIMEOUT = 1000;

export enum ConnectEvents {
  // Internal events used by Connect
  ACK = 'ack',
  CLOSE_POPUP = 'closePopup',
  PING = 'ping',
  URL = 'url',

  // App events exposed to developers
  CANCEL = 'cancel',
  DONE = 'done',
  ERROR = 'error',
  LOADED = 'loaded',
  ROUTE = 'route',
  SUCCESS = 'success',
  USER = 'user',
}
