# Doser — Software Design Document

**Versão:** 1.0  
**Data:** 2026-06-24  
**Autor:** Maycon Araujo Santos  
**Status:** Vigente

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Objetivos e Escopo](#2-objetivos-e-escopo)
3. [Stack Tecnológica](#3-stack-tecnológica)
4. [Arquitetura](#4-arquitetura)
5. [Modelo de Domínio](#5-modelo-de-domínio)
6. [Design do Banco de Dados](#6-design-do-banco-de-dados)
7. [Módulos e Responsabilidades](#7-módulos-e-responsabilidades)
8. [Fluxos Principais](#8-fluxos-principais)
9. [Algoritmos-Chave](#9-algoritmos-chave)
10. [Segurança](#10-segurança)
11. [Requisitos Não-Funcionais](#11-requisitos-não-funcionais)
12. [Build e Deploy](#12-build-e-deploy)
13. [Decisões de Design (ADRs)](#13-decisões-de-design-adrs)

---

## 1. Visão Geral do Sistema

**Doser** é um aplicativo mobile de adesão medicamentosa que permite gerenciar múltiplos perfis (usuário e familiares), criar agendamentos de doses com diferentes frequências, receber lembretes, controlar estoque e visualizar métricas de adesão.

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOSER                                   │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │   Expo/RN    │   │   Supabase   │   │   Gemini Vision  │    │
│  │  (Frontend)  │◄──│  (Auth+Sync) │   │  (AI Scanning)   │    │
│  └──────┬───────┘   └──────────────┘   └──────────────────┘    │
│         │                                                       │
│  ┌──────▼───────┐   ┌──────────────┐   ┌──────────────────┐    │
│  │    SQLite    │   │   Zustand    │   │  React Query     │    │
│  │ (Local DB)   │   │ (App State)  │   │ (Server State)   │    │
│  └──────────────┘   └──────────────┘   └──────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Plataformas Alvo

| Plataforma | Status          |
| ---------- | --------------- |
| Android    | Principal       |
| iOS        | Suportado       |
| Web        | Suporte parcial |

---

## 2. Objetivos e Escopo

### Objetivos

- **Adesão medicamentosa:** facilitar o registro e acompanhamento da tomada de doses.
- **Multi-perfil:** permitir gerenciamento de medicamentos de familiares em um único app.
- **Offline-first:** funcionar completamente sem internet, com sincronização opcional.
- **Redução de entrada manual:** usar IA (Gemini) para extrair dados de embalagens e receitas.

### Fora do Escopo (v1)

- Verificação de interações medicamentosas
- Integração com Apple Health / Google Fit
- Compartilhamento com profissionais de saúde
- Widget de tela inicial (previsto, não implementado)

---

## 3. Stack Tecnológica

### Runtime e Framework

| Camada        | Tecnologia          | Versão      | Justificativa                       |
| ------------- | ------------------- | ----------- | ----------------------------------- |
| App Framework | React Native + Expo | 0.81.5 / 54 | OTA updates, builds gerenciados     |
| Linguagem     | TypeScript          | ~5.9.3      | Segurança de tipos, refactor seguro |
| Roteamento    | Expo Router         | ~6.0.23     | File-based routing tipado           |

### Estado e Dados

| Camada              | Tecnologia             | Justificativa                               |
| ------------------- | ---------------------- | ------------------------------------------- |
| Estado global       | Zustand 5              | Simples, sem boilerplate, TypeScript nativo |
| Estado servidor     | TanStack React Query 5 | Cache, revalidação, loading/error states    |
| Persistência local  | Expo SQLite 16 (WAL)   | Relacional, offline-first, transações       |
| Persistência segura | Expo SecureStore       | Tokens e flags sensíveis                    |

### Backend e IA

| Serviço           | Uso                                                     |
| ----------------- | ------------------------------------------------------- |
| Supabase          | Auth (email/senha), sincronização cloud, Edge Functions |
| Gemini Vision API | Extração de dados de embalagens e receitas              |
| Anthropic SDK     | Integração AI (disponível na lib)                       |

### Qualidade e DX

| Ferramenta            | Finalidade            |
| --------------------- | --------------------- |
| ESLint + Expo config  | Linting               |
| Prettier              | Formatação (80 chars) |
| Husky + lint-staged   | Pre-commit hooks      |
| Commitlint            | Conventional commits  |
| Jest + jest-expo      | Testes unitários      |
| React Testing Library | Testes de componentes |
| Bun                   | Package manager       |

---

## 4. Arquitetura

### Padrão Geral: Local-First com Sync Opcional

O Doser adota arquitetura **local-first**: o SQLite é a fonte de verdade primária. O Supabase é usado para backup/sync e autenticação, mas o app funciona completamente offline.

```
┌─────────────────────────────────────────────────────────┐
│                    Camada de Apresentação               │
│              app/ (Expo Router — file-based)            │
│   ┌──────────┐ ┌────────────┐ ┌────────────────────┐   │
│   │  (auth)/ │ │  (app)/    │ │  Modais Globais    │   │
│   │  login   │ │  (tabs)/   │ │  scan, edit, etc.  │   │
│   │  register│ │  home      │ │                    │   │
│   └──────────┘ │  medicines │ └────────────────────┘   │
│                │  schedule  │                           │
│                │  history   │                           │
│                └────────────┘                           │
├─────────────────────────────────────────────────────────┤
│                    Camada de Estado                     │
│   ┌──────────────────┐  ┌──────────────────────────┐   │
│   │  Zustand Store   │  │  TanStack React Query    │   │
│   │  selectedDate    │  │  doses, medicines,       │   │
│   │  activeProfile   │  │  schedules, adherence    │   │
│   │  dbReady         │  │  (queries + mutations)   │   │
│   └──────────────────┘  └──────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│                    Camada de Serviços (lib/)            │
│   database.ts │ auth.ts │ sync.ts │ notifications.ts   │
│   scanner     │ report  │ storage │ biometrics         │
├─────────────────────────────────────────────────────────┤
│                    Camada de Dados                      │
│   ┌──────────────────┐      ┌──────────────────────┐   │
│   │  SQLite Local    │◄────►│  Supabase PostgreSQL  │  │
│   │  (doser.db)      │ sync │  (cloud backup)       │   │
│   └──────────────────┘      └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Roteamento e Proteção

```
app/
├── index.tsx           ← Route Guard: verifica onboarding + sessão
├── (auth)/             ← Rotas públicas (stack modal)
│   ├── login
│   ├── register
│   ├── onboarding
│   └── ...
└── (app)/              ← Rotas protegidas (requer auth)
    ├── _layout.tsx     ← Inicializa DB, profile, notificações
    └── (tabs)/         ← Navegação principal (bottom tabs)
        ├── index       ← Home (doses do dia)
        ├── medicines
        ├── schedule
        └── history
```

**Fluxo de inicialização:**

1. `app/index.tsx` verifica flag de onboarding (`expo-secure-store`)
2. Se onboarding pendente → `/onboarding`
3. Se sem sessão Supabase → `/login`
4. Caso contrário → `/(app)/(tabs)`
5. `(app)/_layout.tsx` inicializa SQLite, carrega perfil ativo, registra handlers de notificação

---

## 5. Modelo de Domínio

```
Profile (1) ──────────────────────────────────────────────┐
   │                                                       │
   │ (1:N)                                                 │
   ▼                                                       │
Medicine (N) ──────────────────────────────────────────────┤
   │                                                       │
   │ (1:N)                                                 │
   ▼                                                       │
Schedule (N) ──────────────────────────────────────────────┤
   │                                                       │
   │ (1:N) generates                                       │
   ▼                                                       │
Dose (N) ──────────────────────────────────────────────────┘
```

### Entidades

#### Profile

```typescript
interface Profile {
  id: number;
  name: string;
  color: string; // hex — identificação visual
  isDefault: boolean;
  createdAt: string;
}
```

#### Medicine

```typescript
type MedicineType = 'capsule' | 'tablet' | 'drop' | 'ml' | 'injection' | 'other';

interface Medicine {
  id: number;
  profileId: number;
  name: string;
  type: MedicineType;
  stockQuantity: number;
  stockUnit: string; // "comprimidos", "ml", etc.
  photoUri?: string;
  lowStockThreshold: number; // alerta de estoque baixo
  createdAt: string;
}
```

#### FrequencyConfig (embedded em Schedule)

```typescript
type FrequencyType = 'interval_hours' | 'specific_days' | 'fixed_cycle';

interface FrequencyConfig {
  type: FrequencyType;
  intervalHours?: number; // a cada N horas
  specificDays?: number[]; // 0=Dom, 1=Seg, ..., 6=Sáb
  daysOn?: number; // ciclo fixo: N dias tomando
  daysOff?: number; // ciclo fixo: N dias sem tomar
  times: string[]; // ["08:00", "20:00"]
}
```

#### Schedule

```typescript
interface Schedule {
  id: number;
  profileId: number;
  medicineId: number;
  medicineName?: string; // join — não persisted
  dosage: string; // "500mg"
  doseQuantity: number; // unidades por dose (debitadas do estoque)
  frequencyConfig: FrequencyConfig;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}
```

#### Dose

```typescript
type DoseStatus = 'pending' | 'taken' | 'skipped' | 'snoozed';

interface Dose {
  id: number;
  profileId: number;
  scheduleId: number;
  medicineId: number;
  // campos desnormalizados para performance de leitura:
  medicineName?: string;
  medicineType?: MedicineType;
  medicinePhotoUri?: string;
  dosage?: string;
  scheduledTime: string; // ISO datetime local
  takenTime?: string;
  status: DoseStatus;
  skipReason?: string;
  notificationId?: string; // ID da notificação Expo
}
```

---

## 6. Design do Banco de Dados

### SQLite (fonte de verdade local)

```sql
PRAGMA journal_mode = WAL;   -- concorrência e performance
PRAGMA foreign_keys = ON;    -- integridade referencial

CREATE TABLE profiles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  color       TEXT    NOT NULL DEFAULT '#4A90D9',
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE medicines (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id           INTEGER NOT NULL,
  name                 TEXT    NOT NULL,
  type                 TEXT    NOT NULL,
  stock_quantity       REAL    NOT NULL DEFAULT 0,
  stock_unit           TEXT    NOT NULL DEFAULT 'unidades',
  photo_uri            TEXT,
  low_stock_threshold  REAL    DEFAULT 5,
  updated_at           TEXT,
  created_at           TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE schedules (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id       INTEGER NOT NULL,
  medicine_id      INTEGER NOT NULL,
  dosage           TEXT    NOT NULL,
  dose_quantity    REAL    NOT NULL DEFAULT 1,
  frequency_config TEXT    NOT NULL,   -- JSON string
  start_date       TEXT    NOT NULL,
  end_date         TEXT,
  is_active        INTEGER DEFAULT 1,
  updated_at       TEXT,
  created_at       TEXT    DEFAULT (datetime('now')),
  FOREIGN KEY (profile_id)  REFERENCES profiles(id)  ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE CASCADE
);

CREATE TABLE doses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id      INTEGER NOT NULL,
  schedule_id     INTEGER NOT NULL,
  medicine_id     INTEGER NOT NULL,
  scheduled_time  TEXT    NOT NULL,
  taken_time      TEXT,
  status          TEXT    DEFAULT 'pending',
  skip_reason     TEXT,
  notification_id TEXT,
  updated_at      TEXT,
  FOREIGN KEY (profile_id)  REFERENCES profiles(id)   ON DELETE CASCADE,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id)  ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id)  ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_medicines_profile_id  ON medicines(profile_id);
CREATE INDEX idx_schedules_profile_id  ON schedules(profile_id);
CREATE INDEX idx_doses_profile_id      ON doses(profile_id);
CREATE INDEX idx_doses_scheduled_time  ON doses(scheduled_time);
```

### Estratégia de Migração

O `initDatabase()` usa `ensureColumn()` (verifica `PRAGMA table_info`) antes de `ALTER TABLE`. Isso evita migrações versionadas separadas para adição de colunas, mas **novas tabelas ou alterações destrutivas** devem usar versionamento formal se introduzidas.

### Supabase (PostgreSQL — cloud)

Espelha o schema SQLite com adição de `user_id` (UUID do Supabase Auth) para multi-tenancy na nuvem. A sincronização usa `updated_at` como vetor de conflito (last-write-wins).

---

## 7. Módulos e Responsabilidades

### `lib/database.ts`

Única interface com o SQLite. Todas as queries passam por aqui.

**Responsabilidades:**

- Inicialização e migração do banco
- CRUD de profiles, medicines, schedules, doses
- Geração de doses a partir de schedules
- Realinhamento de doses de intervalo
- Projeção de estoque
- Métricas de adesão (streak, adherence por dia)

**Invariante crítico:** toda função de escrita exige `activeProfileId` configurado via `setActiveProfileId()`. Isso garante isolamento de dados entre perfis.

### `lib/store.ts`

Estado global mínimo com Zustand.

```typescript
{
  selectedDate: string,      // data visualizada no Home
  dbReady: boolean,          // DB inicializado?
  activeProfile: Profile | null
}
```

Não armazena dados de domínio (doses, medicines) — esses vivem no React Query.

### `lib/auth.ts`

Wrapper sobre Supabase Auth com tratamento de erros em português.

**Funções expostas:** `signIn`, `signUp`, `signOut`, `sendPasswordReset`, `updatePassword`, `getSession`, `getCurrentUser`, `onAuthStateChange`, `mapAuthError`

### `lib/sync.ts`

Sincronização bidirecional SQLite ↔ Supabase.

- `syncToCloud()`: upsert de medicines/schedules/doses no Supabase
- `pullFromCloud()`: download e merge no SQLite local
- **Conflito:** last-write-wins via `updated_at`
- Disparado ao abrir o app (foreground) e ao fazer login

### `lib/notifications.ts`

Gerencia lembretes via `expo-notifications`.

- Agenda uma notificação por dose futura pendente
- Suporta snooze (cancela e reagenda N minutos à frente)
- `rescheduleAllPendingDoses()`: reprocessa todas as doses sem notificação agendada
- **Importante:** só funciona em development builds; desabilitado no Expo Go

### `lib/scan-cache.ts`

Cache local (SQLite) de resultados de scan para evitar chamadas redundantes à API Gemini.

### `lib/storage.ts`

Abstração sobre `expo-secure-store` para flags persistentes:

| Chave                     | Valor    |
| ------------------------- | -------- |
| `doser_onboarding_done`   | `"true"` |
| `doser_active_profile_id` | `"<id>"` |

### `lib/report.ts`

Gera HTML formatado com métricas de adesão, converte para PDF via `expo-print` e compartilha via `expo-sharing`.

### `lib/biometrics.ts`

Autenticação biométrica opcional (fingerprint/Face ID).

- Verifica suporte do dispositivo
- Persiste preferência do usuário no SecureStore
- Relocking automático ao enviar app para background (configurable timeout)

### `lib/medicine-scanner.ts` / `lib/prescription-scanner.ts`

Chamam Supabase Edge Functions que invocam Gemini Vision para extrair dados estruturados de imagens.

**Retorno do scan de embalagem:**

```typescript
{
  name: string,
  concentration: string,
  type: MedicineType,
  quantity: number,
  unit: string
}
```

### `components/ui/`

Primitivos de UI reutilizáveis: `Button`, `Card`, `Input`, `Badge`, `Text`, `EmptyState`, `ScreenHeader`, `Skeleton`, etc. Todos theme-aware via `useTheme()`.

---

## 8. Fluxos Principais

### 8.1 Cadastro e Primeira Execução

```
Instala app
    │
    ▼
index.tsx verifica flag onboarding
    │
    ├─ pendente ──► /onboarding ──► solicita permissões ──► /register ou /login
    │
    └─ completo ──► verifica sessão Supabase
                        │
                        ├─ sem sessão ──► /login
                        │
                        └─ com sessão ──► /(app)/(tabs) ──► initDatabase() ──► carrega perfil
```

### 8.2 Marcar Dose como Tomada

```
Usuário clica "Tomar" na dose
    │
    ▼
updateDoseStatus(id, 'taken', takenTime)
    │
    ├─► Atualiza status e taken_time na tabela doses
    │
    ├─► Debita dose_quantity do medicine.stock_quantity (via UPDATE atômico)
    │
    ├─► Se frequência = interval_hours:
    │       realignIntervalSchedule(scheduleId, takenTime)
    │           ├─ Deleta doses futuras pendentes
    │           ├─ Atualiza anchor time no frequency_config
    │           └─ Regenera doses a partir do novo anchor
    │
    └─► Cancela notificação agendada (cancelNotification)
```

### 8.3 Scan de Embalagem

```
Usuário abre scan-medicine.tsx
    │
    ▼
expo-image-picker captura/seleciona imagem
    │
    ▼
scan-cache.ts verifica cache local (hash da imagem)
    │
    ├─ cache hit ──► retorna resultado cached
    │
    └─ cache miss
            │
            ▼
        medicine-scanner.ts → POST supabase/functions/scan-medicine
            │
            ▼
        Edge Function: Gemini 2.5 Flash processa imagem
            │
            ▼
        Retorna { name, concentration, type, quantity, unit }
            │
            ▼
        scan-cache.ts salva resultado
            │
            ▼
        Navega para add-medicine.tsx com dados pré-preenchidos
```

### 8.4 Sincronização com Cloud

```
App retorna ao foreground  ──►  sync.ts.syncToCloud()
    │
    ├─ Upsert medicines ON CONFLICT(id) DO UPDATE
    ├─ Upsert schedules
    └─ Upsert doses

Login bem-sucedido  ──►  sync.ts.pullFromCloud()
    │
    └─ SELECT * FROM supabase WHERE user_id = ?  →  INSERT OR REPLACE INTO sqlite
```

---

## 9. Algoritmos-Chave

### 9.1 Geração de Doses (`generateDosesForSchedule`)

Gera doses num horizonte de `daysAhead` dias (padrão: 30) a partir de agora.

**Tipo `interval_hours`**

```
anchor = times[0]  (ex: "08:00")
next   = próximo múltiplo de intervalHours a partir de agora
while next <= finalEnd:
    INSERT dose se não existe (idempotente)
    next += intervalHours * 3600000 ms
```

**Tipo `specific_days`**

```
for each day in [now .. finalEnd]:
    if day.getDay() in specificDays:
        for each time in times:
            INSERT dose se não existe
```

**Tipo `fixed_cycle`**

```
cycleLen = daysOn + daysOff
dayIndex = floor((day - startDate) / msPerDay)
for each day in [now .. finalEnd]:
    posInCycle = dayIndex % cycleLen
    if posInCycle < daysOn:
        for each time in times:
            INSERT dose se não existe
    dayIndex++
```

**Idempotência:** antes de cada INSERT, verifica `SELECT id FROM doses WHERE schedule_id = ? AND scheduled_time = ?`. Isso permite re-executar geração sem duplicatas.

### 9.2 Realinhamento de Intervalo (`realignIntervalSchedule`)

Executado quando o usuário toma uma dose em horário diferente do agendado, em schedules do tipo `interval_hours`.

```
1. Carrega schedule e verifica type == 'interval_hours'
2. Delete todas as doses pendentes futuras do schedule
   (e cancela suas notificações)
3. Recalcula próximo horário: takenTime + intervalMs
4. Regenera doses do novo anchor até finalEnd
5. Persiste novo anchor em frequency_config.times[0]
```

**Exemplo:** schedule de 8 em 8h com anchor 08:00. Usuário toma às 00:15. Novo anchor = 00:15. Próximas doses: 08:15, 16:15, 00:15.

### 9.3 Cálculo de Adesão

**Taxa diária:** `taken / total` para cada dia.  
**Streak:** dias consecutivos retroativos com taxa >= 80% (exclui hoje).

```
SELECT date, COUNT(*) total, SUM(status='taken') taken
FROM doses
WHERE date < today AND status != 'pending'
GROUP BY date
ORDER BY date DESC
LIMIT 90
```

Iteração: verifica se `rows[i].date == today - (i+1)`. Se a sequência quebrar, para.

### 9.4 Projeção de Estoque

```
consumoDiario =
  interval_hours:  (24 / intervalHours) * doseQuantity
  specific_days:   (diasSemana / 7) * times.length * doseQuantity
  fixed_cycle:     (daysOn / (daysOn+daysOff)) * times.length * doseQuantity

diasRestantes = floor(stockQuantity / consumoDiario)
estimatedEndDate = today + diasRestantes
```

---

## 10. Segurança

### Autenticação

- Supabase Auth com email/senha
- Sessão JWT armazenada em `expo-secure-store` (keychain iOS / keystore Android)
- Auto-refresh de sessão habilitado
- Biometria opcional: exige autenticação ao retornar do background

### Isolamento de Dados

- Todas as queries SQLite filtram por `profile_id` (via `requireActiveProfileId()`)
- FK com `ON DELETE CASCADE` garante que deletar um perfil limpa todos os seus dados
- No Supabase, RLS (Row Level Security) filtra por `user_id`

### Dados Sensíveis

| Dado                        | Armazenamento                               |
| --------------------------- | ------------------------------------------- |
| JWT / tokens de sessão      | SecureStore (criptografado)                 |
| API keys (Gemini, Supabase) | `.env` + Expo EAS Secrets                   |
| Chave biométrica            | Keychain/Keystore nativo                    |
| Dados de medicamentos       | SQLite local (não criptografado por padrão) |

### Comunicação

- Supabase: HTTPS/TLS obrigatório
- Edge Functions: autenticação via Bearer token do Supabase

---

## 11. Requisitos Não-Funcionais

### Performance

| Operação                     | Meta             |
| ---------------------------- | ---------------- |
| Abertura do app (cold start) | < 3s             |
| Carregamento de doses do dia | < 200ms          |
| Geração de doses (30 dias)   | < 500ms          |
| Resposta de notificação      | imediata (local) |

**Estratégias:** WAL mode no SQLite, índices em `profile_id` e `scheduled_time`, React Query staleTime de 30s, geração de doses feita no background ao criar schedule.

### Disponibilidade Offline

O app funciona 100% offline. A conexão com internet é necessária apenas para:

- Login / cadastro
- Sincronização cloud
- Scan de embalagem/receita via Gemini

### Escalabilidade de Dados Local

SQLite suporta confortavelmente o volume esperado:

- ~10 medicamentos por perfil
- ~10 doses/dia × 365 dias = ~3.650 doses/ano
- ~3 perfis por instalação

### Consistência de Dados

- Transações SQLite garantem atomicidade no debit de estoque ao marcar dose
- Geração de doses é idempotente (safe para re-executar)
- Sync usa `updated_at` como vetor de conflito; política: last-write-wins

---

## 12. Build e Deploy

### Scripts

```nu
bun run start       # servidor de desenvolvimento (Expo Go / dev build)
bun run android     # build para Android
bun run ios         # build para iOS
bun run web         # versão web
bun run test        # testes Jest
bun run format      # Prettier
bun run lint        # ESLint
```

### Variáveis de Ambiente

```env
EXPO_PUBLIC_SUPABASE_URL=<url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<key>
EXPO_PUBLIC_GEMINI_API_KEY=<key>
SUPABASE_PROJECT_ID=<id>
```

Variáveis prefixadas com `EXPO_PUBLIC_` são injetadas em tempo de build e ficam no bundle. **Não expor chaves secretas com esse prefixo.**

### EAS (Expo Application Services)

Configuração em `eas.json`. Profiles: `development`, `preview`, `production`.

### Git Hooks (Husky)

- **pre-commit:** lint-staged (ESLint + Prettier nos arquivos staged)
- **commit-msg:** commitlint (conventional commits: `feat:`, `fix:`, `refactor:`, etc.)

---

## 13. Decisões de Design (ADRs)

### ADR-001: Local-First com SQLite

**Decisão:** SQLite como fonte de verdade primária, Supabase como backup/sync opcional.  
**Razão:** Usuários de saúde precisam de confiabilidade mesmo sem internet. Perder o acesso a uma dose por falha de conectividade é inaceitável.  
**Trade-off:** Sincronização bidirecional é mais complexa; conflitos requerem estratégia explícita (last-write-wins).

### ADR-002: Zustand para Estado Global Mínimo

**Decisão:** Zustand armazena apenas `selectedDate`, `dbReady`, `activeProfile`.  
**Razão:** Dados de domínio vivem no React Query (cache server-side) ou no SQLite (fonte). Duplicar no Zustand causaria inconsistências e re-renders desnecessários.

### ADR-003: frequency_config como JSON no SQLite

**Decisão:** `FrequencyConfig` serializado como JSON string em vez de tabela normalizada.  
**Razão:** Os três tipos de frequência têm shapes radicalmente diferentes. Normalização exigiria 3 tabelas com colunas opcionais ou uma hierarquia complexa. JSON oferece flexibilidade e a leitura é sempre feita com o schedule inteiro.  
**Trade-off:** Impossível filtrar por campos do config via SQL.

### ADR-004: Dose Generation em vez de Cálculo On-the-Fly

**Decisão:** Doses são pré-geradas e armazenadas no banco (horizonte de 30 dias), não calculadas em runtime.  
**Razão:** Permite notificações agendadas com ID rastreável, marcação de status individual por dose, histórico preciso e queries simples.  
**Trade-off:** Requer job de regeneração periódica; dose table cresce com o tempo.

### ADR-005: Realinhamento Automático de Intervalo

**Decisão:** Ao tomar dose de schedule `interval_hours` fora do horário, realinhar todas as doses futuras.  
**Razão:** Medicamentos de intervalo (ex: antibiótico de 8h) dependem do tempo desde a última dose, não de horário fixo. Manter o horário original após atraso cria acúmulo incorreto.

### ADR-006: Supabase Edge Functions para Scan

**Decisão:** Chamadas ao Gemini Vision passam pelo Supabase Edge Function, não diretamente do app.  
**Razão:** Evita expor a API key do Gemini no bundle do app. Edge Functions rodam em ambiente controlado (Deno) com acesso seguro às variáveis de ambiente.

---

_Este documento deve ser atualizado a cada mudança arquitetural significativa. Mudanças incrementais (novas features dentro da arquitetura existente) não exigem atualização do SDD._
