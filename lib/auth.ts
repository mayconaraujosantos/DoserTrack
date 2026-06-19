import type { Session, AuthChangeEvent, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type { AuthError };

export interface AuthUser {
  id: string;
  email: string | undefined;
  displayName: string | null;
}

function assertSupabase() {
  if (!supabase) throw new Error('Supabase não configurado. Preencha o arquivo .env.');
  return supabase;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const client = assertSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.user_metadata?.name ?? null,
  };
}

export async function signUp(email: string, password: string, name: string): Promise<AuthUser> {
  const client = assertSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;
  return {
    id: data.user!.id,
    email: data.user!.email,
    displayName: name,
  };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: 'doser://reset-password',
  });
  if (error) throw error;
}

export async function updatePassword(newPassword: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.user_metadata?.name ?? null,
  };
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  if (!supabase) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return supabase.auth.onAuthStateChange(callback);
}

// Mapeia erros Supabase para mensagens amigáveis em português
export function mapAuthError(error: AuthError): string {
  const code = error.code ?? '';
  const msg = error.message ?? '';

  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }
  if (code === 'email_address_invalid' || msg.includes('invalid email')) {
    return 'Digite um e-mail válido.';
  }
  if (code === 'user_already_exists' || msg.includes('already registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (code === 'weak_password' || msg.includes('weak')) {
    return 'Use ao menos 6 caracteres na senha.';
  }
  if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos.';
  }
  return 'Erro inesperado. Tente novamente.';
}

// Mantido para compatibilidade com código legado (magic link)
export async function signInWithOtp(email: string): Promise<void> {
  const client = assertSupabase();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: 'doser://auth-callback' },
  });
  if (error) throw error;
}
