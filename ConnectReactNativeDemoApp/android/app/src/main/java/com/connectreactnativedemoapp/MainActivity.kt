package com.connectreactnativedemoapp

import android.os.Bundle
import java.io.File
import androidx.core.view.WindowCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (isDeviceRooted()) {
      finishAffinity()
      return
    }

    WindowCompat.setDecorFitsSystemWindows(window, false)
  }

  private fun isDeviceRooted(): Boolean {
    val buildTags = android.os.Build.TAGS
    if (!buildTags.isNullOrEmpty() && buildTags.contains("test-keys")) {
      return true
    }

    val rootBinaryPaths = arrayOf(
      "/system/app/Superuser.apk",
      "/sbin/su",
      "/system/bin/su",
      "/system/xbin/su",
      "/data/local/xbin/su",
      "/data/local/bin/su",
      "/system/sd/xbin/su",
      "/system/bin/failsafe/su",
      "/data/local/su"
    )

    return rootBinaryPaths.any { File(it).exists() }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ConnectReactNativeDemoApp"

  /**
  * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
  * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
  */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}