# Mastercard Open Finance Connect React Native SDK

## Project Overview

This repository contains the Mastercard Open Finance Connect React Native SDK.

The SDK provides:

- Secure Container flow (in-app browser)
- App-to-App flow (Fi App deep linking)
- Android and iOS support
- React Native integration

## Getting Started (For New Developers)

### Prerequisites

- Node.js LTS
- npm or yarn
- React Native development environment
- Android Studio
- Xcode (for iOS development)

## Install Dependencies

Using npm:

npm install

Using yarn:

yarn install

## Run the Demo App

Navigate to:

ConnectReactNativeDemoApp/

Then run:

Android:
npx react-native run-android

iOS:
npx react-native run-ios

## Important Files

| File            | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| index.tsx       | Main SDK entry point, event handling, browser launch logic |
| constants.ts    | Event names and SDK constants                              |
| nativeModule.ts | Native bridge and browser interactions                     |
| types.ts        | Public SDK types                                           |
| utils.ts        | Shared utilities                                           |

## Architecture

### Secure Container Flow

Connect -> URL Event -> SDK Opens Secure Container -> User Completes Flow -> SDK Returns Control

### App-to-App Flow

Connect -> URL Event -> SDK Launches Fi App -> User Completes Flow -> Deep Link Returns To SDK

## Development Principles

### Backward Compatibility

- Do not introduce breaking API changes.
- Preserve existing public interfaces whenever possible.
- New functionality should be additive.

### Platform Consistency

Changes should behave consistently across Android and iOS.

## Logging Guidelines

For temporary debugging logs use:

console.log('**\*** EVENT_NAME', payload);

Use the **\*** prefix for SDK debugging logs.

## Window Event Tracking

### Open Events

Secure Container:
{ type: 'window', opened: true, open_type: 'secure-container' }

Fi App:
{ type: 'window', opened: true, open_type: 'fi-app' }

### Close Events

Connect sent CLOSE_POPUP and SDK closed the active Secure Container:

{ type: 'window', closed: true, closed_by: 'connect-client-event', action: 'closed' }

Connect sent CLOSE_POPUP but no active Secure Container was found:

{ type: 'window', closed: true, closed_by: 'connect-client-event', action: 'none' }

User manually closed Secure Container:

{ type: 'window', closed: true, closed_by: 'user-closed', action: 'closed' }

User returned from Fi App via partner redirection:

{ type: 'window', closed: true, closed_by: 'partner-redirection', action: 'closed' }

### Blocked Event

Secure Container or Fi App launch failed:

{ type: 'window', blocked: true }

## Common Tasks

### Add a New Event

1. Update the event contract.
2. Emit the event through postMessage.
3. Verify Android behavior.
4. Verify iOS behavior.
5. Update README if the public API changes.

### Modify Browser Logic

Check these methods:

- openBrowser()
- dismissBrowser()
- handleBrowserNavigationEvent()

### Modify Connect Communication

Check these methods:

- handleEvent()
- postMessage()

## Testing Checklist

### Secure Container

- Opens successfully
- User close works
- CLOSE_POPUP works
- Invalid URL handling works

### App-to-App

- Fi App launch works
- Deep link return works
- Missing app handling works
- Launch failure handling works

## Regression Checks

Verify these existing events continue to work:

- ACK
- DONE
- ERROR
- CANCEL
- USER
- ROUTE

## Code Style

- Prefer TypeScript types over any.
- Keep functions small and focused.
- Reuse existing helper methods when possible.
- Avoid duplicating platform-specific logic.
- Follow existing repository coding patterns.

## Pull Request Expectations

1. Explain the use case.
2. Explain platform impact.
3. List emitted events changed or added.
4. Include testing performed.
5. Preserve backward compatibility unless explicitly approved.