package com.mastercard.openbanking.connect.reactnativesdk;

public class NavigationEvent {
  public static final String NAVIGATION_STARTED = "NAVIGATION_STARTED";
  public static final String NAVIGATION_FAILED = "NAVIGATION_FAILED";
  public static final String NAVIGATION_FINISHED = "NAVIGATION_FINISHED";
  public static final String DEEP_LINK_REDIRECT = "DEEP_LINK_REDIRECT";

  public final String eventName;
  public final String message;

  public NavigationEvent(String eventName, String message) {
    this.eventName = eventName;
    this.message = message;
  }
}
