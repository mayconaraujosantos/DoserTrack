# Doser Project Agents

Your workspace is configured with specialized AI agents to help with specific aspects of the project. Here's how to use them:

## 🗄️ Backend/Database Agent

**When to use**: Database operations, migrations, queries, sync patterns

**Invoke with**:

- "Use the database agent to..."
- "@backend-database"
- Working on files in `lib/database.ts`, `lib/sync.ts`

**Expertise**:

- SQLite CRUD operations
- Query optimization
- Migration management
- Profile isolation
- Transaction handling

---

## 🎨 Frontend/UI Agent

**When to use**: Building screens, components, layouts, navigation

**Invoke with**:

- "Use the UI agent to..."
- "@frontend-ui"
- Working on files in `app/`, `components/`

**Expertise**:

- React Native components
- Screen layouts
- Navigation flows
- Styling with theme
- Responsive design

---

## 🔐 Authentication & Security Agent

**When to use**: Auth flows, biometrics, security, permissions

**Invoke with**:

- "Use the auth agent to..."
- "@auth-security"
- Working on `lib/auth.ts`, `lib/biometrics.ts`

**Expertise**:

- Supabase authentication
- Biometric setup
- Secure token storage
- Session management
- GDPR/HIPAA compliance

---

## 🔄 Data Sync & API Agent

**When to use**: Supabase sync, API integration, offline-first patterns

**Invoke with**:

- "Use the sync agent to..."
- "@sync-api"
- Working on `lib/supabase.ts`, `lib/sync.ts`

**Expertise**:

- Supabase queries
- Real-time subscriptions
- Conflict resolution
- Offline-first patterns
- Background sync

---

## ✅ Testing & Quality Agent

**When to use**: Writing tests, QA, coverage, code quality

**Invoke with**:

- "Use the testing agent to..."
- "@testing-quality"
- Working on `__tests__/`

**Expertise**:

- Unit tests
- Integration tests
- Test-driven development
- Coverage analysis
- Mock strategies

---

## 🎯 Features & Modules Agent

**When to use**: Building complete features (medicine, schedules, reports, etc.)

**Invoke with**:

- "Use the features agent to..."
- "@features-modules"
- Working on feature-specific code

**Expertise**:

- Medicine management
- Schedule management
- Notifications
- Report generation
- Prescription scanning
- Dose history

---

## 🚀 DevOps & Build Agent

**When to use**: Build configuration, deployment, CI/CD, environment setup

**Invoke with**:

- "Use the DevOps agent to..."
- "@devops-build"
- Working on `eas.json`, `app.json`, build files

**Expertise**:

- Expo builds
- EAS configuration
- Android/iOS setup
- Deployment pipelines
- Environment variables

---

## 🏗️ Architecture & Refactoring Agent

**When to use**: System design, architecture decisions, major refactoring

**Invoke with**:

- "Use the architecture agent to..."
- "@architecture"
- Major code reorganization

**Expertise**:

- Component architecture
- State management patterns
- Code organization
- Performance optimization
- Refactoring strategies

---

## 📚 Documentation Agent

**When to use**: Creating or updating documentation, guides, specs

**Invoke with**:

- "Use the documentation agent to..."
- "@documentation"
- Working on docs and specs

**Expertise**:

- API documentation
- Architecture guides
- Setup guides
- Architecture Decision Records

---

## 📋 Available Skills

Each skill provides practical step-by-step guidance for complex tasks:

### **test-database**

Complete guide for database testing, migrations, and operations

- Setting up test databases
- Writing CRUD tests
- Testing profile isolation
- Testing transactions
- Debugging database issues

### **setup-auth**

Guide for implementing authentication and biometric support

- Supabase client setup
- Email/password auth
- Biometric authentication
- Session management
- Testing auth flows

### **sync-data**

Guide for offline-first data synchronization

- Sync architecture
- Background sync scheduling
- Conflict resolution
- Retry logic
- Testing offline behavior

### **manage-profiles**

Guide for profile and medicine management

- Profile CRUD operations
- Medicine management
- Schedule management
- Dose history tracking
- Adherence calculation

### **generate-reports**

Guide for reports, exports, and PDF generation

- PDF report generation
- CSV export
- Adherence statistics
- Analytics calculations
- UI components for export

### **testing-qa**

Comprehensive testing guide

- Test setup and configuration
- Unit testing patterns
- Integration testing
- Test commands and coverage
- Debugging tests

---

## 📋 Available Specs

Reference documentation for development standards:

### **system-architecture**

Complete system architecture overview

- Architecture diagram
- Core layers explanation
- Data flow patterns
- Security model
- Performance optimization
- Scalability considerations

### **code-style**

Code style and conventions

- TypeScript guidelines
- React component patterns
- Naming conventions
- File organization
- Error handling patterns
- Performance patterns

### **security-rules**

Security and compliance guidelines

- Authentication rules
- Data protection
- Network security
- Permissions and privacy
- Compliance requirements
- Security checklist

---

## 🎯 How to Use These Together

### Example: Building a New Feature

1. **Architecture Agent** → Design the feature architecture
2. **Testing Agent** → Write tests for the feature
3. **Features Agent** → Implement the feature
4. **UI Agent** → Build UI components
5. **Database Agent** → Handle data operations
6. **Sync Agent** → Implement cloud sync
7. **Documentation Agent** → Document the feature

### Example: Debugging Sync Issues

1. Use **Database Agent** → Check local data integrity
2. Use **Sync Agent** → Review sync logic
3. Use **Testing Agent** → Write sync tests
4. Use **Architecture Agent** → Review design

### Example: Security Audit

1. Use **Security Agent** → Review auth flows
2. Use **Testing Agent** → Write security tests
3. Use **Architecture Agent** → Review design patterns
4. Use **Documentation Agent** → Update security docs

---

## 💡 Tips

- **Mention the agent name** in your request for faster context switching
- **Provide file names** when asking for help on specific files
- **Check the skills** for detailed step-by-step guides
- **Reference specs** when asking about standards
- **Use multiple agents** for complex features
- **Keep agents focused** by staying in their domain

## 🔗 Quick Links

- [System Architecture](specs/system-architecture.md) - Understand the design
- [Code Style](specs/code-style.md) - Follow conventions
- [Security Rules](specs/security-rules.md) - Maintain security
- [.instructions.md](.instructions.md) - Core development rules

---

**Need help?** Ask for a specific agent by name, or provide the file you're working on and I'll suggest the right agent.
