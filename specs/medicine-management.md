# Spec: Gerenciamento de Medicamentos

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** CRUD de medicamentos com controle de estoque por perfil

---

## Objetivo

Permitir que o usuário cadastre, edite, visualize e remova medicamentos do perfil ativo, com controle de quantidade em estoque e alerta de estoque baixo.

## Contexto

Medicamentos são a entidade central do Doser. Cada medicamento pertence a um perfil e pode ter múltiplos schedules associados. O estoque é decrementado automaticamente a cada dose marcada como tomada. O usuário pode atualizar o estoque manualmente (ex: ao comprar mais).

## Requisitos Funcionais

1. O usuário pode cadastrar um medicamento informando nome, tipo, quantidade inicial em estoque, unidade e limiar de alerta
2. O usuário pode fotografar ou selecionar imagem da embalagem para associar ao medicamento
3. O usuário pode editar qualquer campo do medicamento após o cadastro
4. O usuário pode excluir um medicamento (exclusão em cascata de schedules e doses)
5. O usuário vê a lista de medicamentos do perfil ativo com estoque atual
6. O app exibe alerta visual quando `stock_quantity <= low_stock_threshold`
7. O usuário pode atualizar o estoque manualmente (ex: ao comprar nova caixa)

## Requisitos Não-Funcionais

- Lista de medicamentos deve carregar em menos de 300ms
- Imagem da embalagem deve ser comprimida antes de armazenar (máx 1MB)
- Exclusão com schedules ativos exige confirmação do usuário

## Regras de Negócio

- Nome do medicamento é obrigatório e único por perfil
- `stock_quantity` nunca é negativo (mínimo: 0)
- `low_stock_threshold` padrão: 5 unidades
- Exclusão de medicamento remove em cascata schedules e doses (FK `ON DELETE CASCADE`)
- Imagem é armazenada como URI local (`photo_uri`); não é sincronizada para cloud
- Tipos válidos: `capsule`, `tablet`, `drop`, `ml`, `injection`, `other`

## Critérios de Aceitação

- [ ] CA-01: Formulário de cadastro valida campos obrigatórios antes de salvar
- [ ] CA-02: Medicamento criado aparece na lista do perfil ativo imediatamente
- [ ] CA-03: Badge de alerta aparece quando `stock_quantity <= low_stock_threshold`
- [ ] CA-04: Editar medicamento persiste todos os campos alterados
- [ ] CA-05: Excluir medicamento com schedules ativos exibe modal de confirmação
- [ ] CA-06: Após exclusão, medicamento e seus schedules/doses desaparecem da UI
- [ ] CA-07: Atualização manual de estoque reflete na lista e no badge de alerta
- [ ] CA-08: Imagem selecionada aparece no card do medicamento após cadastro
- [ ] CA-09: Medicamentos de outros perfis não aparecem na lista do perfil ativo

## Casos de Erro

| Situação                       | Comportamento esperado                          |
| ------------------------------ | ----------------------------------------------- |
| Nome duplicado no mesmo perfil | Erro de validação no formulário antes de salvar |
| Falha ao salvar imagem         | Medicamento é salvo sem imagem; toast de aviso  |
| Banco indisponível             | Toast de erro; dados não são alterados          |

## Fora do Escopo

- Verificação de interações medicamentosas
- Integração com base de dados de bulas (ANVISA, etc.)
- Sincronização de imagens de embalagem para o cloud
- Código de barras ou QR code para cadastro
