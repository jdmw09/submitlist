import NetInfo from '@react-native-community/netinfo';
import offlineStorage, { OfflineAction } from './offlineStorage';
import { taskAPI, organizationAPI } from './api';

class NetworkService {
  private isOnline: boolean = true;
  private listeners: Array<(isOnline: boolean) => void> = [];

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Subscribe to network state updates
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline));

      // If we just came back online, sync pending actions
      if (wasOffline && this.isOnline) {
        this.syncPendingActions();
      }
    });
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Sync pending offline actions when back online
  async syncPendingActions(): Promise<void> {
    if (!this.isOnline) {
      console.log('Cannot sync - offline');
      return;
    }

    console.log('Starting sync of pending actions...');

    try {
      const actions = await offlineStorage.getPendingActions();
      const unsyncedActions = actions.filter(a => !a.synced);

      for (const action of unsyncedActions) {
        try {
          await this.executeAction(action);
          await offlineStorage.markActionSynced(action.id);
        } catch (error) {
          console.error('Failed to sync action:', action.type, error);
          // Don't throw - continue with other actions
        }
      }

      // Remove synced actions
      await offlineStorage.removeSyncedActions();
      await offlineStorage.setLastSync(Date.now());

      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  private async executeAction(action: OfflineAction): Promise<void> {
    console.log('Executing action:', action.type);

    switch (action.type) {
      case 'create_task':
        await taskAPI.create(action.data);
        break;

      case 'update_task':
        const { taskId, ...updateData } = action.data;
        await taskAPI.update(taskId, updateData);
        break;

      case 'submit_task':
        await taskAPI.submit(action.data.taskId);
        break;

      case 'update_requirement':
        const { requirementId, completed } = action.data;
        await taskAPI.updateRequirement(requirementId, completed);
        break;

      case 'create_completion':
        const { taskId: completionTaskId, formData } = action.data;
        await taskAPI.addCompletion(completionTaskId, formData);
        break;

      default:
        console.warn('Unknown action type:', action.type);
    }
  }

  // Check if we should use offline mode
  shouldUseOffline(): boolean {
    return !this.isOnline;
  }
}

export default new NetworkService();
