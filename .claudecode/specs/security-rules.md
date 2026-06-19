# Security Rules - Doser

## Authentication & Authorization

### Biometric Authentication

```typescript
// ✅ DO: Verify biometric support and fallback
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometrics(): Promise<boolean> {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) {
      return false; // Fallback to PIN/password
    }

    const result = await LocalAuthentication.authenticateAsync({
      disableDeviceFallback: false,
      reason: 'Authenticate to access Doser',
    });

    return result.success;
  } catch (error) {
    console.error('Biometric auth error:', error);
    return false;
  }
}

// ❌ DON'T: Assume biometric always available
const authenticated = await LocalAuthentication.authenticateAsync();
```

### Session Management

```typescript
// ✅ DO: Implement session timeout
const SESSION_TIMEOUT_MINUTES = 15;

export function initSessionTimeout() {
  let timeoutId: NodeJS.Timeout | null = null;

  const resetTimeout = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(
      () => {
        logout(); // Force logout on timeout
      },
      SESSION_TIMEOUT_MINUTES * 60 * 1000
    );
  };

  // Reset on every user interaction
  const userActionHandler = () => resetTimeout();

  return { resetTimeout, userActionHandler };
}
```

### Token Management

```typescript
// ✅ DO: Store tokens securely with expo-secure-store
import * as SecureStore from 'expo-secure-store';

export async function saveAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync('auth_token', token);
  } catch (error) {
    console.error('Failed to save token securely:', error);
    throw error;
  }
}

export async function getAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch (error) {
    console.error('Failed to retrieve token:', error);
    return null;
  }
}

export async function clearAuthToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('auth_token');
  } catch (error) {
    console.error('Failed to clear token:', error);
  }
}

// ❌ DON'T: Store tokens in AsyncStorage (not encrypted)
// ❌ DON'T: Store tokens in app state/memory (lost on logout)
```

## Data Protection

### Input Validation

```typescript
// ✅ DO: Validate and sanitize user input
export function validateMedicineName(name: string): boolean {
  // Check length
  if (name.length < 1 || name.length > 255) return false;
  // Check for valid characters
  if (!/^[a-zA-Z0-9\s\-(),.]*$/.test(name)) return false;
  return true;
}

export function sanitizeMedicineName(name: string): string {
  // Remove potentially harmful characters
  return name.trim().replace(/[<>\"']/g, '');
}

// ❌ DON'T: Trust user input directly in database
const medicine = await database.medicines.create({
  name: userInput, // Dangerous!
});
```

### SQL Injection Prevention

```typescript
// ✅ DO: Use parameterized queries with expo-sqlite
import { openDatabase } from 'expo-sqlite';

const db = openDatabase('doser.db');

export async function getMedicineByName(profileId: string, name: string): Promise<Medicine | null> {
  try {
    const result = await db.execAsync([
      {
        sql: 'SELECT * FROM medicines WHERE profileId = ? AND name = ? LIMIT 1',
        args: [profileId, name], // Parameters bound safely
      },
    ]);
    return result[0]?.[0] || null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// ❌ DON'T: String concatenation in queries
const query = `SELECT * FROM medicines WHERE profileId = '${profileId}' AND name = '${name}'`;
```

### Sensitive Data Handling

```typescript
// ✅ DO: Clear sensitive data on logout
export async function logout(): Promise<void> {
  try {
    // Clear auth tokens
    await clearAuthToken();

    // Clear sensitive state
    useAppStore.setState({
      activeProfileId: null,
      isAuthenticated: false,
    });

    // Clear cached queries
    queryClient.clear();

    // Clear sensitive app data (if any)
    // Optional: Wipe local database (except for backup)
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ❌ DON'T: Log sensitive data
console.log('Token:', token); // Never!
console.log('User:', { name, email, password }); // Never!
```

### Data Encryption

```typescript
// ✅ DO: Consider SQLite encryption for sensitive deployments
// Using: expo-sqlite with encryption plugin (future)

// For now, rely on:
// 1. Secure storage for tokens
// 2. HTTPS for API communication
// 3. Device-level encryption (OS provides)
// 4. Profile isolation in database

// ❌ DON'T: Store unencrypted sensitive data locally
```

## Network Security

### HTTPS Only

```typescript
// ✅ DO: Enforce HTTPS in Supabase client
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://xxx.supabase.co', // Always HTTPS
  'public-anon-key'
);

// ❌ DON'T: Use HTTP
export const supabase = createClient(
  'http://xxx.supabase.co', // Vulnerable!
  'public-anon-key'
);
```

### API Request Security

