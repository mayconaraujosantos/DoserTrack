# Auth Flow — Especificação

## Visão Geral

O Doser usa Supabase Auth com email + senha. O usuário pode criar conta, fazer login, redefinir senha e completar o perfil após o primeiro cadastro.

---

## Fluxo de Roteamento

```
App Launch
│
├── hasSeenOnboarding? = false
│   └── → /onboarding
│         └── "Começar" → /login
│               ├── "Criar conta" → /register
│               └── "Esqueci senha" → /forgot-password
│
└── hasSeenOnboarding? = true
    └── supabase.auth.getSession()?
        ├── session = null → /login
        └── session existe → /(tabs)
```

---

## Telas

### `/onboarding`

**Propósito:** Apresentar o app em 4 slides para novos usuários.

**Comportamento:**

- Slide 0: tela splash (logo + fundo primário, 1.5s) → avança automaticamente
- Slides 1-3: ilustração + título + subtítulo
- Botão "Pular" (canto superior direito) → pula para o último slide
- Botão "Próximo" → avança slide
- Botão "←" → volta slide (exceto no primeiro)
- Último slide: botões "Criar conta" (→ /register) e "Já tenho conta" (→ /login)
- Ao finalizar: chama `markOnboardingDone()` e navega para /login

---

### `/login`

**Propósito:** Autenticar usuário com email e senha.

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| E-mail | email | obrigatório, formato válido |
| Senha | password | obrigatório, mínimo 1 caractere |

**Estados:**

- `idle`: formulário vazio, botão desabilitado
- `loading`: spinner no botão, campos desabilitados
- `error`: mensagem abaixo dos campos ("E-mail ou senha inválidos.")
- `success`: navega para `/(tabs)`

**Navegação:**

- "Esqueci a senha" → /forgot-password
- "Criar conta" → /register
- Voltar: não exibe (é raiz do stack de auth)

**Regras de UX:**

- Botão "Entrar" desabilitado se email ou senha vazios
- Senha com toggle mostrar/ocultar (olho)
- Ao pressionar Enter no campo senha → dispara login

---

### `/register`

**Propósito:** Criar nova conta com nome, email e senha.

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| Nome completo | text | obrigatório, mín. 2 chars |
| E-mail | email | obrigatório, formato válido |
| Senha | password | obrigatório, mín. 6 chars |
| Concordo com Termos | checkbox | obrigatório marcar |

**Estados:**

- `idle`: formulário, botão desabilitado até todos os campos válidos + checkbox
- `loading`: spinner, campos desabilitados
- `error`: mensagem específica por tipo de erro Supabase
- `success`: navega para `/(tabs)` (ou `/complete-profile` se quiser coletar mais dados)

**Erros mapeados do Supabase:**
| Código Supabase | Mensagem exibida |
|-----------------|-----------------|
| `email_address_invalid` | "E-mail inválido." |
| `user_already_exists` | "Este e-mail já está cadastrado." |
| `weak_password` | "Senha muito fraca. Use ao menos 6 caracteres." |
| (outros) | "Erro ao criar conta. Tente novamente." |

**Navegação:**

- Seta voltar → /login
- "Já tenho conta? Entrar" → /login

---

### `/forgot-password`

**Propósito:** Enviar e-mail de redefinição de senha via Supabase.

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| E-mail | email | obrigatório, formato válido |

**Estados:**

- `idle`: campo + botão "Enviar instruções" (desabilitado sem email válido)
- `loading`: spinner
- `success`: card mostrando "Verifique seu e-mail. Enviamos instruções para **{email}**."
- `error`: "E-mail não encontrado." ou erro genérico

**Comportamento técnico:**

- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'doser://reset-password' })`
- Firebase envia e-mail com link → usuário clica → deep link abre `/reset-password`

**Navegação:**

- Seta voltar → /login

---

### `/reset-password`

**Propósito:** Definir nova senha após clicar no link do e-mail.

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| Nova senha | password | obrigatório, mín. 6 chars |
| Confirmar senha | password | deve ser igual à nova senha |

**Estados:**

- `idle`: formulário
- `loading`: spinner
- `success`: "Senha alterada! Você será redirecionado para o login."
- `error`: "As senhas não coincidem." / erro do Supabase

**Comportamento técnico:**

- Recebe `access_token` via deep link params (Supabase injeta na URL)
- Chama `supabase.auth.updateUser({ password: newPassword })`

**Navegação:**

- Sucesso → /login (replace)

---

### `/complete-profile`

**Propósito:** Coleta dados adicionais após o primeiro cadastro (opcional, pode ser pulada).

**Campos:**
| Campo | Tipo | Validação |
|-------|------|-----------|
| Avatar | image picker | opcional |
| Nome | text | pré-preenchido do cadastro |
| Telefone | tel | opcional, formato livre |
| Gênero | select | opcional: Masculino / Feminino / Prefiro não dizer |

**Estados:**

- `idle`: formulário com dados do usuário Supabase
- `loading`: spinner no botão
- `success`: navega para /(tabs)

**Navegação:**

- "Completar Perfil" → /(tabs)
- "Pular" → /(tabs)

---

## Validação de Campos

```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPassword(password: string): boolean {
  return password.length >= 6;
}

function isValidName(name: string): boolean {
  return name.trim().length >= 2;
}
```

---

## Estado Global de Auth

O `_layout.tsx` escuta `onAuthStateChange` do Supabase:

- `SIGNED_IN` → chama `pullFromCloud()` para sincronizar dados
- `SIGNED_OUT` → redireciona para `/login`
- `PASSWORD_RECOVERY` → redireciona para `/reset-password`

---

## Segurança

- Senha nunca armazenada localmente (Supabase cuida via SecureStore adapter)
- `expo-secure-store` usado como storage adapter para tokens Supabase
- Deep links (`doser://`) validados antes de usar tokens
- Campos de senha com `secureTextEntry` e sem autocomplete
