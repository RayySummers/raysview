#!/usr/bin/env bash
# RAY-463：部署后的线上校验。
# 之前 Verify 步骤只 curl 了首页状态码，images 全 404 也照样绿 —— 这里逐个文件校验。
# 任一资源不是 200，脚本退出码非 0，job 变红。

set -euo pipefail

: "${SITE_URL:?缺少 SITE_URL}"

DIST_DIR="${DIST_DIR:-dist}"
RETRIES="${VERIFY_RETRIES:-5}"
RETRY_SLEEP="${VERIFY_SLEEP:-6}"

failures=0
checked=0

check() {
  local url="$1" code="" i
  for ((i = 1; i <= RETRIES; i++)); do
    code=$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$url" || echo "000")
    [[ "$code" == "200" ]] && break
    sleep "$RETRY_SLEEP"
  done
  checked=$((checked + 1))
  if [[ "$code" == "200" ]]; then
    echo "  ✅ $code  $url"
  else
    echo "  ❌ $code  $url"
    failures=$((failures + 1))
  fi
}

echo "== 静态资源（$DIST_DIR/images、$DIST_DIR/fonts 下的每个文件）=="
while IFS= read -r file; do
  check "${SITE_URL}/${file#"$DIST_DIR"/}"
done < <(find "$DIST_DIR/images" "$DIST_DIR/fonts" -type f | sort)

echo
echo "== 关键页面 / 站点文件 =="
for path in / /404.html /robots.txt /sitemap-index.xml /posts/justthinking/justthinking-03-blue-green/; do
  check "${SITE_URL}${path}"
done

echo
echo "== og:image（微信分享缩略图）=="
post_path="/posts/justthinking/justthinking-03-blue-green/"
html=$(curl -s -m 20 "${SITE_URL}${post_path}" || true)
og_url=$(printf '%s' "$html" | grep -o '<meta property="og:image" content="[^"]*"' | head -1 | sed 's/.*content="//; s/"$//') || true

if [[ -z "$og_url" ]]; then
  echo "  ❌ ${post_path} 里没有解析到 og:image"
  failures=$((failures + 1))
else
  echo "  og:image = $og_url"
  if [[ "$og_url" == "${SITE_URL}/og-image.png" ]]; then
    echo "  ❌ og:image 仍是站点默认 Logo，文章封面没有生效"
    failures=$((failures + 1))
  else
    check "$og_url"
  fi
fi

echo
echo "== 校验汇总 =="
echo "  检查 $checked 个 URL，失败 $failures 个"

if [[ "$failures" -gt 0 ]]; then
  echo "::error::$failures 个线上资源校验失败，见上方 ❌ 列表"
  exit 1
fi

echo "全部通过 ✅"
