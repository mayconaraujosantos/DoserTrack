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

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (60-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk go test             # Go test failures only (90%)
rtk jest                # Jest failures only (99.5%)
rtk vitest              # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk pytest              # Python test failures only (90%)
rtk rake test           # Ruby test failures only (90%)
rtk rspec               # RSpec test failures only (60%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%). Format flags (-c, -l, -L, -o, -Z) run raw.
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->
