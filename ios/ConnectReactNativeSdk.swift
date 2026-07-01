import Foundation
import UIKit
import SafariServices


@objc(ConnectReactNativeSdk)
class ConnectReactNativeSdk: NSObject {
  @objc(checklink:withResolver:withRejecter:)
  func x(url: String, resolve:  @escaping RCTPromiseResolveBlock,reject: @escaping RCTPromiseRejectBlock) -> Void {
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

  @objc(resolveAndOpenHostedApp:withResolver:withRejecter:)
  func resolveAndOpenHostedApp(url: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
    guard let inputURL = URL(string: url) else {
      let error = HostedRedirectResolver.ResolverError.invalidInputURL
      reject("INVALID_URL", error.localizedDescription, error)
      return
    }

    HostedRedirectResolver.shared.resolveAndOpenHostedApp(inputURL: inputURL) { result in
      switch result {
      case let .success(finalURL):
        resolve(finalURL.absoluteString)
      case let .failure(error):
        reject("HOSTED_REDIRECT_FAILED", error.localizedDescription, error)
      }
    }
  }
}
