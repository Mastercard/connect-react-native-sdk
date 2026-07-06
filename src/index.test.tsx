import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { DeviceEventEmitter, Platform } from 'react-native';

import {
  Connect,
  type ConnectCancelEvent,
  type ConnectDoneEvent,
  type ConnectErrorEvent,
  type ConnectEventHandlers
} from './index';
import {
  CONNECT_SDK_VERSION,
  ConnectEvents,
  PING_TIMEOUT,
  SDK_PLATFORM
} from './constants';
import { checkLink, ConnectReactNativeSdk } from './nativeModule';

type ConnectInstance = InstanceType<typeof Connect>;

const baseHandlers = (): ConnectEventHandlers => ({
  onCancel: jest.fn<(event: ConnectCancelEvent) => void>(),
  onDone: jest.fn<(event: ConnectDoneEvent) => void>(),
  onError: jest.fn<(event: ConnectErrorEvent) => void>(),
  onLoad: jest.fn(),
  onRoute: jest.fn(),
  onUser: jest.fn()
});

const renderConnect = (
  overrideProps: Partial<React.ComponentProps<typeof Connect>> = {}
) => {
  const ref = React.createRef<ConnectInstance>();
  const eventHandlers = overrideProps.eventHandlers ?? baseHandlers();
  const utils = render(
    <Connect
      ref={ref}
      connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
      eventHandlers={eventHandlers}
      {...overrideProps}
    />
  );

  if (!ref.current) {
    throw new Error('Expected Connect ref to be set');
  }

  ref.current.webViewRef = { postMessage: jest.fn() } as any;

  return {
    ...utils,
    eventHandlers,
    instance: ref.current,
    modal: screen.getByTestId('test-modal'),
    webView: screen.getByTestId('test-webview')
  };
};

