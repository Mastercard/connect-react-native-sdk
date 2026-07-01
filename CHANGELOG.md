# Changelog

### 2.0.5 (January 21, 2026)

### Changes

- Fixed an issue where the OAuth popup did not automatically dismiss after the user completed the OAuth journey on Android 15+ when redirectUrl was not passed to the SDK or redirectUri was not provided during Connect link generation.
- Updated Android build configurations (AGP, SDK versions, EventBus)

### 2.0.4 (September 17, 2025)

### Changes

- Handled Connect modal auto-dismissal after Connect flow completion.

### 2.0.3 (March 24, 2025)

### Changes

- General Enhancements and Bug Fixes

### 2.0.2 (July 03, 2024)

### Changes

- Added a fix to resolve an issue with App To App OAuth flow

### 2.0.1 (March 28, 2024)

- Resolved the "cannot find module" type error that occurred during the import of the 'connect' module.

### 2.0.0 (February 08, 2024)

- Enhanced the App to App OAuth Flow with the newly added `redirectUrl` parameter in the Connect React Native SDK. This enhancement supports universal links for iOS, app links for Android, and deep links for navigation between mobile apps. For more details on App to App, refer to the [documentation](https://developer.mastercard.com/open-banking-us/documentation/connect/mobile-sdks/).
- The support for the `linkingUri` property in the Connect React Native SDK has been deprecated.

### 1.0.0-rc10 (September 06, 2023)

- Fixed issue in iOS when OAuth popup is closed, dismissing Connect and making the application unresponsive

### 1.0.0-rc9 (August 01, 2023)

- Fixed issue in Android with OAuth popup being dismissed on Android when navigating away from app

### 1.0.0-rc8 (December 08, 2022)

- Fixed dependencies version mismatch
- Remove any references to External sources

### 1.0.0-rc7 (August 03, 2022)

- Mastercard rebranding
- Updated dependencies

### 1.0.0-rc6 (March 22, 2022)

- Updated dependencies and README

### 1.0.0-rc5 (May 11, 2021)

- Moved `react` and `react-native` to `devDependencies` and `peerDependencies`

### 1.0.0-rc4 (April 21, 2021)

- Fixed dependencies
- Ignore /dist
- Remove app.json

### 1.0.0-rc3 (April 15, 2021)

- Added MIT license
- Fixed README example
- Fixed payload in `onDone`, `onCancel` and `onExit` events

### 1.0.0-rc.2 (April 08, 2021)

- Send data object in user and route events
- Added event interfaces

### 1.0.0-rc.1 (April 08, 2021)

- Include /dist for GitHub repo

### 1.0.0-rc.0 (April 03, 2021)

- Initial version
