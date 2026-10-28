# Evaluated by @bacons/apple-targets inside `target 'NotificationService' do`,
# appended to the generated Podfile.
#
# Static frameworks, as the app target links them (expo-build-properties
# `useFrameworks: "static"`): `use_frameworks!` is per target, so the app's
# setting does not reach this block. The version is the app's
# `$FirebaseSDKVersion` (plugins/withFirebaseModularHeaders.js), so the
# extension and the app link the same Firebase release.
use_frameworks! :linkage => :static
pod 'FirebaseMessaging', $FirebaseSDKVersion

# The same GoogleUtilities subspecs as the app, so CocoaPods builds one
# GoogleUtilities target for both. FirebaseMessaging alone pulls every subspec
# the app's pods do except MethodSwizzler, and a different subspec set makes a
# second variant (GoogleUtilities-<hash>) whose GoogleUtilities.framework and
# GoogleUtilities_Privacy.bundle land on the same path as the first one's in an
# archive: "Multiple commands produce ... GoogleUtilities_Privacy.bundle".
# A Debug build keeps per-target product folders and never shows it. If a
# Firebase upgrade changes the app's set, the archive fails the same way: list
# the subspecs of each `GoogleUtilities-*` target in Pods.xcodeproj and add the
# missing ones here.
pod 'GoogleUtilities/MethodSwizzler'
