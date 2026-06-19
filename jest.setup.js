// react-native-reanimated
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
  })),
  useLocalSearchParams: jest.fn(() => ({})),
  Link: ({ children }) => children,
  Stack: { Screen: () => null },
}));

// expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

// expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

// expo-image-picker
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
}));

// lib/supabase — mock do cliente Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));

// lib/storage
jest.mock('@/lib/storage', () => ({
  hasSeenOnboarding: jest.fn(() => Promise.resolve(false)),
  markOnboardingDone: jest.fn(() => Promise.resolve()),
  getStoredActiveProfileId: jest.fn(() => Promise.resolve(null)),
  setStoredActiveProfileId: jest.fn(() => Promise.resolve()),
}));

// lib/sync
jest.mock('@/lib/sync', () => ({
  syncToCloud: jest.fn(() => Promise.resolve()),
  pullFromCloud: jest.fn(() => Promise.resolve()),
}));

// react-native safe area context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

// @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// hooks/use-theme
jest.mock('@/hooks/use-theme', () => ({
  useTheme: () => ({
    primary: '#5D54FF',
    success: '#27AE60',
    warning: '#F39C12',
    danger: '#E74C3C',
    bg: '#F2F8FF',
    card: '#FFFFFF',
    text: '#000000',
    sub: '#888888',
    border: '#E8EBED',
  }),
}));

// hooks/use-color-scheme
jest.mock('@/hooks/use-color-scheme', () => ({
  useColorScheme: () => 'light',
}));
