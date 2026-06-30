import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { ensureAuth, pb } from './pb';

const COLLECTION = 'push_tokens';

function getProjectId() {
  return Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
}

export async function registerPushToken(): Promise<void> {
  try {
    await ensureAuth();
    if (!Device.isDevice) return;
    const user = pb.authStore.record?.id;
    if (!user) return;

    const projectId = getProjectId();
    if (!projectId) return;

    const current = await Notifications.getPermissionsAsync();
    const finalStatus = current.status === 'granted'
      ? current.status
      : (await Notifications.requestPermissionsAsync()).status;
    if (finalStatus !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return;

    try {
      await pb.collection(COLLECTION).create({ user, token });
    } catch (error) {
      if (typeof error === 'object' && error && 'status' in error && error.status === 400) return;
      throw error;
    }
  } catch {
    // Push registration must never block login or app startup.
  }
}