```typescript
// ✅ DO: Include auth headers and validate responses
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await logout(); // Token expired
      throw new Error('Authentication failed');
    }
    throw new Error(`API error: ${response.statusText}`);
  }

  return response;
}

// ✅ DO: Validate API responses
export async function fetchMedicines(profileId: string): Promise<Medicine[]> {
  const response = await fetchWithAuth(`/api/medicines/${profileId}`);
  const data = await response.json();

  // Validate response format
  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  // Validate each item
  return data.map(item => validateMedicine(item));
}
```

### Error Message Security

```typescript
// ✅ DO: Show user-friendly errors, log details
async function loadMedicines(profileId: string): Promise<void> {
  try {
    const medicines = await fetchMedicines(profileId);
    // ...
  } catch (error) {
    // User sees generic message
    showUserMessage('Failed to load medicines. Please try again.');

    // Detailed error logged for debugging
    console.error('Detailed error:', error);
  }
}

// ❌ DON'T: Expose internal details to users
catch (error) {
  showUserMessage(`Error: ${error.message}`); // Could leak info
}
```

## Permissions & Privacy

### Permission Requests

```typescript
// ✅ DO: Request permissions explicitly and explain why
import { requestPermissionAsync, getPermissionsAsync } from 'expo-notifications';
import { requestCameraPermissionsAsync } from 'expo-image-picker';

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await requestPermissionAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    showUserMessage('Please enable notifications in settings to receive dose reminders.');
    return false;
  }

  return true;
}

// ✅ DO: Handle permission denied gracefully
export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await requestCameraPermissionsAsync();

  if (status !== 'granted') {
    // Disable camera-dependent features
    return false;
  }

  return true;
}
```

### Data Privacy

```typescript
// ✅ DO: Implement privacy controls
// User can:
// - Delete all personal data
// - Export data
// - Control sync preferences
// - Disable cloud sync

export async function deleteAllUserData(profileId: string): Promise<void> {
  try {
    // Delete from local DB
    await database.profiles.delete(profileId);
    await database.medicines.deleteByProfile(profileId);
    await database.history.deleteByProfile(profileId);

    // Delete from cloud
    if (isConnected) {
      await supabase.from('profiles').delete().eq('id', profileId);
    }

    // Clear sensitive state
    await logout();
  } catch (error) {
    console.error('Data deletion error:', error);
    throw error;
  }
}
```

## Third-Party Integrations

### API Key Security

```typescript
// ✅ DO: Store API keys in environment variables
// .env (never commit)
// GOOGLE_API_KEY=xxx
// ANTHROPIC_API_KEY=yyy

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!GOOGLE_API_KEY || !ANTHROPIC_API_KEY) {
  throw new Error('Missing required environment variables');
}

// ✅ DO: Use .env.example for documentation
// .env.example
// GOOGLE_API_KEY=your_api_key_here
// ANTHROPIC_API_KEY=your_api_key_here

// ❌ DON'T: Hardcode API keys
const GOOGLE_API_KEY = 'AIzaSyXxxxxxxxxxxx'; // Never!
```

### Third-Party Library Vetting

```typescript
// ✅ DO: Review dependencies regularly
// Run: npm audit
// Check: npm outdated
// Review: Security advisories

// ✅ DO: Use established libraries for sensitive operations
import * as SecureStore from 'expo-secure-store'; // Trusted
import * as LocalAuthentication from 'expo-local-authentication'; // Official

// ❌ DON'T: Use obscure libraries for security-critical features
// ❌ DON'T: Ignore security warnings from npm audit
```

## Compliance

### HIPAA Considerations (if applicable)

- Patient data encryption at rest and in transit
- Access logging for medical data
- Secure deletion/archive policies
- Data minimization (only collect necessary data)

### GDPR Compliance (if applicable)

- User consent for data collection
- Right to data access/export
- Right to deletion
- Data processing agreements

### Audit Trail

```typescript
// ✅ DO: Log important security events (in production)
export async function logSecurityEvent(
  event: SecurityEvent,
  details: Record<string, unknown>
): Promise<void> {
  // Log locally (dev)
  if (__DEV__) {
    console.log(`[SECURITY] ${event}`, details);
  }

  // Could send to backend for audit trail
  // await backend.logEvent(event, details);
}

type SecurityEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_TIMEOUT'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_DENIED'
  | 'DATA_DELETED';
```

## Checklist

Before deployment:

- [ ] All tokens stored securely (expo-secure-store)
- [ ] HTTPS only for API calls
- [ ] Input validation on all user data
- [ ] Parameterized database queries
- [ ] No console logs with sensitive data
- [ ] Session timeout implemented
- [ ] Permissions requested and handled
- [ ] Logout clears all sensitive data
- [ ] Error messages don't leak information
- [ ] API responses validated
- [ ] Third-party keys in environment variables
- [ ] Dependencies audited (npm audit)
- [ ] Biometric fallback working
- [ ] GDPR/HIPAA compliance verified
