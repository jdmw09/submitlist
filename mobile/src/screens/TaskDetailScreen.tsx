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
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { taskAPI, commentAPI } from '../services/api';
import { Task, TaskRequirement, TaskComment } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const TaskDetailScreen = ({ route, navigation }: any) => {
  const { taskId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedReq, setExpandedReq] = useState<number | null>(null);
  const [completionTexts, setCompletionTexts] = useState<{ [key: number]: string }>({});
  const [selectedImages, setSelectedImages] = useState<{ [key: number]: { uri: string; name: string; type: string }[] }>({});
  const [reviewComments, setReviewComments] = useState('');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    loadTask();
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      const response = await commentAPI.getComments(taskId);
      setComments(response.data.comments);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || submittingComment) return;

    setSubmittingComment(true);
    try {
      await commentAPI.addComment(taskId, newComment.trim());
      setNewComment('');
      loadComments();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editingCommentText.trim()) return;

    try {
      await commentAPI.updateComment(commentId, editingCommentText.trim());
      setEditingCommentId(null);
      setEditingCommentText('');
      loadComments();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    Alert.alert('Delete Comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await commentAPI.deleteComment(commentId);
            loadComments();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.error || 'Failed to delete comment');
          }
        },
      },
    ]);
  };

  const loadTask = async () => {
    try {
      const response = await taskAPI.getById(taskId);
      setTask(response.data.task);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load task');
    } finally {
      setLoading(false);
    }
  };

  const toggleRequirement = async (req: TaskRequirement) => {
    try {
      await taskAPI.updateRequirement(req.id, !req.completed);
      await loadTask();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update requirement');
    }
  };

  const getRequirementCompletions = (reqId: number) => {
    return task?.completions?.filter(c => c.requirement_id === reqId) || [];
  };

  const pickImage = async (reqId: number) => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access in Settings to select photos. This app needs access to all photos, including hidden ones.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            // On iOS, this would ideally open Settings, but Expo doesn't provide direct API
            // User needs to manually go to Settings > Privacy > Photos > Task Manager
          }}
        ]
      );
      return;
    }

    // Check if we have limited access (iOS 14+)
    if (permissionResult.accessPrivileges === 'limited') {
      Alert.alert(
        'Limited Photo Access',
        'You have granted limited photo access. To access all photos including hidden ones, please select "Select More Photos" or change to "Allow Access to All Photos" in Settings.',
        [
          { text: 'Continue with Limited', style: 'cancel' },
          { text: 'Select More Photos', onPress: async () => {
            // This will trigger iOS photo picker to let user select more photos
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          }}
        ]
      );
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Support images and videos
      allowsMultipleSelection: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const files = result.assets.map(asset => {
        const filename = asset.uri.split('/').pop() || 'file';
        const match = /\.(\w+)$/.exec(filename);
        const extension = match ? match[1].toLowerCase() : '';

        // Determine MIME type based on asset type and extension
        let mimeType = 'application/octet-stream';
        if (asset.type === 'image') {
          mimeType = `image/${extension || 'jpeg'}`;
        } else if (asset.type === 'video') {
          mimeType = `video/${extension || 'mp4'}`;
        } else if (extension) {
          // Fallback: infer from extension
          if (['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp'].includes(extension)) {
            mimeType = `image/${extension}`;
          } else if (['mp4', 'mov', 'm4v', 'avi', 'webm'].includes(extension)) {
            mimeType = `video/${extension}`;
          }
        }

        return { uri: asset.uri, name: filename, type: mimeType };
      });
      setSelectedImages({ ...selectedImages, [reqId]: files });
    }
  };

  const takePhoto = async (reqId: number) => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'Please grant camera permissions');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const filename = asset.uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const image = { uri: asset.uri, name: filename, type };

      // Add to existing images or create new array
      const existing = selectedImages[reqId] || [];
      setSelectedImages({ ...selectedImages, [reqId]: [...existing, image] });
    }
  };

  const uploadFiles = async (reqId: number) => {
    const files = selectedImages[reqId];
    if (!files || files.length === 0) {
      Alert.alert('Error', 'Please select at least one file');
      return;
    }

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append('files', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });

      formData.append('requirementId', reqId.toString());

      // Determine completion type from first file (backend will also validate)
      const firstFileType = files[0].type;
      let completionType = 'file';
      if (firstFileType.startsWith('image/')) {
        completionType = 'image';
      } else if (firstFileType.startsWith('video/')) {
        completionType = 'video';
      }
      formData.append('completionType', completionType);

      await taskAPI.addCompletion(taskId, formData);
      setSelectedImages({ ...selectedImages, [reqId]: [] });
      setExpandedReq(null);
      Alert.alert('Success', `${files.length} file(s) uploaded successfully`);
      await loadTask();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to upload files');
    }
  };

  const addTextCompletion = async (reqId: number) => {
    const text = completionTexts[reqId];
    if (!text || !text.trim()) {
      Alert.alert('Error', 'Please enter completion text');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('textContent', text);
      formData.append('completionType', 'text');
      formData.append('requirementId', reqId.toString());

      await taskAPI.addCompletion(taskId, formData);
      setCompletionTexts({ ...completionTexts, [reqId]: '' });
      setExpandedReq(null);
      Alert.alert('Success', 'Completion added successfully');
      await loadTask();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add completion');
    }
  };

  const handleSubmitTask = async () => {
    Alert.alert(
      'Submit Task',
      'Submit this task for review?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await taskAPI.submit(taskId);
              Alert.alert('Success', 'Task submitted for review');
              await loadTask();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to submit task');
            }
          },
        },
      ]
    );
  };

  const handleReviewTask = async (action: 'approved' | 'rejected') => {
    if (action === 'rejected' && !reviewComments.trim()) {
      Alert.alert('Error', 'Please provide comments for rejection');
      return;
    }

    const confirmMessage = action === 'approved'
      ? 'Approve this task?'
      : 'Reject this task and send it back for revision?';

    Alert.alert(
      action === 'approved' ? 'Approve Task' : 'Reject Task',
      confirmMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approved' ? 'Approve' : 'Reject',
          style: action === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await taskAPI.review(taskId, action, reviewComments);
              Alert.alert('Success', `Task ${action} successfully`);
              setReviewComments('');
              await loadTask();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to review task');
            }
          },
        },
      ]
    );
  };

  const handleDeleteTask = async () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // Check if task has completions with files
            const hasFiles = task?.completions?.some(c => c.file_path);
            let deleteFiles = false;

            if (hasFiles) {
              // Show second confirmation for files
              Alert.alert(
                'Delete Files',
                'This task has uploaded files. Do you want to delete the files as well?\n\nSelect "Delete Files" to remove them from the server, or "Keep Files" to preserve them.',
                [
                  {
                    text: 'Keep Files',
                    onPress: async () => {
                      await performDeleteTask(false);
                    },
                  },
                  {
                    text: 'Delete Files',
                    style: 'destructive',
                    onPress: async () => {
                      await performDeleteTask(true);
                    },
                  },
                ],
                { cancelable: false }
              );
            } else {
              await performDeleteTask(false);
            }
          },
        },
      ]
    );
  };

  const performDeleteTask = async (deleteFiles: boolean) => {
    try {
      await taskAPI.delete(taskId, deleteFiles);
      Alert.alert('Success', 'Task deleted successfully', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to delete task');
    }
  };

  if (loading || !task) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in_progress':
        return '#2196F3';
      case 'submitted':
        return '#9C27B0';
      case 'overdue':
        return '#f44336';
      default:
        return '#FF9800';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{task.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
            <Text style={styles.statusText}>{task.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {task.details && (
          <Text style={[styles.details, { color: colors.textSecondary }]}>{task.details}</Text>
        )}

        <View style={[styles.meta, { backgroundColor: colors.cardBg }]}>
          {task.assigned_user_name && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Assigned to: {task.assigned_user_name}</Text>
          )}
          {task.created_by_name && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>Created by: {task.created_by_name}</Text>
          )}
          {task.end_date && (
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              Due: {new Date(task.end_date).toLocaleDateString()}
            </Text>
          )}
        </View>

        {task.requirements && task.requirements.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Requirements & Completions</Text>
              {task.completions && task.completions.length > 0 && (
                <Button
                  title="View All"
                  onPress={() => navigation.navigate('TaskCompletions', { taskId: task.id })}
                  variant="secondary"
                />
              )}
            </View>
            {task.requirements.map((req) => {
              const reqCompletions = getRequirementCompletions(req.id);
              const isExpanded = expandedReq === req.id;

              return (
                <View key={req.id} style={[styles.requirementCard, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
                  <View style={styles.requirementHeader}>
                    <TouchableOpacity
                      style={styles.requirementItem}
                      onPress={() => toggleRequirement(req)}
                    >
                      <View style={[styles.checkbox, req.completed && styles.checkboxChecked, { borderColor: colors.borderMedium }]}>
                        {req.completed && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.requirementText, { color: colors.textPrimary }, req.completed && styles.completedText]}>
                        {req.description}
                      </Text>
                    </TouchableOpacity>
                    {!req.completed && (
                      <Button
                        title={isExpanded ? 'Cancel' : '+ Add'}
                        onPress={() => setExpandedReq(isExpanded ? null : req.id)}
                        variant="secondary"
                      />
                    )}
                  </View>

                  {isExpanded && (
                    <View style={[styles.completionForm, { backgroundColor: colors.cardBg, borderColor: colors.borderMedium }]}>
                      <Input
                        label="Text Completion"
                        value={completionTexts[req.id] || ''}
                        onChangeText={(text) => setCompletionTexts({ ...completionTexts, [req.id]: text })}
                        placeholder="Describe what you completed"
                        multiline
                        numberOfLines={3}
                      />
                      <Button title="Add Text" onPress={() => addTextCompletion(req.id)} />

                      <View style={styles.uploadButtons}>
                        <Button title="Take Photo" onPress={() => takePhoto(req.id)} variant="secondary" />
                        <Button title="Pick Media" onPress={() => pickImage(req.id)} variant="secondary" />
                      </View>

                      {selectedImages[req.id] && selectedImages[req.id].length > 0 && (
                        <View style={[styles.selectedFilesSection, { backgroundColor: colors.bgPrimary }]}>
                          <Text style={[styles.selectedFilesText, { color: colors.textSecondary }]}>
                            {selectedImages[req.id].length} file(s) selected
                          </Text>
                          <Button
                            title={`Upload ${selectedImages[req.id].length} file(s)`}
                            onPress={() => uploadFiles(req.id)}
                          />
                        </View>
                      )}
                    </View>
                  )}

                  {reqCompletions.length > 0 && (
                    <View style={[styles.requirementCompletions, { backgroundColor: colors.cardBg }]}>
                      <Text style={styles.completionsTitle}>Completions:</Text>
                      {reqCompletions.map((completion) => {
                        // Parse file paths (can be JSON array or single path)
                        let filePaths: string[] = [];
                        if (completion.file_path) {
                          try {
                            filePaths = JSON.parse(completion.file_path);
                          } catch {
                            filePaths = [completion.file_path];
                          }
                        }

                        return (
                          <View key={completion.id} style={[styles.completionItemInline, { backgroundColor: colors.bgPrimary }]}>
                            <Text style={[styles.completionUser, { color: colors.textPrimary }]}>{completion.user_name}</Text>
                            <Text style={[styles.completionDate, { color: colors.textSecondary }]}>
                              {new Date(completion.completed_at).toLocaleString()}
                            </Text>
                            {completion.text_content && (
                              <Text style={[styles.completionText, { color: colors.textPrimary }]}>{completion.text_content}</Text>
                            )}
                            {filePaths.length > 0 && completion.completion_type === 'image' && (
                              <View style={styles.completionImagesContainer}>
                                {filePaths.map((path, idx) => (
                                  <Image
                                    key={idx}
                                    source={{ uri: `http://localhost:3000${path}` }}
                                    style={styles.completionImageSmall}
                                  />
                                ))}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Submit button for assigned users */}
        {user && task.assigned_user_id === user.id && task.status === 'in_progress' && (
          <View style={[styles.actionSection, { backgroundColor: colors.cardBg }]}>
            <Button
              title="Submit Task for Review"
              onPress={handleSubmitTask}
            />
          </View>
        )}

        {/* Review section for task creators */}
        {user && task.created_by_id === user.id && task.status === 'submitted' && (
          <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Review Submission</Text>
            <Text style={[styles.reviewDescription, { color: colors.textSecondary }]}>
              This task has been submitted for review. You can approve it or send it back for revision.
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Comments (required for rejection)</Text>
            <TextInput
              style={[styles.reviewTextArea, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium, color: colors.textPrimary }]}
              value={reviewComments}
              onChangeText={setReviewComments}
              placeholder="Provide feedback..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.reviewButtons}>
              <Button
                title="Reject - Send Back"
                onPress={() => handleReviewTask('rejected')}
                variant="secondary"
              />
              <Button
                title="Approve & Complete"
                onPress={() => handleReviewTask('approved')}
              />
            </View>
          </View>
        )}

        {/* Audit Log section */}
        <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
          <Button
            title="📜 View Audit Log"
            onPress={() => navigation.navigate('TaskAuditLog', { taskId: task.id })}
            variant="secondary"
          />
        </View>

        {/* Comments Section */}
        <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Discussion ({comments.length})
          </Text>

          {/* Add comment form */}
          <View style={styles.commentForm}>
            <TextInput
              style={[styles.commentInput, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium, color: colors.textPrimary }]}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Add a comment..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Button
              title={submittingComment ? 'Posting...' : 'Post Comment'}
              onPress={handleAddComment}
              disabled={!newComment.trim() || submittingComment}
            />
          </View>

          {/* Comments list */}
          {comments.length === 0 ? (
            <Text style={[styles.noComments, { color: colors.textSecondary }]}>
              No comments yet. Be the first to comment!
            </Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={[styles.commentItem, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>{comment.user_name}</Text>
                  <Text style={[styles.commentDate, { color: colors.textSecondary }]}>
                    {new Date(comment.created_at).toLocaleString()}
                    {comment.is_edited && ' (edited)'}
                  </Text>
                </View>

                {editingCommentId === comment.id ? (
                  <View style={styles.commentEditForm}>
                    <TextInput
                      style={[styles.commentInput, { backgroundColor: colors.cardBg, borderColor: colors.borderMedium, color: colors.textPrimary }]}
                      value={editingCommentText}
                      onChangeText={setEditingCommentText}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <View style={styles.commentEditActions}>
                      <Button
                        title="Cancel"
                        onPress={() => setEditingCommentId(null)}
                        variant="secondary"
                      />
                      <Button
                        title="Save"
                        onPress={() => handleUpdateComment(comment.id)}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.commentContent, { color: colors.textPrimary }]}>{comment.content}</Text>
                    {user && comment.user_id === user.id && (
                      <View style={styles.commentActions}>
                        <TouchableOpacity onPress={() => {
                          setEditingCommentId(comment.id);
                          setEditingCommentText(comment.content);
                        }}>
                          <Text style={[styles.commentActionText, { color: colors.link }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteComment(comment.id)}>
                          <Text style={[styles.commentActionText, { color: '#f44336' }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))
          )}
        </View>

        {/* Delete section for task creators */}
        {user && task.created_by_id === user.id && (
          <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
            <Button
              title="Delete Task"
              onPress={handleDeleteTask}
              variant="danger"
            />
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
    padding: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  details: {
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 24,
  },
  meta: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  metaText: {
    fontSize: 14,
  },
  section: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  requirementCard: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  requirementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requirementText: {
    fontSize: 16,
    flex: 1,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  completionForm: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  selectedFilesSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 6,
  },
  selectedFilesText: {
    fontSize: 14,
    marginBottom: 8,
  },
  requirementCompletions: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  completionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginBottom: 8,
  },
  completionItemInline: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  completionUser: {
    fontSize: 14,
    fontWeight: '600',
  },
  completionDate: {
    fontSize: 12,
    marginVertical: 4,
  },
  completionText: {
    fontSize: 14,
    marginTop: 8,
  },
  completionImagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  completionImageSmall: {
    width: 150,
    height: 150,
    borderRadius: 6,
  },
  actionSection: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  reviewDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reviewTextArea: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  reviewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  // Comment styles
  commentForm: {
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 12,
  },
  noComments: {
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 16,
  },
  commentItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  commentHeader: {
    marginBottom: 8,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 12,
    marginTop: 2,
  },
  commentContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
  },
  commentActionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  commentEditForm: {
    marginTop: 8,
  },
  commentEditActions: {
    flexDirection: 'row',
    gap: 12,
  },
});

export default TaskDetailScreen;
