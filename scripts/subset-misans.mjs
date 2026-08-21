#!/usr/bin/env node
// MiSans 按仓库实际用字自动化子集化
// RAY-387 — 11.6MB → <1MB，构建时自动扫描重压，无需手动
//
// 扫描范围（按任务要求）：
//   src/content  — md, mdx
//   src/pages    — astro, md, mdx
//   src/components — astro, ts
// 去重字符，强制保留 U+2013-2014/U+2026（——/…… 破折号/省略号）及数字/连字符，
// 通过 pyftsubset 以 --text-file 方式重压为 woff2，保留 fvar 150-700 与 GSUB ss04/tnum。
//
// 输入源优先级（避免已子集化产物丢失新字）：
//   1) scripts/cache/MiSans-VF.src.woff2       — 首次运行自动创建的原文件备份（不在 public，避免被部署）
//   2) public/fonts/MiSansVF.ttf               — 官方 VF 原始 TTF（如用户手动放置）
//   3) public/fonts/MiSans-VF.ttf
//   4) public/fonts/MiSans-VF.src.woff2        — 兼容旧路径（将自动迁移）
//   5) scripts/cache/*.woff2 / .ttf
//   6) public/fonts/MiSans-VF.woff2            — 回退（首次运行即为 11.6MB 全量 CJK 子集）
//
// 输出：public/fonts/MiSans-VF.woff2 (<1MB, fvar 150-700, GSUB ss04/tnum)
// 依赖：pip install fonttools brotli (提供 pyftsubset)

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const OUTPUT = path.join(ROOT, 'public/fonts/MiSans-VF.woff2');
const SRC_BACKUP = path.join(ROOT, 'scripts/cache/MiSans-VF.src.woff2');
const LEGACY_BACKUP = path.join(ROOT, 'public/fonts/MiSans-VF.src.woff2');

// 扫描配置 — 严格按任务描述
const SCAN_CONFIG = [
  { dir: path.join(ROOT, 'src/content'), exts: new Set(['.md', '.mdx']) },
  { dir: path.join(ROOT, 'src/pages'), exts: new Set(['.astro', '.md', '.mdx']) },
  { dir: path.join(ROOT, 'src/components'), exts: new Set(['.astro', '.ts']) },
];

// 强制保留字符：U+2013 EN DASH, U+2014 EM DASH, U+2026 HORIZONTAL ELLIPSIS + 数字/连字符
const REQUIRED_CHARS = '\u2013\u2014\u2026' + '0123456789-';

// 输入候选（按优先级）
const SOURCE_CANDIDATES = [
  SRC_BACKUP,
  path.join(ROOT, 'public/fonts/MiSansVF.ttf'),
  path.join(ROOT, 'public/fonts/MiSans-VF.ttf'),
  LEGACY_BACKUP,
  path.join(ROOT, 'scripts/cache/MiSans-VF.woff2'),
  path.join(ROOT, 'scripts/cache/MiSans-VF.ttf'),
  path.join(ROOT, 'public/fonts/MiSans-VF.woff2'),
  path.join(ROOT, 'public/fonts/MiSans-VF.src.ttf'),
  path.join(ROOT, 'scripts/cache/MiSans-VF.src.ttf'),
];

function walkCollect(dir, exts, outFiles) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkCollect(full, exts, outFiles);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (exts.has(ext)) outFiles.push(full);
    }
  }
}

