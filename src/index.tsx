import React, { Component } from 'react';
import { Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { InAppBrowser } from 'react-native-inappbrowser-reborn';

import {
  ConnectEvents,
  SDK_PLATFORM,
  PING_TIMEOUT,
  CONNECT_SDK_VERSION
} from './constants';
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

export class Connect extends Component<ConnectProps> {
  webViewRef: WebView | null = null;
  state = {
    connectUrl: '',
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
  }

  launch = (connectUrl: string, eventHandlers: ConnectEventHandlers) => {
    this.state.connectUrl = connectUrl;
    this.state.eventHandlers = { ...defaultEventHandlers, ...eventHandlers };
    this.state.modalVisible = true;
  };

  close = () => {
    this.dismissModal();
    this.state.eventHandlers.onCancel({
      code: 100,
      reason: 'exit'
    });
  };

  postMessage(eventData: any) {
    this?.webViewRef?.postMessage(JSON.stringify(eventData));
  }

  pingConnect = () => {
    const { redirectUrl = '' } = this.props;
    if (this.webViewRef !== null) {
      this.postMessage({
        type: ConnectEvents.PING,
        sdkVersion: CONNECT_SDK_VERSION,
        platform: SDK_PLATFORM,
        redirectUrl: redirectUrl
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

  dismissBrowser = (type?: string) => {
    if (this.state.browserDisplayed) {
      this.postMessage({ type: 'window', closed: true });
      this.state.browserDisplayed = false;
      if (type !== 'cancel')
        (Platform.OS === 'android'
          ? ConnectReactNativeSdk
          : InAppBrowser
        ).close();
    }
  };

  openBrowser = async (url: string) => {
    if (!url) return;

    this.state.browserDisplayed = true;
    await InAppBrowser.isAvailable();
    // NOTE: solves bug in InAppBrowser if an object with non-iOS options is passed
    const browserOptions =
      Platform.OS === 'ios'
        ? undefined
        : { forceCloseOnRedirection: false, showInRecents: true };

    if (Platform.OS === 'android') {
      const { type } = await ConnectReactNativeSdk.open({
        url,
        ...(browserOptions || {})
      });

      this.dismissBrowser(type);
    } else {
      const { type } = await InAppBrowser.open(url, browserOptions);
      this.dismissBrowser(type);
    }
  };

  handleEvent = (event: any) => {
    const eventData = parseEventData(event.nativeEvent.data);
    const { type: eventType, url } = eventData;
    let { browserDisplayed, eventHandlers } = this.state;

    switch (eventType) {
      case ConnectEvents.URL:
        if (!browserDisplayed) {
          Platform.OS === 'ios'
            ? url &&
              checkLink(url).then((canOpen: boolean) => {
                !canOpen && this.openBrowser(url);
              })
            : this.openBrowser(url);
        }
        break;

      case ConnectEvents.CLOSE_POPUP:
        browserDisplayed && this.dismissBrowser();
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

export * from './types';
