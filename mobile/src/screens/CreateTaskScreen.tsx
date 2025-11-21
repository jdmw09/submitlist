import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { taskAPI, organizationAPI } from '../services/api';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const CreateTaskScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [scheduleType, setScheduleType] = useState<'one_time' | 'daily' | 'weekly' | 'monthly'>('one_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [assignedUserIds, setAssignedUserIds] = useState<number[]>([]);
  const [groupId, setGroupId] = useState<number | undefined>();
  const [isPrivate, setIsPrivate] = useState(false);
  const [orgMembers, setOrgMembers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOrgMembers();
    loadGroups();
  }, []);

  const loadOrgMembers = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (storedOrg) {
      const org = JSON.parse(storedOrg);
      try {
        const response = await organizationAPI.getMembers(org.id);
        setOrgMembers(response.data.members);
      } catch (error) {
        console.error('Failed to load organization members');
      }
    }
  };

  const loadGroups = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (storedOrg) {
      const org = JSON.parse(storedOrg);
      try {
        const response = await organizationAPI.getGroups(org.id);
        setGroups(response.data.groups || []);
      } catch (error) {
        console.error('Failed to load groups');
      }
    }
  };

  const addRequirement = () => {
    setRequirements([...requirements, '']);
  };

  const updateRequirement = (index: number, value: string) => {
    const updated = [...requirements];
    updated[index] = value;
    setRequirements(updated);
  };

  const removeRequirement = (index: number) => {
    setRequirements(requirements.filter((_, i) => i !== index));
  };

  const toggleAssignee = (userId: number) => {
    if (assignedUserIds.includes(userId)) {
      setAssignedUserIds(assignedUserIds.filter(id => id !== userId));
    } else {
      setAssignedUserIds([...assignedUserIds, userId]);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    const stored = await AsyncStorage.getItem('selectedOrganization');
    if (!stored) {
      Alert.alert('Error', 'No organization selected');
      return;
    }

    const org = JSON.parse(stored);
    const validRequirements = requirements.filter(r => r.trim());

    setLoading(true);
    try {
      await taskAPI.create({
        organizationId: org.id,
        title,
        details,
        requirements: validRequirements,
        scheduleType,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        assignedUserIds: assignedUserIds.length > 0 ? assignedUserIds : undefined,
        groupId: groupId || undefined,
        isPrivate,
      });

      Alert.alert('Success', 'Task created successfully');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <ScrollView style={styles.content}>
        <Input
          label="Task Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Enter task title"
        />

        <Input
          label="Details"
          value={details}
          onChangeText={setDetails}
          placeholder="Enter task details"
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        {scheduleType === 'one_time' ? (
          <Input
            label="Due Date"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
          />
        ) : (
          <View style={styles.dateRow}>
            <View style={styles.dateInput}>
              <Input
                label="Start Date"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.dateInput}>
              <Input
                label="End Date (optional)"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
        )}

        <Text style={[styles.label, { color: colors.textPrimary }]}>Assign To Group (optional)</Text>
        <View style={[styles.pickerContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Picker
            selectedValue={groupId}
            onValueChange={(itemValue) => setGroupId(itemValue || undefined)}
            style={styles.picker}
          >
            <Picker.Item label="No group" value={undefined} />
            {groups.map((group) => (
              <Picker.Item
                key={group.id}
                label={`${group.name} (${group.member_count} members)`}
                value={group.id}
              />
            ))}
          </Picker>
        </View>
        <Text style={[styles.helperText, { color: colors.textSecondary }]}>
          Selecting a group will automatically assign all group members
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Assign To Members (optional)</Text>
        <View style={[styles.assigneeList, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          {orgMembers.length === 0 ? (
            <Text style={[styles.noMembers, { color: colors.textSecondary }]}>
              No organization members found
            </Text>
          ) : (
            orgMembers.map((member) => (
              <TouchableOpacity
                key={member.user_id}
                style={[styles.assigneeItem, { borderBottomColor: colors.border }]}
                onPress={() => toggleAssignee(member.user_id)}
              >
                <View style={[
                  styles.checkbox,
                  { borderColor: colors.border },
                  assignedUserIds.includes(member.user_id) && styles.checkboxChecked
                ]}>
                  {assignedUserIds.includes(member.user_id) && (
                    <Icon name="check" size={18} color="#fff" />
                  )}
                </View>
                <Text style={[styles.assigneeText, { color: colors.textPrimary }]}>
                  {member.user_name} ({member.role})
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
        {assignedUserIds.length > 0 && (
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {assignedUserIds.length} member(s) selected
          </Text>
        )}

        <TouchableOpacity
          style={[styles.checkboxRow, { backgroundColor: colors.cardBg }]}
          onPress={() => setIsPrivate(!isPrivate)}
        >
          <View style={[
            styles.checkbox,
            { borderColor: colors.border },
            isPrivate && styles.checkboxChecked
          ]}>
            {isPrivate && <Icon name="check" size={18} color="#fff" />}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.textPrimary }]}>
            Private Task (only assigned members can see this task)
          </Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Requirements</Text>
        {requirements.map((req, index) => (
          <View key={index} style={styles.requirementRow}>
            <Input
              value={req}
              onChangeText={(value) => updateRequirement(index, value)}
              placeholder={`Requirement ${index + 1}`}
              style={styles.requirementInput}
            />
            {requirements.length > 1 && (
              <TouchableOpacity
                onPress={() => removeRequirement(index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>×</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        <Button title="+ Add Requirement" onPress={addRequirement} variant="secondary" />

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Schedule Type</Text>
        <View style={styles.scheduleButtons}>
          {['one_time', 'daily', 'weekly', 'monthly'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.scheduleButton,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
                scheduleType === type && styles.scheduleButtonActive,
              ]}
              onPress={() => setScheduleType(type as any)}
            >
              <Text
                style={[
                  styles.scheduleButtonText,
                  { color: colors.textSecondary },
                  scheduleType === type && styles.scheduleButtonTextActive,
                ]}
              >
                {type.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {scheduleType !== 'one_time' && (
          <View style={[styles.scheduleInfo, { backgroundColor: colors.infoBg, borderLeftColor: colors.infoBorder }]}>
            <Text style={[styles.scheduleInfoText, { color: colors.infoText }]}>
              <Text style={[styles.scheduleInfoBold, { color: colors.infoText }]}>Recurring Task: </Text>
              This task will automatically generate new instances{' '}
              {scheduleType === 'daily' && 'every day'}
              {scheduleType === 'weekly' && 'every week'}
              {scheduleType === 'monthly' && 'every month'}
              {startDate && ' starting on the specified start date'}
              {endDate && ' and ending on the end date'}.
              {!endDate && ' with no end date (continues indefinitely)'}.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button title="Cancel" onPress={() => navigation.goBack()} variant="secondary" />
          <Button title="Create Task" onPress={handleCreate} loading={loading} />
        </View>
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 8,
  },
  dateInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  pickerContainer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  picker: {
    height: 50,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementInput: {
    flex: 1,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f44336',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 24,
  },
  scheduleButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  scheduleButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  scheduleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  scheduleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  scheduleButtonTextActive: {
    color: '#fff',
  },
  scheduleInfo: {
    marginTop: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderRadius: 4,
    marginBottom: 16,
  },
  scheduleInfoText: {
    fontSize: 14,
    lineHeight: 20,
  },
  scheduleInfoBold: {
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 20,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  assigneeList: {
    maxHeight: 300,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  assigneeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
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
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  assigneeText: {
    flex: 1,
    fontSize: 14,
  },
  noMembers: {
    textAlign: 'center',
    padding: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
  },
});

export default CreateTaskScreen;
