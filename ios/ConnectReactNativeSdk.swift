import Foundation
import React
import UIKit
import SafariServices


@objc(ConnectReactNativeSdk)
class ConnectReactNativeSdk: RCTEventEmitter, SFSafariViewControllerDelegate {
  private let browserNavigationEventName = "onBrowserNavigationEvent"
  private let navigationStartedEventName = "NAVIGATION_STARTED"
  private let navigationFailedEventName = "NAVIGATION_FAILED"
  private let navigationFinishedEventName = "NAVIGATION_FINISHED"
  private var safariViewController: SFSafariViewController?
  private var openPromiseResolve: RCTPromiseResolveBlock?

  override func supportedEvents() -> [String]! {
    return [browserNavigationEventName]
  }

  @objc(checklink:withResolver:withRejecter:)
  func checklink(url: String, resolve:  @escaping RCTPromiseResolveBlock,reject: @escaping RCTPromiseRejectBlock) -> Void {
    let urlLink = URL(string: url)
    if #available(iOS 10.0, *) {
      UIApplication.shared.open(urlLink!, options: [UIApplication.OpenExternalURLOptionsKey.universalLinksOnly : true]) { (success) in
          if success {
              resolve(true)
          } else {
              resolve(false)
          }
      }
    } else {
      resolve(false)
    }

  }

  @objc(open:withResolver:withRejecter:)
  func open(options: NSDictionary, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
    guard let urlString = options["url"] as? String, let url = URL(string: urlString) else {
      NSLog("[ConnectReactNativeSdk][iOS] Invalid URL supplied to secure container")
      reject("InAppBrowser", "Invalid URL", nil)
      return
    }

    DispatchQueue.main.async {
      guard let presenter = self.topViewController() else {
        NSLog("[ConnectReactNativeSdk][iOS] No presenter available for secure container")
        reject("InAppBrowser", "No view controller available", nil)
        return
      }

      if let previousResolve = self.openPromiseResolve {
        NSLog("[ConnectReactNativeSdk][iOS] Cancelling previous secure container launch")
        previousResolve(["type": "cancel"])
      }

      if let existingSafari = self.safariViewController {
        NSLog("[ConnectReactNativeSdk][iOS] Dismissing stale secure container before relaunch")
        existingSafari.delegate = nil
        existingSafari.dismiss(animated: false)
        self.safariViewController = nil
      }

      let safariViewController = SFSafariViewController(url: url)
      safariViewController.delegate = self
      self.safariViewController = safariViewController
      self.openPromiseResolve = resolve
      NSLog("[ConnectReactNativeSdk][iOS] Launching secure container for URL: %@", url.absoluteString)
      self.emitBrowserNavigationEvent(
        eventName: self.navigationStartedEventName,
        message: "Secure container launched"
      )
      presenter.present(safariViewController, animated: true)
    }
  }

  @objc(close)
  func close() -> Void {
    DispatchQueue.main.async {
      NSLog("[ConnectReactNativeSdk][iOS] Closing secure container")

      guard let safariViewController = self.safariViewController else {
        self.resolveOpen(type: "dismiss")
        return
      }

      safariViewController.delegate = nil
      safariViewController.dismiss(animated: true)
      self.safariViewController = nil
      self.resolveOpen(type: "dismiss")
    }
  }

  func safariViewControllerDidFinish(_ controller: SFSafariViewController) {
    guard safariViewController === controller else {
      return
    }

    NSLog("[ConnectReactNativeSdk][iOS] Secure container dismissed by user")
    safariViewController = nil
    resolveOpen(type: "cancel")
  }

  func safariViewController(_ controller: SFSafariViewController, didCompleteInitialLoad didLoadSuccessfully: Bool) {
    guard safariViewController === controller else {
      return
    }

    if didLoadSuccessfully {
      NSLog("[ConnectReactNativeSdk][iOS] Secure container initial load succeeded")
      emitBrowserNavigationEvent(
        eventName: navigationFinishedEventName,
        message: "Initial page loaded successfully"
      )
    } else {
      NSLog("[ConnectReactNativeSdk][iOS] PAGE_NOT_LOADED reason=initial_load_failed")
      emitBrowserNavigationEvent(
        eventName: navigationFailedEventName,
        message: "Initial page failed to load"
      )
    }
  }

  private func emitBrowserNavigationEvent(eventName: String, message: String) {
    sendEvent(withName: browserNavigationEventName, body: [
      "eventName": eventName,
      "message": message
    ])
  }

  private func resolveOpen(type: String, reason: String? = nil, message: String? = nil) {
    guard let resolve = openPromiseResolve else {
      return
    }

    openPromiseResolve = nil
    var payload: [String: Any] = ["type": type]

    if let reason = reason {
      payload["reason"] = reason
    }

    if let message = message {
      payload["message"] = message
    }

    resolve(payload)
  }

  private func topViewController(base: UIViewController? = UIApplication.shared.connectedScenes
    .compactMap { $0 as? UIWindowScene }
    .flatMap { $0.windows }
    .first(where: { $0.isKeyWindow })?.rootViewController) -> UIViewController? {
    if let navigationController = base as? UINavigationController {
      return topViewController(base: navigationController.visibleViewController)
    }

    if let tabBarController = base as? UITabBarController {
      return topViewController(base: tabBarController.selectedViewController)
    }

    if let presentedViewController = base?.presentedViewController {
      return topViewController(base: presentedViewController)
    }

    return base
  }
}
