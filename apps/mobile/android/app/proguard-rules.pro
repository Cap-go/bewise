# R8 rules for the release build. Capacitor core ships consumer rules that keep
# every Plugin subclass and its @PluginMethod methods; the default optimize file
# keeps @JavascriptInterface bridge methods. These cover the rest.

# Readable crash stack traces in Play Console.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor core finds callbacks by name and annotation, including private ones
# on the base Plugin class (checkPermissions) that its consumer rules miss.
-keep class com.getcapacitor.** { *; }

# Capgo updater: its own ProGuard rules are not shipped as consumer rules, and it
# reaches into the Capacitor bridge and androidx.webkit by reflection.
-keepattributes *Annotation*, Signature
-keep class ee.forgr.capacitor_updater.** { *; }
-keep class com.getcapacitor.Bridge {
    com.getcapacitor.MessageHandler msgHandler;
}
-keep class com.getcapacitor.MessageHandler { *; }
-keep class com.getcapacitor.PluginCall {
    <init>(com.getcapacitor.MessageHandler, java.lang.String, java.lang.String, java.lang.String, com.getcapacitor.JSObject);
}
-keep class * implements com.getcapacitor.PluginHandle {
    public void invoke(java.lang.String, com.getcapacitor.PluginCall);
}
-keep class androidx.webkit.WebViewFeature { public static *; }
-keep class androidx.webkit.WebViewCompat { public static *; }
-dontwarn io.ionic.backgroundrunner.**
