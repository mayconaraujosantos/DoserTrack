# Skill: Authentication & Biometrics Setup

## Overview

Guide for implementing secure authentication with Supabase, biometric authentication, and session management.

## When to Use This Skill

- Setting up Supabase authentication
- Implementing biometric (Face/Fingerprint) authentication
- Configuring secure token storage
- Handling auth errors and session timeouts
- Testing auth flows

## Supabase Authentication Setup

### Initialize Supabase Client

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. ' +
      'Check your .env file with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    storage: {
      getItem: async (key: string) => {
        try {
          return await SecureStore.getItemAsync(key);
        } catch {
          return null;
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch (error) {
          console.error('Failed to store session:', error);
        }
      },
      removeItem: async (key: string) => {
        try {
          await SecureStore.deleteItemAsync(key);
        } catch {
          return;
        }
      },
    },
  },
});
```

### Email/Password Authentication

```typescript
// lib/auth.ts
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.user) {
      return { success: false, error: 'Sign up failed' };
    }

    return { success: true };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session) {
      return { success: false, error: 'No session created' };
    }

    // Session automatically stored via custom storage
    return { success: true };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

export async function signOut(): Promise<void> {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign out error:', error);
    }
  } catch (error) {
    console.error('Sign out failed:', error);
  }
}

export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Get user error:', error);
      return null;
    }
    return data.user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}
```

### Password Reset Flow

```typescript
export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${DEEP_LINK_SCHEME}://reset-password`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Password reset request error:', error);
    return { success: false, error: 'Failed to request password reset' };
  }
}

export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Update password error:', error);
    return { success: false, error: 'Failed to update password' };
  }
}
```

## Biometric Authentication

### Setup Biometric Support

```typescript
// lib/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    return compatible;
  } catch (error) {
    console.error('Biometric check error:', error);
    return false;
  }
}

export async function getSupportedBiometricTypes(): Promise<
  LocalAuthentication.AuthenticationType[]
> {
  try {
    return await LocalAuthentication.supportedAuthenticationTypesAsync();
  } catch (error) {
    console.error('Failed to get biometric types:', error);
    return [];
  }
}

export async function isBiometricEnrolled(): Promise<boolean> {
  try {
    return await LocalAuthentication.isEnrolledAsync();
  } catch (error) {
    console.error('Enrollment check error:', error);
    return false;
  }
}
```

### Authenticate with Biometrics

```typescript
export async function authenticateWithBiometrics(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Check if biometric is available
    const available = await isBiometricAvailable();
    if (!available) {
      return {
        success: false,
        error: 'Biometric authentication not available on this device',
      };
    }

    // Check if enrolled
    const enrolled = await isBiometricEnrolled();
    if (!enrolled) {
      return {
        success: false,
        error: 'No biometric data enrolled. Please set up Face/Touch ID in settings.',
      };
    }

    // Authenticate
    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false, // Allow PIN fallback
      reason: 'Authenticate to access your medications',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    } else if (result.error === 'unknown') {
      return { success: false, error: 'Authentication failed' };
    } else if (result.error === 'user_cancel') {
      return { success: false, error: 'Authentication cancelled' };
    } else {
      return { success: false, error: `Authentication error: ${result.error}` };
    }
  } catch (error) {
    console.error('Biometric auth error:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
```

### Enable/Disable Biometric Login

```typescript
const BIOMETRIC_ENABLED_KEY = 'biometric_login_enabled';
const BIOMETRIC_PIN_KEY = 'biometric_pin_hash';

export async function enableBiometricLogin(
  pinCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const available = await isBiometricAvailable();
    if (!available) {
      return { success: false, error: 'Biometric not available' };
    }

    // Hash PIN for verification
    const pinHash = await hashPin(pinCode);

    // Store securely
    await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, pinHash);
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, 'true');

    return { success: true };
  } catch (error) {
    console.error('Failed to enable biometric:', error);
    return { success: false, error: 'Failed to enable biometric login' };
  }
}

