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
    # 404 是确定性的"文件不在"，重试没有意义，直接判失败
    [[ "$code" == "404" ]] && break
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
echo "== 每篇文章的 og:image / twitter:image（微信分享缩略图）=="
warned_fallback=0
while IFS= read -r page; do
  rel="${page#"$DIST_DIR"}"          # /posts/xxx/index.html
  path="${rel%/index.html}/"
  html=$(cat "$page")
  og_url=$(printf '%s' "$html" | grep -o '<meta property="og:image" content="[^"]*"' | head -1 | sed 's/.*content="//; s/"$//') || true
  tw_url=$(printf '%s' "$html" | grep -o '<meta name="twitter:image" content="[^"]*"' | head -1 | sed 's/.*content="//; s/"$//') || true

  if [[ -z "$og_url" ]]; then
    echo "  ❌ ${path} 没有 og:image"
    failures=$((failures + 1))
    continue
  fi
  if [[ "$tw_url" != "$og_url" ]]; then
    echo "  ❌ ${path} 的 twitter:image（${tw_url:-空}）与 og:image 不一致"
    failures=$((failures + 1))
  fi
  if [[ "$og_url" == "${SITE_URL}/og-image.png" ]]; then
    # 文章没配 banner 时的正常回退，只提示不判失败
    echo "  ⚠️  $og_url （${path} 用的是站点默认图，未配 banner）"
    warned_fallback=$((warned_fallback + 1))
    check "$og_url"
  elif [[ "$og_url" == "${SITE_URL}"* ]]; then
    check "$og_url"
  else
    echo "  ⚠️  ${path} 的 og:image 是站外地址，社交卡片可能抓不到：$og_url"
  fi
done < <(find "$DIST_DIR/posts" -name index.html | sort)
[[ "$warned_fallback" -eq 0 ]] || echo "  （${warned_fallback} 篇未配 banner，回退到站点默认图）"

echo
echo "== 校验汇总 =="
echo "  检查 $checked 个 URL，失败 $failures 个"

if [[ "$failures" -gt 0 ]]; then
  echo "::error::$failures 个线上资源校验失败，见上方 ❌ 列表"
  exit 1
fi

echo "全部通过 ✅"
