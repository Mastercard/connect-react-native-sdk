import React, { Component } from 'react';
import { Modal, Platform, NativeEventEmitter } from 'react-native';
import { WebView } from 'react-native-webview';

import {
  ConnectEvents,
  SDK_PLATFORM,
  PING_TIMEOUT,
  CONNECT_SDK_VERSION,
  DEFAULT_REDIRECT_URL
} from './constants';
import { validateUrl } from './utils';
import { ConnectReactNativeSdk, checkLink } from './nativeModule';
import type { ConnectEventHandlers, ConnectProps } from './types';

const defaultEventHandlers: any = {
  onLoad: () => {
    // Intentionally empty function
  },
  onUser: () => {
    // Intentionally empty function
  },
  onRoute: () => {
    // Intentionally empty function
  }
};

type URLOpenedBy = 'secure-container' | 'fi-app';
type OAuthClosedBy =
  | 'connect-client-event'
  | 'partner-redirection'
  | 'user-closed';
type OAuthCloseAction = 'closed' | 'none';

export class Connect extends Component<ConnectProps> {
  webViewRef: WebView | null = null;
  navigationEventEmitter: NativeEventEmitter | null = null;
  navigationEventSubscription: any = null;
  isTrackPopupBlockedEventActive = false;
  hasSentWindowOpenedEvent = false;
  OAuthUrl: string = '';

  state = {
    connectUrl: '',
    redirectUrl: DEFAULT_REDIRECT_URL,
    pingingConnect: false,
    pingedConnectSuccessfully: false,
    pingIntervalId: 0,
    eventHandlers: defaultEventHandlers,
    browserDisplayed: false,
    modalVisible: false
  };

  constructor(props: ConnectProps) {
    super(props);
    this.launch(props.connectUrl, props.eventHandlers);
    this.setupBrowserEventListener();
  }

  componentWillUnmount() {
    if (this.navigationEventSubscription) {
      this.navigationEventSubscription.remove();
    }
  }

  launch = (connectUrl: string, eventHandlers: ConnectEventHandlers) => {
    this.isTrackPopupBlockedEventActive = false;
    this.hasSentWindowOpenedEvent = false;
    this.OAuthUrl = '';
    this.state.connectUrl = connectUrl;
    this.state.eventHandlers = { ...defaultEventHandlers, ...eventHandlers };
    this.state.modalVisible = true;
    this.state.redirectUrl = validateUrl(this.props.redirectUrl);
  };

  close = () => {
    this.dismissModal();
    this.state.eventHandlers.onCancel({
      code: 100,
      reason: 'exit'
    });
  };

  setupBrowserEventListener = () => {
    this.navigationEventEmitter = new NativeEventEmitter(ConnectReactNativeSdk);
    this.navigationEventSubscription = this.navigationEventEmitter.addListener(
      'onBrowserNavigationEvent',
      event => {
        if (this.isTrackPopupBlockedEventActive) {
          this.handleBrowserNavigationEvent(event);
        }
      }
    );
  };

  handleBrowserNavigationEvent = (event: any) => {
    if (!event) return;

    if (this.state.browserDisplayed) {
      if (event.eventName === 'NAVIGATION_FINISHED') {
        this.sendURLOpenedEvent('secure-container');
        return;
      }

      if (event.eventName === 'NAVIGATION_FAILED') {
        this.sendURLBlockedEvent();
        return;
      }
    }

    if (event.eventName === 'DEEP_LINK_REDIRECT' && this.OAuthUrl) {
      this.sendOauthClosedEvent('partner-redirection', 'closed', event.message);
      return;
    }
  };

  sendURLOpenedEvent = (openType: URLOpenedBy) => {
    if (openType === 'secure-container' && this.hasSentWindowOpenedEvent) {
      return;
    }

    this.postMessage({
      type: 'window',
      opened: true,
      open_type: openType,
      url: this.OAuthUrl
    });

    if (openType === 'secure-container') {
      this.hasSentWindowOpenedEvent = true;
    }
  };

  sendOauthClosedEvent = (
    closedBy: OAuthClosedBy,
    action: OAuthCloseAction,
    url: string = this.OAuthUrl
  ) => {
    this.postMessage({
      type: 'window',
      closed: true,
      closed_by: closedBy,
      action,
      url
    });
    this.OAuthUrl = '';
  };

  sendURLBlockedEvent = () => {
    this.postMessage({
      type: 'window',
      blocked: true,
      url: this.OAuthUrl
    });
  };

  postMessage(eventData: any) {
    this?.webViewRef?.postMessage(JSON.stringify(eventData));
  }

  pingConnect = () => {
    if (this.webViewRef !== null) {
      this.postMessage({
        type: ConnectEvents.PING,
        sdkVersion: CONNECT_SDK_VERSION,
        platform: SDK_PLATFORM,
        redirectUrl: this.state.redirectUrl
      });
    } else {
      this.stopPingingConnect();
    }
  };

