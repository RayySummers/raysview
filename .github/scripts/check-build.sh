#!/usr/bin/env bash
# RAY-463：上传前的构建产物自检。
# 之前 images 目录整体漏传，页面 404 而部署显示 success —— 这里做最后一道闸门：
# 必要的资源目录缺失或为空，就直接让部署失败，不把不完整的站点推上生产。

set -euo pipefail

DIST_DIR="${DIST_DIR:-dist}"

fail() {
  echo "::error::$*"
  exit 1
}

echo "== 构建产物自检 =="

[[ -f "$DIST_DIR/index.html" ]] || fail "构建产物缺少 $DIST_DIR/index.html"
[[ -f "$DIST_DIR/404.html" ]] || fail "构建产物缺少 $DIST_DIR/404.html"

for dir in images images/posts fonts assets; do
  path="$DIST_DIR/$dir"
  [[ -d "$path" ]] || fail "构建产物缺少目录 $path"
  count=$(find "$path" -type f | wc -l)
  [[ "$count" -gt 0 ]] || fail "构建产物目录 $path 是空的"
done

# 文章封面（RAY-462 起站内托管，微信分享卡片依赖它）
image_count=$(find "$DIST_DIR/images" -type f | wc -l)
[[ "$image_count" -ge 5 ]] || fail "$DIST_DIR/images 只有 $image_count 个文件，明显少于预期"

# 站点整体体积（防止构建出空壳还把服务器上的旧文件删掉）
total_kb=$(du -sk "$DIST_DIR" | cut -f1)
[[ "$total_kb" -ge 2048 ]] || fail "$DIST_DIR 体积异常（${total_kb}KB）"

html_count=$(find "$DIST_DIR" -name '*.html' -type f | wc -l)
[[ "$html_count" -ge 10 ]] || fail "只生成了 $html_count 个 HTML 页面，明显少于预期"

# RAY-467：文章页底部的公众号图标曾经误用 hrefFor()（页面路由函数）生成 src，
# 结果带上尾斜杠变成 /images/wechat-icon.png/，图片 404、浏览器只渲染 alt 文字。
# 这里直接对构建产物断言：src 必须是静态资源路径，不带尾斜杠、不带语言前缀。
WECHAT_ICON_SRC='src="/images/wechat-icon.png"'
wechat_srcs=$(grep -rho 'src="[^"]*wechat-icon[^"]*"' "$DIST_DIR" --include='*.html' | sort -u || true)
[[ -n "$wechat_srcs" ]] || fail "构建产物里找不到公众号图标的 img src，预期每篇文章页各有一处（RAY-467）"
while IFS= read -r src; do
  [[ "$src" == "$WECHAT_ICON_SRC" ]] || fail "公众号图标 src 不是 $WECHAT_ICON_SRC（实为 $src）：静态资源不能走路由函数，会 404（RAY-467）"
done <<<"$wechat_srcs"
[[ -f "$DIST_DIR/images/wechat-icon.png" ]] || fail "构建产物缺少 $DIST_DIR/images/wechat-icon.png"
wechat_pages=$(grep -rl "$WECHAT_ICON_SRC" "$DIST_DIR" --include='*.html' | wc -l)

# RAY-544：文章页的「AI 声明」区必须是可折叠的 <details class="ai-disclosure" open>：
# 默认展开、summary 里带 chevron。区块由 astro.config.mjs 的 rehypeAiDisclosure 插件在
# 渲染层统一生成（历史文章内容不改），所以这里断言三件事：
#   1. 每一处折叠区都带 open（默认展开）；
#   2. 折叠区所在页面数与源文件里带「※ AI 声明 / ※ AI Disclosure」的文章数一致 ——
#      这条能抓住「插件只对部分文章生效」（justthinking-02 标题与说明同段的情况就是这样）。
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ai_src=$(grep -rlE '※ \*\*AI (声明|Disclosure)\*\*' "$REPO_ROOT/src/content/posts" "$REPO_ROOT/src/content/posts-en" 2>/dev/null | wc -l || true)
ai_tags=$(grep -rho '<details class="ai-disclosure"[^>]*>' "$DIST_DIR" --include='*.html' | sort -u || true)
[[ -n "$ai_tags" ]] || fail "构建产物里找不到 AI 声明折叠区 <details class=\"ai-disclosure\">（RAY-544）"
while IFS= read -r tag; do
  [[ "$tag" == *" open"* ]] || fail "AI 声明区没有默认展开（缺 open 属性）：$tag（RAY-544）"
done <<<"$ai_tags"
ai_pages=$(grep -rl '<details class="ai-disclosure"' "$DIST_DIR" --include='*.html' | wc -l || true)
[[ "$ai_pages" -eq "$ai_src" ]] || fail "AI 声明折叠区出现在 $ai_pages 个页面，源文件里有 $ai_src 篇文章带 AI 声明，数量对不上（RAY-544）"
ai_chevrons=$(grep -rho 'class="ms-icon ai-disclosure__chevron"' "$DIST_DIR" --include='*.html' | wc -l || true)
[[ "$ai_chevrons" -eq "$ai_pages" ]] || fail "AI 声明区的 chevron 图标有 $ai_chevrons 个，折叠区有 $ai_pages 个，数量对不上（RAY-544）"

