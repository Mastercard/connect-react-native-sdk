import React, { Component } from 'react';
import {
  Alert,
  BackHandler,
  Modal,
  NativeEventEmitter,
  Platform,
  StatusBar,
  StyleSheet,
  type EmitterSubscription,
  type NativeEventSubscription
} from 'react-native';
import {
  SafeAreaInsetsContext,
  SafeAreaView
} from 'react-native-safe-area-context';
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
import type {
  ConnectCancelEvent,
  ConnectDoneEvent,
  ConnectErrorEvent,
  ConnectEventHandlers,
  ConnectProps,
  ConnectRouteEvent,
  ConnectUserEvent
} from './types';

const noop = () => {};

type RequiredConnectEventHandlers = ConnectEventHandlers & {
  onLoad: NonNullable<ConnectEventHandlers['onLoad']>;
  onRoute: NonNullable<ConnectEventHandlers['onRoute']>;
  onUser: NonNullable<ConnectEventHandlers['onUser']>;
};

const defaultEventHandlers: RequiredConnectEventHandlers = {
  onCancel: noop,
  onDone: noop,
  onError: noop,
  onLoad: noop,
  onUser: noop,
  onRoute: noop
};

const ENABLE_ANDROID_EXIT_PROMPT = false;

type URLOpenedBy = 'secure-container' | 'fi-app';
type OAuthClosedBy =
  'connect-client-event' | 'partner-redirection' | 'user-closed';
type OAuthCloseAction = 'closed' | 'none';

type NativeBrowserNavigationEvent = {
  eventName?: string;
  message?: string;
};

type ParsedEventData = {
  type?: string;
  url?: string | null;
  data?: unknown;
};

type CancelReason = string | undefined;

type WebViewMessagePayload = {
  nativeEvent: {
    data: unknown;
  };
};

type WebViewNavigationState = {
  canGoBack?: boolean;
};

type ConnectState = {
  connectUrl: string;
  redirectUrl: string;
  pingingConnect: boolean;
  pingedConnectSuccessfully: boolean;
  pingIntervalId: ReturnType<typeof setInterval> | 0;
  eventHandlers: RequiredConnectEventHandlers;
  browserDisplayed: boolean;
  modalVisible: boolean;
};

export class Connect extends Component<ConnectProps, ConnectState> {
  webViewRef: React.ComponentRef<typeof WebView> | null = null;
  navigationEventEmitter: NativeEventEmitter | null = null;
  navigationEventSubscription: EmitterSubscription | null = null;
  backPressSubscription: NativeEventSubscription | null = null;
  isExitPromptVisible = false;
  isTrackPopupBlockedEventActive = false;
  hasSentWindowOpenedEvent = false;
  canGoBackInWebView = false;
  OAuthUrl: string = '';
  private isMountedRef = false;

