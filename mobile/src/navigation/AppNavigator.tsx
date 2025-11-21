import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import OrganizationsScreen from '../screens/OrganizationsScreen';
import OrganizationSettingsScreen from '../screens/OrganizationSettingsScreen';
import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import TaskCompletionsScreen from '../screens/TaskCompletionsScreen';
import TaskAuditLogScreen from '../screens/TaskAuditLogScreen';
import CreateTaskScreen from '../screens/CreateTaskScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const OrganizationStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="OrganizationsList"
      component={OrganizationsScreen}
      options={{ title: 'Organizations' }}
    />
    <Stack.Screen
      name="OrganizationSettings"
      component={OrganizationSettingsScreen}
      options={{ title: 'Organization Settings' }}
    />
  </Stack.Navigator>
);

const TaskStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="TaskList"
      component={TaskListScreen}
      options={{ title: 'Tasks' }}
    />
    <Stack.Screen
      name="TaskDetail"
      component={TaskDetailScreen}
      options={{ title: 'Task Details' }}
    />
    <Stack.Screen
      name="TaskCompletions"
      component={TaskCompletionsScreen}
      options={{ title: 'Task Completions' }}
    />
    <Stack.Screen
      name="TaskAuditLog"
      component={TaskAuditLogScreen}
      options={{ title: 'Audit Log' }}
    />
    <Stack.Screen
      name="CreateTask"
      component={CreateTaskScreen}
      options={{ title: 'Create Task' }}
    />
  </Stack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator>
    <Tab.Screen
      name="Organizations"
      component={OrganizationStack}
      options={{ headerShown: false }}
    />
    <Tab.Screen
      name="Tasks"
      component={TaskStack}
      options={{ headerShown: false }}
    />
    <Tab.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ title: 'Notifications' }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
  </Tab.Navigator>
);

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="Onboarding" component={OnboardingScreen} />
  </Stack.Navigator>
);

export const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Or a loading screen
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};
