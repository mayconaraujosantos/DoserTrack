# AGENTS.md — Doser Spec-Driven Development

## Papéis dos Agentes

### Spec Architect _(agente de criação)_

**Responsabilidade:** Criar e manter especificações claras, orientadas a comportamento.

- Escreve e atualiza arquivos em `specs/`
- **Nunca escreve código de produção**
- Garante que todo critério de aceitação seja mensurável e testável
- Define explicitamente o que está fora do escopo
- Atualiza spec quando requisitos mudam — antes de qualquer código

### Software Engineer _(agente de implementação)_

**Responsabilidade:** Implementar código exclusivamente conforme as specs aprovadas.

- Lê a spec completa antes de qualquer implementação
- Cria `specs/<feature>.tasks.md` com tarefas derivadas dos critérios de aceitação
- Um teste por critério de aceitação (prefixar com `CA-XX`)
- **Não adiciona funcionalidades não descritas na spec**
- Marca cada critério de aceitação como `[x]` ao concluir

### Review Agent _(agente de validação)_

**Responsabilidade:** Validar que a implementação é fiel à especificação.

- Lê spec e código em paralelo
- Verifica cada critério de aceitação contra o código e os testes
- Valida cobertura mínima de 80%
- **Aprova ou rejeita** a feature com justificativa explícita
- Aponta divergências; nunca corrige silenciosamente

---

## Fluxo Obrigatório

```
1. Spec Architect  →  cria/atualiza specs/<feature>.md
2. Software Engineer  →  lê spec, cria specs/<feature>.tasks.md
3. Software Engineer  →  implementa código + testes (1 teste por CA)
4. Review Agent  →  valida spec ↔ código ↔ testes
5. Se divergências  →  volta ao passo 3 com lista de correções
6. Feature concluída após aprovação do Review Agent
```

---

## Restrições

- **Nenhum código sem spec aprovada.** Se não há spec, o Spec Architect cria antes.
- **Nenhuma funcionalidade além do descrito na spec.** Escopo extra → nova spec.
- **Cobertura mínima de testes: 80%.** Um teste por critério de aceitação.
- **Specs vagas não são aceitas.** Todo critério deve ser verificável por teste ou inspeção.
- **Nunca use `--no-verify`.** Se o pre-commit falhar, corrija o problema.

---

## Stack Tecnológica

| Camada          | Tecnologia                                                         |
| --------------- | ------------------------------------------------------------------ |
| Framework       | React Native 0.81.5 + Expo 54                                      |
| Linguagem       | TypeScript 5.9 (strict, sem `any`)                                 |
| Roteamento      | Expo Router 6 (file-based)                                         |
| Estado global   | Zustand 5 (`selectedDate`, `activeProfile`, `dbReady` — nada mais) |
| Estado servidor | TanStack React Query 5                                             |
| Banco local     | Expo SQLite 16 WAL — **sempre via `lib/database.ts`**              |
| Auth + Sync     | Supabase (PostgreSQL, RLS, Edge Functions)                         |
| IA              | Gemini Vision — via Edge Functions, nunca direto do app            |
| Testes          | Jest + jest-expo + React Testing Library                           |
| Package manager | Bun                                                                |

---

## Estrutura de Specs

```
specs/
  <feature>.md          # Spec comportamental da feature
  <feature>.tasks.md    # Tasks derivadas dos CAs (criado pelo Engineer)
```

### Template de Spec

```markdown
# Spec: <Nome da Feature>

**Versão:** X.Y
**Status:** Rascunho | Aprovado | Implementado | Depreciado
**Feature:** <descrição de uma linha>

## Objetivo

## Contexto

## Requisitos Funcionais

## Requisitos Não-Funcionais

## Regras de Negócio

## Critérios de Aceitação

- [ ] CA-01: <critério mensurável>

## Casos de Erro

## Fora do Escopo
```

---

## Regras de Código (para o Engineer)

- Toda operação SQLite passa por `lib/database.ts` — nunca use `expo-sqlite` diretamente
- Novos componentes visuais em `components/ui/`, sempre com `useTheme()`
- Dados de domínio (doses, medicines) vivem no React Query, **não** no Zustand
- Todos os tipos de domínio em `types/index.ts`
- Nunca use `any` — prefira `unknown` com type guard
- Commits seguem Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.)
- Sem comentários óbvios — comente apenas o "por quê" não-óbvio