# RAY-549：折叠区的左对齐修正与平滑开合都在 CSS 里，构建产物必须带上（minify / @supports 都可能吞规则）：
#   1. summary 的 padding-inline-start:0（覆盖 heti.min.css 的 summary{padding-inline-start:1em}，18px 缩进）；
#   2. ::details-content 的 block-size 过渡（平滑开合；兜底脚本见 ArticlePage.astro）。
ai_css=$(find "$DIST_DIR/assets" -name '*.css' -type f | head -1)
[[ -n "$ai_css" ]] || fail "构建产物里找不到 CSS 资源（RAY-549）"
grep -qE '\.ai-disclosure__summary\{[^}]*padding-inline-start:0' "$ai_css" \
  || fail "构建产物里的折叠区 summary 没有 padding-inline-start:0，左对齐修正丢了（RAY-549）"
grep -q 'ai-disclosure::details-content' "$ai_css" \
  || fail "构建产物里没有 ::details-content 过渡规则，平滑开合 CSS 丢了（RAY-549）"

# RAY-552：字体栈顺序必须是 Zhudou Sans → Roboto Flex Variable → MiSans。
# 顺序就是「谁认领谁」：Zhudou 认领标点/符号、Roboto 认领西文与数字、MiSans 认领 CJK 汉字。
# 一旦回退（MiSans 回到首位），：；《》 这类标点会重新由 MiSans 认领，
# 标点与相邻汉字不再同字体，字体内部的挤压/kern 就失效 —— 正是 Ray 报的「：“ 不压」。
# 这里直接对产物断言，防止 CSS 被改回去而没人发现。
font_sans=$(grep -rho -e '--font-sans:[^;}]*' "$DIST_DIR/assets" --include='*.css' | head -1 || true)
[[ -n "$font_sans" ]] || fail "构建产物里找不到 --font-sans 声明（RAY-552）"
[[ "$font_sans" == *'"Zhudou Sans"'*'"Roboto Flex Variable"'*'"MiSans"'* ]] \
  || fail "--font-sans 顺序不是 Zhudou Sans → Roboto Flex Variable → MiSans（RAY-552）：$font_sans"

# RAY-547：JT#04《广州地铁志愿有感》的中英对照词表必须逐行渲染。
# 词表在源文件里是同一个段落里的连续多行，靠行尾两个空格（CommonMark 硬换行）分行；
# 行尾空格一旦被删掉（或被编辑器 trim），Markdown 会把整块并成一个段落 ——
# 页面上就是一整行，正是 Ray 10/9 报的那个问题。这里直接对构建产物断言：
# 词表段落里的 <br> 数 = 源文件词表行数 - 1。行数从源文件数出来，不写死，
# 以后增删词条不用改这个脚本。
check_wordlist() { # <源文件> <构建产物 html> <词表首行> <语言标签>
  local src="$1" file="$2" first_entry="$3" label="$4"
  [[ -f "$file" ]] || fail "构建产物缺少 $file（RAY-547）"
  local src_lines block brs
  src_lines=$(awk -v first="$first_entry" 'index($0, first) == 1 { f = 1 } f && NF == 0 { exit } f { print }' "$src" | wc -l)
  [[ "$src_lines" -gt 1 ]] || fail "$label 源文件里找不到词表区块（首行「$first_entry」）：$src（RAY-547）"
  # 词表段落里除 <br> 外没有别的标签，所以「<p> + 非 < 文本 + 若干 <br>」就能整段捞出来
  block=$(tr -d '\n' < "$file" | grep -o "<p>[^<]*\(<br>[^<]*\)*</p>" | grep -F "$first_entry" | head -1 || true)
  [[ -n "$block" ]] || fail "$label 文章页里找不到词表段落：首行「$first_entry」不在任何一个无属性 <p> 里（RAY-547）"
  # 一个 <br> 都没有时 grep 退出码是 1，这里必须吞掉：否则 set -e 会在 fail 之前就把脚本掐掉，报不出原因
  brs=$(grep -o '<br>' <<<"$block" | wc -l || true)
  [[ "$brs" -eq "$((src_lines - 1))" ]] \
    || fail "$label 词表段落只有 $brs 个硬换行，源文件是 $src_lines 行（预期 $((src_lines - 1)) 个）——词表被并成整行了（RAY-547）"
}
check_wordlist \
  "$REPO_ROOT/src/content/posts/justthinking/justthinking-04-metro-volunteer.md" \
  "$DIST_DIR/posts/justthinking/justthinking-04-metro-volunteer/index.html" \
  '乘车码——ride code' '中文'
