import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useOffline } from '../hooks/useOffline';

const OfflineBanner: React.FC = () => {
  const { isOffline, isSyncing, pendingCount, syncNow } = useOffline();

  if (!isOffline && !isSyncing && pendingCount === 0) {
    return null;
  }

  return (
    <View style={[
      styles.banner,
      isOffline ? styles.offlineBanner : styles.syncingBanner
    ]}>
      <View style={styles.content}>
        <Icon
          name={isOffline ? 'cloud-off' : 'cloud-sync'}
          size={20}
          color="#fff"
        />
        <Text style={styles.text}>
          {isOffline
            ? `Offline${pendingCount > 0 ? ` - ${pendingCount} pending` : ''}`
            : isSyncing
            ? 'Syncing...'
            : `${pendingCount} pending`}
        </Text>
      </View>

      {!isOffline && !isSyncing && pendingCount > 0 && (
        <TouchableOpacity onPress={syncNow} style={styles.syncButton}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      )}

      {isSyncing && (
        <ActivityIndicator size="small" color="#fff" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  offlineBanner: {
    backgroundColor: '#f44336',
  },
  syncingBanner: {
    backgroundColor: '#ff9800',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default OfflineBanner;
