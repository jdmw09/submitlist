import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { notificationAPI } from '../services/api';
import { Notification } from '../types';

const NotificationsScreen = () => {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationAPI.getAll();
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load notifications');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, []);

  const markAsRead = async (notif: Notification) => {
    if (notif.read) return;

    try {
      await notificationAPI.markAsRead(notif.id);
      await loadNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      await loadNotifications();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to mark all as read');
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notifCard,
        { backgroundColor: colors.cardBg, borderColor: colors.borderMedium },
        !item.read && styles.unreadCard,
      ]}
      onPress={() => markAsRead(item)}
    >
      <View style={styles.notifHeader}>
        <Text style={[styles.notifTitle, { color: colors.textPrimary }]}>{item.title}</Text>
        {!item.read && <View style={styles.unreadDot} />}
      </View>
      {item.message && (
        <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>{item.message}</Text>
      )}
      {item.task_title && (
        <Text style={[styles.notifTask, { color: colors.textSecondary }]}>Task: {item.task_title}</Text>
      )}
      <Text style={[styles.notifDate, { color: colors.textSecondary }]}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.borderMedium }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Notifications</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllAsRead}>
            <Text style={styles.markAllButton}>Mark all as read</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  markAllButton: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    padding: 16,
  },
  notifCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  unreadCard: {
    backgroundColor: '#E3F2FD',
  },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
  },
  notifMessage: {
    fontSize: 14,
    marginBottom: 8,
  },
  notifTask: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  notifDate: {
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
  },
});

export default NotificationsScreen;
