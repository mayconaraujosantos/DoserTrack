# 🏥 Doser Project - Claude Development Configuration

Welcome to the Doser project Claude development environment! This directory contains all the specialized configurations, guidelines, and tools to help you work effectively with AI-assisted development.

## 📁 Structure

```
.claudecode/
├── README.md                    # This file
├── .clauderc.json              # Agent and skill configuration
├── AGENTS.md                   # Agent descriptions and usage
├── AGENTS_GUIDE.md             # How to use agents effectively
├── .instructions.md            # Core development rules and principles
│
├── specs/                       # Detailed specifications and standards
│   ├── system-architecture.md  # Complete system design and architecture
│   ├── code-style.md          # Code style, patterns, and conventions
│   ├── security-rules.md      # Security, auth, and compliance rules
│
└── skills/                      # Step-by-step practical guides
    ├── test-database.md        # Database testing and operations
    ├── setup-auth.md           # Authentication setup guide
    ├── sync-data.md            # Data sync and offline-first patterns
    ├── manage-profiles.md      # Profile and medicine management
    ├── generate-reports.md     # Reports, exports, and PDFs
    └── testing-qa.md           # Testing and quality assurance
```

## 🤖 Specialist Agents (9 Total)

Each agent is specialized in a specific domain and automatically activates when you work on related files:

| Agent                  | Focus                                       | Files                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------- |
| **Backend/Database**   | SQLite, queries, migrations, sync           | `lib/database.ts`, `lib/sync.ts`      |
| **Frontend/UI**        | React Native, components, screens           | `app/**`, `components/**`, `hooks/**` |
| **Auth & Security**    | Supabase, biometrics, security              | `lib/auth.ts`, `lib/biometrics.ts`    |
| **Data Sync & API**    | Supabase, offline-first, real-time          | `lib/supabase.ts`, `lib/sync.ts`      |
| **Testing & Quality**  | Tests, coverage, QA                         | `__tests__/**`                        |
| **Features & Modules** | Medicine, schedules, notifications, reports | Feature-specific code                 |
| **DevOps & Build**     | Expo, EAS, deployment, CI/CD                | `eas.json`, `app.json`                |
| **Architecture**       | System design, refactoring                  | `types/`, core `lib/` files           |
| **Documentation**      | Docs, specs, guides                         | Markdown files, docs                  |

### How to Invoke an Agent

```
"Use the database agent to implement a query for getting medicines by profile"
"@auth-security - help me set up biometric authentication"
"I'm working on sync issues in lib/sync.ts" [Agent auto-activates based on file]
```

## 📚 Specifications (Reference Docs)

### system-architecture.md

Complete reference for understanding the entire system design.

**Covers**:

- Architecture layers and components
- Data flow patterns (offline-first)
- Security model
- Performance optimization
- Scalability considerations
- Service integration

**Use when**: Planning features, understanding design, debugging architectural issues

### code-style.md

Standards for all code written in the project.

**Covers**:

- TypeScript patterns and type safety
- React component structure
- Naming conventions (files, functions, types)
- File organization
- Error handling patterns
- Performance patterns (memoization, caching)

**Use when**: Writing code, code reviews, ensuring consistency

### security-rules.md

Security and compliance guidelines.

**Covers**:

- Authentication & biometrics
- Data protection (encryption, secure storage)
- Network security (HTTPS, API security)
- Permissions & privacy
- Compliance (GDPR, HIPAA)
- Security checklist

**Use when**: Working on auth, handling sensitive data, compliance requirements

## 🛠️ Skills (Step-by-Step Guides)

### test-database.md

Complete guide for database testing and operations.

**Learn**:

- Setting up test databases
- Writing CRUD operation tests
- Testing profile isolation
- Testing transactions
- Database debugging

**Use when**: Writing database tests, setting up test infrastructure

### setup-auth.md

Guide for implementing authentication and biometric support.

**Learn**:

- Initializing Supabase client
- Email/password authentication
- Biometric (Face/Fingerprint) setup
- Secure token storage
- Session management
- Password recovery flows

**Use when**: Setting up auth system, implementing biometric features

### sync-data.md

Guide for offline-first data synchronization.

**Learn**:

- Sync architecture and patterns
- Push and pull operations
- Conflict resolution strategies
- Background sync scheduling
- Retry logic with exponential backoff
- Testing offline behavior

**Use when**: Implementing sync features, fixing sync bugs, handling offline scenarios

### manage-profiles.md

Guide for profile and medicine management.

**Learn**:

- Profile CRUD operations
- Medicine management (create, read, update, delete)
- Schedule management
- Dose history tracking
- Adherence calculations

**Use when**: Building profile screens, implementing medicine management

### generate-reports.md

Guide for reports, exports, and PDF generation.

**Learn**:

- PDF report generation with HTML templates
- CSV export functionality
- Adherence statistics and analytics
- UI components for export dialogs
- Sharing functionality

**Use when**: Building export features, generating reports, creating statistics

### testing-qa.md

Comprehensive testing and quality assurance guide.

**Learn**:

- Jest configuration and setup
- Unit testing patterns
- Integration testing
- Component testing with React Testing Library
- Coverage goals and metrics
- Running test suites

**Use when**: Writing tests, setting up test infrastructure, improving coverage

## 📋 Core Instructions (.instructions.md)

Essential development rules that apply to all work:

- ✅ **Write tests BEFORE implementation** (TDD approach)
- ✅ **Quality over speed** - Take time to think through each step
- ✅ **Never skip planning** - Always plan thoroughly before coding
- ✅ **Type safety** - Strict TypeScript, no `any` types
- ✅ **Error handling** - Explicit error handling in all async operations

### Development Principles

