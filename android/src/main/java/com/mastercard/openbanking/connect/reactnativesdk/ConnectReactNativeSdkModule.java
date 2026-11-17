package com.mastercard.openbanking.connect.reactnativesdk;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@ReactModule(name = ConnectReactNativeSdkModule.NAME)
public class ConnectReactNativeSdkModule extends ReactContextBaseJavaModule implements LifecycleEventListener, ActivityEventListener {
  public static final String NAME = "ConnectReactNativeSdk";
  private final ReactApplicationContext reactContext;
  private static ConnectReactNativeSdkModule instance;

  public ConnectReactNativeSdkModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
    instance = this;
    reactContext.addLifecycleEventListener(this);
    reactContext.addActivityEventListener(this);
  }

  public static boolean hasInstance() {
    return instance != null;
  }

  public static ConnectReactNativeSdkModule getInstance() {
    return instance;
  }

  @Override
  @NonNull
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void open(final ReadableMap options, final Promise promise) {
    final Activity activity = getCurrentActivity();
    RNInAppBrowser.getInstance().open(this.reactContext, options, promise, activity);
  }

  @ReactMethod
  public void close() {
    RNInAppBrowser.getInstance().close();
  }

  @ReactMethod
  public void checklink(final String url, final Promise promise) {
    if (url == null || url.isEmpty()) {
      promise.resolve(false);
      return;
    }

    final Uri uri = Uri.parse(url);
    final Activity activity = getCurrentActivity();
    boolean result = tryOpenInExternalApp(uri, activity);
    promise.resolve(result);
  }

  /**
   * Attempts to open the URI in a non-browser app.
   * Returns true if a non-browser app was launched, false otherwise.
   */
  private boolean tryOpenInExternalApp(Uri uri, Activity activity) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // API 30+ — FLAG_ACTIVITY_REQUIRE_NON_BROWSER throws ActivityNotFoundException
      // when no non-browser app handles the URI, making this the reliable detection path.
      try {
        Intent appIntent = new Intent(Intent.ACTION_VIEW, uri);
        appIntent.addFlags(Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER);
        if (activity != null) {
          activity.startActivity(appIntent);
        } else {
          appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          reactContext.startActivity(appIntent);
        }
        return true;
      } catch (ActivityNotFoundException e) {
        return false;
      }
    } else {
      // API < 30 — manually exclude packages that can handle generic browser URLs.
      if (hasNonBrowserHandler(uri)) {
        Intent appIntent = new Intent(Intent.ACTION_VIEW, uri);
        if (activity != null) {
          activity.startActivity(appIntent);
        } else {
          appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          reactContext.startActivity(appIntent);
        }
        return true;
      }
      return false;
    }
  }

  /**
   * API < 30 fallback: returns true if at least one non-browser app handles this URI.
   */
  private boolean hasNonBrowserHandler(Uri uri) {
    Intent probe = new Intent(Intent.ACTION_VIEW, uri);
    probe.addCategory(Intent.CATEGORY_BROWSABLE);
    PackageManager pm = reactContext.getPackageManager();
    Set<String> browserPackages = getBrowserPackages(pm);
    List<ResolveInfo> handlers = pm.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY);
    for (ResolveInfo info : handlers) {
      if (info.activityInfo != null && !browserPackages.contains(info.activityInfo.packageName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Identifies installed browser packages so they are excluded from the app-to-app check.
   * Queries packages that can handle ACTION_VIEW with CATEGORY_BROWSABLE dynamically
   * instead of maintaining a static allowlist.
   */
  private Set<String> getBrowserPackages(PackageManager packageManager) {
    Set<String> browserPackages = new HashSet<>();
    Intent browserIntent = new Intent(Intent.ACTION_VIEW);
    browserIntent.addCategory(Intent.CATEGORY_BROWSABLE);

    List<ResolveInfo> browsers = packageManager.queryIntentActivities(browserIntent, PackageManager.MATCH_DEFAULT_ONLY);
    for (ResolveInfo info : browsers) {
      if (info.activityInfo != null) {
        browserPackages.add(info.activityInfo.packageName);
      }
    }
    return browserPackages;
  }

  @ReactMethod
  public void isAvailable(final Promise promise) {
    RNInAppBrowser.getInstance().isAvailable(this.reactContext, promise);
  }

  public static void onStart(final Activity activity) {
    RNInAppBrowser.getInstance().onStart(activity);
  }

  @Override
  public void onHostResume() {
    final Activity activity = getCurrentActivity();
    if (activity != null) {
      RNInAppBrowser.getInstance().onStart(activity);
    }
  }

  @Override
  public void onHostPause() {
    // No-op.
  }

  @Override
  public void onHostDestroy() {
    // No-op.
  }

  @Override
  public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
    // No-op.
  }

  @Override
  public void onNewIntent(Intent intent) {
    final Activity activity = getCurrentActivity();
    if (activity != null) {
      activity.setIntent(intent);
    }
    handleDeepLinkIntent(intent, "SDK_ACTIVITY_EVENT_LISTENER");
  }

  private void handleDeepLinkIntent(Intent intent, String source) {
    if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) {
      return;
    }

    Uri data = intent.getData();
    if (data != null) {
      String deepLink = data.toString();
      sendDeepLinkRedirectEvent(deepLink, source);
    }
  }

  @ReactMethod
  public void warmup(final Promise promise) {
    RNInAppBrowser.getInstance().warmup(promise);
  }

  @ReactMethod
  public void mayLaunchUrl(final String mostLikelyUrl, final ReadableArray otherUrls) {
    RNInAppBrowser.getInstance().mayLaunchUrl(mostLikelyUrl, otherUrls);
  }

  public void sendNavigationEvent(NavigationEvent event) {
    WritableMap params = Arguments.createMap();
    params.putString("eventName", event.eventName);
    params.putString("message", event.message);

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit("onBrowserNavigationEvent", params);
  }

  public void sendDeepLinkRedirectEvent(String deepLink, String source) {
    WritableMap params = Arguments.createMap();
    params.putString("eventName", NavigationEvent.DEEP_LINK_REDIRECT);
    params.putString("message", deepLink);
    params.putString("source", source);

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit("onBrowserNavigationEvent", params);
  }

}
