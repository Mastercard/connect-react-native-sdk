# Prevent R8/ProGuard from stripping EventBus annotations and classes
-keepclassmembers class ** {
    @org.greenrobot.eventbus.Subscribe <methods>;
}
-keepattributes *Annotation*
-keep class org.greenrobot.eventbus.** { *; }
