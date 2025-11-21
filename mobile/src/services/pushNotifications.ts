// Push Notifications Service
// Note: This requires @react-native-firebase/messaging to be installed
// See PUSH_NOTIFICATIONS_SETUP.md for complete setup instructions

import { Platform } from 'react-native';
// Uncomment after installing Firebase packages:
// import messaging from '@react-native-firebase/messaging';

class PushNotificationService {
  private fcmToken: string | null = null;

  async initialize() {
    // Uncomment after installing Firebase packages:
    /*
    try {
      // Request permission (iOS)
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Push notification permission denied');
          return;
        }
      }

      // Get FCM token
      const token = await messaging().getToken();
      this.fcmToken = token;
      console.log('FCM Token:', token);

      // Listen for token refresh
      messaging().onTokenRefresh(newToken => {
        console.log('FCM Token refreshed:', newToken);
        this.fcmToken = newToken;
        this.sendTokenToBackend(newToken);
      });

      // Handle foreground messages
      messaging().onMessage(async remoteMessage => {
        console.log('Foreground notification:', remoteMessage);
        this.handleNotification(remoteMessage);
      });

      // Handle background messages (requires separate handler in index.js)
      messaging().setBackgroundMessageHandler(async remoteMessage => {
        console.log('Background notification:', remoteMessage);
      });

      // Send token to backend
      if (token) {
        await this.sendTokenToBackend(token);
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
    */

    console.log('Push notifications service initialized (Firebase not configured)');
  }

  async sendTokenToBackend(token: string) {
    // TODO: Send token to backend to store in database
    // This allows the backend to send notifications to this device
    /*
    try {
      await api.post('/users/device-token', { token, platform: Platform.OS });
    } catch (error) {
      console.error('Error sending token to backend:', error);
    }
    */
    console.log('Token to send to backend:', token);
  }

  handleNotification(remoteMessage: any) {
    // Handle different notification types
    const { data, notification } = remoteMessage;

    switch (data?.type) {
      case 'task_assigned':
        // Navigate to task detail
        console.log('Task assigned notification:', data.taskId);
        break;

      case 'task_completed':
        // Show task completed notification
        console.log('Task completed notification:', data.taskId);
        break;

      case 'comment_added':
        // Navigate to task comments
        console.log('Comment added notification:', data.taskId);
        break;

      default:
        console.log('Unknown notification type:', data?.type);
    }
  }

  getToken(): string | null {
    return this.fcmToken;
  }

  async checkPermission(): Promise<boolean> {
    // Uncomment after installing Firebase packages:
    /*
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().hasPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    }
    */
    return true; // Android doesn't require runtime permission for notifications
  }
}

export default new PushNotificationService();
