// One-time PWA icon generation from public/favicon.svg.
// Usage: node scripts/generate-icons.mjs   (requires devDependency: sharp)
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SVG = path.join(__dirname, '..', 'public', 'favicon.svg');
const OUT = path.join(__dirname, '..', 'client', 'public', 'icons');

fs.mkdirSync(OUT, { recursive: true });
const svg = fs.readFileSync(SVG);

// Direct rasters — the SVG already has its own rounded-rect background
await sharp(svg).resize(192, 192).png().toFile(path.join(OUT, 'icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(path.join(OUT, 'icon-512.png'));

// Maskable: full-bleed brand background with the glyph inside the ~80% safe zone
async function flattened(size, file) {
    const inner = Math.round(size * 0.7);
    const glyph = await sharp(svg).resize(inner, inner).png().toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#d92d20' } })
        .composite([{ input: glyph, gravity: 'center' }])
        .png()
        .toFile(path.join(OUT, file));
}
await flattened(512, 'icon-maskable-512.png');
await flattened(180, 'apple-touch-icon.png');

console.log(`Icons written to ${OUT}`);
