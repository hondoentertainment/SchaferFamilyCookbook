import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NOTIFY_PUSH_RATE_LIMIT, resetSlidingBucketsForTests } from './lib/rateLimit';

const { notifyAdminMocks } = vi.hoisted(() => {
  const sendEachForMulticast = vi.fn();
  const collectionGet = vi.fn();

  const notifyAdminMocks = {
    apps: [] as unknown[],
    sendEachForMulticast,
    collectionGet,
  };

  return { notifyAdminMocks };
});

vi.mock('firebase-admin', () => ({
  default: {
    get apps(): unknown[] {
      return notifyAdminMocks.apps;
    },
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    firestore: vi.fn(() => ({
      collection: vi.fn(() => ({
        get: notifyAdminMocks.collectionGet,
      })),
    })),
    messaging: vi.fn(() => ({
      sendEachForMulticast: notifyAdminMocks.sendEachForMulticast,
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

function postReq(extra: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: 'POST',
    headers: {},
    body: {},
    ...extra,
  } as unknown as VercelRequest;
}

describe('notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSlidingBucketsForTests();
    vi.stubEnv('NOTIFY_SECRET', 'test-notify-secret');
    notifyAdminMocks.apps = [];
    notifyAdminMocks.collectionGet.mockResolvedValue({
      forEach: () => {
        /* empty token list */
      },
    });
    notifyAdminMocks.sendEachForMulticast.mockResolvedValue({
      successCount: 0,
      failureCount: 0,
      responses: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 405 for non-POST', async () => {
    const handler = (await import('./notify')).default;
    const r = res();
    await handler({ method: 'GET' } as unknown as VercelRequest, r as unknown as VercelResponse);
    expect(r.status).toHaveBeenCalledWith(405);
  });

  it('returns 401 when NOTIFY_SECRET missing', async () => {
    vi.unstubAllEnvs();
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({ headers: { 'x-notify-secret': 'x' }, body: { title: 'Hi' } }),
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when x-notify-secret does not match', async () => {
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'wrong' },
        body: { title: 'Hi' },
      }),
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(401);
  });

  it('returns 429 when IP exceeds notify rate limit after auth', async () => {
    const handler = (await import('./notify')).default;
    const ip = '198.51.100.77';
    const base = postReq({
      headers: {
        'x-notify-secret': 'test-notify-secret',
        'x-forwarded-for': ip,
      },
      body: { title: 'Alert' },
    });

    for (let i = 0; i < NOTIFY_PUSH_RATE_LIMIT.max; i++) {
      const r = res();
      await handler(base, r as unknown as VercelResponse);
      expect(r.status).not.toHaveBeenCalledWith(429);
    }

    const blocked = res();
    await handler(base, blocked as unknown as VercelResponse);
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.json).toHaveBeenCalledWith({ error: 'Too many requests' });
  });

  it('returns 400 when title is missing', async () => {
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'test-notify-secret' },
        body: {},
      }),
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 when Firebase Admin is not initialized', async () => {
    notifyAdminMocks.apps = [];
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'test-notify-secret' },
        body: { title: 'Ping' },
      }),
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(500);
    expect(r.json.mock.calls[0][0]?.error).toMatch(/Firebase Admin not initialized/i);
  });

  it('returns sent 0 when no FCM tokens are registered', async () => {
    notifyAdminMocks.apps = [{}];
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'test-notify-secret' },
        body: { title: 'Hello' },
      }),
      r as unknown as VercelResponse
    );
    expect(notifyAdminMocks.sendEachForMulticast).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json).toHaveBeenCalledWith({ sent: 0, failed: 0 });
  });

  it('fans out multicast when tokens exist', async () => {
    notifyAdminMocks.apps = [{}];
    notifyAdminMocks.collectionGet.mockResolvedValue({
      forEach: (fn: (d: { data: () => { token?: string; userName?: string } }) => void) => {
        fn({ data: () => ({ token: '  tok-a  ' }) });
        fn({ data: () => ({ token: '' }) });
        fn({ data: () => ({ token: 'tok-b' }) });
      },
    });
    notifyAdminMocks.sendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    });
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'test-notify-secret' },
        body: { title: 'Dinner', body: 'Soup is ready' },
      }),
      r as unknown as VercelResponse
    );
    expect(notifyAdminMocks.sendEachForMulticast).toHaveBeenCalledTimes(1);
    const msg = notifyAdminMocks.sendEachForMulticast.mock.calls[0][0];
    expect(msg.tokens).toEqual(['tok-a', 'tok-b']);
    expect(msg.notification).toEqual({ title: 'Dinner', body: 'Soup is ready' });
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.json).toHaveBeenCalledWith({ sent: 2, failed: 0 });
  });

  it('filters tokens by userName when provided', async () => {
    notifyAdminMocks.apps = [{}];
    notifyAdminMocks.collectionGet.mockResolvedValue({
      forEach: (fn: (d: { data: () => { token?: string; userName?: string } }) => void) => {
        fn({ data: () => ({ token: 'tok-wren', userName: 'Wren Feyereisen' }) });
        fn({ data: () => ({ token: 'tok-alice', userName: 'Alice' }) });
      },
    });
    notifyAdminMocks.sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    });
    const handler = (await import('./notify')).default;
    const r = res();
    await handler(
      postReq({
        headers: { 'x-notify-secret': 'test-notify-secret' },
        body: { title: 'Approved', userName: 'Wren' },
      }),
      r as unknown as VercelResponse
    );
    const msg = notifyAdminMocks.sendEachForMulticast.mock.calls[0][0];
    expect(msg.tokens).toEqual(['tok-wren']);
    expect(r.json).toHaveBeenCalledWith({ sent: 1, failed: 0 });
  });
});
