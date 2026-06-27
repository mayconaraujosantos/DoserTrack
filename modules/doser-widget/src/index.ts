import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

interface DoserWidgetNativeModule {
  writeWidgetData(json: string): Promise<void>;
  requestWidgetUpdate(): Promise<void>;
}

let nativeModule: DoserWidgetNativeModule | null = null;

function getModule(): DoserWidgetNativeModule | null {
  if (Platform.OS === 'web') return null;
  if (!nativeModule) {
    try {
      nativeModule = requireNativeModule('DoserWidget');
    } catch {
      return null;
    }
  }
  return nativeModule;
}

export async function writeWidgetData(json: string): Promise<void> {
  await getModule()?.writeWidgetData(json);
}

export async function requestWidgetUpdate(): Promise<void> {
  await getModule()?.requestWidgetUpdate();
}
