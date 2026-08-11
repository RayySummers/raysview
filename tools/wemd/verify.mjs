// 自检脚本：验证公众号 HTML 交付物
import fs from 'node:fs';

const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');

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
check(`文字级强调色 #b8860b 出现 ${accentCount} 次`, accentCount >= 20);

// 2b. 对齐：全文无两端对齐；正文元素显式左对齐（图注保持居中）
check('无 text-align:justify', !/text-align:\s*justify/i.test(html));
const leftCount = (html.match(/text-align:\s*left/g) || []).length;
check(`text-align:left 出现 ${leftCount} 次`, leftCount >= 20);
const capStyle = html.match(/<p style="text-align:center;margin:0 0 20px[^"]*">（[^）]{2,40}）<\/p>/g) || [];
check(`图注保持居中（${capStyle.length} 条）`, capStyle.length === 2);

// 2c. 链接色：<a> 与内层 span 均为 #b8860b；脚注 URL span 着色
const links = [...html.matchAll(/<a [^>]*style="([^"]*)"/g)].map((m) => m[1]);
check('链接色 #b8860b', links.length >= 1 && links.every((s) => s.includes('#b8860b')));
const fnUrls = (html.match(/<span style="color:#b8860b;">https?:/g) || []).length;
// 18 条脚注中 17 条含 URL（[^5] GB/T 标准无链接），全部着色
check(`脚注 URL 着色 ${fnUrls} 条`, fnUrls === 17);

// 3. 图片：4 张（封面 + 3 正文），全部图床 URL
const imgs = [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);
check(`图片数量 = 4（实际 ${imgs.length}）`, imgs.length === 4);
check('图片全部为 imgdb 图床 URL', imgs.every((u) => u.startsWith('https://pic1.imgdb.cn/i/')));
const expected = [
  '0345F7UprQuwvNe3KzbPh1', // 封面
  '0345F65p7Myv3bJnGXN721', // Tokenizer
  '0345F66hVbYTZwd6MuILtS', // 词元安全警示
  '0345F66ooqgG42tASYKUL1', // DeepSeek 用量
];
check('四张图与图床映射一一对应', expected.every((id) => imgs.some((u) => u.includes(id))));

// 4. 脚注：19 个上标引用 + 18 条定义
const sups = [...html.matchAll(/<sup[^>]*>\[(\d+)\]<\/sup>/g)].map((m) => Number(m[1]));
check(`上标引用 = 19（实际 ${sups.length}）`, sups.length === 19);
const defs = [...html.matchAll(/<span style="[^"]*width:32px[^"]*">\[(\d+)\]<\/span>/g)].map((m) => Number(m[1]));
check(`脚注定义 = 18（实际 ${defs.length}）`, defs.length === 18);
check('引用编号均在 1..18', sups.every((n) => n >= 1 && n <= 18));
check('定义编号 1..18 齐全', JSON.stringify(defs) === JSON.stringify([...Array(18)].map((_, i) => i + 1)));
const supSet = new Set(sups);
check('每个被引用编号都有定义', [...supSet].every((n) => defs.includes(n)));

// 5. 图注：源文中 2 条（Tokenizer / DeepSeek；词元警示图为前置说明段，无图注行）
const captions = [...html.matchAll(/（[^）]{2,40}）<\/p>/g)];
check(`图注 = 2（实际 ${captions.length}）`, captions.length === 2);

// 5b. 图注间距：带图注的图片 margin-bottom 12px（28px 过远 → 4px 过近 → 12px 折中），图注紧贴图片
check('图注图距 12px（img margin-bottom 12px）', html.includes('margin:20px auto 12px'));
check('图注上距归零（caption margin-top 0）', /text-align:center;margin:0 0 20px/.test(html));

// 5c. 页边距：主题容器 padding 12px（用户要求小页边距，文字贴近边缘但不贴边）
check('页边距 padding 12px', /padding:12px[^"]*text-align:left/.test(html));

// 6. 关键内容存在性与顺序
const orderChecks = [
  '标题 H1',
  '封面图',
  'OpenAI Tokenizer',
  '词元安全警示',
  'DeepSeek 用量',
  '参考资料标题',
  'AI 声明',
];
const idx = [
  html.indexOf('谁有权给一个概念命名'),
  html.indexOf('0345F7UprQuwvNe3KzbPh1'),
  html.indexOf('OpenAI Platform Tokenizer 网页截图'),
  html.indexOf('词元安全警示中对token的混淆'),
  html.indexOf('DeepSeek 开放平台用量信息截图'),
  html.indexOf('>参考资料<'),
  html.indexOf('AI 声明'),
];
const inOrder = idx.every((v, i) => v !== -1 && (i === 0 || v > idx[i - 1]));
check('关键内容存在且顺序正确', inOrder, orderChecks.join(' → '));

// 7. 直角引号惯例：正文（参考资料之前）文本中无英文/弯双引号残留
const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const bodyText = stripTags(html.slice(html.indexOf('<h1'), html.indexOf('参考资料')));
check('正文无引号残留（已转直角引号）', !/[“”"]/.test(bodyText));

// 8. 无本地资源引用
check('无本地路径引用', !/file:\/\/|src="\.\//.test(html));

const failed = results.filter((r) => !r.pass);
console.log(`\n${failed.length === 0 ? '全部通过' : failed.length + ' 项未通过'}`);
process.exit(failed.length === 0 ? 0 : 1);
