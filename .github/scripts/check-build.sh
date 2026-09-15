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

echo "  dist 体积 : $(du -sh "$DIST_DIR" | cut -f1)"
echo "  HTML 页面 : $html_count"
echo "  公众号图标: $wechat_pages 个页面，src=/images/wechat-icon.png"
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
