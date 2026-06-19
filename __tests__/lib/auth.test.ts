import {
  getCurrentUser,
  mapAuthError,
  sendPasswordReset,
  signIn,
  signOut,
  signUp,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const mockAuth = (supabase as NonNullable<typeof supabase>).auth as jest.Mocked<
  NonNullable<typeof supabase>['auth']
>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('signIn', () => {
  it('retorna AuthUser quando credenciais são válidas', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'uid-1', email: 'user@test.com', user_metadata: { name: 'Maria' } },
        session: {} as any,
      },
      error: null,
    } as any);

    const user = await signIn('user@test.com', '123456');

    expect(user.id).toBe('uid-1');
    expect(user.email).toBe('user@test.com');
    expect(user.displayName).toBe('Maria');
  });

  it('lança erro quando credenciais são inválidas', async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as any);

    await expect(signIn('user@test.com', 'errada')).rejects.toMatchObject({
      code: 'invalid_credentials',
    });
  });
});

describe('signUp', () => {
  it('retorna AuthUser com nome ao cadastrar com sucesso', async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'uid-2', email: 'novo@test.com', user_metadata: { name: 'João' } },
        session: null,
      },
      error: null,
    } as any);

    const user = await signUp('novo@test.com', 'senha123', 'João');

    expect(user.id).toBe('uid-2');
    expect(user.displayName).toBe('João');
  });

  it('lança erro quando e-mail já existe', async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    } as any);

    await expect(signUp('existente@test.com', 'senha123', 'Ana')).rejects.toMatchObject({
      code: 'user_already_exists',
    });
  });
});

describe('signOut', () => {
  it('chama supabase.auth.signOut', async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: null } as any);

    await signOut();

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('sendPasswordReset', () => {
  it('chama resetPasswordForEmail com o e-mail correto', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({ data: {}, error: null } as any);

    await sendPasswordReset('user@test.com');

    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@test.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('reset-password') })
    );
  });

  it('lança erro quando e-mail não é encontrado', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValueOnce({
      data: {},
      error: { code: 'user_not_found', message: 'User not found' },
    } as any);

    await expect(sendPasswordReset('naoexiste@test.com')).rejects.toMatchObject({
      code: 'user_not_found',
    });
  });
});

describe('getCurrentUser', () => {
  it('retorna null quando não há sessão', async () => {
    mockAuth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any);

    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it('retorna AuthUser quando há sessão ativa', async () => {
    mockAuth.getSession.mockResolvedValueOnce({
      data: {
        session: {
          user: { id: 'uid-3', email: 'ativo@test.com', user_metadata: { name: 'Carlos' } },
        },
      },
      error: null,
    } as any);

    const user = await getCurrentUser();
    expect(user?.id).toBe('uid-3');
    expect(user?.email).toBe('ativo@test.com');
  });
});

describe('mapAuthError', () => {
  it.each([
    ['invalid_credentials', 'E-mail ou senha inválidos.'],
    ['email_address_invalid', 'Digite um e-mail válido.'],
    ['user_already_exists', 'Este e-mail já está cadastrado.'],
    ['weak_password', 'Use ao menos 6 caracteres na senha.'],
    ['over_email_send_rate_limit', 'Muitas tentativas. Aguarde alguns minutos.'],
    ['unknown_code', 'Erro inesperado. Tente novamente.'],
  ])('código "%s" → mensagem correta', (code, expected) => {
    const error = { code, message: '' } as any;
    expect(mapAuthError(error)).toBe(expected);
  });
});
