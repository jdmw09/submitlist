import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { organizationAPI } from '../services/api';
import { Button } from '../components/Button';
import { useTheme } from '../contexts/ThemeContext';

interface Member {
  id: number;
  user_id: number;
  email: string;
  user_name: string;
  role: string;
  joined_at: string;
}

interface TaskSettings {
  default_task_sort: 'due_date' | 'priority';
  hide_completed_tasks: boolean;
  auto_archive_enabled: boolean;
  auto_archive_after_days: number;
  archive_schedule: 'daily' | 'weekly_sunday' | 'weekly_monday';
}

const OrganizationSettingsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [orgName, setOrgName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('member');
  const [taskSettings, setTaskSettings] = useState<TaskSettings>({
    default_task_sort: 'due_date',
    hide_completed_tasks: false,
    auto_archive_enabled: false,
    auto_archive_after_days: 7,
    archive_schedule: 'daily',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    loadOrganizationDetails();
    loadTaskSettings();
  }, []);

  const loadOrganizationDetails = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) {
      navigation.navigate('Organizations');
      return;
    }

    const org = JSON.parse(storedOrg);
    setLoading(true);

    try {
      const response = await organizationAPI.getDetails(org.id);
      setOrgName(response.data.organization.name);
      setUserRole(response.data.userRole);
      setMembers(response.data.members);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskSettings = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    try {
      const response = await organizationAPI.getSettings(org.id);
      const settings = response.data.settings;
      if (settings) {
        setTaskSettings({
          default_task_sort: settings.default_task_sort || 'due_date',
          hide_completed_tasks: settings.hide_completed_tasks || false,
          auto_archive_enabled: settings.auto_archive_enabled || false,
          auto_archive_after_days: settings.auto_archive_after_days || 7,
          archive_schedule: settings.archive_schedule || 'daily',
        });
      }
    } catch (error) {
      console.log('Failed to load task settings:', error);
    }
  };

  const saveTaskSettings = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    setSavingSettings(true);
    try {
      await organizationAPI.updateSettings(org.id, {
        defaultTaskSort: taskSettings.default_task_sort,
        hideCompletedTasks: taskSettings.hide_completed_tasks,
        autoArchiveEnabled: taskSettings.auto_archive_enabled,
        autoArchiveAfterDays: taskSettings.auto_archive_after_days,
        archiveSchedule: taskSettings.archive_schedule,
      });
      Alert.alert('Success', 'Task settings updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const addMember = async () => {
    if (!newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    try {
      await organizationAPI.addMember(org.id, newMemberEmail, newMemberRole);
      setNewMemberEmail('');
      setNewMemberRole('member');
      setShowAddModal(false);
      loadOrganizationDetails();
      Alert.alert('Success', 'Member added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add member');
    }
  };

  const updateRole = async (memberId: number, newRole: string) => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    Alert.alert(
      'Confirm',
      `Change this member's role to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await organizationAPI.updateMemberRole(org.id, memberId, newRole);
              loadOrganizationDetails();
              Alert.alert('Success', 'Member role updated successfully');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to update member role');
            }
          },
        },
      ]
    );
  };

  const removeMember = async (memberId: number, memberName: string) => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) return;
    const org = JSON.parse(storedOrg);

    Alert.alert(
      'Confirm',
      `Remove ${memberName} from this organization?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await organizationAPI.removeMember(org.id, memberId);
              loadOrganizationDetails();
              Alert.alert('Success', 'Member removed successfully');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  const isAdmin = userRole === 'admin';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{orgName} Settings</Text>

        <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.borderMedium }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Members ({members.length})</Text>
            {isAdmin && (
              <Button
                title="+ Add"
                onPress={() => setShowAddModal(true)}
                style={styles.addButton}
              />
            )}
          </View>

          {loading ? (
            <Text style={[styles.loading, { color: colors.textSecondary }]}>Loading members...</Text>
          ) : (
            <View style={styles.membersList}>
              {members.map((member) => (
                <View key={member.user_id} style={[styles.memberCard, { backgroundColor: colors.cardBg, borderColor: colors.borderMedium }]}>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.avatarText}>
                        {(member.user_name || member.email || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberDetails}>
                      <Text style={[styles.memberName, { color: colors.textPrimary }]}>{member.user_name || 'Unknown'}</Text>
                      <Text style={[styles.memberEmail, { color: colors.textSecondary }]}>{member.email}</Text>
                    </View>
                  </View>

                  <View style={styles.memberActions}>
                    {isAdmin ? (
                      <Picker
                        selectedValue={member.role}
                        onValueChange={(value) => updateRole(member.user_id, value)}
                        style={styles.rolePicker}
                      >
                        <Picker.Item label="Admin" value="admin" />
                        <Picker.Item label="Member" value="member" />
                      </Picker>
                    ) : (
                      <View style={[styles.roleBadge, { backgroundColor: colors.bgSecondary }]}>
                        <Text style={[styles.roleBadgeText, { color: colors.primary }]}>{member.role}</Text>
                      </View>
                    )}

                    {isAdmin && members.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removeMember(member.user_id, member.user_name)}
                        style={[styles.removeButton, { backgroundColor: colors.error }]}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {isAdmin && (
          <View style={[styles.section, { backgroundColor: colors.cardBg }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: colors.borderMedium }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Task Settings</Text>
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Default Sort Order</Text>
              <View style={[styles.settingPicker, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
                <Picker
                  selectedValue={taskSettings.default_task_sort}
                  onValueChange={(value) => setTaskSettings({ ...taskSettings, default_task_sort: value })}
                  style={styles.picker}
                >
                  <Picker.Item label="Due Date" value="due_date" />
                  <Picker.Item label="Priority" value="priority" />
                </Picker>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Hide Completed Tasks</Text>
              <Switch
                value={taskSettings.hide_completed_tasks}
                onValueChange={(value) => setTaskSettings({ ...taskSettings, hide_completed_tasks: value })}
                trackColor={{ false: colors.borderMedium, true: colors.primary }}
              />
            </View>

            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Auto-Archive Completed Tasks</Text>
              <Switch
                value={taskSettings.auto_archive_enabled}
                onValueChange={(value) => setTaskSettings({ ...taskSettings, auto_archive_enabled: value })}
                trackColor={{ false: colors.borderMedium, true: colors.primary }}
              />
            </View>

            {taskSettings.auto_archive_enabled && (
              <>
                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Archive After (Days)</Text>
                  <View style={[styles.settingPicker, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
                    <Picker
                      selectedValue={taskSettings.auto_archive_after_days}
                      onValueChange={(value) => setTaskSettings({ ...taskSettings, auto_archive_after_days: value })}
                      style={styles.picker}
                    >
                      <Picker.Item label="1 day" value={1} />
                      <Picker.Item label="3 days" value={3} />
                      <Picker.Item label="7 days" value={7} />
                      <Picker.Item label="14 days" value={14} />
                      <Picker.Item label="30 days" value={30} />
                    </Picker>
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Archive Schedule</Text>
                  <View style={[styles.settingPicker, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
                    <Picker
                      selectedValue={taskSettings.archive_schedule}
                      onValueChange={(value) => setTaskSettings({ ...taskSettings, archive_schedule: value })}
                      style={styles.picker}
                    >
                      <Picker.Item label="Daily" value="daily" />
                      <Picker.Item label="Weekly (Sunday)" value="weekly_sunday" />
                      <Picker.Item label="Weekly (Monday)" value="weekly_monday" />
                    </Picker>
                  </View>
                </View>
              </>
            )}

            <Button
              title={savingSettings ? "Saving..." : "Save Settings"}
              onPress={saveTaskSettings}
              disabled={savingSettings}
              style={styles.saveButton}
            />
          </View>
        )}

        <Button
          title="Back to Tasks"
          onPress={() => navigation.goBack()}
          variant="secondary"
          style={styles.backButton}
        />
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Member</Text>

            <Text style={[styles.label, { color: colors.textPrimary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium, color: colors.textPrimary }]}
              value={newMemberEmail}
              onChangeText={setNewMemberEmail}
              placeholder="member@example.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={[styles.label, { color: colors.textPrimary }]}>Role</Text>
            <View style={[styles.pickerContainer, { backgroundColor: colors.bgPrimary, borderColor: colors.borderMedium }]}>
              <Picker
                selectedValue={newMemberRole}
                onValueChange={setNewMemberRole}
                style={styles.picker}
              >
                <Picker.Item label="Member" value="member" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowAddModal(false)}
                variant="secondary"
                style={styles.modalButton}
              />
              <Button
                title="Add Member"
                onPress={addMember}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
  },
  loading: {
    textAlign: 'center',
    padding: 40,
  },
  membersList: {
    gap: 16,
  },
  memberCard: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rolePicker: {
    flex: 1,
    height: 40,
  },
  roleBadge: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  roleBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  removeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  removeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    marginBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 12,
    padding: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  settingPicker: {
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 140,
  },
  saveButton: {
    marginTop: 20,
  },
});

export default OrganizationSettingsScreen;
