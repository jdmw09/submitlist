import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { taskAPI } from '../services/api';
import { Task, TaskCompletion } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { useTheme } from '../contexts/ThemeContext';

const TaskCompletionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { taskId } = route.params as { taskId: number };
  const { user } = useAuth();
  const { colors } = useTheme();

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupByRequirement, setGroupByRequirement] = useState(true);

  useEffect(() => {
    loadTask();
  }, [taskId]);

  const loadTask = async () => {
    try {
      const response = await taskAPI.getById(taskId);
      setTask(response.data.task);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load task');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCompletion = async (completionId: number) => {
    Alert.alert(
      'Delete Completion',
      'Are you sure you want to delete this completion?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await taskAPI.deleteCompletion(completionId);
              Alert.alert('Success', 'Completion deleted successfully');
              loadTask();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete completion');
            }
          },
        },
      ]
    );
  };

  const renderFileContent = (completion: TaskCompletion) => {
    if (!completion.file_path) return null;

    let filePaths: string[] = [];
    try {
      filePaths = JSON.parse(completion.file_path);
    } catch {
      filePaths = [completion.file_path];
    }

    return (
      <View style={styles.completionFilesGrid}>
        {completion.completion_type === 'image' && filePaths.map((path, idx) => (
          <Image
            key={idx}
            source={{ uri: `http://localhost:3000${path}` }}
            style={styles.completionImageLarge}
            resizeMode="cover"
          />
        ))}
        {completion.completion_type === 'video' && filePaths.map((path, idx) => (
          <View key={idx} style={[styles.videoPlaceholder, { backgroundColor: colors.bgSecondary }]}>
            <Text style={styles.videoIcon}>▶️</Text>
            <Text style={[styles.videoText, { color: colors.textPrimary }]}>Video</Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(`http://localhost:3000${path}`)}
            >
              <Text style={[styles.videoLink, { color: colors.primary }]}>Tap to view</Text>
            </TouchableOpacity>
          </View>
        ))}
        {completion.completion_type === 'document' && filePaths.map((path, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.completionDocumentCard, { backgroundColor: colors.bgSecondary }]}
            onPress={() => Linking.openURL(`http://localhost:3000${path}`)}
          >
            <Text style={styles.documentIcon}>📄</Text>
            <Text style={[styles.documentName, { color: colors.textPrimary }]}>{path.split('/').pop()}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderCompletionCard = (completion: TaskCompletion) => {
    const canDelete = user && (task?.created_by_id === user.id || completion.user_id === user.id);

    return (
      <View key={completion.id} style={[styles.completionCard, { backgroundColor: colors.cardBg, borderColor: colors.borderMedium }]}>
        <View style={styles.completionCardHeader}>
          <View style={styles.completionUserInfo}>
            <View style={[styles.userAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {(completion.user_name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.userName, { color: colors.textPrimary }]}>{completion.user_name || 'Unknown'}</Text>
              <Text style={[styles.completionDate, { color: colors.textSecondary }]}>
                {new Date(completion.completed_at).toLocaleString()}
              </Text>
            </View>
          </View>
          {canDelete && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: colors.error }]}
              onPress={() => handleDeleteCompletion(completion.id)}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>

        {completion.text_content && (
          <View style={[styles.completionTextContainer, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.completionText, { color: colors.textPrimary }]}>{completion.text_content}</Text>
          </View>
        )}

        {renderFileContent(completion)}
      </View>
    );
  };

  const renderCompletionsByRequirement = () => {
    const requirementGroups = new Map<number | string, TaskCompletion[]>();

    task?.completions?.forEach(completion => {
      const key = completion.requirement_id || 'general';
      if (!requirementGroups.has(key)) {
        requirementGroups.set(key, []);
      }
      requirementGroups.get(key)!.push(completion);
    });

    return Array.from(requirementGroups.entries()).map(([reqId, completions]) => {
      const requirement = task?.requirements?.find(r => r.id === reqId);
      const title = requirement?.description || 'General Completions';

      return (
        <View key={reqId} style={[styles.requirementGroup, { backgroundColor: colors.bgSecondary }]}>
          <Text style={[styles.requirementTitle, { color: colors.textPrimary, borderBottomColor: colors.borderMedium }]}>{title}</Text>
          <View style={styles.completionsContainer}>
            {completions.map(renderCompletionCard)}
          </View>
        </View>
      );
    });
  };

  const renderCompletionsChronological = () => {
    const sortedCompletions = [...(task?.completions || [])].sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );

    return (
      <View style={styles.completionsContainer}>
        {sortedCompletions.map(renderCompletionCard)}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading completions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>Task not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const completionsCount = task.completions?.length || 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.bgSecondary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.backButtonText, { color: colors.textPrimary }]}>← Back to Task</Text>
        </TouchableOpacity>

        <View style={[styles.completionsHeader, { borderBottomColor: colors.borderMedium }]}>
          <View style={styles.headerInfo}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Task Completions</Text>
            <Text style={[styles.taskTitle, { color: colors.textSecondary }]}>{task.title}</Text>
            <Text style={[styles.completionsCount, { color: colors.textSecondary }]}>
              {completionsCount} {completionsCount === 1 ? 'completion' : 'completions'}
            </Text>
          </View>
        </View>

        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { borderColor: colors.primary },
              groupByRequirement && { backgroundColor: colors.primary },
            ]}
            onPress={() => setGroupByRequirement(true)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: groupByRequirement ? '#fff' : colors.primary },
              ]}
            >
              Group by Requirement
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              { borderColor: colors.primary },
              !groupByRequirement && { backgroundColor: colors.primary },
            ]}
            onPress={() => setGroupByRequirement(false)}
          >
            <Text
              style={[
                styles.toggleButtonText,
                { color: !groupByRequirement ? '#fff' : colors.primary },
              ]}
            >
              Chronological
            </Text>
          </TouchableOpacity>
        </View>

        {completionsCount === 0 ? (
          <View style={[styles.emptyStateCard, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.noCompletions, { color: colors.textSecondary }]}>No completions yet for this task.</Text>
          </View>
        ) : (
          <View style={styles.completionsWrapper}>
            {groupByRequirement ? renderCompletionsByRequirement() : renderCompletionsChronological()}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  completionsHeader: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
  },
  headerInfo: {
    gap: 8,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  taskTitle: {
    fontSize: 16,
  },
  completionsCount: {
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyStateCard: {
    padding: 40,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noCompletions: {
    fontSize: 16,
    textAlign: 'center',
  },
  completionsWrapper: {
    gap: 24,
  },
  requirementGroup: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  requirementTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
  },
  completionsContainer: {
    gap: 16,
  },
  completionCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  completionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  completionUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  completionDate: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completionTextContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  completionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  completionFilesGrid: {
    gap: 12,
  },
  completionImageLarge: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 8,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  videoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  videoText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  videoLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  completionDocumentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  documentIcon: {
    fontSize: 32,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

export default TaskCompletionsScreen;
