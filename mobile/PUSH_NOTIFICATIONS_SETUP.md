# Push Notifications Setup Guide

This guide explains how to set up push notifications for the TaskManager mobile app using Firebase Cloud Messaging (FCM).

## Prerequisites

- Firebase account
- Xcode (for iOS)
- Android Studio (for Android)

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `taskmanager-mobile`
4. Follow the setup wizard

## Step 2: Add Android App to Firebase

1. In Firebase Console, click "Add app" → Android
2. Enter Android package name: `com.taskmanager` (from app.json)
3. Download `google-services.json`
4. Place it in: `android/app/google-services.json`

## Step 3: Add iOS App to Firebase

1. In Firebase Console, click "Add app" → iOS
2. Enter iOS bundle ID: `com.taskmanager` (from app.json)
3. Download `GoogleService-Info.plist`
4. Place it in: `ios/TaskManager/GoogleService-Info.plist`

## Step 4: Install Dependencies

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

## Step 5: Configure Android

### android/build.gradle
Add Google Services plugin:
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

### android/app/build.gradle
Apply the plugin:
```gradle
apply plugin: 'com.google.gms.google-services'
```

## Step 6: Configure iOS

### Install CocoaPods
```bash
cd ios
pod install
cd ..
```

### ios/TaskManager/AppDelegate.mm
Add Firebase initialization:
```objective-c
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];  // Add this line
  // ... rest of code
}
```

### Enable Push Notifications in Xcode
1. Open `ios/TaskManager.xcworkspace` in Xcode
2. Select project → Capabilities
3. Enable "Push Notifications"
4. Enable "Background Modes" → Check "Remote notifications"

## Step 7: Request Permissions

The app will automatically request notification permissions on first launch.

## Step 8: Test Push Notifications

### Get Device Token
1. Run the app
2. Check logs for FCM token
3. Copy the token

### Send Test Notification
1. Go to Firebase Console → Cloud Messaging
2. Click "Send your first message"
3. Enter message content
4. Select "Single device" and paste your token
5. Click "Send"

## Backend Integration

To send notifications from your backend:

### Install Firebase Admin SDK
```bash
cd backend
npm install firebase-admin
```

### Initialize Firebase Admin
```typescript
import admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});
```

### Send Notification
```typescript
await admin.messaging().send({
  token: userDeviceToken,
  notification: {
    title: 'New Task Assigned',
    body: 'You have been assigned to: Task Title',
  },
  data: {
    taskId: '123',
    type: 'task_assigned',
  },
});
```

## Troubleshooting

### Android: Notifications not received
- Verify `google-services.json` is in correct location
- Check app is running in foreground/background
- Verify FCM token is valid

### iOS: Notifications not received
- Ensure APNs certificate is configured in Firebase
- Check Xcode capabilities are enabled
- Verify `GoogleService-Info.plist` is added to target

### Token not generating
- Check Firebase configuration files
- Verify app permissions
- Check network connectivity

## Production Checklist

- [ ] Configure APNs certificates for iOS
- [ ] Set up Firebase Cloud Functions for automated notifications
- [ ] Store device tokens in database
- [ ] Handle token refresh
- [ ] Implement notification handlers for different types
- [ ] Test on physical devices
- [ ] Configure notification channels (Android)
- [ ] Add notification icons
