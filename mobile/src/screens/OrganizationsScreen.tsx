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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { organizationAPI } from '../services/api';
import { Organization } from '../types';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

const OrganizationsScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

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
            <Text style={[styles.settingsButtonText, { color: colors.textPrimary }]}>⚙️ Settings</Text>
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
});

export default OrganizationsScreen;
