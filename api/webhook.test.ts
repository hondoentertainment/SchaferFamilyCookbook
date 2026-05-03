import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TWILIO_WEBHOOK_RATE_LIMIT, resetSlidingBucketsForTests } from './lib/rateLimit';

// --- Mock state (configurable per test) ---
const mockState = {
  validateRequest: true as boolean,
  contributorSnap: { empty: true, docs: [] } as {
    empty: boolean;
    docs: Array<{ data: () => Record<string, unknown> }>;
  },
  fetchOk: true,
  fetchContentType: 'image/jpeg',
  firestoreSetThrows: false,
  storageSaveThrows: false,
  storageMakePublicThrows: false,
};

// --- Twilio mock: validateRequest + MessagingResponse ---
vi.mock('twilio', () => ({
  default: {
    validateRequest: vi.fn(() => mockState.validateRequest),
    twiml: {
      MessagingResponse: class MockMessagingResponse {
        _messages: string[] = [];
        message = (body: string) => {
          this._messages.push(body);
        };
        toString = () =>
          this._messages.length
            ? `<Response><Message>${this._messages.join('</Message><Message>')}</Message></Response>`
            : '<Response></Response>';
      },
    },
  },
}));

// --- Firebase Admin mock: Firestore + Storage ---
const mockGallerySet = vi.fn();
const mockHistorySet = vi.fn();
const mockFileSave = vi.fn();
const mockFileMakePublic = vi.fn();

vi.mock('firebase-admin', () => ({
  default: {
    apps: { length: 0 },
    initializeApp: vi.fn(),
    credential: { cert: vi.fn() },
    firestore: vi.fn(() => ({
      collection: (name: string) => {
        if (name === 'contributors') {
          return {
            where: vi.fn(() => ({
              get: vi.fn(() => Promise.resolve(mockState.contributorSnap)),
            })),
          };
        }
        if (name === 'gallery') {
          return {
            doc: vi.fn(() => ({
              set: vi.fn().mockImplementation(async (data: unknown) => {
                if (mockState.firestoreSetThrows) throw new Error('Firestore set failed');
                mockGallerySet(data);
              }),
            })),
          };
        }
        if (name === 'history') {
          return {
            doc: vi.fn(() => ({
              set: vi.fn().mockImplementation(async (data: unknown) => {
                if (mockState.firestoreSetThrows) throw new Error('Firestore set failed');
                mockHistorySet(data);
              }),
            })),
          };
        }
        return { doc: vi.fn(() => ({ set: vi.fn() })) };
      },
    })),
    storage: vi.fn(() => ({
      bucket: vi.fn(() => ({
        name: 'test-bucket',
        file: vi.fn(() => ({
          save: vi.fn().mockImplementation(async (buf: Buffer) => {
            if (mockState.storageSaveThrows) throw new Error('Storage save failed');
            mockFileSave(buf);
          }),
          makePublic: vi.fn().mockImplementation(async () => {
            if (mockState.storageMakePublicThrows) throw new Error('Storage makePublic failed');
            mockFileMakePublic();
          }),
        })),
      })),
    })),
  },
}));

const mockFetch = vi.fn((_: string) =>
  Promise.resolve({
    ok: mockState.fetchOk,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    headers: { get: () => mockState.fetchContentType },
  })
);

// --- Global fetch mock ---
vi.stubGlobal('fetch', mockFetch);

function res() {
  type R = ReturnType<typeof res>;
  return {
    status: vi.fn(function (this: R) {
      return this;
    }),
    json: vi.fn(),
    setHeader: vi.fn(function (this: R) {
      return this;
    }),
    send: vi.fn(),
  };
}

