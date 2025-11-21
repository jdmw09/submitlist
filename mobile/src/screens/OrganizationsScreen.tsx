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
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { organizationAPI } from '../services/api';
import { Organization } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface PublicOrganization {
  id: number;
  name: string;
  description?: string;
  member_count: number;
}

const OrganizationsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  // Join organization state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [availableOrgs, setAvailableOrgs] = useState<PublicOrganization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<PublicOrganization | null>(null);
  const [joinMessage, setJoinMessage] = useState('');
  const [loadingAvailableOrgs, setLoadingAvailableOrgs] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const response = await organizationAPI.getAll();
      setOrganizations(response.data.organizations);

      // Store first organization as selected if none exists
      if (response.data.organizations.length > 0) {
        const stored = await AsyncStorage.getItem('selectedOrganization');
        if (!stored) {
          await AsyncStorage.setItem(
            'selectedOrganization',
            JSON.stringify(response.data.organizations[0])
          );
        }
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrganizations();
    setRefreshing(false);
  }, []);

  const selectOrganization = async (org: Organization) => {
    await AsyncStorage.setItem('selectedOrganization', JSON.stringify(org));
    navigation.navigate('Tasks');
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    try {
      await organizationAPI.create(newOrgName);
      setNewOrgName('');
      setShowCreateModal(false);
      await loadOrganizations();
      Alert.alert('Success', 'Organization created successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to create organization');
    }
  };

  const loadAvailableOrganizations = async () => {
    setLoadingAvailableOrgs(true);
    try {
      const response = await organizationAPI.getPublicOrganizations();
      const publicOrgs: PublicOrganization[] = response.data.organizations || [];
      // Filter out organizations the user is already a member of
      const memberOrgIds = new Set(organizations.map(org => org.id));
      const available = publicOrgs.filter(org => !memberOrgIds.has(org.id));
      setAvailableOrgs(available);
    } catch (error: any) {
      console.error('Failed to load available organizations:', error);
      setAvailableOrgs([]);
    } finally {
      setLoadingAvailableOrgs(false);
    }
  };

  const openJoinModal = () => {
    setShowJoinModal(true);
    loadAvailableOrganizations();
  };

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setSelectedOrg(null);
    setJoinMessage('');
  };

  const handleJoinRequest = async () => {
    if (!selectedOrg) {
      Alert.alert('Error', 'Please select an organization to join');
      return;
    }

    try {
      await organizationAPI.createJoinRequest(selectedOrg.id, joinMessage);
      Alert.alert('Success', 'Join request sent successfully! You will be notified when it is reviewed.');
      closeJoinModal();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to send join request');
    }
  };

  const renderOrganization = ({ item }: { item: Organization }) => (
    <TouchableOpacity
      style={[styles.orgCard, { backgroundColor: colors.cardBg }]}
      onPress={() => selectOrganization(item)}
    >
      <View style={styles.orgContent}>
        <Text style={[styles.orgName, { color: colors.textPrimary }]}>{item.name}</Text>
        <Text style={[styles.orgRole, { color: colors.textSecondary }]}>{item.role}</Text>
      </View>
      <Text style={[styles.arrow, { color: colors.primary }]}>→</Text>
    </TouchableOpacity>
  );

  const navigateToSettings = async () => {
    const storedOrg = await AsyncStorage.getItem('selectedOrganization');
    if (!storedOrg) {
      Alert.alert('Info', 'Please select an organization first');
      return;
    }
    navigation.navigate('OrganizationSettings');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.borderMedium }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Organizations</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: colors.bgSecondary }]}
            onPress={navigateToSettings}
          >
            <Text style={[styles.settingsButtonText, { color: colors.textPrimary }]}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.joinButton, { backgroundColor: colors.bgSecondary, borderColor: colors.primary }]}
            onPress={openJoinModal}
          >
            <Text style={[styles.joinButtonText, { color: colors.primary }]}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.addButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showCreateModal && (
        <View style={[styles.createModal, { backgroundColor: colors.cardBg }]}>
          <Input
            label="Organization Name"
            value={newOrgName}
            onChangeText={setNewOrgName}
            placeholder="Enter organization name"
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={() => {
                setShowCreateModal(false);
                setNewOrgName('');
              }}
              variant="secondary"
            />
            <Button title="Create" onPress={createOrganization} />
          </View>
        </View>
      )}

      {/* Join Organization Modal */}
      <Modal
        visible={showJoinModal}
        animationType="slide"
        transparent={true}
        onRequestClose={closeJoinModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.joinModal, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Join Organization</Text>

            {loadingAvailableOrgs ? (
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading organizations...</Text>
            ) : availableOrgs.length === 0 ? (
              <View style={[styles.naContainer, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.naText, { color: colors.textSecondary }]}>N/A - No organizations available to join</Text>
              </View>
            ) : (
              <>
                <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Select an organization:</Text>
                <ScrollView style={styles.orgList} showsVerticalScrollIndicator={false}>
                  {availableOrgs.map((org) => (
                    <TouchableOpacity
                      key={org.id}
                      style={[
                        styles.orgOption,
                        {
                          backgroundColor: selectedOrg?.id === org.id ? colors.primary + '20' : colors.bgSecondary,
                          borderColor: selectedOrg?.id === org.id ? colors.primary : colors.borderLight,
                        }
                      ]}
                      onPress={() => setSelectedOrg(org)}
                    >
                      <Text style={[styles.orgOptionName, { color: colors.textPrimary }]}>{org.name}</Text>
                      <Text style={[styles.orgOptionMembers, { color: colors.textSecondary }]}>
                        {org.member_count} members
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {selectedOrg && (
                  <View style={styles.messageContainer}>
                    <Text style={[styles.selectLabel, { color: colors.textSecondary }]}>Message (optional):</Text>
                    <TextInput
                      style={[styles.messageInput, {
                        backgroundColor: colors.bgSecondary,
                        color: colors.textPrimary,
                        borderColor: colors.borderLight,
                      }]}
                      value={joinMessage}
                      onChangeText={setJoinMessage}
                      placeholder="Why do you want to join this organization?"
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                )}
              </>
            )}

            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={closeJoinModal} variant="secondary" />
              <Button
                title="Request to Join"
                onPress={handleJoinRequest}
                disabled={!selectedOrg || availableOrgs.length === 0}
              />
            </View>
          </View>
        </View>
      </Modal>

      <FlatList
        data={organizations}
        renderItem={renderOrganization}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No organizations yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>Create one to get started</Text>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  settingsButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  createModal: {
    padding: 20,
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  list: {
    padding: 16,
  },
  orgCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  orgContent: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  orgRole: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
  arrow: {
    fontSize: 24,
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
  // Join button styles
  joinButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  joinButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Join modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinModal: {
    width: '90%',
    maxHeight: '80%',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 20,
  },
  naContainer: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  naText: {
    fontSize: 14,
  },
  selectLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  orgList: {
    maxHeight: 200,
  },
  orgOption: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  orgOptionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orgOptionMembers: {
    fontSize: 12,
    marginTop: 4,
  },
  messageContainer: {
    marginTop: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});

export default OrganizationsScreen;
