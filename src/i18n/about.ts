/**
 * 「关于」页的双语文案（RAY-465）
 *
 * 正文比界面文案长得多，而且带链接，所以没有塞进 zh.json / en.json，
 * 单独放在这里：结构一样、两份文案并排，第二阶段加语言时照着填即可。
 *
 * 行内片段 `Inline` 支持三种形态：
 *   - 纯文本                     '我是 Rayy Summers。'
 *   - 链接                       { href, label, external? }
 *   - 等宽片段（邮箱之类）        { code: 'rayysummers[at]proton.me' }
 */

import type { Lang } from './index';

export type Inline =
  | string
  | { href: string; label: string; external?: boolean }
  | { code: string };

export interface AboutPlatform {
  name: string;
  href: string;
  handle: string;
}

export interface AboutCopy {
  /** <title> */
  title: string;
  metaDescription: string;
  /** 返回按钮的 aria-label */
  backLabel: string;
  heading: string;
  intro: Inline[][];
  platformsHeading: string;
  /** 平台名与账号之间的分隔符（中文全角冒号，英文半角） */
  platformSeparator: string;
  platforms: AboutPlatform[];
  historyHeading: string;
  history: Inline[][];
  siteHeading: string;
  site: Inline[][];
  /** 字体许可附注（小号、次要色） */
  fontNotice: Inline[];
  /** 备案号（次要色） */
  icpNotice: Inline[];
  updated: string;
}

/** 站外链接只写一处，两份文案共用 */
const LINKS = {
  wechat:
    'https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=MzYzNTI3NjQwMg==#wechat_redirect',
  zhihu: 'https://www.zhihu.com/people/hunderlineh',
  github: 'https://github.com/RayySummers',
  bluesky: 'https://bsky.app/profile/rayysummers.bsky.social',
  x: 'https://x.com/xRayySummers',
  repo: 'https://github.com/RayySummers/raysview',
  miFont: 'https://hyperos.mi.com/font',
  miFontLicense:
    'https://hyperos.mi.com/font-download/MiSans%E5%AD%97%E4%BD%93%E7%9F%A5%E8%AF%86%E4%BA%A7%E6%9D%83%E8%AE%B8%E5%8F%AF%E5%8D%8F%E8%AE%AE.pdf',
  icp: 'https://beian.miit.gov.cn/',
} as const;

const zh: AboutCopy = {
  title: '关于 - 睿见 RayView',
  metaDescription:
    'Rayy Summers（Ray）的个人介绍：语言学专业学生，公众号「睿见 RayView」主理人，分享设计、语言学、AI、社会现象与日常观察。',
  backLabel: '返回',
  heading: '关于 Ray',
  intro: [
    [
      '我是 Rayy Summers，您可以叫我 Ray。我来自重庆，目前住在广州。目前就读于广东外语外贸大学英语语言学拔尖人才实验班。',
    ],
    [
      '目前运营微信公众号 @睿见 RayView (',
      { href: LINKS.wechat, label: '@RayView365', external: true },
      ')，主要发布《半月记（Biweekly）》记录每半个月的洞察和思考、《Ray 的设计课（RayDesign）》分享我对设计的见解。',
    ],
    [
      '如有需要，您可以通过电子邮件（',
      { code: 'rayysummers[at]proton.me' },
      '）联系我。',
    ],
  ],
  platformsHeading: '其他平台',
  platformSeparator: '：',
  platforms: [
    { name: '微信公众号', href: LINKS.wechat, handle: '@RayView365' },
    { name: '知乎', href: LINKS.zhihu, handle: '@睿见RayView' },
    { name: 'GitHub', href: LINKS.github, handle: '@RayySummers' },
    { name: 'Bluesky', href: LINKS.bluesky, handle: '@rayysummers.bsky.social' },
    { name: 'X', href: LINKS.x, handle: '@xRayySummers' },
  ],
  historyHeading: '关于睿见 RayView',
  history: [
    ['睿见 RayView 是 Ray 的个人博客，目前在微信公众号和本网站活跃。'],
    ['2025 年 10 月 20 日，我在个人朋友圈发布了我的第 1 期周记，其为睿见 RayView 事实上的首篇文章。'],
    ['2025 年 11 月 23 日，我创建了微信公众号 @睿见RayView，并发布了第 6 周周记。'],
    ['2025 年 12 月 22 日，发布第 10 周周记。'],
    ['2026 年 1 月 16 日，《周记（Weekly）》系列停止更新，发布《半月记（Biweekly）》第 1 期。'],
    ['2026 年 4 月 25 日，发布第一期《Ray 的设计课（RayDesign）》。'],
    ['2026 年 5 月 21 日，博客网站正式公开，部署在 GitHub Pages。'],
    ['2026 年 7 月 1 日，博客网站备案通过，部署到腾讯云服务器。'],
    ['2026 年 7 月 10 日，发布第一期《随便想想（JustThinking）》。'],
  ],
  siteHeading: '关于这个网站',
  site: [
    ['这个网站基于 Astro 构建，部署在腾讯云服务器，域名 raysview.fun。整个网站都由 AI 帮助搭建。'],
    ['GitHub 仓库：', { href: LINKS.repo, label: 'github.com/RayySummers/raysview', external: true }],
  ],
  fontNotice: [
    '中文字体使用 ',
    { href: LINKS.miFont, label: 'MiSans © Xiaomi', external: true },
    '（自托管 VF，许可见',
    { href: LINKS.miFontLicense, label: '知识产权许可协议', external: true },
    '，本站仅嵌入 woff2 子集用于正文展示）',
  ],
  icpNotice: [
    '备案号：',
    { href: LINKS.icp, label: '渝 ICP 备 2026010610 号', external: true },
  ],
  updated: '最近更新：2026-08-26',
};

