import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const KEYS = {
  TASKS: 'offline_tasks',
  ORGANIZATIONS: 'offline_organizations',
  ORG_MEMBERS: 'offline_org_members',
  PENDING_ACTIONS: 'offline_pending_actions',
  LAST_SYNC: 'offline_last_sync',
};

// Offline action types
export interface OfflineAction {
  id: string;
  type: 'create_task' | 'update_task' | 'submit_task' | 'update_requirement' | 'create_completion';
  data: any;
  timestamp: number;
  synced: boolean;
}

class OfflineStorage {
  // Tasks
  async getTasks(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline tasks:', error);
      return [];
    }
  }

  async saveTasks(tasks: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
    } catch (error) {
      console.error('Error saving offline tasks:', error);
    }
  }

  async getTask(taskId: number): Promise<any | null> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  async saveTask(task: any): Promise<void> {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === task.id);

    if (index >= 0) {
      tasks[index] = task;
    } else {
      tasks.push(task);
    }

    await this.saveTasks(tasks);
  }

  // Organizations
  async getOrganizations(): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.ORGANIZATIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline organizations:', error);
      return [];
    }
  }

  async saveOrganizations(organizations: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.ORGANIZATIONS, JSON.stringify(organizations));
    } catch (error) {
      console.error('Error saving offline organizations:', error);
    }
  }

  // Organization members
  async getOrgMembers(orgId: number): Promise<any[]> {
    try {
      const data = await AsyncStorage.getItem(`${KEYS.ORG_MEMBERS}_${orgId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting offline org members:', error);
      return [];
    }
  }

  async saveOrgMembers(orgId: number, members: any[]): Promise<void> {
    try {
      await AsyncStorage.setItem(`${KEYS.ORG_MEMBERS}_${orgId}`, JSON.stringify(members));
    } catch (error) {
      console.error('Error saving offline org members:', error);
    }
  }

  // Pending actions (for offline queue)
  async getPendingActions(): Promise<OfflineAction[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PENDING_ACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting pending actions:', error);
      return [];
    }
  }

  async addPendingAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'synced'>): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const newAction: OfflineAction = {
        ...action,
        id: Date.now().toString(),
        timestamp: Date.now(),
        synced: false,
      };
      actions.push(newAction);
      await AsyncStorage.setItem(KEYS.PENDING_ACTIONS, JSON.stringify(actions));
    } catch (error) {
      console.error('Error adding pending action:', error);
    }
  }

  async markActionSynced(actionId: string): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const updated = actions.map(a =>
        a.id === actionId ? { ...a, synced: true } : a
      );
      await AsyncStorage.setItem(KEYS.PENDING_ACTIONS, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking action synced:', error);
    }
  }

  async removeSyncedActions(): Promise<void> {
    try {
      const actions = await this.getPendingActions();
      const pending = actions.filter(a => !a.synced);
      await AsyncStorage.setItem(KEYS.PENDING_ACTIONS, JSON.stringify(pending));
    } catch (error) {
      console.error('Error removing synced actions:', error);
    }
  }

  // Last sync timestamp
  async getLastSync(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(KEYS.LAST_SYNC);
      return data ? parseInt(data, 10) : null;
    } catch (error) {
      console.error('Error getting last sync:', error);
      return null;
    }
  }

  async setLastSync(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.LAST_SYNC, timestamp.toString());
    } catch (error) {
      console.error('Error setting last sync:', error);
    }
  }

  // Clear all offline data
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.TASKS,
        KEYS.ORGANIZATIONS,
        KEYS.PENDING_ACTIONS,
        KEYS.LAST_SYNC,
      ]);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }
}

export default new OfflineStorage();