export async function disableBiometricLogin(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  } catch (error) {
    console.error('Failed to disable biometric:', error);
  }
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === 'true';
  } catch (error) {
    return false;
  }
}
```

## Session Management

### Automatic Session Timeout

```typescript
// lib/session.ts
const SESSION_TIMEOUT_MINUTES = 15;
let sessionTimeoutId: NodeJS.Timeout | null = null;

export function initializeSessionTimeout(onTimeout: () => Promise<void>) {
  const resetTimeout = () => {
    if (sessionTimeoutId) {
      clearTimeout(sessionTimeoutId);
    }

    sessionTimeoutId = setTimeout(
      async () => {
        console.log('Session timeout - logging out');
        await onTimeout();
      },
      SESSION_TIMEOUT_MINUTES * 60 * 1000
    );
  };

  // Reset on app focus
  const appState = useAppState();
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        resetTimeout();
      }
    });

    return () => subscription.remove();
  }, []);

  // Reset on user interaction
  const resetOnInteraction = () => {
    resetTimeout();
  };

  return resetOnInteraction;
}

export function clearSessionTimeout() {
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
}
```

### Session State Management

```typescript
// lib/store.ts - Add to Zustand store
interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setAuthenticated: (value: boolean) => void;
  setBiometricEnabled: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  biometricEnabled: false,

  setUser: user => set({ user }),
  setSession: session => set({ session }),
  setAuthenticated: value => set({ isAuthenticated: value }),
  setBiometricEnabled: value => set({ biometricEnabled: value }),
}));
```

### Auth State Listener

```typescript
export function useAuthStateListener() {
  const { setUser, setSession, setAuthenticated } = useAuthStore();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setUser(data.session?.user || null);
      setAuthenticated(!!data.session);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user || null);
      setAuthenticated(!!session);

      if (event === 'SIGNED_OUT') {
        // Clear sensitive data
        queryClient.clear();
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);
}
```

## Testing Authentication

### Auth Flow Tests

```typescript
// __tests__/auth.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { signUpWithEmail, signInWithEmail, signOut } from '@/lib/auth';

describe('Authentication', () => {
  beforeEach(async () => {
    // Clear auth state
    await signOut().catch(() => {});
  });

  it('should sign up with email and password', async () => {
    const result = await signUpWithEmail('test@example.com', 'securepassword123');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject weak passwords', async () => {
    const result = await signUpWithEmail('test@example.com', 'weak');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should sign in with correct credentials', async () => {
    await signUpWithEmail('test@example.com', 'securepassword123');

    const result = await signInWithEmail('test@example.com', 'securepassword123');

    expect(result.success).toBe(true);
  });

  it('should reject incorrect password', async () => {
    await signUpWithEmail('test@example.com', 'securepassword123');

    const result = await signInWithEmail('test@example.com', 'wrongpassword');

    expect(result.success).toBe(false);
  });
});
```

## Environment Setup

### .env.example

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Auth Deep Links
DEEP_LINK_SCHEME=doser://
```

### Supabase Configuration

1. Create Supabase project at supabase.com
2. Enable email/password authentication
3. Configure deep links for OAuth callbacks
4. Set up database (migrations)
5. Enable real-time subscriptions if needed

## Security Checklist

- [ ] Tokens stored in expo-secure-store
- [ ] HTTPS enforced in Supabase client
- [ ] Session timeout configured
- [ ] Biometric fallback working
- [ ] Logout clears sensitive data
- [ ] Password minimum requirements set
- [ ] Email verification enabled
- [ ] MFA available (optional)
- [ ] Error messages don't leak user info
- [ ] Tokens refreshed before expiry

## Common Issues & Solutions

### Session Not Persisting

- Check expo-secure-store implementation in supabase client config
- Verify permissions for secure storage (Android)

### Biometric Not Working

- Check device has fingerprint/face data enrolled
- Test with `isBiometricEnrolled()` first
- Fallback to PIN should work

### OAuth Flow Issues

- Verify deep link configuration in app.json
- Check redirect URIs in Supabase dashboard
- Test on real device, emulator may have issues

## Next Steps

1. Set up Supabase project
2. Configure environment variables
3. Implement sign-up/sign-in screens
4. Add biometric support
5. Test auth flows
6. Implement session management
7. Add password recovery
8. Set up MFA (optional)