function resolveSource() {
  // 兼容迁移：若旧路径存在而新路径不存在，自动迁移到 scripts/cache
  if (fs.existsSync(LEGACY_BACKUP) && !fs.existsSync(SRC_BACKUP)) {
    try {
      fs.mkdirSync(path.dirname(SRC_BACKUP), { recursive: true });
      fs.copyFileSync(LEGACY_BACKUP, SRC_BACKUP);
      console.log(`[subset] 迁移备份: ${path.relative(ROOT, LEGACY_BACKUP)} → ${path.relative(ROOT, SRC_BACKUP)}`);
    } catch (e) {
      console.warn(`[subset] 迁移备份失败: ${e.message}`);
    }
  }

  for (const cand of SOURCE_CANDIDATES) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      // 若命中 OUTPUT 本身且备份尚不存在，则先备份（保留原 11.6MB 全量 CJK）
      if (path.resolve(cand) === path.resolve(OUTPUT) && !fs.existsSync(SRC_BACKUP) && !fs.existsSync(LEGACY_BACKUP)) {
        const st = fs.statSync(cand);
        // 仅当文件较大（>1MB）时才视为原全量，值得备份；已子集化的 445KB 不覆盖备份
        if (st.size > 1024 * 1024) {
          try {
            fs.mkdirSync(path.dirname(SRC_BACKUP), { recursive: true });
            fs.copyFileSync(cand, SRC_BACKUP);
            console.log(`[subset] 备份原字体: ${cand} → ${SRC_BACKUP} (${(st.size / 1024 / 1024).toFixed(2)} MB)`);
          } catch (e) {
            console.warn(`[subset] 备份失败: ${e.message}`);
          }
          // 备份后后续应以备份为源
          return SRC_BACKUP;
        }
      }
      // 若候选是旧备份且新备份已存在，优先返回新备份
      if (path.resolve(cand) === path.resolve(LEGACY_BACKUP) && fs.existsSync(SRC_BACKUP)) {
        return SRC_BACKUP;
      }
      return cand;
    }
  }
  return null;
}

function findPyftsubset() {
  const direct = spawnSync('pyftsubset', ['--help'], { stdio: 'pipe' });
  if (direct.error == null && (direct.status === 0 || direct.status === 1)) return { cmd: 'pyftsubset', argsPrefix: [] };
  // fallback: python -m fontTools.subset
  const py = spawnSync('python3', ['-m', 'fontTools.subset', '--help'], { stdio: 'pipe' });
  if (py.error == null) return { cmd: 'python3', argsPrefix: ['-m', 'fontTools.subset'] };
  const py2 = spawnSync('python', ['-m', 'fontTools.subset', '--help'], { stdio: 'pipe' });
  if (py2.error == null) return { cmd: 'python', argsPrefix: ['-m', 'fontTools.subset'] };
  return null;
}

