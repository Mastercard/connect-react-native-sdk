# Connect React Native SDK

## Overview

Mastercard Open Finance Connect React Native SDK provides an easy way for developers to integrate Mastercard Open Finance Connect into their React Native application.

The Connect React Native SDK can be used with Mastercard Open Finance in the United States and Australia only.

The functionality available with Connect varies slightly between regions. For details of how to integrate Connect using the Connect SDKs see the following:

* United States
  - [The Connect Application](https://developer.mastercard.com/open-banking-us/documentation/connect/)
  - [Integrating with Connect](https://developer.mastercard.com/open-banking-us/documentation/connect/integrating/)
    - [Using the Connect React Native SDK (US)](https://developer.mastercard.com/open-banking-us/documentation/connect/integrating/react-native-sdk/)
* Australia
  - [The Connect Application](https://developer.mastercard.com/open-banking-au/documentation/connect/)
  - [Integrating with Connect](https://developer.mastercard.com/open-banking-au/documentation/connect/integrating-with-connect/)
    - [Using the Connect React Native SDK (Australia)](https://developer.mastercard.com/open-banking-au/documentation/connect/integrating-with-connect/react-sdk/)

Note that this Connect SDK is not suitable for Mastercard Open Finance Europe. 

## Compatibility

The Connect React Native SDK supports following Android and iOS versions.
* Android:
  - Android 7.0 (Nougat) or later
  - minSdkVersion 24 or later
* iOS:
  - iOS 15.1 or later

React Native 0.86 requires Node.js 22.13.0 or later and Xcode 16.1 or later for iOS builds.

The Connect React Native SDK has the following peerDependencies:

* [react-native-webview 14.0.1](https://www.npmjs.com/package/react-native-webview)
* [react >=19.2.3](https://www.npmjs.com/package/react)
* [react-native >=0.86.0](https://www.npmjs.com/package/react-native)

## Sample App
[Github](https://github.com/Mastercard/connect-react-native-sdk/tree/master/ConnectReactNativeDemoApp) contains a sample React Native project that is integrated with the Connect React Native SDK. This sample project is named ConnectReactNativeDemoApp. Ensure that you have the necessary setup for React Native version 0.86 to successfully run and explore this demo application.