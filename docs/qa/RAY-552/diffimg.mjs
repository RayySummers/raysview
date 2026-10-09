/**
 * RAY-552 辅助脚本：把两张同尺寸截图做成 diff 可视化（差异像素涂红，其余留浅灰）。
 * 用法: node diffimg.mjs <before.png> <after.png> <out.png>
 * 只为人工复核用：把 before↔after 的差异画出来，确认差异只落在字形/文字位置上。
 */
import sharp from 'sharp';

const [aPath, bPath, outPath] = process.argv.slice(2);
if (!aPath || !bPath || !outPath) {
  console.error('usage: node diffimg.mjs <before.png> <after.png> <out.png>');
  process.exit(2);
}

const a = await sharp(aPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const b = await sharp(bPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = a.info;
if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
  console.error('尺寸不一致，无法 diff');
  process.exit(1);
}

const out = Buffer.alloc(width * height * 4);
let n = 0;
for (let i = 0; i < a.data.length; i += channels) {
  const d = Math.max(
    Math.abs(a.data[i] - b.data[i]),
    Math.abs(a.data[i + 1] - b.data[i + 1]),
    Math.abs(a.data[i + 2] - b.data[i + 2])
  );
  const o = (i / channels) * 4;
  if (d > 8) {
    out[o] = 255; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 255;
    n++;
  } else {
    out[o] = 245; out[o + 1] = 245; out[o + 2] = 245; out[o + 3] = 255;
  }
}

await sharp(out, { raw: { width, height, channels: 4 } }).png().toFile(outPath);
console.log(`${outPath}: ${width}x${height} diffPixels=${n} (${(n / (width * height) * 100).toFixed(3)}%)`);
