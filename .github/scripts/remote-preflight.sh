#!/usr/bin/env bash
# RAY-463：在目标服务器上执行（由 workflow 通过 `ssh host "bash -s" < 本文件` 传入）。
# 只做巡检 + 一次可写性探测（创建后立刻删除的隐藏临时文件），不改动任何站点文件。
# 目的：把"文件到底有没有落地、能不能写"写进部署日志，避免再次静默失败。

set -u

TARGET="${DEPLOY_TARGET:-/www/wwwroot/raysview.fun}"

echo "== 运行身份 =="
id
echo "umask: $(umask 2>/dev/null || echo unknown)"

echo
echo "== 目标目录 =="
if [[ -d "$TARGET" ]]; then
  ls -ld "$TARGET"
  echo "  下面内容（前 40 行）："
  ls -la "$TARGET" 2>&1 | head -40
else
  echo "MISSING: $TARGET"
fi

echo
echo "== 子目录状态 =="
for d in images images/posts fonts assets; do
  if [[ -e "$TARGET/$d" ]]; then
    ls -ld "$TARGET/$d"
    echo "  文件数: $(find "$TARGET/$d" -type f 2>/dev/null | wc -l)"
  else
    echo "MISSING: $TARGET/$d"
  fi
done

echo
echo "== images 目录明细（前 30 行）=="
ls -la "$TARGET/images" 2>&1 | head -30

echo
echo "== 可写性探测 =="
for d in "$TARGET" "$TARGET/images" "$TARGET/fonts"; do
  probe="$d/.deploy-write-probe"
  if touch "$probe" 2>/dev/null; then
    echo "WRITABLE   $d"
    rm -f "$probe"
  else
    echo "NOT-WRITABLE $d"
  fi
done

echo
echo "== 磁盘 / inode =="
df -h "$TARGET" 2>&1 | tail -2
df -i "$TARGET" 2>&1 | tail -2

echo
echo "== 归档残留（用于取证）=="
ls -la "$HOME"/*.tar.gz /tmp/*.tar.gz 2>/dev/null | head -10 || echo "（无）"

echo
echo "== 站点文件是否落在别处 =="
find /www/wwwroot -maxdepth 5 -name 'welcome-banner.jpg' 2>/dev/null | head -5 || true

echo
echo "== 版本 / 工具 =="
echo "rsync: $(command -v rsync || echo '未安装')"
echo "tar  : $(command -v tar || echo '未安装') $(tar --version 2>/dev/null | head -1)"

echo
echo "== 挂载点 =="
mount 2>/dev/null | grep -E "www|raysview" || echo "（目标目录不在单独挂载点上）"

echo
echo "== /www 顶层 =="
ls -la /www 2>/dev/null | head -30
for d in /www/raysview /www/wwwroot; do
  if [[ -e "$d" ]]; then
    ls -ld "$d"
    [[ -L "$d" ]] && echo "  -> 指向 $(readlink -f "$d")"
  else
    echo "缺失: $d"
  fi
done
if [[ -d /www/raysview ]]; then
  echo "  /www/raysview 下的目录（前 20 个）:"
  find /www/raysview -maxdepth 2 -type d 2>/dev/null | head -20
  echo "  /www/raysview 里的图片:"
  find /www/raysview -name 'welcome-banner.jpg' 2>/dev/null | head -3
fi

echo
echo "== nginx 站点配置 =="
conf_files=$(grep -rl "raysview.fun" /www/server/panel/vhost/nginx/ /etc/nginx/conf.d/ 2>/dev/null | head -3)
if [[ -n "$conf_files" ]]; then
  for f in $conf_files; do
    echo "--- $f ---"
    cat "$f"
  done
else
  echo "未找到 raysview.fun 的 vhost 配置文件"
fi

echo
echo "== nginx 全量配置里与 images 相关的片段 =="
nginx -T 2>/dev/null | grep -n -B4 -A8 "images" | head -60 || true

echo
echo "== 站点访问/错误日志（最后 30 行）=="
for log in /www/wwwlogs/raysview.fun.error.log /www/wwwlogs/raysview.fun.log; do
  if [[ -f "$log" ]]; then
    echo "--- $log ---"
    tail -30 "$log"
  fi
done