- **Code Organization**: Follow file structure for screens, components, lib utilities
- **Naming Conventions**: kebab-case files, PascalCase components, camelCase functions
- **Database**: Always profile-scoped queries, use parameterized SQL
- **State Management**: React Query for server state, Zustand for UI state
- **Performance**: Lazy loading, memoization, bundle size monitoring
- **Testing**: Aim for >80% coverage, test critical user flows
- **Git**: Feature branches, descriptive commit messages, PR reviews
- **Security**: No sensitive data in logs, validate all inputs, use HTTPS only

## 🚀 Quick Start

### Step 1: Get Familiar with Specs

Read the specs in this order:

1. `specs/system-architecture.md` - Understand the design
2. `specs/code-style.md` - Learn the patterns
3. `specs/security-rules.md` - Understand requirements

### Step 2: Choose Your Focus Agent

Based on what you're working on:

- Building UI? → **Frontend/UI Agent**
- Writing database queries? → **Backend/Database Agent**
- Setting up auth? → **Auth & Security Agent**
- Writing tests? → **Testing & Quality Agent**

### Step 3: Reference a Skill

If you need detailed guidance:

- Use the relevant skill file (they're in `skills/`)
- Skill files have code examples and best practices

### Step 4: Follow .instructions.md

Always reference `.instructions.md` for:

- Development rules
- Code style
- Testing requirements
- Error handling

## 📖 Common Workflows

### 🔨 Building a New Feature

1. **Plan** → Use Architecture Agent to design
2. **Test** → Use Testing Agent to write tests first
3. **Implement** → Use appropriate feature agent
4. **Integrate** → Use Sync Agent for cloud integration
5. **Document** → Use Documentation Agent

Example request:

```
"Use the architecture agent to design a new 'medication reminders' feature,
then the testing agent to write tests, then the features agent to implement it."
```

### 🐛 Fixing a Bug

1. **Understand** → Find which agent handles this area
2. **Write Test** → Use Testing Agent to create failing test
3. **Fix** → Use appropriate agent to fix the bug
4. **Verify** → Run tests to ensure it passes

Example request:

```
"There's a bug in medicine deletion - it's not removing schedules.
Use the testing agent to write a test, then the features agent to fix it."
```

### 🔒 Implementing a Security Feature

1. **Design** → Use Security Agent to review requirements
2. **Test** → Use Testing Agent for security tests
3. **Implement** → Use Auth & Security Agent
4. **Audit** → Use Security Agent for final review

Example request:

```
"Use the security agent to design biometric authentication,
then the testing agent to write tests, then implement it with setup-auth.md"
```

### 🗄️ Database Changes

1. **Design Schema** → Use Database Agent
2. **Write Tests** → Use Testing Agent (use test-database.md)
3. **Implement** → Use Database Agent
4. **Migrate** → Use Database Agent for migrations

Example request:

```
"I need to add a 'prescriptions' table. Use the database agent to design it,
the testing agent to write migration tests, then implement with migrations."
```

## 🎯 Best Practices for This Setup

### ✅ DO

- ✅ Mention the agent name or skill in your request
- ✅ Reference spec sections when asking about standards
- ✅ Check the relevant skill first for detailed guidance
- ✅ Use `.instructions.md` as your baseline reference
- ✅ Invoke multiple agents for complex features
- ✅ Provide context (file names, current state, errors)

### ❌ DON'T

- ❌ Ask agents to skip planning or testing
- ❌ Request work outside the agent's domain (e.g., UI Agent for database queries)
- ❌ Skip reading specs when questions could be answered there
- ❌ Work around security rules
- ❌ Import or skip the TDD approach

## 🔗 Important Files Outside .claudecode

| File               | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `CLAUDE.md`        | Project-level principles (quality over speed, TDD) |
| `package.json`     | Dependencies, scripts, project config              |
| `app.json`         | Expo/app configuration                             |
| `tsconfig.json`    | TypeScript configuration                           |
| `eslint.config.js` | Linting rules                                      |
| `.env.example`     | Environment variables template                     |

## 📞 Getting Help

### "I don't know which agent to use"

→ Tell me what you're working on, and I'll suggest the right agent

### "I need detailed guidance"

→ Ask me to use the relevant skill (e.g., "Use test-database.md to help me write a database test")

### "What's the standard for [something]?"

→ Check the relevant spec or ask me to reference it

### "I want to understand the architecture"

→ Read `specs/system-architecture.md` or ask the Architecture Agent to explain

## 🎓 Learning Path

1. **New to project?** → Start with `specs/system-architecture.md`
2. **First feature?** → Use the appropriate skill guide
3. **Need to follow standards?** → Read `specs/code-style.md`
4. **Security work?** → Study `specs/security-rules.md`
5. **Writing tests?** → Use `skills/testing-qa.md`
6. **Stuck?** → Check `.instructions.md` for core principles

## 📊 Project Stats

- **Type**: React Native + Expo + TypeScript
- **Features**: Multi-profile, offline-first, Supabase sync
- **DB**: SQLite (local) + PostgreSQL (Supabase)
- **Auth**: Biometric + Email/Password
- **Platform**: Android, iOS, Web

## 🎯 Success Criteria

Your work is successful when:

- ✅ All tests pass (>80% coverage)
- ✅ No TypeScript errors
- ✅ No ESLint warnings
- ✅ Code follows style guide
- ✅ Security rules enforced
- ✅ Documentation updated
- ✅ Profile isolation maintained

## 🔄 Continuous Improvement

This setup evolves as the project grows:

- **Add agents** when new specializations emerge
- **Update specs** as patterns change
- **Refine skills** based on what's difficult
- **Extend .instructions.md** with new rules

---

**Remember**: Quality over speed. Take time to think through each step. Tests before implementation. Never skip planning.

**Questions?** Ask me directly - I can explain any part of this setup or help you find the right resource.
