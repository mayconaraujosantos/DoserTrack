describe('useAppStore', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
  });

  it('inicializa selectedDate com a data local (não UTC), mesmo à noite em fusos atrás de UTC', () => {
    // America/Manaus (UTC-4): 22h locais de 07/07 é 02h UTC de 08/07. Se
    // selectedDate usasse toISOString() (UTC), o app abriria mostrando o dia
    // seguinte em vez de hoje -- exatamente o bug reportado.
    jest.useFakeTimers().setSystemTime(new Date('2026-07-07T22:00:00'));
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAppStore } = require('@/lib/store');

    expect(useAppStore.getState().selectedDate).toBe('2026-07-07');
  });
});
