import type { VercelRequest } from '@vercel/node';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { rotwMocks } = vi.hoisted(() => {
  const sendEachForMulticast = vi.fn();
  const collections = new Map<string, { get: ReturnType<typeof vi.fn> }>();

  const rotwMocks = {
    apps: [] as unknown[],
    sendEachForMulticast,
    collections,
    collectionFor(name: string) {
      if (!collections.has(name)) collections.set(name, { get: vi.fn() });
      return collections.get(name)!;
    },
  };

  return { rotwMocks };
});

vi.mock('firebase-admin', () => ({
  default: {
    get apps(): unknown[] {
      return rotwMocks.apps;
    },
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    firestore: vi.fn(() => ({
      collection: vi.fn((name: string) => ({
        get: rotwMocks.collectionFor(name).get,
      })),
    })),
    messaging: vi.fn(() => ({
      sendEachForMulticast: rotwMocks.sendEachForMulticast,
    })),
  },
}));

function res() {
  return {
    status: vi.fn(function (this: ReturnType<typeof res>) {
      return this;
    }),
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

function getReq(extra: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    ...extra,
  } as unknown as VercelRequest;
}

const snapshotOf = (docs: Array<Record<string, unknown>>) => ({
  forEach: (cb: (d: { id: string; data: () => Record<string, unknown> }) => void) => {
    docs.forEach((doc, i) => cb({ id: (doc.id as string) ?? `doc-${i}`, data: () => doc }));
  },
});

const recipeDocs = [
  { id: 'r1', title: 'Sunday Rolls', contributor: 'Grandma Rose' },
  { id: 'r2', title: 'Peach Pie', contributor: 'Aunt May' },
  { id: 'r3', title: 'Pot Roast', contributor: 'Grandpa Joe' },
];

describe('recipe-of-the-week', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rotwMocks.collections.clear();
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubEnv('NOTIFY_SECRET', 'test-notify-secret');
    rotwMocks.apps = [{}];
    rotwMocks.collectionFor('recipes').get.mockResolvedValue(snapshotOf(recipeDocs));
    rotwMocks.collectionFor('fcm_tokens').get.mockResolvedValue(snapshotOf([{ token: 'tok-1' }]));
    rotwMocks.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects unsupported methods', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(getReq({ method: 'DELETE' }), r as never);
    expect(r.status).toHaveBeenCalledWith(405);
  });

  it('rejects requests without a valid secret', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(getReq(), r as never);
    expect(r.status).toHaveBeenCalledWith(401);

    const r2 = res();
    await handler(getReq({ headers: { authorization: 'Bearer wrong' } }), r2 as never);
    expect(r2.status).toHaveBeenCalledWith(401);
  });

  it('accepts the Vercel cron bearer secret', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(
      getReq({ headers: { authorization: 'Bearer test-cron-secret' } }),
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(200);
    expect(rotwMocks.sendEachForMulticast).toHaveBeenCalledTimes(1);
  });

  it('accepts the x-notify-secret header for manual runs', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(getReq({ headers: { 'x-notify-secret': 'test-notify-secret' } }), r as never);
    expect(r.status).toHaveBeenCalledWith(200);
  });

  it('dryRun returns the deterministic pick without sending', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(
      getReq({
        headers: { authorization: 'Bearer test-cron-secret' },
        query: { dryRun: '1', date: '2026-07-15' },
      }),
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(200);
    const payload = r.json.mock.calls[0][0];
    expect(payload.dryRun).toBe(true);
    expect(payload.week).toBe('2026-W29');
    expect(payload.source).toBe('firestore');
    expect(recipeDocs.map((d) => d.id)).toContain(payload.recipe.id);
    expect(rotwMocks.sendEachForMulticast).not.toHaveBeenCalled();

    // Same date again → identical pick (determinism).
    const r2 = res();
    await handler(
      getReq({
        headers: { authorization: 'Bearer test-cron-secret' },
        query: { dryRun: '1', date: '2026-07-15' },
      }),
      r2 as never,
    );
    expect(r2.json.mock.calls[0][0].recipe.id).toBe(payload.recipe.id);
  });

  it('sends the pick as a notification with recipe deep-link data', async () => {
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(
      getReq({
        headers: { authorization: 'Bearer test-cron-secret' },
        query: { date: '2026-07-15' },
      }),
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(200);
    const msg = rotwMocks.sendEachForMulticast.mock.calls[0][0];
    expect(msg.tokens).toEqual(['tok-1']);
    expect(msg.notification.title).toContain('Recipe of the Week');
    expect(msg.notification.body).toMatch(/— from /);
    expect(msg.data.url).toBe(`/share/recipe/${msg.data.recipeId}`);
    expect(msg.data.week).toBe('2026-W29');
    const payload = r.json.mock.calls[0][0];
    expect(payload.sent).toBe(1);
    expect(payload.failed).toBe(0);
  });

  it('chunks token fan-out at 500 per multicast call', async () => {
    const manyTokens = Array.from({ length: 501 }, (_, i) => ({ token: `tok-${i}` }));
    rotwMocks.collectionFor('fcm_tokens').get.mockResolvedValue(snapshotOf(manyTokens));
    rotwMocks.sendEachForMulticast.mockImplementation(async ({ tokens }: { tokens: string[] }) => ({
      successCount: tokens.length,
      failureCount: 0,
      responses: tokens.map(() => ({ success: true })),
    }));

    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(getReq({ headers: { authorization: 'Bearer test-cron-secret' } }), r as never);
    expect(rotwMocks.sendEachForMulticast).toHaveBeenCalledTimes(2);
    expect(rotwMocks.sendEachForMulticast.mock.calls[0][0].tokens).toHaveLength(500);
    expect(rotwMocks.sendEachForMulticast.mock.calls[1][0].tokens).toHaveLength(1);
    expect(r.json.mock.calls[0][0].sent).toBe(501);
  });

  it('falls back to the bundled seed when Firestore recipes are empty', async () => {
    rotwMocks.collectionFor('recipes').get.mockResolvedValue(snapshotOf([]));
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(
      getReq({
        headers: { authorization: 'Bearer test-cron-secret' },
        query: { dryRun: '1' },
      }),
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(200);
    const payload = r.json.mock.calls[0][0];
    expect(payload.source).toBe('seed');
    expect(payload.recipe.id).toBeTruthy();
  });

  it('reports zero sends when no tokens are registered', async () => {
    rotwMocks.collectionFor('fcm_tokens').get.mockResolvedValue(snapshotOf([]));
    const handler = (await import('./recipe-of-the-week')).default;
    const r = res();
    await handler(getReq({ headers: { authorization: 'Bearer test-cron-secret' } }), r as never);
    const payload = r.json.mock.calls[0][0];
    expect(payload.sent).toBe(0);
    expect(rotwMocks.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('500s on send when Firebase Admin is not initialized (still dryRuns from seed)', async () => {
    rotwMocks.apps = [];
    const handler = (await import('./recipe-of-the-week')).default;

    const r = res();
    await handler(getReq({ headers: { authorization: 'Bearer test-cron-secret' } }), r as never);
    expect(r.status).toHaveBeenCalledWith(500);

    const r2 = res();
    await handler(
      getReq({
        headers: { authorization: 'Bearer test-cron-secret' },
        query: { dryRun: '1' },
      }),
      r2 as never,
    );
    expect(r2.status).toHaveBeenCalledWith(200);
    expect(r2.json.mock.calls[0][0].source).toBe('seed');
  });
});
