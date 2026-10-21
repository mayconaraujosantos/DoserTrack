import { scheduleDoseNotification } from '@/lib/notifications';

// checkOverdueDoses() nao e testavel aqui: ela usa `await import('@/lib/database')`
// (import dinamico) internamente, e este ambiente de teste (Jest + Babel, sem
// --experimental-vm-modules) lanca "A dynamic import callback was invoked
// without --experimental-vm-modules" para qualquer import() dinamico -- a
// funcao sempre cai no catch e retorna { count: 0, doses: [] }, independente
// do mock. Nenhum outro teste do projeto exercita esse padrao hoje. A
// correcao de fuso horario em checkOverdueDoses (lib/notifications.ts) segue
// valida, so nao da pra cobrir por aqui sem mudar o import para estatico ou
// habilitar suporte a import() dinamico no Jest.

afterEach(() => {
  jest.useRealTimers();
});

describe('scheduleDoseNotification', () => {
  it('não agenda notificação para uma dose cujo horário já passou', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T10:00:00'));

    const result = await scheduleDoseNotification({
      id: 1,
      medicineName: 'Dipirona',
      dosage: '1 comprimido',
      scheduledTime: '2026-07-07T08:00:00',
    });

    expect(result).toBeNull();
  });
});
