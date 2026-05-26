#!/usr/bin/env node
/**
 * Bundle-size budget gate.
 *
 * After `npm run build`, this script measures the gzip-equivalent (deflate)
 * size of every JS chunk under `dist/assets` and fails when any individual
 * file exceeds a configured budget. It also reports the top-5 largest chunks
 * so we can spot regressions early.
 *
 * Budgets are intentionally generous to start; tighten them as you optimize.
 *
 * Usage:
 *   npm run build && npm run test:bundle-size
 *   node scripts/check-bundle-size.mjs --budget-kb 800
 *
 * Environment overrides:
 *   BUNDLE_BUDGET_KB        — total compressed JS budget (default 1500 KB)
 *   BUNDLE_FILE_BUDGET_KB   — per-file compressed budget  (default 600 KB)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const assetsDir = path.join(repoRoot, 'dist', 'assets');

function parseFlag(name, fallback) {
    const idx = process.argv.indexOf(name);
    if (idx === -1) return fallback;
    const v = Number(process.argv[idx + 1]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
}

const TOTAL_BUDGET_KB = parseFlag('--budget-kb', Number(process.env.BUNDLE_BUDGET_KB) || 1500);
const FILE_BUDGET_KB = parseFlag(
    '--file-budget-kb',
    Number(process.env.BUNDLE_FILE_BUDGET_KB) || 600,
);

function* walk(dir) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walk(full);
        } else if (entry.isFile() && /\.(js|mjs|cjs)$/.test(entry.name)) {
            yield full;
        }
    }
}

function compressedSize(filePath) {
    const buf = readFileSync(filePath);
    return gzipSync(buf, { level: 9 }).byteLength;
}

function formatKB(bytes) {
    return (bytes / 1024).toFixed(1) + ' KB';
}

function main() {
    let dirStat;
    try {
        dirStat = statSync(assetsDir);
    } catch {
        console.error(
            `[bundle-size] dist/assets not found. Run \`npm run build\` first.\n  Looked at: ${assetsDir}`,
        );
        process.exit(2);
    }
    if (!dirStat.isDirectory()) {
        console.error(`[bundle-size] ${assetsDir} is not a directory.`);
        process.exit(2);
    }

    const files = [...walk(assetsDir)].map((file) => ({
        file,
        relative: path.relative(repoRoot, file),
        rawBytes: statSync(file).size,
        gzipBytes: compressedSize(file),
    }));

    if (files.length === 0) {
        console.error('[bundle-size] No JS chunks found in dist/assets.');
        process.exit(2);
    }

    const totalGzip = files.reduce((acc, f) => acc + f.gzipBytes, 0);
    const totalRaw = files.reduce((acc, f) => acc + f.rawBytes, 0);
    files.sort((a, b) => b.gzipBytes - a.gzipBytes);

    console.log('[bundle-size] JS chunks (gzipped):');
    for (const file of files.slice(0, 8)) {
        console.log(
            `  ${file.relative.padEnd(60)}  ${formatKB(file.gzipBytes).padStart(9)}  (raw ${formatKB(file.rawBytes)})`,
        );
    }
    if (files.length > 8) {
        console.log(`  …and ${files.length - 8} more chunks`);
    }
    console.log(
        `\n[bundle-size] Total compressed JS: ${formatKB(totalGzip)} (raw ${formatKB(totalRaw)}) across ${files.length} files`,
    );
    console.log(
        `[bundle-size] Budgets: total ${TOTAL_BUDGET_KB} KB, per-file ${FILE_BUDGET_KB} KB (gzipped)`,
    );

    const failures = [];
    if (totalGzip / 1024 > TOTAL_BUDGET_KB) {
        failures.push(
            `Total compressed JS ${formatKB(totalGzip)} exceeds budget ${TOTAL_BUDGET_KB} KB.`,
        );
    }
    for (const file of files) {
        if (file.gzipBytes / 1024 > FILE_BUDGET_KB) {
            failures.push(
                `Chunk ${file.relative} compressed to ${formatKB(file.gzipBytes)}, over per-file budget ${FILE_BUDGET_KB} KB.`,
            );
        }
    }

    if (failures.length === 0) {
        console.log('\n[bundle-size] PASS — all budgets respected.');
        return;
    }

    console.error('\n[bundle-size] FAIL:');
    for (const message of failures) {
        console.error(`  - ${message}`);
    }
    console.error(
        '\nTo investigate, inspect dist/assets/*.js, run a code-split review on the largest chunks, or relax the budgets via --budget-kb / --file-budget-kb if intentional.',
    );
    process.exit(1);
}

main();
