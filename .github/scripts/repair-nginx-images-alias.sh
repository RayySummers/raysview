#!/usr/bin/env bash
# 一次性运维脚本（RAY-463）：移除站点 nginx 配置里遗留的 /images/ alias。
#
# 背景：vhost 里被手工加过这样一段（优先级高于 root）：
#     location ^~ /images/ {
#         alias /www/raysview/images/;
#         expires 30d;
#     }
# 它指向旧部署目录 /www/raysview/（现已废弃、基本为空），所以 /images/** 全部 404，
# 而文件其实一直好好地躺在真正的站点根 /www/wwwroot/raysview.fun/images/ 里 —— 部署没问题，是配置指错了地方。
#
# 行为：备份 → 删掉该块 → nginx -t → reload；任何一步失败自动回滚。配置里没有该块时直接跳过（幂等）。

set -euo pipefail

CONF="${NGINX_CONF:-/www/server/panel/vhost/nginx/html_raysview.fun.conf}"
STAMP="$(date -u +%Y%m%d%H%M%S)"
BAK="${CONF}.bak-ray463-${STAMP}"

[[ -f "$CONF" ]] || { echo "::error::找不到 $CONF"; exit 1; }

if ! grep -qE 'location[[:space:]]+\^~[[:space:]]+/images/' "$CONF"; then
  echo "配置里没有 ^~ /images/ 块，无需修改（幂等跳过）"
  exit 0
fi

cp -a "$CONF" "$BAK"
echo "已备份原配置：$BAK"
echo "--- 将被删除的块 ---"
grep -nE -A4 'location[[:space:]]+\^~[[:space:]]+/images/' "$CONF"

# 逐行删除：从匹配行开始，直到遇到第一个含 } 的行
awk '
  skipping { if ($0 ~ /\}/) skipping = 0; next }
  /location[[:space:]]+\^~[[:space:]]+\/images\// { skipping = 1; next }
  { print }
' "$BAK" > "$CONF"

rollback() {
  cp -a "$BAK" "$CONF"
  echo "::error::$1；已回滚到 $BAK"
  exit 1
}

grep -qE 'location[[:space:]]+\^~[[:space:]]+/images/' "$CONF" && rollback "未能删除 alias 块"
grep -q 'server_name raysview.fun;' "$CONF" || rollback "配置结构异常（server_name 丢失）"
echo "已删除。删除前后行数：$(wc -l < "$BAK") -> $(wc -l < "$CONF")"

echo "--- nginx -t ---"
nginx -t || rollback "nginx -t 失败"

echo "--- reload ---"
if ! nginx -s reload 2>/dev/null; then
  if command -v systemctl >/dev/null && systemctl reload nginx 2>/dev/null; then
    :
  elif [[ -x /etc/init.d/nginx ]]; then
    /etc/init.d/nginx reload || rollback "reload 失败"
  else
    rollback "无法 reload nginx"
  fi
fi
echo "nginx 已 reload"

sleep 2
echo "--- 本机自测 ---"
for u in /images/ /images/posts/welcome-banner.jpg /images/justthinking-02-cover.png /fonts/MiSans-VF.woff2; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' -H 'Host: raysview.fun' "http://127.0.0.1${u}" || echo "000")
  echo "  $code  $u"
done
