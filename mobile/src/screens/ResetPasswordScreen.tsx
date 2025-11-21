import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { authAPI } from '../services/api';

interface ResetPasswordScreenProps {
  navigation: any;
  route: {
    params?: {
      token?: string;
    };
  };
}

const ResetPasswordScreen = ({ navigation, route }: ResetPasswordScreenProps) => {
  const { colors } = useTheme();
  const token = route.params?.token || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setTokenValid(false);
      setValidatingToken(false);
      return;
    }

    try {
      await authAPI.validateResetToken(token);
      setTokenValid(true);
    } catch (error) {
      setTokenValid(false);
    } finally {
      setValidatingToken(false);
    }
  };

  const handleSubmit = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setResetSuccess(true);
      Alert.alert(
        'Password Reset',
        'Your password has been successfully reset. You can now log in with your new password.',
        [
          {
            text: 'Go to Login',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Validating reset link...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!tokenValid) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.error }]}>Invalid Link</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              This password reset link is invalid or has expired.
            </Text>
          </View>

          <View style={styles.form}>
            <Button
              title="Request New Link"
              onPress={() => navigation.navigate('ForgotPassword')}
              variant="primary"
            />

            <Button
              title="Back to Login"
              onPress={() => navigation.navigate('Login')}
              variant="secondary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (resetSuccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.success }]}>Success!</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Your password has been reset successfully.
            </Text>
          </View>

          <View style={styles.form}>
            <Button
              title="Go to Login"
              onPress={() => navigation.navigate('Login')}
              variant="primary"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Reset Password</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your new password
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="New Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter new password"
            secureTextEntry
            autoCapitalize="none"
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Password must be at least 8 characters
          </Text>

          <Button title="Reset Password" onPress={handleSubmit} loading={loading} />

          <Button
            title="Back to Login"
            onPress={() => navigation.navigate('Login')}
            variant="secondary"
          />
        </View>
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
    justifyContent: 'center',
    padding: 20,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    marginTop: 20,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
    marginTop: -8,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default ResetPasswordScreen;
