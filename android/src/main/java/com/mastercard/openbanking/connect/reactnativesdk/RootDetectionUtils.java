package com.mastercard.openbanking.connect.reactnativesdk;

import android.os.Build;

import java.io.File;

public final class RootDetectionUtils {
  private static final String[] ROOT_BINARY_PATHS = new String[] {
    "/system/app/Superuser.apk",
    "/sbin/su",
    "/system/bin/su",
    "/system/xbin/su",
    "/data/local/xbin/su",
    "/data/local/bin/su",
    "/system/sd/xbin/su",
    "/system/bin/failsafe/su",
    "/data/local/su"
  };

  private RootDetectionUtils() {}

  public static boolean isDeviceRooted() {
    return hasTestKeys() || hasKnownRootBinary();
  }

  private static boolean hasTestKeys() {
    String buildTags = Build.TAGS;
    return buildTags != null && buildTags.contains("test-keys");
  }

  private static boolean hasKnownRootBinary() {
    for (String path : ROOT_BINARY_PATHS) {
      if (new File(path).exists()) {
        return true;
      }
    }
    return false;
  }
}
