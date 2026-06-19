# Doser System Architecture

## Overview

Doser is a medication management app with offline-first capabilities and cloud synchronization. It supports multiple user profiles and provides dose tracking, scheduling, and reporting features.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile/Web UI Layer                   │
│  (Expo Router, React Native, React Components)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              State Management Layer                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │ React Query (Server State)                       │   │
│  │ Zustand Store (Local UI State)                   │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Business Logic Layer                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │ lib/database.ts (SQLite operations)              │   │
│  │ lib/store.ts (State logic)                       │   │
│  │ lib/supabase.ts (Cloud operations)               │   │
│  │ lib/auth.ts (Authentication)                     │   │
│  │ lib/biometrics.ts (Biometric auth)               │   │
│  │ lib/notifications.ts (Push notifications)        │   │
│  │ lib/sync.ts (Offline-first sync)                 │   │
│  │ lib/report.ts (PDF generation)                   │   │
│  │ lib/prescription-scanner.ts (OCR/scanning)       │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼────────┐ │
│ SQLite (Local) │ │ File System │ │
│ Storage        │ │ (Reports,  │ │
│                │ │  Cache)    │ │
└────────────────┘ └────────────┘ │
                                   │
                          ┌────────▼────────┐
                          │ Supabase Cloud  │
                          │ - Auth          │
                          │ - Database      │
                          │ - Real-time     │
                          │ - Storage       │
                          └─────────────────┘
```

## Core Layers

### 1. Presentation Layer (`/app`, `/components`)

- **Expo Router** for navigation
- **React Native** components for UI
- **Screen-level components** in `/app`
- **Reusable UI components** in `/components/ui`
- **Theme system** from `/constants/theme.ts`

### 2. State Management Layer

- **React Query**: Manages server/sync state (Supabase data)
  - Caching, invalidation, background sync
  - Configured in `lib/query-client.ts`
- **Zustand Store**: Local UI state
  - Current profile, app settings
  - Configured in `lib/store.ts`

### 3. Business Logic Layer (`/lib`)

Core services handling all application logic:

#### Database Service (`lib/database.ts`)

- SQLite operations with expo-sqlite
- CRUD operations for medicines, schedules, history
- Query optimization
- Profile-scoped data access
- Migration system for schema updates

#### Auth Service (`lib/auth.ts`, `lib/biometrics.ts`)

- Supabase authentication flows
- User session management
- Biometric authentication (Face/Fingerprint)
- Secure token storage with expo-secure-store
- OAuth callback handling

#### Sync Service (`lib/sync.ts`)

- Offline-first data synchronization
- Conflict resolution (last-write-wins)
- Background sync scheduling
- Retry logic for failed syncs
- Timestamp-based reconciliation

#### Notification Service (`lib/notifications.ts`)

- Push notification setup
- Dose reminder scheduling
- Permission handling
- Deep linking on notification tap

#### Supabase Service (`lib/supabase.ts`)

- Supabase client initialization
- Cloud database queries
- Real-time subscriptions
- File storage operations

#### Report Service (`lib/report.ts`)

- PDF generation with expo-print
- HTML template rendering
- Data aggregation by period
- File sharing with expo-sharing

#### Scanner Service (`lib/prescription-scanner.ts`)

- Image capture with expo-image-picker
- OCR processing (Google/Anthropic APIs)
- Medicine data extraction
- Validation and formatting

### 4. Data Layer

#### Local Storage (SQLite)

```sql
Profiles
├── id
├── name
├── createdAt
└── updatedAt

Medicines
├── id
├── profileId
├── name
├── strength
├── unit
├── frequency
└── ...

Schedules
├── id
├── profileId
├── medicineId
├── time
├── daysOfWeek
└── ...

History
├── id
├── profileId
├── medicineId
├── takenAt
├── skipped
└── notes
```

#### Cloud Storage (Supabase PostgreSQL)

- Mirror of local SQLite schema
- Real-time subscriptions
- User authentication integration
- Cloud-only features

#### File Storage

- Local cache (expo-file-system)
- Supabase storage for attachments
- Temporary files for reports

## Data Flow

### Offline-First Pattern

```
User Action
    ↓
