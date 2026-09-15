// 自检脚本：验证公众号 HTML 交付物（32 项断言）
//
// 用法：
//   node verify.mjs <produit.html> [--profile <文章 profile>]
//
// 断言中的「文章相关数量」（图片张数、上标数、定义数、图注数、脚注 URL 数、关键内容顺序）
// 写死绑定单篇文章，因此按文章拆成 profile。默认 profile = 最近一次转换的文章；
// 验证旧文章时用 --profile 指定，例如：
//   node verify.mjs "./output/02-token.html" --profile justthinking-02
import fs from 'node:fs';

const PROFILES = {
  // JustThinking #02《谁有权给一个概念命名？》（RAY-222 原始断言值，数字脚注 19 处引用 / 18 条定义）
  'justthinking-02': {
    images: 4,
    imageIds: [
      '0345F7UprQuwvNe3KzbPh1', // 封面
      '0345F65p7Myv3bJnGXN721', // Tokenizer
      '0345F66hVbYTZwd6MuILtS', // 词元安全警示
      '0345F66ooqgG42tASYKUL1', // DeepSeek 用量
    ],
    sups: 19,
    defs: 18,
    captions: 2,
    fnUrls: 17, // 18 条脚注中 17 条含 URL（GB/T 标准那条无链接）
    order: [
      { label: '标题 H1', needle: '谁有权给一个概念命名' },
      { label: '封面图', needle: '0345F7UprQuwvNe3KzbPh1' },
      { label: 'OpenAI Tokenizer', needle: 'OpenAI Platform Tokenizer 网页截图' },
      { label: '词元安全警示', needle: '词元安全警示中对token的混淆' },
      { label: 'DeepSeek 用量', needle: 'DeepSeek 开放平台用量信息截图' },
      { label: '参考资料标题', needle: '>参考资料<' },
      { label: 'AI 声明', needle: 'AI 声明' },
    ],
  },
  // JustThinking #03《你的蓝色和我的蓝色一样吗？》（具名脚注 6 处引用 / 5 条定义，无图注）
  'justthinking-03': {
    images: 6,
    imageIds: [
      '034OkYqAkXTTF4n25eKF0Y', // 封面 JustThinking_03.png
      '034OkXvOYDZkJ2YFpKGUgS', // 03-06-MyBlueResult.png
      '034OkY2T6vELHVTlQYCiUj', // 03-01.png 俄语 голубой / синий
      '034OkZAv5yAFd5Kc7sQ8zb', // 03-02.png 日语「青」
      '034OkYiqCZniPdp4LIzAss', // 03-04-Japan_traffic_light.png
      '034OkYkTTwidqN3IOUy1Nr', // 03-05-Chinese_qing.png
    ],
    sups: 6, // mineault / bk / boas / martin ×2 / pullum
    defs: 5,
    captions: 0, // 正文 5 张图均无独立「（……）」图注行
    fnUrls: 1, // 只有 [5] Mineault 条目含 URL（ismy.blue）
    order: [
      { label: '标题 H1', needle: '你的蓝色和我的蓝色一样吗' },
      { label: '封面图', needle: '034OkYqAkXTTF4n25eKF0Y' },
      { label: 'Is My Blue 结果图', needle: '034OkXvOYDZkJ2YFpKGUgS' },
      { label: '俄语蓝图', needle: '034OkY2T6vELHVTlQYCiUj' },
      { label: '日语青图', needle: '034OkZAv5yAFd5Kc7sQ8zb' },
      { label: '日本交通灯图', needle: '034OkYiqCZniPdp4LIzAss' },
      { label: '汉语青图', needle: '034OkYkTTwidqN3IOUy1Nr' },
      { label: '参考资料标题', needle: '>参考资料<' },
      { label: 'AI 声明', needle: 'AI 声明' },
    ],
  },
};
const DEFAULT_PROFILE = 'justthinking-03';

const argv = process.argv.slice(2);
let file = null;
let profileName = DEFAULT_PROFILE;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--profile' || argv[i] === '-p') {
    if (!argv[i + 1] || argv[i + 1].startsWith('-')) {
      console.error('--profile 缺少参数，可选：' + Object.keys(PROFILES).join(' / '));
      process.exit(2);
    }
    profileName = argv[++i];
  } else if (!argv[i].startsWith('-') && !file) {
    file = argv[i];
  }
}
if (!file) {
  console.error('用法: node verify.mjs <output.html> [--profile ' + Object.keys(PROFILES).join('|') + ']');
  process.exit(2);
}
if (!PROFILES[profileName]) {
  console.error(`未知 profile: ${profileName}，可选：${Object.keys(PROFILES).join(' / ')}`);
  process.exit(2);
}
const E = PROFILES[profileName];
console.log(`profile: ${profileName}\nfile: ${file}\n`);

const html = fs.readFileSync(file, 'utf8');
const links = [...html.matchAll(/<a [^>]*style="([^"]*)"/g)].map((m) => m[1]);
const fnUrls = (html.match(/<span style="color:#b8860b;">https?:/g) || []).length;

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

