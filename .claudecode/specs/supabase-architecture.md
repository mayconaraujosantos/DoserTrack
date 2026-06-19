# Supabase Architecture — Especificação

## Visão Geral

O Doser usa Supabase como backend de autenticação e sincronização em nuvem. O banco local (SQLite via expo-sqlite) é a fonte de verdade primária; o Supabase é usado para persistência remota e sincronização entre dispositivos.

---

## Autenticação

### Provedor

- **Supabase Auth** com email + senha (`signInWithPassword`)
- Sessão armazenada via `expo-secure-store` (SecureStoreAdapter em `lib/supabase.ts`)
- Token de sessão auto-renovado (`autoRefreshToken: true`)

### Funções em `lib/auth.ts`

| Função                          | Supabase API                      | Descrição                      |
| ------------------------------- | --------------------------------- | ------------------------------ |
| `signIn(email, password)`       | `auth.signInWithPassword`         | Login com email/senha          |
| `signUp(email, password, name)` | `auth.signUp` + `auth.updateUser` | Cadastro + define display name |
| `signOut()`                     | `auth.signOut`                    | Logout                         |
| `sendPasswordReset(email)`      | `auth.resetPasswordForEmail`      | Envia e-mail de reset          |
| `getSession()`                  | `auth.getSession`                 | Retorna sessão atual ou null   |
| `onAuthStateChange(cb)`         | `auth.onAuthStateChange`          | Listener de mudanças de auth   |

### Configuração Supabase Client

```typescript
// lib/supabase.ts
createClient(url, anonKey, {
  auth: {
    storage: SecureStoreAdapter, // expo-secure-store
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### Variáveis de Ambiente

```
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Sincronização de Dados

### Estratégia: Offline-First com Supabase como espelho

```
SQLite (local) ←→ Supabase PostgreSQL (nuvem)
     ↑
  fonte de verdade primária
```

### Quando sincroniza:

- `pullFromCloud()`: ao evento `SIGNED_IN` (baixa dados do servidor)
- `syncToCloud()`: ao retornar do background (envia mudanças locais)

### Resolução de Conflitos

- **Last-write-wins** baseado em `updated_at`
- Na pull: `INSERT ... ON CONFLICT DO UPDATE SET ... WHERE excluded.updated_at > local.updated_at`
- Na push: `upsert({ onConflict: 'id' })`

---

## Estrutura de Tabelas no Supabase

### `medicines`

```sql
id               TEXT PRIMARY KEY
user_id          UUID REFERENCES auth.users
profile_id       INTEGER
name             TEXT
type             TEXT
stock_quantity   REAL
stock_unit       TEXT
photo_uri        TEXT
low_stock_threshold INTEGER
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### `schedules`

```sql
id               TEXT PRIMARY KEY
user_id          UUID REFERENCES auth.users
profile_id       INTEGER
medicine_id      TEXT
dosage           TEXT
frequency_config JSONB
start_date       TEXT
end_date         TEXT
is_active        BOOLEAN
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### `doses`

```sql
id               TEXT PRIMARY KEY
user_id          UUID REFERENCES auth.users
profile_id       INTEGER
schedule_id      TEXT
medicine_id      TEXT
scheduled_time   TEXT
taken_time       TEXT
status           TEXT
skip_reason      TEXT
notification_id  TEXT
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### Row Level Security (RLS)

Todas as tabelas devem ter RLS habilitado:

```sql
-- Exemplo para medicines
CREATE POLICY "users see own data"
  ON medicines FOR ALL
  USING (auth.uid() = user_id);
```

---

## Edge Functions

Localizadas em `supabase/functions/`:

### `scan-prescription/`

- Recebe imagem em base64
- Usa Gemini Vision API para extrair medicamentos da receita
- Retorna array de `{ name, type, dosage, frequency }`

### `scan-medicine/`

- Recebe imagem em base64
- Usa Gemini Vision API para ler embalagem do medicamento
- Retorna `{ name, type, strength, unit }`

### Variável de Ambiente (Edge Function)

```
GEMINI_API_KEY=<chave-gemini>
```

---

## Fluxo de Auth no \_layout.tsx

```typescript
onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    pullFromCloud(); // sincroniza dados do servidor
  }
  if (event === 'SIGNED_OUT') {
    router.replace('/login');
  }
  if (event === 'PASSWORD_RECOVERY') {
    router.replace('/reset-password');
  }
});
```

---

## Erros Supabase → Mensagens de UI

| AuthError.code               | Exibir para usuário                          |
| ---------------------------- | -------------------------------------------- |
| `invalid_credentials`        | "E-mail ou senha inválidos."                 |
| `email_address_invalid`      | "Digite um e-mail válido."                   |
| `user_already_exists`        | "Este e-mail já está cadastrado."            |
| `weak_password`              | "Use ao menos 6 caracteres na senha."        |
| `over_email_send_rate_limit` | "Muitas tentativas. Aguarde alguns minutos." |
| (outros)                     | "Erro inesperado. Tente novamente."          |
