import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { taskAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskAuditLog'>;

interface AuditLog {
  id: number;
  task_id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id: number;
  changes: any;
  metadata: any;
  created_at: string;
}

const TaskAuditLogScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { taskId } = route.params;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [taskId]);

  const loadAuditLogs = async () => {
    try {
      const response = await taskAPI.getAuditLogs(taskId);
      setLogs(response.data.logs);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return '➕';
      case 'updated':
      case 'status_changed':
        return '✏️';
      case 'deleted':
        return '🗑️';
      case 'submitted':
        return '📤';
      case 'approved':
        return '✅';
      case 'rejected':
        return '❌';
      case 'requirement_completed':
        return '☑️';
      default:
        return '📝';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return 'Created Task';
      case 'updated':
        return 'Updated Task';
      case 'status_changed':
        return 'Changed Status';
      case 'deleted':
        return 'Deleted Task';
      case 'submitted':
        return 'Submitted Task';
      case 'approved':
        return 'Approved Task';
      case 'rejected':
        return 'Rejected Task';
      case 'requirement_completed':
        return 'Completed Requirement';
      default:
        return action;
    }
  };

  const renderChanges = (changes: any) => {
    if (!changes) return null;

    return (
      <View style={[styles.changesContainer, { backgroundColor: colors.bgSecondary, borderLeftColor: colors.success }]}>
        {Object.entries(changes).map(([key, value]: [string, any]) => (
          <View key={key} style={styles.changeItem}>
            <Text style={[styles.changeField, { color: colors.textSecondary }]}>{key}:</Text>
            <View style={styles.changeValues}>
              {value.before !== undefined && (
                <Text style={[styles.changeBefore, { color: colors.error, backgroundColor: colors.errorBg }]}>
                  {typeof value.before === 'object'
                    ? JSON.stringify(value.before)
                    : String(value.before || 'null')}
                </Text>
              )}
              <Text style={[styles.changeArrow, { color: colors.textTertiary }]}>→</Text>
              <Text style={[styles.changeAfter, { color: colors.success, backgroundColor: colors.successBg }]}>
                {typeof value.after === 'object'
                  ? JSON.stringify(value.after)
                  : String(value.after || 'null')}
              </Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderMetadata = (metadata: any) => {
    if (!metadata) return null;

    return (
      <View style={[styles.metadataContainer, { backgroundColor: colors.warningBg, borderLeftColor: colors.warning }]}>
        <Text style={[styles.metadataTitle, { color: colors.textSecondary }]}>Additional Info:</Text>
        {Object.entries(metadata).map(([key, value]: [string, any]) => (
          <View key={key} style={styles.metadataItem}>
            <Text style={[styles.metadataKey, { color: colors.textSecondary }]}>{key}:</Text>
            <Text style={[styles.metadataValue, { color: colors.textPrimary }]}>
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading audit logs...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {logs.length === 0 ? (
          <View style={styles.noLogsContainer}>
            <Text style={[styles.noLogsText, { color: colors.textTertiary }]}>No audit logs found for this task.</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={[styles.logItem, { backgroundColor: colors.cardBg, borderColor: colors.borderMedium }]}>
              <View style={[styles.logIconContainer, { backgroundColor: colors.bgSecondary }]}>
                <Text style={styles.logIcon}>{getActionIcon(log.action)}</Text>
              </View>
              <View style={styles.logContent}>
                <View style={styles.logHeader}>
                  <Text style={[styles.logAction, { color: colors.textPrimary }]}>{getActionLabel(log.action)}</Text>
                  <Text style={[styles.logUser, { color: colors.textSecondary }]}>by {log.user_name}</Text>
                  <Text style={[styles.logDate, { color: colors.textTertiary }]}>{formatDate(log.created_at)}</Text>
                </View>
                {renderChanges(log.changes)}
                {renderMetadata(log.metadata)}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  logItem: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logIcon: {
    fontSize: 20,
  },
  logContent: {
    flex: 1,
  },
  logHeader: {
    marginBottom: 8,
  },
  logAction: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  logUser: {
    fontSize: 14,
    marginBottom: 2,
  },
  logDate: {
    fontSize: 13,
  },
  changesContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  changeItem: {
    marginBottom: 8,
  },
  changeField: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  changeValues: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  changeBefore: {
    fontSize: 13,
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  changeArrow: {
    fontSize: 13,
    marginRight: 8,
  },
  changeAfter: {
    fontSize: 13,
    fontFamily: 'monospace',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  metadataContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
  },
  metadataTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  metadataItem: {
    marginBottom: 4,
  },
  metadataKey: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  metadataValue: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  noLogsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noLogsText: {
    fontSize: 16,
  },
});

export default TaskAuditLogScreen;
