import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../services/api';
import { Notification } from '../types';
import Layout from '../components/Layout';
import './NotificationsPage.css';

const NotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationAPI.getAll();
      setNotifications(response.data.notifications);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notif: Notification) => {
    if (notif.read) return;

    try {
      await notificationAPI.markAsRead(notif.id);
      loadNotifications();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      loadNotifications();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to mark all as read');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <Layout>
      <div className="notifications-page">
        <div className="page-header">
          <h1>Notifications</h1>
          {unreadCount > 0 && (
            <button className="btn btn-secondary" onClick={markAllAsRead}>
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {loading ? (
          <div className="loading">Loading notifications...</div>
        ) : notifications.length === 0 ? (
          <div className="empty">
            <p>No notifications</p>
          </div>
        ) : (
          <div className="notifications-list">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`notification-item ${!notif.read ? 'unread' : ''}`}
                onClick={() => markAsRead(notif)}
              >
                <div className="notification-header">
                  <h3>{notif.title}</h3>
                  {!notif.read && <div className="unread-dot" />}
                </div>
                {notif.message && <p>{notif.message}</p>}
                <div className="notification-date">
                  {new Date(notif.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default NotificationsPage;