describe('webhook', () => {
  beforeEach(() => {
    resetSlidingBucketsForTests();
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('TWILIO_AUTH_TOKEN', '');
    vi.stubEnv('TWILIO_ACCOUNT_SID', '');
    vi.stubEnv('NODE_ENV', 'test');
    mockState.validateRequest = true;
    mockState.contributorSnap = { empty: true, docs: [] };
    mockState.fetchOk = true;
    mockState.fetchContentType = 'image/jpeg';
    mockState.firestoreSetThrows = false;
    mockState.storageSaveThrows = false;
    mockState.storageMakePublicThrows = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 429 with Retry-After when IP exceeds webhook rate limit', async () => {
    const handler = (await import('./webhook')).default;
    const ip = '203.0.113.50';
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': ip },
      body: { From: '+15551234567', NumMedia: '0', Body: 'x' },
    } as unknown as VercelRequest;

    for (let i = 0; i < TWILIO_WEBHOOK_RATE_LIMIT.max; i++) {
      const r = res();
      await handler(req, r as unknown as VercelResponse);
      expect(r.status).toHaveBeenCalledWith(200);
    }

    const blocked = res();
    await handler(req, blocked as unknown as VercelResponse);
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(blocked.send).toHaveBeenCalledWith('Too many requests');
  });

  it('should return 405 for non-POST', async () => {
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler({ method: 'GET' } as unknown as VercelRequest, r as unknown as VercelResponse);
    expect(r.status).toHaveBeenCalledWith(405);
  });

  it('should return 200 with no-media TwiML when NumMedia is 0', async () => {
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: { From: '+15551234567', NumMedia: '0', Body: 'test' },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
    expect(r.send).toHaveBeenCalled();
    expect(r.send.mock.calls[0][0]).toContain('no media detected');
  });

  it('should return 200 with no-media TwiML when MediaUrl0 is missing', async () => {
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: { From: '+15551234567', NumMedia: '1', Body: 'test' },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
    expect(r.send.mock.calls[0][0]).toContain('no media detected');
  });

  it('should return 200 with invalid sender TwiML when From is missing', async () => {
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: { NumMedia: '1', MediaUrl0: 'https://api.twilio.com/media/123', Body: 'test' },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('invalid sender number');
  });

  it('should return 403 when TWILIO_AUTH_TOKEN is set and signature is invalid', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'test_token');
    mockState.validateRequest = false;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        headers: { 'x-twilio-signature': 'bad_sig', host: 'localhost:3000' },
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
  });

  it('should return 200 with success TwiML when valid payload and all services succeed', async () => {
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'my caption',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.setHeader).toHaveBeenCalledWith('Content-Type', 'text/xml');
    expect(r.send).toHaveBeenCalled();
    expect(r.send.mock.calls[0][0]).toContain('memory preserved');
    expect(r.send.mock.calls[0][0]).toContain('mms submission');
    expect(mockGallerySet).toHaveBeenCalled();
    expect(mockHistorySet).toHaveBeenCalled();
    expect(mockFileSave).toHaveBeenCalled();
    expect(mockFileMakePublic).toHaveBeenCalled();
  });

  it('should include Twilio Basic auth when credentials are configured', async () => {
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'AC123');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'auth_token');
    mockState.validateRequest = true;
    vi.resetModules();

    const handler = (await import('./webhook')).default;
    const r = res();

    await handler(
      {
        method: 'POST',
        headers: { 'x-twilio-signature': 'valid_sig', host: 'localhost:3000' },
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'caption',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );

    const expectedAuth = `Basic ${Buffer.from('AC123:auth_token').toString('base64')}`;
    expect(mockFetch).toHaveBeenCalledWith('https://api.twilio.com/media/1', {
      headers: { Authorization: expectedAuth },
    });
  });

  it('should use contributor name when phone matches in contributors', async () => {
    mockState.contributorSnap = {
      empty: false,
      docs: [{ data: () => ({ name: 'Jane Doe' }) }],
    };
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'caption',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('jane doe');
    const galleryPayload = mockGallerySet.mock.calls[0][0];
    expect(galleryPayload.contributor).toBe('Jane Doe');
  });

  it('should treat video content-type as video type in gallery item', async () => {
    mockState.fetchContentType = 'video/mp4';
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: '',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    const galleryPayload = mockGallerySet.mock.calls[0][0];
    expect(galleryPayload.type).toBe('video');
  });

  it('should return error TwiML when fetch fails (non-ok response)', async () => {
    mockState.fetchOk = false;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('error preserving memory');
    expect(mockGallerySet).not.toHaveBeenCalled();
  });

  it('should return error TwiML when Firestore set throws', async () => {
    mockState.firestoreSetThrows = true;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('error preserving memory');
  });

  it('should return error TwiML when Storage save throws', async () => {
    mockState.storageSaveThrows = true;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('error preserving memory');
  });

  it('should return error TwiML when Storage makePublic throws', async () => {
    mockState.storageMakePublicThrows = true;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.send.mock.calls[0][0]).toContain('error preserving memory');
  });

  it('should use default caption when Body is empty', async () => {
    const handler = (await import('./webhook')).default;
    await handler(
      {
        method: 'POST',
        body: { From: '+15551234567', NumMedia: '1', MediaUrl0: 'https://api.twilio.com/media/1' },
      } as unknown as VercelRequest,
      res() as unknown as VercelResponse
    );
    const galleryPayload = mockGallerySet.mock.calls[0][0];
    expect(galleryPayload.caption).toBe('Preserved via MMS');
  });

  it('should pass signature validation when TWILIO_AUTH_TOKEN set and validateRequest returns true', async () => {
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'test_token');
    mockState.validateRequest = true;
    vi.resetModules();
    const handler = (await import('./webhook')).default;
    const r = res();
    await handler(
      {
        method: 'POST',
        headers: { 'x-twilio-signature': 'valid_sig', host: 'localhost:3000' },
        body: {
          From: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/1',
          Body: 'x',
        },
      } as unknown as VercelRequest,
      r as unknown as VercelResponse
    );
    expect(r.status).toHaveBeenCalledWith(200);
    expect(r.send.mock.calls[0][0]).toContain('memory preserved');
  });
});
