import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { organizationAPI } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';

interface PublicOrganization {
  id: number;
  name: string;
  description: string;
  member_count: number;
  created_at: string;
}

const OnboardingScreen = ({ navigation }: any) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<'choice' | 'invite' | 'browse' | 'create'>('choice');
  const [inviteCode, setInviteCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Browse organizations state
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    if (step === 'browse') {
      loadPublicOrganizations();
    }
  }, [step, searchQuery]);

  const loadPublicOrganizations = async () => {
    try {
      const response = await organizationAPI.getPublicOrganizations(searchQuery);
      setOrganizations(response.data.organizations);
    } catch (err) {
      console.error('Failed to load organizations:', err);
    }
  };

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }

    setLoading(true);
    try {
      await organizationAPI.acceptInvite(inviteCode);
      Alert.alert('Success', 'Successfully joined organization!', [
        { text: 'OK', onPress: () => navigation.replace('Organizations') }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to join organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      Alert.alert('Error', 'Please enter an organization name');
      return;
    }

    setLoading(true);
    try {
      const response = await organizationAPI.create(orgName, orgDescription, true, false);
      await AsyncStorage.setItem('selectedOrganization', JSON.stringify(response.data.organization));
      Alert.alert('Success', 'Organization created successfully!', [
        { text: 'OK', onPress: () => navigation.replace('Organizations') }
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestToJoin = async (organizationId: number) => {
    setLoading(true);
    try {
      await organizationAPI.createJoinRequest(organizationId, joinMessage);
      Alert.alert(
        'Success',
        'Join request submitted successfully! You will be notified when an admin reviews your request.',
        [{ text: 'OK', onPress: () => navigation.replace('Organizations') }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to submit join request');
    } finally {
      setLoading(false);
    }
  };

  const renderChoiceStep = () => (
    <View style={styles.stepContainer}>
      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
        Welcome! Let's Get Started
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Choose how you'd like to proceed:
      </Text>

      <TouchableOpacity
        style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
        onPress={() => setStep('invite')}
      >
        <Text style={styles.choiceIcon}>📬</Text>
        <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
          Join with Invite Code
        </Text>
        <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
          Have an invite code? Join an existing organization instantly.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
        onPress={() => setStep('browse')}
      >
        <Text style={styles.choiceIcon}>🔍</Text>
        <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
          Browse Organizations
        </Text>
        <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
          Find and request to join public organizations.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.choiceCard, { backgroundColor: colors.cardBg }]}
        onPress={() => setStep('create')}
      >
        <Text style={styles.choiceIcon}>➕</Text>
        <Text style={[styles.choiceTitle, { color: colors.textPrimary }]}>
          Create New Organization
        </Text>
        <Text style={[styles.choiceDescription, { color: colors.textSecondary }]}>
          Start your own organization and invite others.
        </Text>
      </TouchableOpacity>

      <Button
        title="Skip for Now"
        onPress={() => navigation.replace('Organizations')}
        variant="secondary"
      />
    </View>
  );

  const renderInviteStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={() => setStep('choice')} style={styles.backButton}>
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
        Join with Invite Code
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Enter the invite code you received:
      </Text>

      <Input
        label="Invite Code"
        value={inviteCode}
        onChangeText={(text) => setInviteCode(text.toUpperCase())}
        placeholder="XXXX-XXXX-XXXX-XXXX"
        maxLength={19}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      <Button
        title="Join Organization"
        onPress={handleJoinWithCode}
        loading={loading}
      />
    </View>
  );

  const renderBrowseStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={() => setStep('choice')} style={styles.backButton}>
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
        Browse Organizations
      </Text>

      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search organizations..."
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.searchInput,
          {
            backgroundColor: colors.cardBg,
            color: colors.textPrimary,
            borderColor: colors.border,
          },
        ]}
      />

      <ScrollView style={styles.organizationsList} showsVerticalScrollIndicator={false}>
        {organizations.length === 0 ? (
          <Text style={[styles.noResults, { color: colors.textSecondary }]}>
            No public organizations found
          </Text>
        ) : (
          organizations.map((org) => (
            <View key={org.id} style={[styles.organizationCard, { backgroundColor: colors.cardBg }]}>
              <View style={styles.orgInfo}>
                <Text style={[styles.orgName, { color: colors.textPrimary }]}>{org.name}</Text>
                <Text style={[styles.orgDescription, { color: colors.textSecondary }]}>
                  {org.description || 'No description provided'}
                </Text>
                <Text style={[styles.memberCount, { color: colors.textSecondary }]}>
                  {org.member_count} members
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.joinButton, { backgroundColor: colors.primary }]}
                onPress={() => setSelectedOrgId(org.id)}
              >
                <Text style={styles.joinButtonText}>Request to Join</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {selectedOrgId && (
        <View style={[styles.joinRequestForm, { backgroundColor: colors.cardBg }]}>
          <Text style={[styles.joinRequestTitle, { color: colors.textPrimary }]}>
            Request to Join
          </Text>
          <TextInput
            value={joinMessage}
            onChangeText={setJoinMessage}
            placeholder="Tell the admins why you want to join (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            style={[
              styles.messageInput,
              {
                backgroundColor: colors.bgPrimary,
                color: colors.textPrimary,
                borderColor: colors.border,
              },
            ]}
          />
          <View style={styles.formActions}>
            <Button
              title="Cancel"
              onPress={() => setSelectedOrgId(null)}
              variant="secondary"
            />
            <Button
              title="Submit Request"
              onPress={() => handleRequestToJoin(selectedOrgId)}
              loading={loading}
            />
          </View>
        </View>
      )}
    </View>
  );

  const renderCreateStep = () => (
    <View style={styles.stepContainer}>
      <TouchableOpacity onPress={() => setStep('choice')} style={styles.backButton}>
        <Text style={[styles.backButtonText, { color: colors.primary }]}>← Back</Text>
      </TouchableOpacity>

      <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
        Create New Organization
      </Text>
      <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
        Choose a name for your organization:
      </Text>

      <Input
        label="Organization Name"
        value={orgName}
        onChangeText={setOrgName}
        placeholder="My Organization"
        maxLength={100}
      />

      <TextInput
        value={orgDescription}
        onChangeText={setOrgDescription}
        placeholder="Description (optional)"
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
        maxLength={500}
        style={[
          styles.messageInput,
          {
            backgroundColor: colors.cardBg,
            color: colors.textPrimary,
            borderColor: colors.border,
          },
        ]}
      />

      <Button
        title="Create Organization"
        onPress={handleCreateOrganization}
        loading={loading}
      />
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {step === 'choice' && renderChoiceStep()}
          {step === 'invite' && renderInviteStep()}
          {step === 'browse' && renderBrowseStep()}
          {step === 'create' && renderCreateStep()}
        </ScrollView>
      </KeyboardAvoidingView>
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
  stepContainer: {
    gap: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  choiceCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  choiceIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  choiceDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  searchInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: 16,
  },
  organizationsList: {
    maxHeight: 400,
    marginBottom: 16,
  },
  organizationCard: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    flexDirection: 'column',
    gap: 12,
  },
  orgInfo: {
    gap: 4,
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
  },
  orgDescription: {
    fontSize: 14,
  },
  memberCount: {
    fontSize: 12,
    marginTop: 4,
  },
  joinButton: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  noResults: {
    textAlign: 'center',
    fontSize: 14,
    padding: 32,
  },
  joinRequestForm: {
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  joinRequestTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  messageInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});

export default OnboardingScreen;
