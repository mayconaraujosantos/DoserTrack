# Spec: Autenticação e Biometria

**Versão:** 1.0  
**Status:** Implementado  
**Feature:** Login, cadastro, recuperação de senha e bloqueio biométrico

---

## Objetivo

Controlar o acesso ao app via Supabase Auth (email/senha), com opção de bloqueio biométrico após o app ir para background, garantindo segurança dos dados de saúde do usuário.

## Contexto

O Doser usa Supabase Auth como provedor de identidade. A sessão JWT é armazenada no `expo-secure-store`. A biometria é opcional e adiciona uma camada de proteção local: ao retornar do background, o app solicita impressão digital ou Face ID antes de exibir os dados.

## Requisitos Funcionais

1. O usuário pode criar conta com email e senha
2. O usuário pode fazer login com email e senha
3. O usuário pode solicitar redefinição de senha por email
4. O usuário pode alterar a senha após confirmar o código recebido
5. O usuário permanece autenticado entre sessões (auto-refresh de JWT)
6. O usuário pode ativar/desativar bloqueio biométrico nas configurações
7. Com biometria ativa, o app solicita autenticação ao retornar do background após N segundos
8. O usuário pode fazer logout, encerrando a sessão local e na nuvem

## Requisitos Não-Funcionais

- Sessão JWT armazenada em `expo-secure-store` (keychain iOS / keystore Android)
- Mensagens de erro de auth em português, sem expor detalhes técnicos
- Biometria não substitui a senha do Supabase; é apenas proteção de acesso local

## Regras de Negócio

- Senha mínima: 6 caracteres (regra do Supabase)
- Tentativas de biometria: máximo 3 falhas seguidas → pede senha do app
- Timeout de background para solicitar biometria: configurável (padrão: 30s)
- Logout limpa o JWT local e desativa qualquer sessão ativa no Supabase
- Onboarding é exibido uma vez; flag `doser_onboarding_done` persiste no SecureStore

## Critérios de Aceitação

**Cadastro e Login**

- [ ] CA-01: Cadastro com email válido e senha ≥ 6 caracteres cria conta e redireciona para o app
- [ ] CA-02: Login com credenciais válidas redireciona para `/(app)/(tabs)`
- [ ] CA-03: Login com credenciais inválidas exibe mensagem de erro em português
- [ ] CA-04: Sessão persiste após fechar e reabrir o app

**Recuperação de Senha**

- [ ] CA-05: Solicitar reset envia email com código para o endereço informado
- [ ] CA-06: Código válido permite definir nova senha
- [ ] CA-07: Código inválido ou expirado exibe erro descritivo

**Biometria**

- [ ] CA-08: Ativar biometria persiste a preferência no SecureStore
- [ ] CA-09: App retornando do background após timeout solicita autenticação biométrica
- [ ] CA-10: 3 falhas de biometria apresentam campo de senha como fallback
- [ ] CA-11: Desativar biometria remove a preferência e não solicita mais autenticação

**Logout**

- [ ] CA-12: Logout redireciona para `/login` e limpa dados de sessão local

## Casos de Erro

| Situação                               | Comportamento esperado                                 |
| -------------------------------------- | ------------------------------------------------------ |
| Email já cadastrado                    | Mensagem "Email já em uso"; não revela se conta existe |
| Sem conexão ao fazer login             | Toast de erro de rede; formulário não trava            |
| Biometria não suportada no dispositivo | Opção de biometria oculta nas configurações            |
| JWT expirado sem refresh               | Redireciona silenciosamente para `/login`              |

## Fora do Escopo

- Login social (Google, Apple, GitHub)
- Autenticação por PIN numérico
- Múltiplos usuários Supabase no mesmo dispositivo
- Autenticação offline (requer internet para login/cadastro)
