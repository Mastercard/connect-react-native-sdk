import Foundation

// Run with: swiftc ios/ConnectExternalURL.swift tests/ios/main.swift -o /tmp/connect-url-tests && /tmp/connect-url-tests
let cases: [(String, Bool)] = [
  ("https://example.com/path?token=value", true),
  ("HTTPS://example.com/path", true),
  ("https://example.com:8443/path", true),
  ("https://[::1]/path", true),
  ("https://@example.com", true),
  ("", false),
  ("http://example.com", false),
  ("bankapp://authorize", false),
  ("intent://malicious", false),
  ("https:example.com", false),
  ("https://", false),
  ("https://example.com:999999", false),
  ("https://user@example.com", false),
  ("https://user:password@example.com", false)
]

for (value, expected) in cases {
  let actual = ConnectExternalURL.validated(value) != nil
  if actual != expected {
    fatalError("Unexpected validation result for \(value): \(actual)")
  }
}

print("Passed \(cases.count) external URL validation cases")
