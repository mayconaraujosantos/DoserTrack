# Spec: Relatório de Adesão em PDF

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Gerar e compartilhar relatório PDF de adesão medicamentosa por período

---

## Objetivo

Permitir que o usuário exporte um relatório PDF com suas métricas de adesão (doses tomadas, puladas e pendentes) num período selecionado, para compartilhar com médicos ou cuidadores.

## Contexto

O histórico de doses fica armazenado localmente. O relatório consolida esses dados em um documento visual com estatísticas por medicamento e por dia, gerado inteiramente no dispositivo sem depender de serviços externos.

## Requisitos Funcionais

1. O usuário seleciona um período (data início e data fim) para o relatório
2. O app gera um PDF com métricas de adesão do perfil ativo no período selecionado
3. O PDF inclui: nome do perfil, período, total de doses por status, taxa de adesão geral e por medicamento
4. O usuário pode compartilhar o PDF via share sheet nativo (email, WhatsApp, Drive, etc.)
5. O PDF é salvo temporariamente no dispositivo e descartado após o compartilhamento

## Requisitos Não-Funcionais

- Geração do PDF deve concluir em menos de 3s para períodos de até 90 dias
- O PDF gerado deve ter tamanho máximo de 5MB
- O relatório é gerado inteiramente no dispositivo (sem chamada a serviços externos)

## Regras de Negócio

- Apenas doses do perfil ativo são incluídas
- Doses com status `pending` são contabilizadas como "não tomadas" se o horário já passou
- Taxa de adesão = `taken / (taken + skipped + pending_passados)` × 100
- Período máximo do relatório: 365 dias
- Relatório com período sem dados exibe mensagem informativa no PDF

## Critérios de Aceitação

- [ ] CA-01: Selecionar período válido e tocar "Exportar" inicia geração do PDF
- [ ] CA-02: PDF inclui nome do perfil e período no cabeçalho
- [ ] CA-03: PDF exibe total de doses por status (tomada, pulada, pendente passada)
- [ ] CA-04: PDF exibe taxa de adesão geral (%) para o período
- [ ] CA-05: PDF exibe taxa de adesão por medicamento
- [ ] CA-06: Após geração, share sheet nativo é exibido automaticamente
- [ ] CA-07: Período sem doses exibe mensagem "Sem dados no período informado" no PDF
- [ ] CA-08: Loading indicator é exibido durante a geração do PDF

## Casos de Erro

| Situação                        | Comportamento esperado                    |
| ------------------------------- | ----------------------------------------- |
| Período inválido (início > fim) | Validação no formulário; não gera         |
| Falha na geração do PDF         | Toast de erro com mensagem descritiva     |
| Falha no compartilhamento       | Toast de erro; arquivo temporário é limpo |
| Período > 365 dias              | Bloqueado com mensagem de limite máximo   |

## Fora do Escopo

- Exportação em CSV ou Excel
- Envio automático de relatório por email
- Relatório comparativo entre perfis
- Sincronização do relatório com o Supabase
