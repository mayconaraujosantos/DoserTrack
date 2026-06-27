# Spec: Notificações de Dose

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Lembretes locais agendados para cada dose pendente

---

## Objetivo

Garantir que o usuário receba lembretes no momento correto para cada dose agendada, com suporte a sonezar e cancelamento automático ao marcar a dose.

## Contexto

As notificações são locais (agendadas via `expo-notifications`, sem servidor). Cada dose gerada recebe um `notification_id` único. Ao criar ou regenerar doses, as notificações são agendadas automaticamente. Ao marcar uma dose, a notificação é cancelada. Notificações só funcionam em development builds; no Expo Go são ignoradas silenciosamente.

## Requisitos Funcionais

1. Ao gerar uma dose futura, o app agenda uma notificação local para o `scheduled_time`
2. A notificação exibe nome do medicamento, dosagem e horário
3. Ao marcar uma dose (`taken` ou `skipped`), a notificação correspondente é cancelada
4. Ao sonezar uma dose, a notificação é reagendada para N minutos à frente
5. O app reagenda notificações perdidas ao voltar ao foreground (`rescheduleAllPendingDoses`)
6. O usuário pode revogar permissão de notificações; o app funciona sem elas

## Requisitos Não-Funcionais

- Notificações funcionam apenas em development builds (não no Expo Go)
- Máximo de notificações agendadas simultâneas: 64 (limite do iOS)
- Reagendamento em foreground não deve bloquear a UI

## Regras de Negócio

- Uma notificação por dose; `notification_id` armazenado na linha da dose
- Notificação não é agendada para doses de perfis inativos ao trocar de perfil
- Ao revogar permissão, doses são marcadas normalmente; logs de erro são silenciosos
- Sonezar N minutos: nova notificação com `trigger = { date: now + N * 60 * 1000 }`

## Critérios de Aceitação

- [ ] CA-01: Dose gerada futura recebe notificação agendada para o `scheduled_time`
- [ ] CA-02: Notificação exibe nome do medicamento e dosagem no corpo
- [ ] CA-03: Marcar dose como `taken` cancela a notificação correspondente
- [ ] CA-04: Marcar dose como `skipped` cancela a notificação correspondente
- [ ] CA-05: Sonezar reagenda notificação para `now + N minutos` sem alterar `scheduled_time`
- [ ] CA-06: `rescheduleAllPendingDoses` agenda notificações para doses sem `notification_id`
- [ ] CA-07: App com permissão revogada não lança exceção ao tentar agendar

## Casos de Erro

| Situação                               | Comportamento esperado                                         |
| -------------------------------------- | -------------------------------------------------------------- |
| Permissão negada ao solicitar          | Toast informativo; app continua sem notificações               |
| Limite de 64 notificações atingido     | Agenda as 64 mais próximas; demais ficam sem `notification_id` |
| `notification_id` inválido ao cancelar | Ignora silenciosamente; não lança erro                         |

## Fora do Escopo

- Notificações push via servidor (todas são locais)
- Notificações no Expo Go
- Configuração de som/vibração por medicamento
- Notificações de estoque baixo (exibido apenas na UI)