  state: ConnectState = {
    connectUrl: this.props.connectUrl,
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

  componentDidMount() {
    this.isMountedRef = true;

    if (Platform.OS === 'android') {
      this.backPressSubscription = BackHandler.addEventListener(
        'hardwareBackPress',
        this.handleHardwareBackPress
      );
    }
  }

  componentWillUnmount() {
    if (this.navigationEventSubscription) {
      this.navigationEventSubscription.remove();
    }

    if (this.backPressSubscription) {
      this.backPressSubscription.remove();
    }

    this.isMountedRef = false;
    this.stopPingingConnect();
  }

  mergeEventHandlers = (
    eventHandlers: ConnectEventHandlers
  ): RequiredConnectEventHandlers => {
    return {
      ...defaultEventHandlers,
      ...eventHandlers
    };
  };

  applyState = (partialState: Partial<ConnectState>) => {
    if (this.isMountedRef) {
      this.setState(previousState => ({ ...previousState, ...partialState }));
      return;
    }

    Object.assign(this.state, partialState);
  };

  launch = (connectUrl: string, eventHandlers: ConnectEventHandlers) => {
    this.isTrackPopupBlockedEventActive = false;
    this.hasSentWindowOpenedEvent = false;
    this.canGoBackInWebView = false;
    this.OAuthUrl = '';

    this.applyState({
      connectUrl,
      eventHandlers: this.mergeEventHandlers(eventHandlers),
      modalVisible: true,
      redirectUrl: validateUrl(this.props.redirectUrl),
      pingedConnectSuccessfully: false
    });
  };

  close = () => {
    this.canGoBackInWebView = false;
    this.dismissModal();
    this.state.eventHandlers.onCancel({
      code: 100,
      reason: 'exit'
    });
  };

  navigateBackInWebViewIfPossible = () => {
    if (
      !this.state.modalVisible ||
      this.state.browserDisplayed ||
      !this.canGoBackInWebView
    ) {
      return false;
    }

    const webView = this.webViewRef as { goBack?: () => void } | null;
    if (!webView || typeof webView.goBack !== 'function') {
      return false;
    }

    webView.goBack();
    return true;
  };

  handleHardwareBackPress = () => {
    if (Platform.OS !== 'android' || !this.state.modalVisible) {
      return false;
    }

    if (this.navigateBackInWebViewIfPossible()) {
      return true;
    }

    this.handleRequestClose();
    return true;
  };

  handleRequestClose = () => {
    if (Platform.OS !== 'android') {
      this.close();
      return;
    }

    if (this.navigateBackInWebViewIfPossible()) {
      return;
    }

    if (!ENABLE_ANDROID_EXIT_PROMPT || this.isExitPromptVisible) {
      if (!ENABLE_ANDROID_EXIT_PROMPT) {
        this.close();
      }

      return;
    }

    this.isExitPromptVisible = true;

    Alert.alert(
      'Exit Connect',
      'Are you sure you want to exit Connect?',
      [
        {
          text: 'Stay',
          style: 'cancel',
          onPress: () => {
            this.isExitPromptVisible = false;
          }
        },
        {
          text: 'Exit',
          style: 'destructive',
          onPress: () => {
            this.isExitPromptVisible = false;
            this.close();
          }
        }
      ],
      {
        cancelable: true,
        onDismiss: () => {
          this.isExitPromptVisible = false;
        }
      }
    );
  };

  shouldConfirmAndroidExit = (reason: CancelReason) => {
    void reason;

    if (Platform.OS !== 'android' || !this.state.modalVisible) {
      return false;
    }

    return ENABLE_ANDROID_EXIT_PROMPT;
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

  handleWebViewNavigationStateChange = (state: WebViewNavigationState) => {
    this.canGoBackInWebView = Boolean(state.canGoBack);
  };

  handleBrowserNavigationEvent = (
    event: NativeBrowserNavigationEvent | null | undefined
  ) => {
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

  postMessage(eventData: Record<string, unknown>) {
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

      return;
    }

    this.stopPingingConnect();
  };

  startPingingConnect = () => {
    if (
      this.webViewRef !== null &&
      !this.state.pingedConnectSuccessfully &&
      !this.state.pingingConnect &&
      this.state.pingIntervalId === 0
    ) {
      this.state.pingingConnect = true;
      this.state.pingIntervalId = setInterval(this.pingConnect, PING_TIMEOUT);
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
    const action: OAuthCloseAction = this.OAuthUrl ? 'closed' : 'none';

    if (this.isTrackPopupBlockedEventActive) {
      this.sendOauthClosedEvent(closedBy, action);
    } else if (this.state.browserDisplayed) {
      this.postMessage({
        type: 'window',
        closed: true
      });
    }

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

  handleEvent = (event: WebViewMessagePayload) => {
    const eventData = parseEventData(event.nativeEvent.data);
    const { type: eventType, url } = eventData;

    if (!eventType) {
      return;
    }

    const { eventHandlers } = this.state;

    switch (eventType) {
      case ConnectEvents.TRACK_POPUP_BLOCKED_EVENT:
        this.isTrackPopupBlockedEventActive = true;
        break;

      case ConnectEvents.URL:
        if (!this.state.browserDisplayed && typeof url === 'string' && url) {
          this.OAuthUrl = url;

          void checkLink(url)
            .then((canOpen: boolean) => {
              if (canOpen) {
                if (this.isTrackPopupBlockedEventActive) {
                  this.sendURLOpenedEvent('fi-app');
                }

                return;
              }

              void this.openBrowser(url);
            })
            .catch(() => {
              void this.openBrowser(url);
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
        if (
          this.shouldConfirmAndroidExit(
            (eventData.data as ConnectCancelEvent | undefined)?.reason
          )
        ) {
          this.handleRequestClose();
          break;
        }

        this.dismissModal();
        eventHandlers.onCancel(eventData.data as ConnectCancelEvent);
        break;

      case ConnectEvents.DONE:
        this.dismissModal();
        eventHandlers.onDone(eventData.data as ConnectDoneEvent);
        break;

      case ConnectEvents.ERROR:
        this.dismissModal();
        eventHandlers.onError(eventData.data as ConnectErrorEvent);
        break;

      case ConnectEvents.ROUTE:
        eventHandlers.onRoute(eventData.data as ConnectRouteEvent);
        break;

      case ConnectEvents.USER:
        eventHandlers.onUser(eventData.data as ConnectUserEvent);
        break;

      default:
        break;
    }
  };

  dismissModal = () => {
    this.canGoBackInWebView = false;
    this.setState({ modalVisible: false });
  };

  render() {
    const injectedJavaScript = `
      (function() {
        window.maOBConnectReactNative = window.maOBConnectReactNative || true;
        window.ReactNativeWebView = window.ReactNativeWebView || true;
      })();
    `;

    const useSafeAreaInsets =
      Platform.OS !== 'android' ||
      this.props.androidEdgeToEdgeMode !== 'before';

    return (
      <Modal
        visible={this.state.modalVisible}
        animationType={'slide'}
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        transparent={false}
        testID="test-modal"
        onRequestClose={this.handleRequestClose}
      >
        <SafeAreaInsetsContext.Consumer>
          {insets => {
            const fallbackTopInset =
              Platform.OS === 'android' &&
              useSafeAreaInsets &&
              (insets?.top ?? 0) === 0
                ? (StatusBar.currentHeight ?? 0)
                : 0;

            return (
              <SafeAreaView
                testID="test-safe-area-view"
                style={[
                  styles.safeAreaView,
                  fallbackTopInset > 0 ? { paddingTop: fallbackTopInset } : null
                ]}
                edges={useSafeAreaInsets ? ['top', 'bottom'] : []}
              >
                <WebView
                  ref={ref => {
                    this.webViewRef = ref;
                  }}
                  style={styles.webView}
                  source={{ uri: this.state.connectUrl }}
                  javaScriptEnabled
                  injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
                  testID="test-webview"
                  onNavigationStateChange={
                    this.handleWebViewNavigationStateChange
                  }
                  onMessage={event =>
                    this.handleEvent(event as WebViewMessagePayload)
                  }
                  onLoad={() => this.startPingingConnect()}
                />
              </SafeAreaView>
            );
          }}
        </SafeAreaInsetsContext.Consumer>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  safeAreaView: {
    flex: 1
  },
  webView: {
    flex: 1
  }
});

function parseEventData(eventData: any) {
  if (typeof eventData === 'string') {
    try {
      const parsed = JSON.parse(eventData);
      return parsed && typeof parsed === 'object'
        ? (parsed as ParsedEventData)
        : {};
    } catch {
      return {};
    }
  }

  return eventData && typeof eventData === 'object'
    ? (eventData as ParsedEventData)
    : {};
}

export type * from './types';
