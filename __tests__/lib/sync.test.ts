// jest.setup.js mocka @/lib/sync globalmente (stubs vazios) para telas que
// disparam sync como efeito colateral; este arquivo testa a implementação
// real, então precisa desfazer esse mock.
jest.unmock('@/lib/sync');

jest.mock('@/lib/database', () => ({
  getAllRows: jest.fn(),
  runQuery: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

import { getAllRows, runQuery } from '@/lib/database';
import { pullFromCloud, syncToCloud } from '@/lib/sync';
import { supabase } from '@/lib/supabase';

const mockGetAllRows = getAllRows as jest.Mock;
const mockRunQuery = runQuery as jest.Mock;
const mockGetSession = (supabase as NonNullable<typeof supabase>).auth.getSession as jest.Mock;
const mockFrom = (supabase as NonNullable<typeof supabase>).from as jest.Mock;

const USER_ID = 'uid-1';

function rowsForTable(medicines: unknown[] = [], schedules: unknown[] = [], doses: unknown[] = []) {
  mockGetAllRows.mockImplementation((sql: string) => {
    if (sql.includes('FROM medicines')) return Promise.resolve(medicines);
    if (sql.includes('FROM schedules')) return Promise.resolve(schedules);
    if (sql.includes('FROM doses')) return Promise.resolve(doses);
    return Promise.resolve([]);
  });
}

function cloudRowsForTable(
  medicines: unknown[] = [],
  schedules: unknown[] = [],
  doses: unknown[] = []
) {
  mockFrom.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => {
        if (table === 'medicines') return Promise.resolve({ data: medicines, error: null });
        if (table === 'schedules') return Promise.resolve({ data: schedules, error: null });
        return Promise.resolve({ data: doses, error: null });
      },
    }),
  }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: USER_ID } } } });
});

describe('syncToCloud', () => {
  it('faz upsert com o payload mapeado corretamente para uma tabela com linhas', async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    rowsForTable([
      {
        id: 1,
        profile_id: 1,
        name: 'Dipirona',
        type: 'tablet',
        stock_quantity: 10,
        stock_unit: 'comprimidos',
        photo_uri: null,
        low_stock_threshold: 5,
        created_at: '2026-07-01T00:00:00',
        updated_at: null,
      },
    ]);

    await syncToCloud();

    expect(mockFrom).toHaveBeenCalledWith('medicines');
    expect(mockUpsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 1,
          user_id: USER_ID,
          profile_id: 1,
          name: 'Dipirona',
          updated_at: expect.any(String),
        }),
      ],
      { onConflict: 'id' }
    );
  });

  it('não chama upsert quando a tabela local está vazia', async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    rowsForTable([], [], []);

    await syncToCloud();

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('se medicines falhar, schedules e doses ainda são tentados', async () => {
    const mockUpsert = jest
      .fn()
      .mockResolvedValueOnce({ error: new Error('falha de rede') })
      .mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
    rowsForTable([{ id: 1 }], [{ id: 1 }], [{ id: 1 }]);

    await syncToCloud();

    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });
});

describe('pullFromCloud', () => {
  it('monta o SQL de INSERT/ON CONFLICT com os parâmetros na ordem certa', async () => {
    cloudRowsForTable([
      {
        id: 1,
        profile_id: 1,
        name: 'Dipirona',
        type: 'tablet',
        stock_quantity: 10,
        stock_unit: 'comprimidos',
        photo_uri: null,
        low_stock_threshold: 5,
        created_at: '2026-07-01T00:00:00',
        updated_at: '2026-07-02T00:00:00',
      },
    ]);

    await pullFromCloud();

    expect(mockRunQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO medicines'),
      [1, 1, 'Dipirona', 'tablet', 10, 'comprimidos', null, 5, '2026-07-01T00:00:00', '2026-07-02T00:00:00']
    );
  });

  it('se medicines falhar, schedules e doses ainda são tentados', async () => {
    let calls = 0;
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => {
          calls++;
          if (calls === 1) return Promise.resolve({ data: null, error: new Error('falha') });
          return Promise.resolve({ data: [], error: null });
        },
      }),
    }));

    await pullFromCloud();

    expect(calls).toBe(3);
  });
});
