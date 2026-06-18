import { NativeModules } from 'react-native';

NativeModules.ConnectReactNativeSdk = {
  checklink: jest.fn(),
  addListener: jest.fn(),
  removeListeners: jest.fn()
};

jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');

  const WebView = React.forwardRef((props, ref) =>
    React.createElement(View, {
      ...props,
      ref
    })
  );

  WebView.displayName = 'WebView';

  return {
    __esModule: true,
    default: WebView,
    WebView
  };
});

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Modal = React.forwardRef(({ children, ...props }, ref) =>
    React.createElement(View, { ...props, ref }, children)
  );

  Modal.displayName = 'Modal';

  return {
    __esModule: true,
    default: Modal
  };
});

jest.mock('react-native/Libraries/TurboModule/TurboModuleRegistry', () => {
  const turboModuleRegistry = jest.requireActual(
    'react-native/Libraries/TurboModule/TurboModuleRegistry'
  );
  return {
    ...turboModuleRegistry,
    getEnforcing: name => {
      if (name === 'RNCWebView') {
        return null;
      }
      return turboModuleRegistry.getEnforcing(name);
    }
  };
});

jest.mock('./src/nativeModule', () => {
  return {
    checkLink: jest.fn().mockResolvedValue(false),
    ConnectReactNativeSdk: {
      close: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
      open: jest.fn().mockResolvedValue({
        type: 'close'
      })
    }
  };
});