// 1. 无 <style> / class 选择器 / 不允许的 CSS 特性
check('无 <style> 标签', !/<style/i.test(html));
check('无 class 属性', !/class="/.test(html));
for (const bad of ['flex', 'position:', '::before', '::after', 'max-content', 'overflow-x']) {
  check(`无 ${bad}`, !html.includes(bad));
}

// 2. 主色替换（预期 #edd363：装饰性；#b8860b：文字级强调）
check('无旧主色 #FAAD14', !/#FAAD14/i.test(html) && !/rgba\(250,\s*173,\s*20/i.test(html));
check('无旧主色 #ffe576', !/#ffe576/i.test(html) && !/rgba\(255,\s*229,\s*118/i.test(html));
const primaryCount = (html.match(/#edd363/g) || []).length;
// 装饰性主色：#edd363 仅用于 H1 左色条、H2 下划线、列表符号、参考资料标题（文字级已改用 #b8860b）
check(`主色 #edd363 出现 ${primaryCount} 次（装饰性）`, primaryCount >= 5);
const accentCount = (html.match(/#b8860b/g) || []).length;
// 文字级强调色的下限由文章结构推出：每个上标 / 脚注编号 / 脚注 URL span 各 1 处，每个链接 2 处（<a> + 内层 span）
const accentMin = E.sups + E.defs + E.fnUrls + links.length * 2;
check(`文字级强调色 #b8860b 出现 ${accentCount} 次（下限 ${accentMin}）`, accentCount >= accentMin);

// 2b. 对齐：全文无两端对齐；正文元素显式左对齐（图注保持居中）
check('无 text-align:justify', !/text-align:\s*justify/i.test(html));
const leftCount = (html.match(/text-align:\s*left/g) || []).length;
check(`text-align:left 出现 ${leftCount} 次`, leftCount >= 20);
const capStyle = html.match(/<p style="text-align:center;margin:0 0 20px[^"]*">（[^）]{2,40}）<\/p>/g) || [];
check(`图注保持居中（${capStyle.length} 条）`, capStyle.length === E.captions);

// 2c. 链接色：<a> 与内层 span 均为 #b8860b；脚注 URL span 着色
// 正文可无链接（此时以脚注 URL 着色为准），但只要有链接就必须是深金
check(
  `链接色 #b8860b（<a> ${links.length} 个 + 脚注 URL span ${fnUrls} 条）`,
  links.every((s) => s.includes('#b8860b')) && links.length + fnUrls >= 1
);
check(`脚注 URL 着色 ${fnUrls} 条`, fnUrls === E.fnUrls);

// 3. 图片：全部图床 URL，与映射一一对应
const imgs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
check(`图片数量 = ${E.images}（实际 ${imgs.length}）`, imgs.length === E.images);
check('图片全部为 imgdb 图床 URL', imgs.every((u) => u.startsWith('https://pic1.imgdb.cn/i/')));
check('图片与图床映射一一对应', E.imageIds.every((id) => imgs.some((u) => u.includes(id))));

// 4. 脚注：上标引用 + 定义条数
const sups = [...html.matchAll(/<sup[^>]*>\[(\d+)\]<\/sup>/g)].map((m) => Number(m[1]));
check(`上标引用 = ${E.sups}（实际 ${sups.length}）`, sups.length === E.sups);
const defs = [...html.matchAll(/<span style="[^"]*width:32px[^"]*">\[(\d+)\]<\/span>/g)].map((m) => Number(m[1]));
check(`脚注定义 = ${E.defs}（实际 ${defs.length}）`, defs.length === E.defs);
check(`引用编号均在 1..${E.defs}`, sups.every((n) => n >= 1 && n <= E.defs));
check(`定义编号 1..${E.defs} 齐全`, JSON.stringify(defs) === JSON.stringify([...Array(E.defs)].map((_, i) => i + 1)));
const supSet = new Set(sups);
check('每个被引用编号都有定义', [...supSet].every((n) => defs.includes(n)));

// 5. 图注数量（仅匹配真正的图注段：居中 + 收起间距的「（……）」段，避免误吞正文里的括号句）
const captions = [...html.matchAll(/<p style="text-align:center;margin:0 0 20px[^"]*">（[^）]{2,40}）<\/p>/g)];
check(`图注 = ${E.captions}（实际 ${captions.length}）`, captions.length === E.captions);

// 5b. 图注间距：带图注的图片 margin-bottom 12px（28px 过远 → 4px 过近 → 12px 折中），图注紧贴图片；
//     无图注文章则要求全部图片统一 margin:20px auto，且不得残留图注样式
const imgTags = [...html.matchAll(/<img [^>]*>/g)].map((m) => m[0]);
if (E.captions > 0) {
  check('图注图距 12px（img margin-bottom 12px）', html.includes('margin:20px auto 12px'));
  check('图注上距归零（caption margin-top 0）', /text-align:center;margin:0 0 20px/.test(html));
} else {
  check(
    '无图注文章：图片统一 margin:20px auto',
    imgTags.length > 0 && imgTags.every((t) => t.includes('margin:20px auto;'))
  );
  check('无图注文章：无图注样式残留', !html.includes('margin:20px auto 12px') && !html.includes('text-align:center;margin:0 0 20px'));
}

// 5c. 页边距：主题容器 padding 12px（用户要求小页边距，文字贴近边缘但不贴边）
check('页边距 padding 12px', /padding:12px[^"]*text-align:left/.test(html));

// 6. 关键内容存在性与顺序
const idx = E.order.map((o) => html.indexOf(o.needle));
const inOrder = idx.every((v, i) => v !== -1 && (i === 0 || v > idx[i - 1]));
check('关键内容存在且顺序正确', inOrder, E.order.map((o) => o.label).join(' → '));

// 7. 直角引号惯例：正文（参考资料之前）文本中无英文/弯双引号残留
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const bodyText = stripTags(html.slice(html.indexOf('<h1'), html.indexOf('参考资料')));
check('正文无引号残留（已转直角引号）', !/[“”"]/.test(bodyText));

// 8. 无本地资源引用
check('无本地路径引用', !/file:\/\/|src="\.\//.test(html));

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? '全部通过' : failed.length + ' 项未通过'}（共 ${results.length} 项）`);
process.exit(failed.length === 0 ? 0 : 1);
