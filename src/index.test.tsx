import React from 'react';
import renderer from 'react-test-renderer';
import { Connect } from './index';
import { render, screen } from '@testing-library/react-native';

import { InAppBrowser } from 'react-native-inappbrowser-reborn';
import { checkLink, ConnectReactNativeSdk } from './nativeModule';
import {
  ConnectEvents,
  CONNECT_SDK_VERSION,
  SDK_PLATFORM,
  PING_TIMEOUT,
} from './constants';
import { Platform } from 'react-native';
import type { WebViewMessageEvent } from 'react-native-webview';
import type { ConnectEventHandlers } from './types';

describe('Connect', () => {
  const eventHandlerFns: ConnectEventHandlers = {
    onCancel: (event: any) => {
      console.log('cancel event received', event);
    },
    onDone: (event: any) => {
      console.log('done event received', event);
    },
    onError: (event: any) => {
      console.log('error event received', event);
    },
    onLoad: () => {
      console.log('loaded event received');
    },
    onRoute: (event: any) => {
      console.log('route event received', event);
    },
    onUser: (event: any) => {
      console.log('user event received', event);
    },
  };

  test('close', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onCancel = mockFn;
    instanceOf.close();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({ code: 100, reason: 'exit' });
  });

  test('render android', () => {
    Platform.OS = 'android';
    render(
      <Connect
        connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
        eventHandlers={eventHandlerFns}
        redirectUrl="https://mastercard.com"
      />
    );

    const modal = screen.getByTestId('test-modal');
    const webview = screen.getByTestId('test-webview');
    expect(webview).toBeDefined();
    expect(modal.props.presentationStyle).toBe('fullScreen');
  });

  test('render ios', () => {
    Platform.OS = 'ios';
    render(
      <Connect
        connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
        eventHandlers={eventHandlerFns}
        redirectUrl="https://mastercard.com"
      />
    );

    const modal = screen.getByTestId('test-modal');
    const webview = screen.getByTestId('test-webview');
    expect(webview).toBeDefined();
    expect(modal.props.presentationStyle).toBe('pageSheet');
  });

  test('postMessage', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    const mockFn = jest.fn();
    instanceOf.webViewRef = { postMessage: mockFn } as any;
    instanceOf.postMessage({ test: true });
    expect(mockFn).toHaveBeenCalledWith(JSON.stringify({ test: true }));

    // handle null webView
    instanceOf.webViewRef = null;
    jest.spyOn(instanceOf, 'postMessage');
    expect(instanceOf.postMessage).not.toThrow();
  });

  test('open Browser ios', () => {
    Platform.OS = 'ios';
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create route event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;

    instanceOf.state.browserDisplayed = false;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.URL,
      url: 'https://b2b.mastercard.com',
    });
    // mock route event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onRoute = mockFn;
    instanceOf.handleEvent(event);
    expect(checkLink).toHaveBeenCalledTimes(1);
    expect(checkLink).toHaveBeenLastCalledWith('https://b2b.mastercard.com');
  });

  test('open Browser android', () => {
    Platform.OS = 'android';
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create route event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    instanceOf.state.browserDisplayed = false;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.URL,
      url: 'https://b2b.mastercard.com',
    });
    // mock route event callback
    const mockFn = jest.fn();
    instanceOf.dismissBrowser = jest.fn();
    instanceOf.state.eventHandlers.onRoute = mockFn;
    instanceOf.handleEvent(event);
    instanceOf.openBrowser('https://b2b.mastercard.com');
    expect(instanceOf.dismissBrowser).not.toHaveBeenCalled();
  });

  test('pingConnect', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // expect postMessage to be called to inform Connect of SDK
    const mockFn = jest.fn();
    instanceOf.postMessage = mockFn;
    instanceOf.pingConnect();
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      type: ConnectEvents.PING,
      redirectUrl: '',
      sdkVersion: CONNECT_SDK_VERSION,
      platform: SDK_PLATFORM,
    });
    // expect to call stopPingingConnect if webViewRef = null
    const mockFn2 = jest.fn();
    instanceOf.stopPingingConnect = mockFn2;
    instanceOf.webViewRef = null;
    instanceOf.pingConnect();
    expect(mockFn2).toHaveBeenCalledTimes(1);
  });

  test('dismissBrowser (no-op)', async () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    const postMessageMockFn = jest.fn();
    instanceOf.postMessage = postMessageMockFn;

    instanceOf.state.browserDisplayed = false;
    await instanceOf.dismissBrowser();
    expect(InAppBrowser.close).toHaveBeenCalledTimes(0);
    expect(postMessageMockFn).toHaveBeenCalledTimes(0);
  });

  test('close popup', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create close popup event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.CLOSE_POPUP,
    });
    // mock dismiss browser to catch call to dismissBrowser, set state to browser displayed.
    const mockFn = jest.fn();
    instanceOf.state.browserDisplayed = true;
    instanceOf.dismissBrowser = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  test('ack', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create ack event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.ACK,
    });
    // mock stopPingingConnect, and eventHandler loaded to catch calls to these functions
    const mockStopPingFn = jest.fn();
    instanceOf.stopPingingConnect = mockStopPingFn;
    const mockLoadedEventFn = jest.fn();
    instanceOf.state.eventHandlers.onLoad = mockLoadedEventFn;
    instanceOf.handleEvent(event);
    expect(mockStopPingFn).toHaveBeenCalledTimes(1);
    expect(mockLoadedEventFn).toHaveBeenCalledTimes(1);
  });

  test('parseEventData', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;

    // invalid JSON event
    const event: any = {
      nativeEvent: {
        data: '{0}',
      },
    };

    jest.spyOn(instanceOf, 'handleEvent');
    expect(instanceOf.handleEvent.bind(instanceOf, event)).not.toThrow();

    // valid event
    event.nativeEvent.data = {
      type: ConnectEvents.CANCEL,
      data: {
        code: 100,
        reason: 'exit',
      },
    };

    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onCancel = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenLastCalledWith({
      code: 100,
      reason: 'exit',
    });

    // valid JSON event
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.CANCEL,
      data: {
        code: 100,
        reason: 'exit',
      },
    });

    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenLastCalledWith({
      code: 100,
      reason: 'exit',
    });
  });

  test('cancel Event', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create cancel event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.CANCEL,
      data: {
        code: 100,
        reason: 'exit',
      },
    });
    // mock cancel event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onCancel = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      code: 100,
      reason: 'exit',
    });
  });

  test('done Event', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create done event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.DONE,
      data: {
        code: 200,
        reason: 'complete',
      },
    });
    // mock done event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onDone = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      code: 200,
      reason: 'complete',
    });
  });

  test('error Event', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create error event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.ERROR,
      data: {
        code: 500,
        reason: 'error',
      },
    });
    // mock error event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onError = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      code: 500,
      reason: 'error',
    });
  });

  test('route Event', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create route event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.ROUTE,
      data: {
        params: {},
        screen: 'search',
      },
    });
    // mock route event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onRoute = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      params: {},
      screen: 'search',
    });
  });

  test('startPingingConnect/stopPingingConnect', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // expect to use set interval timer to post ping message to Connect
    jest.useFakeTimers();
    const mockFn = jest.fn();
    instanceOf.pingConnect = mockFn;
    instanceOf.startPingingConnect();

    jest.advanceTimersByTime(PING_TIMEOUT + 1);
    expect(mockFn).toHaveBeenCalledTimes(1);
    // Stop pinging Connect
    expect(instanceOf.state.pingingConnect).toEqual(true);
    expect(instanceOf.state.pingIntervalId).not.toEqual(0);
    instanceOf.stopPingingConnect();
    expect(instanceOf.state.pingingConnect).toEqual(false);
    expect(instanceOf.state.pingIntervalId).toEqual(0);
  });

  test('user Event', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;
    // create user event
    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.USER,
      data: {
        action: 'Initialize',
        customerId: '5003205004',
        experience: null,
        partnerId: '2445582695152',
        sessionId:
          'c004a06ffc4cccd485df796fba74f1a4b647ab4fee3e691b227db2d6b2c5d9e3',
        timestamp: '1617009241542',
        ttl: '1617016441542',
        type: 'default',
      },
    });
    // mock user event callback
    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onUser = mockFn;
    instanceOf.handleEvent(event);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenLastCalledWith({
      action: 'Initialize',
      customerId: '5003205004',
      experience: null,
      partnerId: '2445582695152',
      sessionId:
        'c004a06ffc4cccd485df796fba74f1a4b647ab4fee3e691b227db2d6b2c5d9e3',
      timestamp: '1617009241542',
      ttl: '1617016441542',
      type: 'default',
    });
  });

  test('open Browser ios - checkLink resolves to true', async () => {
    Platform.OS = 'ios';
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;

    // create URL event
    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.URL,
          url: 'https://b2b.mastercard.com',
        }),
      },
    } as WebViewMessageEvent;

    instanceOf.state.browserDisplayed = false;
    const mockFn = jest.fn();
    instanceOf.openBrowser = mockFn;

    // Mock checkLink to resolve to true
    (checkLink as jest.Mock).mockResolvedValueOnce(true);

    await instanceOf.handleEvent(event);

    expect(checkLink).toHaveBeenCalledTimes(1);
    expect(checkLink).toHaveBeenLastCalledWith('https://b2b.mastercard.com');
    expect(mockFn).not.toHaveBeenCalled();
  });

  test('close popup when browser not displayed', () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;

    const event = {
      nativeEvent: {
        data: JSON.stringify({
          type: ConnectEvents.CLOSE_POPUP,
        }),
      },
    } as WebViewMessageEvent;

    const mockFn = jest.fn();
    instanceOf.dismissBrowser = mockFn;

    instanceOf.state.browserDisplayed = false;
    instanceOf.handleEvent(event);

    expect(mockFn).not.toHaveBeenCalled();
  });

  test('should not call checkLink or open browser when URL is null or empty', () => {
    Platform.OS = 'ios';
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;

    const event = {
      nativeEvent: {
        data: '',
      },
    } as WebViewMessageEvent;

    instanceOf.state.browserDisplayed = false;
    event.nativeEvent.data = JSON.stringify({
      type: ConnectEvents.URL,
      url: null,
    });

    const mockFn = jest.fn();
    instanceOf.state.eventHandlers.onRoute = mockFn;
    instanceOf.handleEvent(event);
    expect(checkLink).toHaveBeenCalledTimes(0);
  });

  test('openBrowser should return early when URL is null or empty', async () => {
    const instanceOf = renderer
      .create(
        <Connect
          connectUrl="https://b2b.mastercard.com/open-banking-solutions/"
          eventHandlers={eventHandlerFns}
        />
      )
      .getInstance() as unknown as Connect;

    // Spy on InAppBrowser and ConnectReactNativeSdk.open
    const inAppBrowserSpy = jest.spyOn(InAppBrowser, 'open');
    const sdkOpenSpy = jest.spyOn(ConnectReactNativeSdk, 'open');

    // Test with null URL
    await instanceOf.openBrowser(null as unknown as string);
    expect(inAppBrowserSpy).not.toHaveBeenCalled();
    expect(sdkOpenSpy).not.toHaveBeenCalled();
    expect(instanceOf.state.browserDisplayed).toBeFalsy();

    // Test with empty string URL
    await instanceOf.openBrowser('');
    expect(inAppBrowserSpy).not.toHaveBeenCalled();
    expect(sdkOpenSpy).not.toHaveBeenCalled();
    expect(instanceOf.state.browserDisplayed).toBeFalsy();

    // Clean up spies
    inAppBrowserSpy.mockRestore();
    sdkOpenSpy.mockRestore();
  });
});
