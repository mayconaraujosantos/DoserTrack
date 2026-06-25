# Doser — Guia para Claude

## Terminal

Todos os comandos devem ser escritos para **NuShell** (`nu`).
Nunca sugira comandos PowerShell ou Bash — use sempre o equivalente NuShell.

```nu
# NuShell usa `|` para pipe, sem `&&` — use ponto-e-vírgula ou `do`
bun run lint
bun run format
```

---

## Comandos de Desenvolvimento

| Tarefa                         | Comando                 |
| ------------------------------ | ----------------------- |
| Iniciar dev client (dev build) | `bun run start`         |
| Iniciar no Expo Go             | `bun run start:go`      |
| Rodar no Android               | `bun run android`       |
| Rodar no iOS                   | `bun run ios`           |
| Rodar na Web                   | `bun run web`           |
| Lint (ESLint)                  | `bun run lint`          |
| Formatar código (Prettier)     | `bun run format`        |
| Verificar formatação           | `bun run format:check`  |
| Rodar testes                   | `bun run test`          |
| Testes com cobertura           | `bun run test:coverage` |

> `bun run start` requer um **development build** instalado no dispositivo/emulador.
> Use `bun run start:go` para testar no Expo Go (funcionalidades nativas limitadas — notificações e biometria não funcionam).

---

## Fluxo de Desenvolvimento

### Antes de fazer commit

O Husky executa automaticamente no `pre-commit`:

```text
lint-staged → Prettier + ESLint --fix em arquivos staged
```

Se o pre-commit falhar, corrija antes de tentar novamente — nunca use `--no-verify`.

### Padrão de commit (Commitlint)

```text
feat: adicionar suporte a widget de tela inicial
fix(scan): tratar resposta inesperada da API Gemini
refactor(routing): extrair route guard para index.tsx
chore: atualizar dependências
docs: atualizar SDD com ADR-007
test: adicionar testes para geração de doses
```

Tipos válidos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`, `ci`

---

## Estrutura do Projeto

```text
app/          Rotas Expo Router (file-based)
  (auth)/     Fluxos públicos: login, register, onboarding
  (app)/      Rotas protegidas
    (tabs)/   Navegação principal: home, medicines, schedule, history
components/   UI components reutilizáveis
  ui/         Primitivos: Button, Card, Input, Badge, etc.
constants/    theme.ts (cores e fontes)
hooks/        Custom hooks (tema, color scheme)
lib/          Lógica de negócio e serviços
  database.ts Única interface com SQLite — toda query passa aqui
  store.ts    Zustand: selectedDate, activeProfile, dbReady
  auth.ts     Supabase Auth wrapper
  sync.ts     Sincronização local ↔ cloud
  notifications.ts Lembretes de dose
  scanner*    Integração Gemini Vision
  report.ts   Geração de PDF de adesão
types/        index.ts — todos os tipos de domínio
supabase/     Edge Functions (Deno) + config local
__tests__/    Testes Jest
```

---

## Regras de Código

### Banco de dados

- **Toda** operação no SQLite passa por `lib/database.ts` — nunca use `expo-sqlite` diretamente nas screens.
- Funções de escrita exigem `setActiveProfileId()` configurado; se não estiver, lança erro.
- Novas colunas: use o padrão `ensureColumn(table, column, definition)` já existente.
- Novas tabelas ou alterações destrutivas: documente no SDD (`docs/SDD.md`).

### Estado

- **Zustand** (`lib/store.ts`): apenas `selectedDate`, `activeProfile`, `dbReady`. Não adicione dados de domínio aqui.
- **React Query**: use para todos os dados lidos do SQLite — queries + mutations com `invalidateQueries`.

### Tipos

- Todos os tipos de domínio em `types/index.ts`.
- Nunca use `any` — prefira `unknown` com type guard se necessário.

### Componentes

- Novos componentes visuais vão em `components/ui/`.
- Use `useTheme()` para cores — nunca hardcode hex fora de `constants/theme.ts`.

---

## Arquitetura Resumida

**Local-first:** SQLite é a fonte de verdade. Supabase é backup/sync opcional.

```text
Screen → React Query → lib/database.ts → SQLite
                    ↕ (sync periódico)
              lib/sync.ts → Supabase
```

**Isolamento de perfis:** todo dado é filtrado por `profile_id`. Ao trocar de perfil, chame `setActiveProfileId(id)`.

**Dose generation:** doses são pré-geradas (horizonte 30 dias) e armazenadas — não calculadas on-the-fly. Ao criar/editar um schedule, chame `generateDosesForSchedule()`.

Documentação detalhada: [`docs/SDD.md`](docs/SDD.md)

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GEMINI_API_KEY=
SUPABASE_PROJECT_ID=
```

`EXPO_PUBLIC_*` fica no bundle — **não** coloque chaves secretas com esse prefixo.