  startPingingConnect = () => {
    if (
      this.webViewRef !== null &&
      !this.state.pingedConnectSuccessfully &&
      !this.state.pingingConnect &&
      this.state.pingIntervalId === 0
    ) {
      this.state.pingingConnect = true;
      (this.state.pingIntervalId as any) = setInterval(
        this.pingConnect,
        PING_TIMEOUT
      );
    }
  };

  stopPingingConnect = () => {
    if (this.state.pingingConnect && this.state.pingIntervalId !== 0) {
      clearInterval(this.state.pingIntervalId);
      this.state.pingingConnect = false;
      this.state.pingIntervalId = 0;
    }
  };

  dismissBrowser = (
    type?: string,
    closedBy: OAuthClosedBy = 'partner-redirection'
  ) => {
    const action = this.OAuthUrl ? 'closed' : 'none';
    this.isTrackPopupBlockedEventActive
      ? this.sendOauthClosedEvent(closedBy, action)
      : this.state.browserDisplayed &&
        this.postMessage({
          type: 'window',
          closed: true
        });

    this.state.browserDisplayed = false;
    this.hasSentWindowOpenedEvent = false;
    this.OAuthUrl = '';

    if (
      closedBy === 'connect-client-event' &&
      type !== 'cancel' &&
      type !== 'NAVIGATION_FAILED'
    ) {
      ConnectReactNativeSdk.close();
    }
  };

  openBrowser = async (url: string) => {
    if (!url) return;

    this.state.browserDisplayed = true;
    this.hasSentWindowOpenedEvent = false;

    const browserOptions =
      Platform.OS === 'ios'
        ? undefined
        : { forceCloseOnRedirection: false, showInRecents: true };
    const openOptions =
      Platform.OS === 'android' ? { url, ...browserOptions } : { url };
    let closedBy: OAuthClosedBy = 'partner-redirection';
    const { type } = await ConnectReactNativeSdk.open(openOptions);

    if (type === 'cancel') {
      closedBy = 'user-closed';
    } else if (type === 'dismiss') {
      closedBy =
        Platform.OS === 'android'
          ? 'partner-redirection'
          : 'connect-client-event';
    }
    this.dismissBrowser(type, closedBy);
  };

  handleEvent = (event: any) => {
    const eventData = parseEventData(event.nativeEvent.data);
    const { type: eventType, url } = eventData;
    let { browserDisplayed, eventHandlers } = this.state;

    switch (eventType) {
      case ConnectEvents.TRACK_POPUP_BLOCKED_EVENT:
        this.isTrackPopupBlockedEventActive = true;
        break;

      case ConnectEvents.URL:
        if (!browserDisplayed && url) {
          this.OAuthUrl = url;
          checkLink(url)
            .then((canOpen: boolean) => {
              if (canOpen) {
                this.isTrackPopupBlockedEventActive &&
                  this.sendURLOpenedEvent('fi-app');
                return;
              }
              this.openBrowser(url);
            })
            .catch(() => {
              this.openBrowser(url);
            });
        }
        break;

      case ConnectEvents.CLOSE_POPUP:
        this.dismissBrowser(undefined, 'connect-client-event');
        break;

      case ConnectEvents.ACK:
        this.state.pingedConnectSuccessfully = true;
        this.stopPingingConnect();
        eventHandlers.onLoad();
        break;

      case ConnectEvents.CANCEL:
        this.dismissModal();
        eventHandlers.onCancel(eventData.data);
        break;

      case ConnectEvents.DONE:
        this.dismissModal();
        eventHandlers.onDone(eventData.data);
        break;

      case ConnectEvents.ERROR:
        this.dismissModal();
        eventHandlers.onError(eventData.data);
        break;

      case ConnectEvents.ROUTE:
        eventHandlers.onRoute(eventData.data);
        break;

      case ConnectEvents.USER:
        eventHandlers.onUser(eventData.data);
        break;

      default:
        break;
    }
  };

  dismissModal = () => {
    this.setState({ modalVisible: false });
  };

  render() {
    const injectedJavaScript = `
      (function() {
        window.maOBConnectReactNative = window.maOBConnectReactNative || true;
        window.ReactNativeWebView = window.ReactNativeWebView || true;
      })();
    `;

    return (
      <Modal
        visible={this.state.modalVisible}
        animationType={'slide'}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        transparent={false}
        testID="test-modal"
        onRequestClose={() => this.close()}
      >
        <WebView
          ref={(ref: any) => (this.webViewRef = ref)}
          source={{ uri: this.state.connectUrl }}
          javaScriptEnabled
          injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
          testID="test-webview"
          onMessage={event => this.handleEvent(event)}
          onLoad={() => this.startPingingConnect()}
        />
      </Modal>
    );
  }
}

function parseEventData(eventData: any) {
  try {
    return typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
  } catch (e) {
    return {};
  }
}

export type * from './types';
