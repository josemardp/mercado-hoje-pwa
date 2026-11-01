import { afterEach, describe, expect, it, vi } from 'vitest';

const FIVE_MINUTES = 5 * 60 * 1000;

function stubFetch(headers: Record<string, string>) {
  const fetchMock = vi.fn(async () => new Response(null, { status: 200, headers }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// O desvio fica em uma variável de módulo: cada caso precisa de um db.ts novo.
async function freshDb() {
  vi.resetModules();
  return import('../db');
}

describe('syncServerClock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adota o desvio informado pelo header Date do servidor', async () => {
    const { syncServerClock, getServerNow } = await freshDb();
    stubFetch({ date: new Date(Date.now() + FIVE_MINUTES).toUTCString() });

    await syncServerClock();

    expect(Math.abs(getServerNow() - (Date.now() + FIVE_MINUTES))).toBeLessThan(2000);
  });

  // Regressão: em /auth/v1 o CORS não expõe o Date, headers.get('date') volta
  // null no navegador e o alinhamento vira um no-op silencioso.
  it('consulta um endpoint que expõe o Date via CORS', async () => {
    const { syncServerClock } = await freshDb();
    const fetchMock = stubFetch({ date: new Date().toUTCString() });

    await syncServerClock();

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('/rest/v1/');
    expect(url).not.toContain('/auth/v1/');
  });

  it('mantém o relógio local quando o header Date não vem', async () => {
    const { syncServerClock, getServerNow } = await freshDb();
    stubFetch({});

    await syncServerClock();

    expect(Math.abs(getServerNow() - Date.now())).toBeLessThan(1000);
  });
});
