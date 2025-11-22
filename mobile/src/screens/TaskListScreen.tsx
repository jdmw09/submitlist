import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SafeAreaView,
  Switch,
  SectionList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { taskAPI, organizationAPI } from '../services/api';
import { Task } from '../types';
import OfflineBanner from '../components/OfflineBanner';
import offlineStorage from '../services/offlineStorage';
import networkService from '../services/networkService';

const TaskListScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [sortOrder, setSortOrder] = useState<'due_date' | 'priority'>('due_date');
  const [showArchived, setShowArchived] = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    loadSelectedOrganization();
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      loadTasks();
      loadOrgSettings();
    }
  }, [selectedOrg, filter, sortOrder, hideCompleted]);

  useEffect(() => {
    if (selectedOrg && showArchived) {
      loadArchivedTasks();
    }
  }, [selectedOrg, showArchived]);

  const loadSelectedOrganization = async () => {
    const stored = await AsyncStorage.getItem('selectedOrganization');
    if (stored) {
      setSelectedOrg(JSON.parse(stored));
    }
  };

  const loadOrgSettings = async () => {
    if (!selectedOrg || !networkService.getIsOnline()) return;
    try {
      const response = await organizationAPI.getSettings(selectedOrg.id);
      const settings = response.data.settings;
      if (settings) {
        setSortOrder(settings.default_task_sort || 'due_date');
        setHideCompleted(settings.hide_completed_tasks || false);
      }
    } catch (error) {
      console.log('Failed to load org settings:', error);
    }
  };

  const loadTasks = async () => {
    if (!selectedOrg) return;

    setLoading(true);
    try {
      if (networkService.getIsOnline()) {
        // Online: fetch from API
        const response = await taskAPI.getAll(selectedOrg.id, {
          assignedToMe: filter === 'mine',
          sort: sortOrder,
          hideCompleted: hideCompleted,
        });
        const fetchedTasks = response.data.tasks;
        setTasks(fetchedTasks);

        // Cache for offline use
        await offlineStorage.saveTasks(fetchedTasks);
      } else {
        // Offline: load from cache
        const cachedTasks = await offlineStorage.getTasks();
        const filteredTasks = cachedTasks.filter((task: Task) => {
          if (task.organization_id !== selectedOrg.id) return false;
          // Note: offline filtering is limited - may show all tasks
          return true;
        });
        setTasks(filteredTasks);
      }
    } catch (error: any) {
      // If online fetch fails, try offline cache
      if (networkService.getIsOnline()) {
        const cachedTasks = await offlineStorage.getTasks();
        const filteredTasks = cachedTasks.filter((task: Task) => task.organization_id === selectedOrg.id);
        if (filteredTasks.length > 0) {
          setTasks(filteredTasks);
          Alert.alert('Info', 'Using cached data (network error)');
        } else {
          Alert.alert('Error', error.response?.data?.error || 'Failed to load tasks');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadArchivedTasks = async () => {
    if (!selectedOrg || !networkService.getIsOnline()) return;
    try {
      const response = await taskAPI.getArchived(selectedOrg.id);
      setArchivedTasks(response.data.tasks || []);
    } catch (error) {
      console.log('Failed to load archived tasks:', error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, [selectedOrg, filter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'overdue':
        return '#f44336';
      default:
        return '#FF9800';
    }
  };

  const renderTask = ({ item }: { item: Task }) => {
    const progress = item.total_requirements
      ? (item.completed_requirements || 0) / item.total_requirements
      : 0;

    return (
      <TouchableOpacity
        style={[styles.taskCard, { backgroundColor: colors.cardBg }]}
        onPress={() => navigation.navigate('TaskDetail', { taskId: item.id })}
      >
        <View style={styles.taskHeader}>
          <Text style={[styles.taskTitle, { color: colors.textPrimary }]}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {item.details && (
          <Text style={[styles.taskDetails, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.details}
          </Text>
        )}

        <View style={styles.taskMeta}>
          {item.assigned_user_name && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Assigned to: {item.assigned_user_name}</Text>
          )}
          {item.total_requirements > 0 && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Progress: {item.completed_requirements}/{item.total_requirements}
            </Text>
          )}
        </View>

        {item.total_requirements > 0 && (
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}

        {item.end_date && (
          <Text style={[styles.dueDate, { color: colors.textSecondary }]}>
            Due: {new Date(item.end_date).toLocaleDateString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <OfflineBanner />

      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{selectedOrg?.name || 'Tasks'}</Text>
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('CreateTask')}
        >
          <Text style={styles.createButtonText}>+ New Task</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
              filter === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setFilter('all')}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'all' && styles.filterTextActive
            ]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
              filter === 'mine' && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setFilter('mine')}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              filter === 'mine' && styles.filterTextActive
            ]}>
              Mine
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton,
              { backgroundColor: colors.cardBg, borderColor: colors.border },
              showArchived && { backgroundColor: colors.primary, borderColor: colors.primary }
            ]}
            onPress={() => setShowArchived(!showArchived)}
          >
            <Text style={[
              styles.filterText,
              { color: colors.textSecondary },
              showArchived && styles.filterTextActive
            ]}>
              Archived
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionsRow}>
          <View style={styles.sortContainer}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Sort:</Text>
            <TouchableOpacity
              style={[styles.sortButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              onPress={() => setSortOrder(sortOrder === 'due_date' ? 'priority' : 'due_date')}
            >
              <Text style={[styles.sortButtonText, { color: colors.textPrimary }]}>
                {sortOrder === 'due_date' ? 'Due Date' : 'Priority'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.toggleContainer}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Hide done</Text>
            <Switch
              value={hideCompleted}
              onValueChange={setHideCompleted}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </View>
      </View>

      <FlatList
        data={tasks}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tasks yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Create one to get started</Text>
          </View>
        }
        ListFooterComponent={showArchived && archivedTasks.length > 0 ? (
          <View style={[styles.archivedSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.archivedTitle, { color: colors.textSecondary }]}>Archived Tasks</Text>
            {archivedTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskCard, styles.archivedCard, { backgroundColor: colors.cardBg }]}
                onPress={() => navigation.navigate('TaskDetail', { taskId: task.id })}
              >
                <View style={styles.taskHeader}>
                  <Text style={[styles.taskTitle, { color: colors.textSecondary }]}>{task.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: '#999' }]}>
                    <Text style={styles.statusText}>Archived</Text>
                  </View>
                </View>
                {task.details && (
                  <Text style={[styles.taskDetails, { color: colors.textSecondary }]} numberOfLines={2}>
                    {task.details}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filters: {
    padding: 16,
    gap: 12,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionLabel: {
    fontSize: 13,
  },
  list: {
    padding: 16,
  },
  taskCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  taskDetails: {
    fontSize: 14,
    marginBottom: 12,
  },
  taskMeta: {
    gap: 4,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  dueDate: {
    fontSize: 12,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
  },
  archivedSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  archivedTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  archivedCard: {
    opacity: 0.7,
  },
});

export default TaskListScreen;