check_wordlist \
  "$REPO_ROOT/src/content/posts-en/justthinking/justthinking-04-metro-volunteer.md" \
  "$DIST_DIR/en/posts/justthinking/justthinking-04-metro-volunteer/index.html" \
  'ride code——乘车码' '英文'

# RAY-557：主题初始化必须是 <head> 里的「经典」内联脚本 —— 跨页导航不闪白全靠它。
# Astro 对不带 is:inline 的 <script> 会产物化成**延迟**的 type="module"（落在 <body>），
# 浏览器首帧先按默认浅色画完，脚本才把 data-theme 写上 —— Ray 看到的就是这一下白闪。
# 这里对构建产物断言两件事，改回 <script>（非内联）或把脚本挪出 head 都会立刻挂：
#   1. 每个页面 </head> 之前都有那段读 localStorage 的主题脚本；
#   2. 承载它的 <script> 开标签是最朴素的 <script>，不带 type / src。
theme_in_head_missing=0
theme_tags=""
while IFS= read -r file; do
  # 用命令替换而不是 `sed | grep -q`：grep -q 命中即退出，会给 sed 一个 SIGPIPE，
  # pipefail 下管道整体返回 141 —— 命中的页面反而会被判成「缺失」。
  head_part=$(sed -n '1,/<\/head>/p' "$file")
  [[ "$head_part" == *"localStorage.getItem('theme')"* ]] || {
    echo "  ::error file=$file::<head> 里没有主题初始化内联脚本（RAY-557）"
    theme_in_head_missing=$((theme_in_head_missing + 1))
    continue
  }
  # 取出承载主题脚本的那个开标签。先把 head 压成一行：grep 是逐行匹配的，
  # `<script>` 与 `localStorage` 之间正好有一个换行，不压平就匹配不到。
  tag=$(printf '%s' "$head_part" | tr -d '\n' \
    | grep -o "<script[^>]*>[^<]*localStorage.getItem('theme')" | sed 's/>.*//')
  theme_tags="$theme_tags$tag"$'\n'
done < <(find "$DIST_DIR" -name '*.html' -type f)
[[ "$theme_in_head_missing" -eq 0 ]] \
  || fail "有 $theme_in_head_missing 个页面的 <head> 里没有主题初始化脚本，跨页会闪白（RAY-557）"

theme_tags=$(printf '%s\n' "$theme_tags" | sed '/^$/d' | sort -u)
[[ -n "$theme_tags" ]] || fail "构建产物里找不到 head 主题内联脚本（RAY-557）"
while IFS= read -r tag; do
  [[ "$tag" == '<script' ]] \
    || fail "主题初始化脚本的开标签是「$tag」而不是「<script>」：带 type=\"module\" / src 的脚本会延迟执行，首帧仍是浅色（RAY-557）"
done <<<"$theme_tags"

echo "  dist 体积 : $(du -sh "$DIST_DIR" | cut -f1)"
echo "  HTML 页面 : $html_count"
echo "  公众号图标: $wechat_pages 个页面，src=/images/wechat-icon.png"
echo "  AI 声明区 : $ai_pages 个页面（源文件 $ai_src 篇），默认展开 + chevron"
echo "  折叠区样式: 左对齐修正 + ::details-content 过渡 已在 $(basename "$ai_css")"
echo "  字体栈顺序: Zhudou Sans → Roboto Flex Variable → MiSans（RAY-552）"
echo "  主题初始化: <head> 内联经典脚本，产物中无 type=module / src（RAY-557）"
echo "  词表逐行  : JT#04 中英词表逐行渲染（硬换行数 = 源文件行数 - 1）"
echo "  images    : $(find "$DIST_DIR/images" -type f | wc -l) 个文件"
echo "  fonts     : $(find "$DIST_DIR/fonts" -type f | wc -l) 个文件"
echo "  assets    : $(find "$DIST_DIR/assets" -type f | wc -l) 个文件"
echo "自检通过"

# dry-run（线上排障）时额外打印归档内容，确认 dist/images 真的进了 tarball
if [[ "${DRY_RUN:-false}" == "true" ]]; then
  echo
  echo "== dry-run：$DIST_DIR 顶层 =="
  ls -la "$DIST_DIR"

  echo
  echo "== dry-run：复刻 scp-action 的打包方式，检查归档内容 =="
  # shellcheck disable=SC2046
  tar -zcf /tmp/dist-check.tar.gz $(ls -d "$DIST_DIR"/*)
  echo "  归档体积 : $(du -h /tmp/dist-check.tar.gz | cut -f1)"
  echo "  归档条目 : $(tar -tzf /tmp/dist-check.tar.gz | wc -l)"
  echo "  images 条目: $(tar -tzf /tmp/dist-check.tar.gz | grep -c "^${DIST_DIR}/images" || true)"
  echo "  --- images 条目（前 20 条）---"
  tar -tzf /tmp/dist-check.tar.gz | grep "^${DIST_DIR}/images" | head -20 || true
fi
