/**
 * Material Symbols 图标数据（RAY-464）
 *
 * 来源：icons-package（RayView 素材包）里的 14 个 SVG，原样拷入本目录，未做任何改动。
 * 每个图标两套：`-light` 用于浅色主题（GRAD 0），`-dark` 用于深色主题（GRAD 25，
 * 补偿深色背景下描边偏细的视觉减重）。
 *
 * 生成参数：wght 350 / opsz 24 / FILL 0 / GRAD 0 或 25。
 * wght 取值经过一轮实测：Lucide 的 stroke-width 2 在 24 格上等于 Material 的 wght 400
 * （横杆 80/960 单位），wght 300 只有 75%（60 单位）；Ray 在三档对比后定 350（70 单位，
 * 略轻于原版，视觉更透气）。
 * 复现方式（详见素材包 README.md）：
 *   1. 下载可变字体 MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].ttf（google/material-design-icons 仓库的 variablefont/ 目录）；
 *   2. fontTools 的 instancer 按上面的轴实例化，SVGPathPen 取 "d" 路径；
 *   3. 组装成 <svg viewBox="0 -960 960 960" fill="currentColor"><g transform="scale(1,-1)">…</g></svg>。
 *
 * 三个已知坑：
 *   - 字体坐标系 y 轴向上，SVG y 轴向下，必须用 g transform="scale(1,-1)" 翻转，否则图形上下颠倒；
 *   - fontTools 输出的坐标带十几位小数，要压到 2 位，否则文件白白变大；
 *   - Google 的短链 SVG 接口（fonts.gstatic.com/s/i/short-term/…）只支持 wght，不支持 opsz/GRAD 组合，会全部 404。
 *
 * 注意：Material 里名为 arrow_left 的图标是实心三角，线条箭头必须用 arrow_back。
 *
 * RAY-465 补充：语言切换按钮用的 translate（文A，码点 E8E2）同样原样取自素材包，
 * 参数与上面完全一致（wght 350 / opsz 24 / FILL 0 / GRAD 0、25）。
 * 它的两个文件坐标已在生成阶段取负（y 落在 viewBox 的负半轴），因此没有 scale(1,-1) 那层 <g>；
 * 渲染结果与其它图标一致，接入方式不变。
 */

import arrowBackLight from './arrow_back-light.svg?raw';
import arrowBackDark from './arrow_back-dark.svg?raw';
import arrowUpwardLight from './arrow_upward-light.svg?raw';
import arrowUpwardDark from './arrow_upward-dark.svg?raw';
import searchLight from './search-light.svg?raw';
import searchDark from './search-dark.svg?raw';
import closeLight from './close-light.svg?raw';
import closeDark from './close-dark.svg?raw';
import lightModeLight from './light_mode-light.svg?raw';
import lightModeDark from './light_mode-dark.svg?raw';
import darkModeLight from './dark_mode-light.svg?raw';
import darkModeDark from './dark_mode-dark.svg?raw';
import desktopWindowsLight from './desktop_windows-light.svg?raw';
import desktopWindowsDark from './desktop_windows-dark.svg?raw';
import translateLight from './translate-light.svg?raw';
import translateDark from './translate-dark.svg?raw';

export interface MaterialIconPair {
  /** 浅色主题（GRAD 0） */
  light: string;
  /** 深色主题（GRAD 25） */
  dark: string;
}

export const MATERIAL_ICONS = {
  arrow_back: { light: arrowBackLight, dark: arrowBackDark },
  arrow_upward: { light: arrowUpwardLight, dark: arrowUpwardDark },
  search: { light: searchLight, dark: searchDark },
  close: { light: closeLight, dark: closeDark },
  light_mode: { light: lightModeLight, dark: lightModeDark },
  dark_mode: { light: darkModeLight, dark: darkModeDark },
  desktop_windows: { light: desktopWindowsLight, dark: desktopWindowsDark },
  translate: { light: translateLight, dark: translateDark },
} satisfies Record<string, MaterialIconPair>;

export type MaterialIconName = keyof typeof MATERIAL_ICONS;
