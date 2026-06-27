# Spec: Controle de Doses

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Registrar o status de cada dose agendada (tomada, pulada, sonezada)

---

## Objetivo

Permitir que o usuário registre o status de cada dose do dia, atualizando automaticamente o estoque do medicamento e realinhando as próximas doses de schedules por intervalo.

## Contexto

O Doser pré-gera doses num horizonte de 30 dias e as exibe na Home agrupadas por data. Cada dose nasce com status `pending`. Ao interagir com ela, o usuário sinaliza se a tomou, pulou ou quer ser lembrado novamente. O sistema deve reagir a cada ação de forma atômica: atualizar status, debitar estoque e recalcular horários futuros quando necessário.

## Requisitos Funcionais

1. O usuário pode marcar uma dose como **tomada** (`taken`)
2. O usuário pode marcar uma dose como **pulada** (`skipped`), com motivo opcional
3. O usuário pode **sonezar** (`snoozed`) uma dose, reagendando o lembrete em N minutos
4. Ao marcar `taken`, o `stock_quantity` do medicamento é debitado em `dose_quantity`
5. Ao marcar `taken` em schedule `interval_hours`, todas as doses futuras `pending` do mesmo schedule são deletadas e regeneradas a partir do `taken_time`
6. A notificação Expo agendada para a dose é cancelada ao marcar `taken` ou `skipped`
7. A Home exibe doses do dia selecionado, ordenadas por `scheduled_time`
8. Doses de perfis inativos não aparecem na Home

## Requisitos Não-Funcionais

- Marcar dose deve completar em menos de 200ms (operação local SQLite)
- A UI atualiza o status de forma otimista via `invalidateQueries` do React Query

## Regras de Negócio

- Somente o perfil ativo (`activeProfileId`) pode registrar doses
- Dose com status `taken` ou `skipped` não pode ser revertida pela UI
- O débito de estoque e a atualização de status ocorrem em transação SQLite única
- Sonezar não muda o `scheduled_time` original; apenas agenda nova notificação
- Estoque não fica negativo: debita até zero e exibe alerta de estoque baixo

## Critérios de Aceitação

- [ ] CA-01: Tocar "Tomar" muda o status para `taken` e atualiza o ícone imediatamente
- [ ] CA-02: O campo `taken_time` é gravado com o datetime atual (ISO local)
- [ ] CA-03: O `stock_quantity` do medicamento cai em exatamente `dose_quantity` unidades
- [ ] CA-04: A notificação da dose é cancelada após marcar `taken` ou `skipped`
- [ ] CA-05: Para schedule `interval_hours`, doses futuras `pending` são recalculadas a partir de `taken_time` após marcar `taken`
- [ ] CA-06: O motivo de pulo (se informado) é salvo em `skip_reason`
- [ ] CA-07: Sonezar agenda nova notificação N minutos à frente sem alterar `scheduled_time`
- [ ] CA-08: Doses de perfis inativos não são exibidas na Home
- [ ] CA-09: Estoque nunca fica negativo; alerta é exibido quando `stock_quantity <= low_stock_threshold`

## Casos de Erro

| Situação                          | Comportamento esperado                                      |
| --------------------------------- | ----------------------------------------------------------- |
| Banco indisponível ao marcar      | Toast de erro; UI não muda de estado                        |
| `activeProfileId` não configurado | `Error` lançado antes da escrita; operação abortada         |
| `doseQuantity` > `stockQuantity`  | Debita até zero; exibe alerta de estoque insuficiente       |
| Notificação sem permissão         | Marca dose normalmente; ignora cancelamento silenciosamente |

## Fora do Escopo

- Reverter uma dose já marcada (`taken` ou `skipped`)
- Editar o horário agendado de uma dose individual
- Registrar observações clínicas ou notas na dose
- Histórico de alterações de status por dose