describe('Connect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    Platform.OS = 'ios';
  });

  test('renders with the correct presentation style and injected javascript', () => {
    const { modal, webView } = renderConnect({
      redirectUrl: 'https://mastercard.com'
    });

    expect(modal.props.presentationStyle).toBe('pageSheet');
    expect(webView.props.source).toEqual({
      uri: 'https://b2b.mastercard.com/open-banking-solutions/'
    });
    expect(webView.props.injectedJavaScriptBeforeContentLoaded).toContain(
      'window.maOBConnectReactNative'
    );
    expect(webView.props.injectedJavaScriptBeforeContentLoaded).toContain(
      'window.ReactNativeWebView'
    );
  });

  test('renders fullscreen on android', () => {
    Platform.OS = 'android';
    const { modal } = renderConnect();

    expect(modal.props.presentationStyle).toBe('fullScreen');
  });

  test('launch stores url handlers and validated redirect url', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const customHandlers = {
      onCancel: jest.fn(),
      onDone: jest.fn(),
      onError: jest.fn()
    };
    const { instance } = renderConnect({
      connectUrl: 'https://example.com/connect',
      eventHandlers: customHandlers,
      redirectUrl: 'invalid url'
    });

    expect(instance.state.connectUrl).toBe('https://example.com/connect');
    expect(instance.state.modalVisible).toBe(true);
    expect(instance.state.redirectUrl).toBe('connect://maob/redirect');
    expect(instance.state.eventHandlers.onCancel).toBe(customHandlers.onCancel);
    expect(typeof instance.state.eventHandlers.onLoad).toBe('function');
    expect(typeof instance.state.eventHandlers.onRoute).toBe('function');
    expect(typeof instance.state.eventHandlers.onUser).toBe('function');
    expect(warn).toHaveBeenCalledWith('Invalid URL format');
  });

  test('close dismisses the modal and emits cancel', () => {
    const eventHandlers = baseHandlers();
    const { instance } = renderConnect({ eventHandlers });

    act(() => {
      instance.close();
    });

    expect(instance.state.modalVisible).toBe(false);
    expect(eventHandlers.onCancel).toHaveBeenCalledWith({
      code: 100,
      reason: 'exit'
    });
  });

  test('browser navigation listener forwards events only while popup tracking is active', () => {
    const { instance, unmount } = renderConnect();
    const handleBrowserNavigationEvent = jest.spyOn(
      instance,
      'handleBrowserNavigationEvent'
    );

    instance.isTrackPopupBlockedEventActive = false;
    DeviceEventEmitter.emit('onBrowserNavigationEvent', {
      eventName: 'NAVIGATION_FINISHED'
    });
    expect(handleBrowserNavigationEvent).not.toHaveBeenCalled();

    instance.isTrackPopupBlockedEventActive = true;
    DeviceEventEmitter.emit('onBrowserNavigationEvent', {
      eventName: 'NAVIGATION_FINISHED'
    });
    expect(handleBrowserNavigationEvent).toHaveBeenCalledWith({
      eventName: 'NAVIGATION_FINISHED'
    });

    unmount();
    handleBrowserNavigationEvent.mockClear();
    DeviceEventEmitter.emit('onBrowserNavigationEvent', {
      eventName: 'NAVIGATION_FINISHED'
    });
    expect(handleBrowserNavigationEvent).not.toHaveBeenCalled();
  });

  test('componentWillUnmount tolerates a missing navigation subscription', () => {
    const { instance } = renderConnect();

    instance.navigationEventSubscription = null;

    expect(() => instance.componentWillUnmount()).not.toThrow();
  });

  test('postMessage serializes payloads and tolerates a missing webview ref', () => {
    const { instance } = renderConnect();
    const postMessage = jest.fn();

    instance.webViewRef = { postMessage } as any;
    instance.postMessage({ test: true });
    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ test: true }));

    instance.webViewRef = null;
    expect(() => instance.postMessage({ test: false })).not.toThrow();
  });

  test('pingConnect posts sdk details when the webview exists', () => {
    const { instance } = renderConnect({
      redirectUrl: 'https://mastercard.com/redirect'
    });
    const postMessage = jest.fn();

    instance.webViewRef = { postMessage } as any;
    instance.pingConnect();

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({
        type: ConnectEvents.PING,
        sdkVersion: CONNECT_SDK_VERSION,
        platform: SDK_PLATFORM,
        redirectUrl: 'https://mastercard.com/redirect'
      })
    );
  });

  test('pingConnect stops pinging when the webview ref is missing', () => {
    const { instance } = renderConnect();
    const stopPingingConnect = jest.spyOn(instance, 'stopPingingConnect');

    instance.webViewRef = null;
    instance.pingConnect();

    expect(stopPingingConnect).toHaveBeenCalled();
  });

  test('startPingingConnect starts exactly once and stopPingingConnect clears it', () => {
    jest.useFakeTimers();
    const { instance } = renderConnect();
    const pingConnect = jest.spyOn(instance, 'pingConnect');

    instance.webViewRef = { postMessage: jest.fn() } as any;
    instance.startPingingConnect();
    instance.startPingingConnect();

    jest.advanceTimersByTime(PING_TIMEOUT + 1);

    expect(pingConnect).toHaveBeenCalledTimes(1);
    expect(instance.state.pingingConnect).toBe(true);
    expect(instance.state.pingIntervalId).not.toBe(0);

    instance.stopPingingConnect();

    expect(instance.state.pingingConnect).toBe(false);
    expect(instance.state.pingIntervalId).toBe(0);
  });

  test('startPingingConnect does nothing after connect has acknowledged', () => {
    jest.useFakeTimers();
    const { instance } = renderConnect();
    const pingConnect = jest.spyOn(instance, 'pingConnect');

    instance.webViewRef = {} as any;
    instance.state.pingedConnectSuccessfully = true;
    instance.startPingingConnect();
    jest.advanceTimersByTime(PING_TIMEOUT + 1);

    expect(pingConnect).not.toHaveBeenCalled();
    expect(instance.state.pingingConnect).toBe(false);

    instance.state.pingingConnect = false;
    instance.state.pingIntervalId = 0;
    instance.stopPingingConnect();
    expect(instance.state.pingIntervalId).toBe(0);
  });

  test('dismissBrowser no-ops when popup tracking is inactive and no browser is displayed', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.state.browserDisplayed = false;
    instance.dismissBrowser();

    expect(postMessage).not.toHaveBeenCalled();
    expect(ConnectReactNativeSdk.close).not.toHaveBeenCalled();
  });

  test('dismissBrowser emits closed event with close metadata', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;

    Platform.OS = 'ios';
    instance.state.browserDisplayed = true;
    instance.dismissBrowser();
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'partner-redirection',
      action: 'none',
      url: ''
    });
    expect(ConnectReactNativeSdk.close).not.toHaveBeenCalled();
    expect(instance.state.browserDisplayed).toBe(false);

    Platform.OS = 'android';
    instance.state.browserDisplayed = true;
    instance.dismissBrowser('cancel');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'partner-redirection',
      action: 'none',
      url: ''
    });
    expect(ConnectReactNativeSdk.close).not.toHaveBeenCalled();
    expect(instance.state.browserDisplayed).toBe(false);

    instance.state.browserDisplayed = true;
    instance.dismissBrowser(undefined, 'connect-client-event');
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'connect-client-event',
      action: 'none',
      url: ''
    });
    expect(ConnectReactNativeSdk.close).toHaveBeenCalledTimes(1);
  });

  test('dismissBrowser emits legacy close event when popup tracking is inactive and browser is displayed', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.isTrackPopupBlockedEventActive = false;
    instance.state.browserDisplayed = true;
    instance.OAuthUrl = 'https://b2b.mastercard.com/oauth';
    instance.dismissBrowser('NAVIGATION_FAILED', 'connect-client-event');

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true
    });
    expect(ConnectReactNativeSdk.close).not.toHaveBeenCalled();
    expect(instance.state.browserDisplayed).toBe(false);
    expect(instance.OAuthUrl).toBe('');
  });

  test('openBrowser returns early for empty urls', async () => {
    const { instance } = renderConnect();

    await instance.openBrowser('');
    await instance.openBrowser(null as unknown as string);

    expect(ConnectReactNativeSdk.open).not.toHaveBeenCalled();
    expect(instance.state.browserDisplayed).toBe(false);
  });

  test('openBrowser uses the native sdk on ios and dismisses with partner-redirection metadata', async () => {
    Platform.OS = 'ios';
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;

    await instance.openBrowser('https://b2b.mastercard.com');

    expect(ConnectReactNativeSdk.open).toHaveBeenCalledWith({
      url: 'https://b2b.mastercard.com'
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'partner-redirection',
      action: 'none',
      url: ''
    });
    expect(dismissBrowser).toHaveBeenCalledWith('close', 'partner-redirection');
  });

  test('openBrowser sends blocked telemetry when native open fails on ios', async () => {
    Platform.OS = 'ios';
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;

    (ConnectReactNativeSdk.open as jest.Mock).mockRejectedValueOnce(
      new Error('browser failed')
    );

    await expect(
      instance.openBrowser('https://b2b.mastercard.com')
    ).rejects.toThrow('browser failed');

    expect(ConnectReactNativeSdk.open).toHaveBeenCalledWith({
      url: 'https://b2b.mastercard.com'
    });
    expect(postMessage).not.toHaveBeenCalled();
    expect(dismissBrowser).not.toHaveBeenCalled();
  });

  test('openBrowser uses the native sdk on android and dismisses with partner-redirection metadata', async () => {
    Platform.OS = 'android';
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;

    await instance.openBrowser('https://b2b.mastercard.com');

    expect(ConnectReactNativeSdk.open).toHaveBeenCalledWith({
      url: 'https://b2b.mastercard.com',
      forceCloseOnRedirection: false,
      showInRecents: true
    });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'partner-redirection',
      action: 'none',
      url: ''
    });
    expect(dismissBrowser).toHaveBeenCalledWith('close', 'partner-redirection');
  });

  test('browser navigation failed event sends blocked event while browser is displayed', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;
    instance.state.browserDisplayed = true;

    instance.handleBrowserNavigationEvent({ eventName: 'NAVIGATION_FAILED' });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      blocked: true,
      url: ''
    });
  });

  test('openBrowser handles cancel and dismiss result types', async () => {
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');
    instance.isTrackPopupBlockedEventActive = true;

    (ConnectReactNativeSdk.open as jest.Mock).mockResolvedValueOnce({
      type: 'cancel'
    });
    await instance.openBrowser('https://cancel.example.com');
    expect(dismissBrowser).toHaveBeenCalledWith('cancel', 'user-closed');

    Platform.OS = 'ios';
    (ConnectReactNativeSdk.open as jest.Mock).mockResolvedValueOnce({
      type: 'dismiss'
    });
    await instance.openBrowser('https://dismiss-ios.example.com');
    expect(dismissBrowser).toHaveBeenCalledWith(
      'dismiss',
      'connect-client-event'
    );

    Platform.OS = 'android';
    (ConnectReactNativeSdk.open as jest.Mock).mockResolvedValueOnce({
      type: 'dismiss'
    });
    await instance.openBrowser('https://dismiss-android.example.com');
    expect(dismissBrowser).toHaveBeenCalledWith(
      'dismiss',
      'partner-redirection'
    );
  });

  test('ios URL events check deep-link availability before opening a browser', async () => {
    Platform.OS = 'ios';
    const { instance } = renderConnect();
    const openBrowser = jest.spyOn(instance, 'openBrowser');

    (checkLink as jest.Mock).mockResolvedValueOnce(false);
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://b2b.mastercard.com'
        })
      }
    });

    await act(async () => Promise.resolve());

    expect(checkLink).toHaveBeenCalledWith('https://b2b.mastercard.com');
    expect(openBrowser).toHaveBeenCalledWith('https://b2b.mastercard.com');
  });

  test('ios URL events do not open a browser when checkLink resolves true or url is empty', async () => {
    Platform.OS = 'ios';
    const { instance } = renderConnect();
    const openBrowser = jest.spyOn(instance, 'openBrowser');
    const postMessage = jest.spyOn(instance, 'postMessage');
    instance.isTrackPopupBlockedEventActive = true;

    (checkLink as jest.Mock).mockResolvedValueOnce(true);
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://b2b.mastercard.com'
        })
      }
    });

    await act(async () => Promise.resolve());

    expect(openBrowser).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      opened: true,
      open_type: 'fi-app',
      url: 'https://b2b.mastercard.com'
    });

    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: null
        })
      }
    });

    expect(checkLink).toHaveBeenCalledTimes(1);

    instance.state.browserDisplayed = true;
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://ignored.example.com'
        })
      }
    });

    expect(checkLink).toHaveBeenCalledTimes(1);
  });

  test('URL events fall back to secure container when app-to-app check rejects', async () => {
    Platform.OS = 'android';
    const { instance } = renderConnect();
    const openBrowser = jest.spyOn(instance, 'openBrowser');

    (checkLink as jest.Mock).mockRejectedValueOnce(new Error('launch failed'));
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://b2b.mastercard.com'
        })
      }
    });

    await act(async () => Promise.resolve());

    expect(openBrowser).toHaveBeenCalledWith('https://b2b.mastercard.com');
  });

  test('track popup blocked events enable popup tracking before URL handling', async () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.isTrackPopupBlockedEventActive = false;
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({ type: ConnectEvents.TRACK_POPUP_BLOCKED_EVENT })
      }
    });
    expect(instance.isTrackPopupBlockedEventActive).toBe(true);

    (checkLink as jest.Mock).mockResolvedValueOnce(true);
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://b2b.mastercard.com'
        })
      }
    });

    await act(async () => Promise.resolve());

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      opened: true,
      open_type: 'fi-app',
      url: 'https://b2b.mastercard.com'
    });
  });

  test('close popup forwards dismiss request as connect client event', () => {
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');

    instance.state.browserDisplayed = false;
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({ type: ConnectEvents.CLOSE_POPUP })
      }
    });
    expect(dismissBrowser).toHaveBeenCalledWith(
      undefined,
      'connect-client-event'
    );

    instance.state.browserDisplayed = true;
    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({ type: ConnectEvents.CLOSE_POPUP })
      }
    });
    expect(dismissBrowser).toHaveBeenCalledWith(
      undefined,
      'connect-client-event'
    );
    expect(dismissBrowser).toHaveBeenCalledTimes(2);
  });

  test('android navigation failures emit blocked telemetry', () => {
    Platform.OS = 'android';
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.isTrackPopupBlockedEventActive = true;
    instance.state.browserDisplayed = true;

    instance.handleBrowserNavigationEvent({ eventName: 'NAVIGATION_FAILED' });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      blocked: true,
      url: ''
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test('deep-link redirect events emit partner redirection close telemetry when oauth url exists', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.state.browserDisplayed = false;
    instance.OAuthUrl = 'https://b2b.mastercard.com/oauth';

    instance.handleBrowserNavigationEvent({
      eventName: 'DEEP_LINK_REDIRECT',
      message: 'connect://maob/redirect?code=123'
    });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      closed: true,
      closed_by: 'partner-redirection',
      action: 'closed',
      url: 'connect://maob/redirect?code=123'
    });
    expect(instance.OAuthUrl).toBe('');
  });

  test('browser navigation ignores empty events and deep-link redirects without oauth url', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.OAuthUrl = 'https://b2b.mastercard.com/oauth';
    instance.handleBrowserNavigationEvent(null);

    instance.state.browserDisplayed = true;
    instance.handleBrowserNavigationEvent(null);

    instance.state.browserDisplayed = false;
    instance.OAuthUrl = '';
    instance.handleBrowserNavigationEvent({
      eventName: 'DEEP_LINK_REDIRECT',
      message: 'connect://maob/redirect?code=123'
    });

    expect(postMessage).not.toHaveBeenCalled();
  });

  test('secure-container opened telemetry is emitted once for repeated navigation finished events', () => {
    const { instance } = renderConnect();
    const postMessage = jest.spyOn(instance, 'postMessage');

    instance.isTrackPopupBlockedEventActive = true;
    instance.state.browserDisplayed = true;
    instance.OAuthUrl = 'https://b2b.mastercard.com';

    instance.handleBrowserNavigationEvent({ eventName: 'NAVIGATION_FINISHED' });
    instance.handleBrowserNavigationEvent({ eventName: 'NAVIGATION_FINISHED' });
    instance.handleBrowserNavigationEvent({ eventName: 'NAVIGATION_FINISHED' });

    expect(postMessage).toHaveBeenCalledWith({
      type: 'window',
      opened: true,
      open_type: 'secure-container',
      url: 'https://b2b.mastercard.com'
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  test('ack events stop pinging, mark connect as ready, and use default optional handlers safely', () => {
    const requiredHandlers = {
      onCancel: jest.fn(),
      onDone: jest.fn(),
      onError: jest.fn()
    };
    const { instance } = renderConnect({ eventHandlers: requiredHandlers });
    const stopPingingConnect = jest.spyOn(instance, 'stopPingingConnect');

    instance.handleEvent({
      nativeEvent: {
        data: JSON.stringify({ type: ConnectEvents.ACK })
      }
    });

    expect(instance.state.pingedConnectSuccessfully).toBe(true);
    expect(stopPingingConnect).toHaveBeenCalled();

    expect(() =>
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({ type: ConnectEvents.ROUTE, data: 'route' })
        }
      })
    ).not.toThrow();

    expect(() =>
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({ type: ConnectEvents.USER, data: 'user' })
        }
      })
    ).not.toThrow();
  });

  test('cancel, done, error, route and user events forward their payloads', () => {
    const eventHandlers = baseHandlers();
    const { instance } = renderConnect({ eventHandlers });

    act(() => {
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({
            type: ConnectEvents.CANCEL,
            data: { code: 100, reason: 'exit' }
          })
        }
      });
    });
    expect(eventHandlers.onCancel).toHaveBeenCalledWith({
      code: 100,
      reason: 'exit'
    });

    act(() => {
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({
            type: ConnectEvents.DONE,
            data: { code: 200, reason: 'complete' }
          })
        }
      });
    });
    expect(eventHandlers.onDone).toHaveBeenCalledWith({
      code: 200,
      reason: 'complete'
    });

    act(() => {
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({
            type: ConnectEvents.ERROR,
            data: { code: 500, reason: 'error' }
          })
        }
      });
    });
    expect(eventHandlers.onError).toHaveBeenCalledWith({
      code: 500,
      reason: 'error'
    });

    act(() => {
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({
            type: ConnectEvents.ROUTE,
            data: { screen: 'search', params: {} }
          })
        }
      });
    });
    expect(eventHandlers.onRoute).toHaveBeenCalledWith({
      screen: 'search',
      params: {}
    });

    act(() => {
      instance.handleEvent({
        nativeEvent: {
          data: JSON.stringify({
            type: ConnectEvents.USER,
            data: { customerId: '5003205004' }
          })
        }
      });
    });
    expect(eventHandlers.onUser).toHaveBeenCalledWith({
      customerId: '5003205004'
    });
    expect(instance.state.modalVisible).toBe(false);
  });

  test('handleEvent ignores invalid and unknown payloads', () => {
    const { instance } = renderConnect();
    const dismissBrowser = jest.spyOn(instance, 'dismissBrowser');

    expect(() =>
      instance.handleEvent({
        nativeEvent: {
          data: '{'
        }
      })
    ).not.toThrow();

    instance.handleEvent({
      nativeEvent: {
        data: {
          type: 'unknown',
          data: 'ignored'
        }
      }
    });

    expect(dismissBrowser).not.toHaveBeenCalled();
  });

  test('render callbacks delegate to close, handleEvent, and startPingingConnect', () => {
    const { instance, modal, webView } = renderConnect();
    const close = jest.spyOn(instance, 'close');
    const handleEvent = jest.spyOn(instance, 'handleEvent');
    const startPingingConnect = jest.spyOn(instance, 'startPingingConnect');

    act(() => {
      modal.props.onRequestClose();
      webView.props.onMessage({ nativeEvent: { data: '{}' } });
      webView.props.onLoad();
    });

    expect(close).toHaveBeenCalled();
    expect(handleEvent).toHaveBeenCalledWith({ nativeEvent: { data: '{}' } });
    expect(startPingingConnect).toHaveBeenCalled();
  });

  test('dismissModal updates modalVisible through setState', () => {
    const { instance } = renderConnect();

    act(() => {
      instance.dismissModal();
    });

    expect(instance.state.modalVisible).toBe(false);
  });
});
