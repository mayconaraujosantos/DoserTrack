# Spec: Gerenciamento de Agendamentos

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Criar e editar schedules de dose com frequências configuráveis

---

## Objetivo

Permitir que o usuário configure quando e em quais quantidades um medicamento deve ser tomado, suportando três padrões de frequência: intervalo em horas, dias específicos da semana e ciclo fixo (N dias on / N dias off).

## Contexto

Um schedule conecta um medicamento a uma regra de frequência e gera doses pré-calculadas num horizonte de 30 dias. Ao criar ou editar um schedule, as doses são regeneradas imediatamente. Schedules inativos não geram novas doses, mas preservam o histórico.

## Requisitos Funcionais

1. O usuário cria um schedule associando medicamento, dosagem, frequência e data de início
2. O usuário configura frequência por um de três modos:
   - **Intervalo em horas:** tomar a cada N horas, a partir de um horário âncora
   - **Dias específicos:** tomar em dias selecionados da semana, em horários fixos
   - **Ciclo fixo:** tomar N dias, parar N dias, repetir (com horários fixos)
3. O usuário pode definir data de término opcional
4. O usuário pode desativar um schedule sem excluí-lo (preserva histórico)
5. O usuário pode reativar um schedule desativado
6. Ao criar ou editar schedule, as doses são regeneradas no horizonte de 30 dias
7. O usuário pode excluir um schedule (remove schedules e doses futuras pendentes)

## Requisitos Não-Funcionais

- Geração de doses (30 dias) deve concluir em menos de 500ms
- Geração é idempotente: executar duas vezes não cria doses duplicadas
- Edição de schedule não duplica doses já marcadas (`taken` ou `skipped`)

## Regras de Negócio

- Um medicamento pode ter múltiplos schedules ativos simultaneamente
- `dose_quantity` deve ser > 0 (quantidade de unidades debitadas por dose)
- `start_date` não pode ser no passado ao criar (validado na UI)
- Horários (`times`) devem ser únicos por schedule (sem duplicatas)
- Ao desativar um schedule, doses futuras `pending` são removidas
- Ao reativar, doses são regeneradas a partir de hoje

## Critérios de Aceitação

- [ ] CA-01: Formulário valida campos obrigatórios (medicamento, dosagem, frequência, data início)
- [ ] CA-02: Ao criar schedule com `interval_hours`, doses são geradas em intervalos corretos
- [ ] CA-03: Ao criar schedule com `specific_days`, doses aparecem apenas nos dias selecionados
- [ ] CA-04: Ao criar schedule com `fixed_cycle`, doses respeitam os dias on/off a partir de `start_date`
- [ ] CA-05: Editar horário do schedule regenera doses futuras sem duplicar as já marcadas
- [ ] CA-06: Desativar schedule remove doses futuras `pending` e cancela suas notificações
- [ ] CA-07: Reativar schedule gera novas doses a partir de hoje
- [ ] CA-08: Excluir schedule remove doses futuras `pending`; doses históricas (`taken`/`skipped`) são mantidas
- [ ] CA-09: Geração de doses é idempotente (sem duplicatas ao re-executar)

## Casos de Erro

| Situação                                  | Comportamento esperado                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `start_date` no passado                   | Erro de validação; formulário não submete                               |
| Medicamento sem estoque ao criar schedule | Aviso visual; criação permitida                                         |
| Geração de doses falha parcialmente       | Toast de erro; schedule salvo sem doses (usuário pode tentar novamente) |

## Fora do Escopo

- Múltiplos schedules com horários conflitantes (não são bloqueados, apenas exibidos)
- Regras de frequência personalizadas além dos três modos suportados
- Importação de schedules de receitas digitais
- Dose split (ex: meio comprimido)
