import Foundation
import UIKit

final class HostedRedirectResolver {

  static let shared = HostedRedirectResolver()

  private init() {}

  enum ResolverError: Error, LocalizedError {
    case invalidInputURL
    case unresolvedFinalURL
    case unexpectedHost(String)
    case appOpenFailed

    var errorDescription: String? {
      switch self {
      case .invalidInputURL:
        return "The input URL is invalid."
      case .unresolvedFinalURL:
        return "Could not resolve the final redirect URL."
      case let .unexpectedHost(host):
        return "Unexpected redirect host: \(host)."
      case .appOpenFailed:
        return "Failed to open final URL."
      }
    }
  }

  func resolveAndOpenHostedApp(
    inputURL: URL,
    completion: @escaping (Result<URL, Error>) -> Void
  ) {
    resolveFinalURL(startingAt: inputURL) { result in
      switch result {
      case let .failure(error):
        completion(.failure(error))
      case let .success(finalURL):
        DispatchQueue.main.async {
          UIApplication.shared.open(finalURL, options: [.universalLinksOnly: true]) { openedAsApp in
            if openedAsApp {
              completion(.success(finalURL))
              return
            }
            completion(.failure(ResolverError.appOpenFailed))
          }
        }
      }
    }
  }

  private func resolveFinalURL(startingAt url: URL, completion: @escaping (Result<URL, Error>) -> Void) {
    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 20
    config.timeoutIntervalForResource = 30

    let session = URLSession(configuration: config)
    let task = session.dataTask(with: url) { _, response, error in
      if let error {
        completion(.failure(error))
        return
      }

      guard let finalURL = response?.url else {
        completion(.failure(ResolverError.unresolvedFinalURL))
        return
      }

      completion(.success(finalURL))
    }
    task.resume()
  }
}
