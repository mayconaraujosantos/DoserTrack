# Spec: Múltiplos Perfis

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Gerenciar medicamentos de múltiplas pessoas (usuário + familiares) em um único app

---

## Objetivo

Permitir que o usuário gerencie medicamentos de múltiplas pessoas (ex: cônjuge, filho, pai) dentro de um único aplicativo, com isolamento total de dados entre perfis.

## Contexto

Um único usuário pode ser responsável por medicamentos de várias pessoas da família. O Doser suporta múltiplos perfis locais, cada um com seu próprio conjunto de medicamentos, schedules, doses e histórico. O perfil ativo determina quais dados aparecem em toda a UI.

## Requisitos Funcionais

1. O usuário pode criar até N perfis (sem limite definido em v1)
2. Cada perfil tem nome e cor de identificação visual
3. Um perfil é marcado como padrão (`isDefault`); é ativado na abertura do app
4. O usuário pode trocar o perfil ativo a qualquer momento
5. O usuário pode editar nome e cor de um perfil
6. O usuário pode excluir um perfil (com confirmação; exclui todos os dados do perfil em cascata)
7. Toda a UI (Home, Medicines, Schedule, History) filtra dados pelo perfil ativo

## Requisitos Não-Funcionais

- Troca de perfil deve refletir na UI em menos de 300ms
- Exclusão de perfil com muitos dados pode levar até 2s (feedback de loading obrigatório)

## Regras de Negócio

- Sempre existe pelo menos um perfil; o último perfil não pode ser excluído
- O perfil padrão não pode ser excluído enquanto for o único padrão
- Ao trocar de perfil, `setActiveProfileId(id)` é chamado no Zustand e no `lib/database.ts`
- Toda query SQLite filtra por `profile_id = activeProfileId` (invariante crítico)
- A cor do perfil é um hex válido (`#RRGGBB`)

## Critérios de Aceitação

- [ ] CA-01: Criar perfil com nome e cor válidos persiste e aparece na lista de perfis
- [ ] CA-02: Trocar perfil ativo muda os dados exibidos em toda a UI (Home, Medicines, etc.)
- [ ] CA-03: Medicamentos e doses de um perfil não aparecem ao visualizar outro perfil
- [ ] CA-04: Perfil padrão é carregado automaticamente ao abrir o app
- [ ] CA-05: Editar nome/cor do perfil atualiza a exibição imediatamente
- [ ] CA-06: Excluir perfil exibe modal de confirmação com aviso sobre perda de dados
- [ ] CA-07: Após exclusão, todos os medicamentos, schedules e doses do perfil são removidos
- [ ] CA-08: Tentativa de excluir o último perfil exibe erro e é bloqueada

## Casos de Erro

| Situação               | Comportamento esperado                                          |
| ---------------------- | --------------------------------------------------------------- |
| Nome de perfil vazio   | Validação no formulário; não salva                              |
| Excluir último perfil  | Bloqueado com mensagem de erro explicativa                      |
| Cor inválida (não-hex) | Usa seletor de cores na UI; não permite entrada manual inválida |
| Falha ao trocar perfil | Toast de erro; mantém perfil anterior ativo                     |

## Fora do Escopo

- Compartilhamento de perfil com outros usuários (ex: cuidador remoto)
- Sincronização de perfil entre dispositivos diferentes do mesmo usuário
- Limite máximo de perfis (sem restrição em v1)
- Permissões por perfil (ex: senha separada por perfil)
