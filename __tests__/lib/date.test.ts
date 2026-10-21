import { localDateStr } from '@/lib/date';

describe('localDateStr', () => {
  it('formata a data local como YYYY-MM-DD', () => {
    expect(localDateStr(new Date('2026-07-07T15:30:00'))).toBe('2026-07-07');
  });

  it('preenche mês e dia com zero à esquerda', () => {
    expect(localDateStr(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
  });

  it('usa o horário local, não UTC -- não pula pro dia seguinte à noite em fusos atrás de UTC', () => {
    // America/Manaus (UTC-4): 22h locais de 07/07 é 02h UTC de 08/07.
    // toISOString() (UTC) retornaria "2026-07-08" aqui, incorretamente.
    expect(localDateStr(new Date('2026-07-07T22:00:00'))).toBe('2026-07-07');
  });

  it('usa new Date() quando nenhum argumento é passado', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T10:00:00'));
    expect(localDateStr()).toBe('2026-07-07');
    jest.useRealTimers();
  });
});
