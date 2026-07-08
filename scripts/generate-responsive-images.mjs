#!/usr/bin/env node
/**
 * Generate responsive width variants for every recipe photo so cards and
 * heroes can serve an appropriately-sized image via <img srcset>. Recipe
 * source images are 1200px-wide WebP (~175 KB); on a 2-column mobile grid a
 * card is ~180px, so shipping the full 1200px file wastes ~75% of the bytes.
 *
 * For each `public/recipe-images/<id>.webp` this writes:
 *   <id>-480.webp   (small — mobile grid cards)
 *   <id>-800.webp   (medium — tablet / large phone / single-column)
 * The original file is left as the 1200px (largest) candidate.
 *
 * Idempotent: skips a variant when it already exists and is newer than the
 * source, and never upscales (a variant wider than the source is skipped).
 *
 * Run: node scripts/generate-responsive-images.mjs [--force]
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = join(__dirname, '..', 'public', 'recipe-images');
const WIDTHS = [480, 800];
const FORCE = process.argv.includes('--force');

/** A source file is a variant if it ends in -<width>.webp. */
const VARIANT_RE = /-(\d+)\.webp$/;

async function run() {
    if (!existsSync(IMAGES_DIR)) {
        console.error(`[responsive-images] directory not found: ${IMAGES_DIR}`);
        process.exit(1);
    }

    const sources = readdirSync(IMAGES_DIR).filter(
        (f) => f.endsWith('.webp') && !VARIANT_RE.test(f),
    );

    let generated = 0;
    let skipped = 0;

    for (const file of sources) {
        const srcPath = join(IMAGES_DIR, file);
        const base = file.replace(/\.webp$/, '');
        const srcStat = statSync(srcPath);

        for (const width of WIDTHS) {
            const outName = `${base}-${width}.webp`;
            const outPath = join(IMAGES_DIR, outName);
            if (!FORCE && existsSync(outPath) && statSync(outPath).mtimeMs >= srcStat.mtimeMs) {
                skipped++;
                continue;
            }
            // `withoutEnlargement` keeps a smaller-than-target source at its own
            // width instead of upscaling, but the variant file is still written
            // so <img srcset> can reference every width uniformly.
            await sharp(srcPath)
                .resize({ width, withoutEnlargement: true })
                .webp({ quality: 72 })
                .toFile(outPath);
            generated++;
        }
    }

    console.log(
        `[responsive-images] ${sources.length} sources · ${generated} variants written · ${skipped} up-to-date`,
    );
}

run().catch((err) => {
    console.error('[responsive-images]', err);
    process.exit(1);
});
