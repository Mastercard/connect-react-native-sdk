import Foundation

enum ConnectExternalURL {
  static func validated(_ urlString: String) -> URL? {
    guard urlString.lowercased().hasPrefix("https://"),
          let components = URLComponents(string: urlString),
          components.scheme?.lowercased() == "https",
          let host = components.host, !host.isEmpty,
          components.port.map({ (0...65535).contains($0) }) ?? true,
          components.user?.isEmpty ?? true,
          components.password?.isEmpty ?? true else {
      return nil
    }

    return components.url
  }
}