function main() {
  console.log('[subset] MiSans 自动化子集化开始…');
  // 1. 收集文件
  const files = [];
  for (const cfg of SCAN_CONFIG) {
    walkCollect(cfg.dir, cfg.exts, files);
  }
  if (files.length === 0) {
    console.warn('[subset] 未扫描到任何文件，检查 src/content/src/pages/src/components 是否存在');
  }
  console.log(`[subset] 扫描到 ${files.length} 个文件`);
  for (const f of files) console.log(`  - ${path.relative(ROOT, f)}`);

  // 2. 去重字符
  const charSet = new Set();
  for (const f of files) {
    try {
      const text = fs.readFileSync(f, 'utf-8');
      for (const ch of text) charSet.add(ch);
    } catch (e) {
      console.warn(`[subset] 读取失败 ${f}: ${e.message}`);
    }
  }
  // 强制保留
  for (const ch of REQUIRED_CHARS) charSet.add(ch);

  const chars = [...charSet].join('');
  // 按码点排序以稳定输出（可选）
  const sorted = [...charSet].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
  console.log(`[subset] 去重后字符数: ${charSet.size}（含强制保留 U+2013/U+2014/U+2026 与数字/连字符）`);

  // 3. 解析源字体
  const source = resolveSource();
  if (!source) {
    console.error('[subset] 错误: 未找到可用源字体。请确保以下任一存在：');
    for (const c of SOURCE_CANDIDATES) console.error(`  - ${path.relative(ROOT, c)}`);
    console.error('  官方下载: https://hyperos.mi.com/font/zh/download → 选择 MiSans VF');
    process.exit(1);
  }
  console.log(`[subset] 源字体: ${path.relative(ROOT, source)} (${(fs.statSync(source).size / 1024 / 1024).toFixed(2)} MB)`);

  // 4. 准备临时文件
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'misans-'));
  const charsFile = path.join(tmpDir, 'chars.txt');
  const outTmp = path.join(tmpDir, 'MiSans-VF.woff2');
  fs.writeFileSync(charsFile, sorted, 'utf-8');
  console.log(`[subset] 字符集已写入临时文件: ${charsFile} (${(Buffer.byteLength(sorted, 'utf-8') / 1024).toFixed(1)} KB, ${sorted.length} chars)`);
  // 调试：也可输出未排序版本 chars 供 --text 使用，但统一用 --text-file

  // 5. 检查 pyftsubset
  const py = findPyftsubset();
  if (!py) {
    console.error('[subset] 错误: 未找到 pyftsubset。请先安装: pip install fonttools brotli');
    console.error('  将保留现有字体，回退到 Source Han 兜底，构建不阻断。');
    // 清理
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    // 非阻断：退出 0 让 prebuild 不阻塞，CI 可感知警告
    process.exit(0);
  }
  const cmd = py.cmd;
  const baseArgs = [...py.argsPrefix];

  // 6. 执行子集化
  const args = [
    ...baseArgs,
    source,
    `--text-file=${charsFile}`,
    '--layout-features=ss04,tnum,liga,kern',
    '--flavor=woff2',
    `--output-file=${outTmp}`,
  ];
  // 若源已是 woff2，fontTools 需 brotli 已安装；若为 ttf 则无需。
  console.log(`[subset] 执行: ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit' });
  if (res.error) {
    console.error(`[subset] 执行失败: ${res.error.message}`);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`[subset] pyftsubset 退出码 ${res.status}`);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(res.status);
  }

  if (!fs.existsSync(outTmp)) {
    console.error('[subset] 错误: 输出文件未生成');
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(1);
  }

  const outSize = fs.statSync(outTmp).size;
  console.log(`[subset] 产物体积: ${(outSize / 1024).toFixed(1)} KB (${(outSize / 1024 / 1024).toFixed(2)} MB)`);

  if (outSize >= 1024 * 1024) {
    console.warn(`[subset] 警告: 产物体积 ${(outSize / 1024).toFixed(1)} KB ≥ 1MB，虽不阻断构建但未达 <1MB 目标`);
    console.warn('  提示: 检查字符集是否异常增大，或源字体本身过大');
  } else {
    console.log('[subset] 体积校验通过: <1MB');
  }

  // 7. 校验 fvar / GSUB（可选，失败不阻断）
  try {
    // 轻量校验：用 fontTools 读取（若可用），否则跳过
    const check = spawnSync('python3', ['-c', `
from fontTools.ttLib import TTFont
import sys
p=sys.argv[1]
f=TTFont(p)
# fvar
assert 'fvar' in f, 'missing fvar'
wght=[a for a in f['fvar'].axes if a.axisTag=='wght'][0]
assert abs(wght.minValue-150)<0.01 and abs(wght.maxValue-700)<0.01, f"fvar wght {wght.minValue}-{wght.maxValue} != 150-700"
# GSUB
assert 'GSUB' in f, 'missing GSUB'
feats=[r.FeatureTag for r in f['GSUB'].table.FeatureList.FeatureRecord]
assert 'ss04' in feats, 'GSUB missing ss04'
assert 'tnum' in feats, 'GSUB missing tnum'
print(f"校验通过: fvar 150-700, GSUB {feats}")
` , outTmp], { stdio: 'pipe', encoding: 'utf-8' });
    if (check.status === 0) {
      console.log(`[subset] ${check.stdout.trim()}`);
    } else {
      console.warn(`[subset] 校验警告: ${check.stderr || check.stdout}`);
    }
  } catch (e) {
    console.warn(`[subset] 校验跳过: ${e.message}`);
  }

  // 8. 原子替换到目标路径
  try {
    // 确保目标目录存在
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    // 若 OUTPUT 已存在且与源相同路径，先确保备份已创建（上文已处理）
    // 直接覆盖
    fs.copyFileSync(outTmp, OUTPUT);
    console.log(`[subset] 已更新: ${path.relative(ROOT, OUTPUT)}`);
  } catch (e) {
    console.error(`[subset] 写入目标失败: ${e.message}`);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    process.exit(1);
  }

  // 9. 清理
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  const finalSize = fs.statSync(OUTPUT).size;
  console.log(`[subset] 完成 — ${path.relative(ROOT, OUTPUT)} ${(finalSize / 1024).toFixed(1)} KB`);
  console.log('[subset] 提示: 新增文章后无需手动操作，下次构建将自动重新扫描并重压；偶发遗漏字符会回退到 Source Han Sans SC，不阻断发布。');
}

main();
