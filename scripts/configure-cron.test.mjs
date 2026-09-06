import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'configure-cron.mjs');

describe('configure-cron', () => {
    it('--generate prints a secret and does not require Vercel', () => {
        const r = spawnSync(process.execPath, [script, '--generate'], {
            encoding: 'utf8',
            env: { ...process.env, CRON_SECRET: '' },
        });
        expect(r.status).toBe(0);
        const lines = (r.stdout ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
        const secret = lines.find((l) => /^[A-Za-z0-9_-]{20,}$/.test(l));
        expect(secret).toBeTruthy();
        expect(r.stdout).toContain('do not commit');
        expect(r.stdout).not.toMatch(/sk_live|AIza|BEGIN PRIVATE KEY/);
    });
});