Update Local State (React Query)
    ↓
Write to SQLite
    ↓
Optimistic UI Update
    ↓
Background Sync (if connected)
    ↓
Sync with Supabase
    ↓
Confirm/Rollback on server response
```

### Multi-Profile Pattern

```
All queries filtered by profileId
    ↓
State includes current activeProfileId
    ↓
Sync operations scoped to active profile
    ↓
UI shows only active profile data
    ↓
Profile switching resets queries
```

## Service Integration

### Database → UI Flow

1. Component mounts or data needs refresh
2. React Query hook fetches from SQLite via `lib/database.ts`
3. Data cached in React Query
4. Component renders with data
5. Background sync updates cloud if needed

### Cloud → Local Flow

1. Supabase real-time subscription triggered
2. `lib/sync.ts` receives changes
3. Compare with local SQLite version
4. Apply changes or resolve conflicts
5. Invalidate React Query cache
6. UI re-renders with new data

## Security Model

### Authentication

- Biometric + PIN fallback
- Session tokens in secure storage
- Token refresh before expiry
- Logout clears sensitive data

### Data Protection

- SQLite encryption (optional, via library)
- HTTPS only for cloud communication
- No sensitive data in logs
- Profile isolation at database level

### Permissions

- Request at runtime (Android 6+, iOS)
- Graceful degradation if denied
- Document why each permission needed

## Performance Optimization

### Caching Strategy

- React Query: Default 5 min stale time
- SQLite: Direct device storage
- Memory cache for frequently accessed data
- Image optimization with expo-image

### Bundle Size Management

- Code splitting at route level
- Lazy loading heavy components
- Tree shaking for unused code
- Image compression and optimization

### Database Optimization

- Indexes on frequently queried columns
- Pagination for large result sets
- Query result caching
- Batch operations when possible

## Scalability Considerations

### Current Limits

- SQLite: Handles thousands of records efficiently
- One profile per device
- Typical usage: 10-50 medicines, 100-500 history entries

### Future Scaling

- Implement data archival for old history
- Pagination for large medicine lists
- Sync debouncing for high-frequency changes
- Server-side filtering and pagination

## Testing Architecture

### Unit Tests

- Test individual functions in isolation
- Mock external dependencies
- Test error cases
- Aim for >80% coverage

### Integration Tests

- Test database operations
- Test sync flows
- Test auth flows
- Test notification triggers

### E2E Tests

- Test critical user journeys
- Test on real devices/emulators
- Test offline behavior
- Test cloud sync

## Deployment Architecture

### Build Process

1. TypeScript compilation
2. Asset optimization
3. Bundle creation (JavaScript)
4. APK/IPA generation (EAS)

### Deployment Targets

- Google Play Store (Android)
- Apple App Store (iOS)
- Web (Expo Web)

### Update Strategy

- Over-the-air updates (expo-updates)
- Native updates via app stores
- Scheduled maintenance windows

## Error Handling Strategy

### Network Errors

- Automatic retry with exponential backoff
- User notification of sync status
- Fallback to local data
- Queue changes for later sync

### Database Errors

- Transaction rollback on failure
- User-friendly error messages
- Log detailed errors for debugging
- Provide recovery options

### Auth Errors

- Session timeout handling
- Re-authentication prompts
- Token refresh logic
- Logout and re-login flows

## Monitoring & Logging

### Debug Logging

- SQLite query logging (dev only)
- Sync operations logging
- API call logging
- Performance metrics

### Error Tracking

- Crash reporting (if integrated)
- Error categorization
- User context in errors
- Production error filtering

## Future Enhancements

1. **Widgets**: iOS WidgetKit + Android AppWidget
2. **Wearables**: Wear OS integration
3. **AI Features**: Dose predictions, health insights
4. **Telemedicine**: Doctor communication
5. **Family Sharing**: Multiple device sync
6. **Advanced Reports**: Charts, analytics, trends
7. **Backend Services**: Automated reminders, push notifications