const en: AboutCopy = {
  title: 'About - RayView',
  metaDescription:
    'Rayy Summers (Ray) — linguistics student and editor of the WeChat account 睿见 RayView, writing about design, linguistics, AI, society, and everyday observations.',
  backLabel: 'Back',
  heading: 'About Ray',
  intro: [
    [
      "I'm Rayy Summers — you can call me Ray. I'm from Chongqing and I currently live in Guangzhou, where I study in the Elite Experimental Class of English Linguistics at Guangdong University of Foreign Studies.",
    ],
    [
      'I run the WeChat Official Account @睿见 RayView (',
      { href: LINKS.wechat, label: '@RayView365', external: true },
      '), where I publish Biweekly — notes and reflections from every two weeks — and RayDesign, where I share my thinking about design.',
    ],
    ['You can reach me by email at ', { code: 'rayysummers[at]proton.me' }, '.'],
  ],
  platformsHeading: 'Elsewhere',
  platformSeparator: ': ',
  platforms: [
    { name: 'WeChat Official Account', href: LINKS.wechat, handle: '@RayView365' },
    { name: 'Zhihu', href: LINKS.zhihu, handle: '@睿见RayView' },
    { name: 'GitHub', href: LINKS.github, handle: '@RayySummers' },
    { name: 'Bluesky', href: LINKS.bluesky, handle: '@rayysummers.bsky.social' },
    { name: 'X', href: LINKS.x, handle: '@xRayySummers' },
  ],
  historyHeading: 'About RayView',
  history: [
    ["RayView is Ray's personal blog, published both on WeChat and on this site."],
    [
      'On 20 October 2025 I posted my first weekly note to my personal WeChat Moments — effectively the first RayView piece.',
    ],
    [
      'On 23 November 2025 I created the WeChat Official Account @睿见RayView and published the sixth weekly note.',
    ],
    ['On 22 December 2025 I published the tenth weekly note.'],
    ['On 16 January 2026 the Weekly series ended and issue 1 of Biweekly was published.'],
    ['On 25 April 2026 I published the first issue of RayDesign.'],
    ['On 21 May 2026 the blog went public, deployed on GitHub Pages.'],
    ['On 1 July 2026 the site passed its ICP filing and moved to a Tencent Cloud server.'],
    ['On 10 July 2026 I published the first issue of JustThinking.'],
  ],
  siteHeading: 'About this website',
  site: [
    ['This site is built with Astro, deployed on a Tencent Cloud server, and served at raysview.fun. It was built end to end with AI assistance.'],
    ['GitHub repository: ', { href: LINKS.repo, label: 'github.com/RayySummers/raysview', external: true }],
  ],
  fontNotice: [
    'Chinese text is set in ',
    { href: LINKS.miFont, label: 'MiSans © Xiaomi', external: true },
    ' (self-hosted variable font; see the ',
    { href: LINKS.miFontLicense, label: 'intellectual property license', external: true },
    '). Only a woff2 subset is embedded here, for body text.',
  ],
  icpNotice: [
    'ICP filing: ',
    { href: LINKS.icp, label: '渝 ICP 备 2026010610 号', external: true },
  ],
  updated: 'Last updated: 2026-08-26',
};

export const ABOUT: Record<Lang, AboutCopy> = { zh, en };
