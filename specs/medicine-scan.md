# Spec: Scan de Embalagem e Receita

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Extrair dados de medicamentos via foto de embalagem ou receita usando Gemini Vision

---

## Objetivo

Reduzir a entrada manual de dados ao cadastrar um medicamento, permitindo que o usuário fotografe a embalagem ou a receita médica para pré-preencher o formulário de cadastro automaticamente.

## Contexto

O cadastro manual de medicamentos é propenso a erros de digitação e tedioso. A integração com Gemini Vision (via Supabase Edge Function) extrai estruturalmente nome, concentração, tipo e quantidade da imagem. Um cache local evita chamadas redundantes à API para imagens já processadas.

## Requisitos Funcionais

1. O usuário pode iniciar scan pela câmera ou galeria de fotos
2. O app envia a imagem para a Edge Function `scan-medicine` (embalagem) ou `scan-prescription` (receita)
3. O resultado pré-preenche o formulário de cadastro de medicamento
4. Resultados de scan são cacheados localmente por hash da imagem
5. Cache hit retorna resultado sem chamada à API
6. O usuário pode editar qualquer campo pré-preenchido antes de salvar
7. Scan de receita pode retornar múltiplos medicamentos; usuário seleciona quais importar

## Requisitos Não-Funcionais

- Scan com cache miss deve completar em menos de 10s (inclui upload e processamento Gemini)
- Cache hit deve retornar em menos de 100ms
- Imagem deve ser comprimida antes do upload (máx 4MB, para respeitar limite do Gemini)
- A API key do Gemini nunca é exposta no bundle do app

## Regras de Negócio

- O scan é feito via Supabase Edge Function autenticada com Bearer token do usuário
- Cache usa hash SHA da imagem como chave (tabela `scan_cache` no SQLite)
- Se a Edge Function retornar estrutura inesperada, lança `TypeError` com mensagem descritiva
- Campos não identificados pelo Gemini ficam vazios no formulário (usuário preenche manualmente)

## Critérios de Aceitação

**Scan de Embalagem**

- [ ] CA-01: Ao fotografar embalagem, o formulário é pré-preenchido com nome, concentração, tipo e quantidade
- [ ] CA-02: Segunda scan da mesma imagem usa cache local (sem chamada à API)
- [ ] CA-03: Falha da API exibe mensagem de erro e mantém formulário vazio para preenchimento manual
- [ ] CA-04: Campos pré-preenchidos são editáveis pelo usuário antes de salvar

**Scan de Receita**

- [ ] CA-05: Receita com múltiplos medicamentos lista todos os identificados para seleção
- [ ] CA-06: Medicamento selecionado da receita pré-preenche o formulário de cadastro
- [ ] CA-07: Receita ilegível ou sem medicamentos exibe mensagem de erro descritiva

**Geral**

- [ ] CA-08: Imagem comprimida antes do upload respeita limite de tamanho
- [ ] CA-09: API key do Gemini não aparece no bundle (uso exclusivo via Edge Function)

## Casos de Erro

| Situação                                    | Comportamento esperado                                      |
| ------------------------------------------- | ----------------------------------------------------------- |
| Sem conexão com internet                    | Toast de erro; sugere cadastro manual                       |
| Edge Function retorna estrutura inesperada  | `TypeError` capturado; toast com mensagem; formulário vazio |
| Permissão de câmera negada                  | Modal explicativo com link para configurações               |
| Imagem muito grande (> 4MB após compressão) | Toast de erro; sugere tirar foto com melhor enquadramento   |
| Token Supabase expirado                     | Redireciona para login                                      |

## Fora do Escopo

- Scan offline (requer internet para chamar Gemini)
- Reconhecimento de código de barras/QR code
- Validação de receita médica (autenticidade, validade)
- Extração de posologia da receita para auto-criar schedule
