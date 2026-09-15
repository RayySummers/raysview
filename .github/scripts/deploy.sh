#!/usr/bin/env bash
# RAY-463：把 dist/ 同步到服务器。
# 之前用 appleboy/scp-action@master：整包重传（每次 7 分钟）、解包失败不上报、action 还钉在 master。
# 现在改为 rsync 增量同步（--delete 保持服务器与构建产物一致），服务器没有 rsync 时退回 tar over ssh。
# 关键：ssh / rsync / tar 任何一步退出码非 0，在 `set -euo pipefail` 下都会让 job 变红。

set -euo pipefail

: "${SERVER_HOST:?缺少 SERVER_HOST}"
: "${SERVER_USER:?缺少 SERVER_USER}"
: "${SSH_KEY_PATH:?缺少 SSH_KEY_PATH}"
: "${DEPLOY_TARGET:?缺少 DEPLOY_TARGET}"

DIST_DIR="${DIST_DIR:-dist}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"

SSH_OPTS=(
  -i "$SSH_KEY_PATH"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=20
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=8
)

echo "== 目标 =="
echo "  ${DIST_DIR}/ -> ${REMOTE}:${DEPLOY_TARGET}/"
echo "  本地体积: $(du -sh "$DIST_DIR" | cut -f1)"

if ssh "${SSH_OPTS[@]}" "$REMOTE" 'command -v rsync >/dev/null 2>&1'; then
  echo
  echo "== rsync 增量同步 =="
  # .user.ini 是 aaPanel 站点标记文件，.well-known 留给证书校验，二者都保留
  rsync -az --delete --human-readable --stats \
    --exclude '.user.ini' \
    --exclude '.well-known/' \
    -e "ssh ${SSH_OPTS[*]}" \
    "${DIST_DIR}/" "${REMOTE}:${DEPLOY_TARGET}/"
else
  echo
  echo "== 服务器没有 rsync，退回 tar over ssh（全量）=="
  tar -czf - -C "$DIST_DIR" . | ssh "${SSH_OPTS[@]}" "$REMOTE" \
    "tar -xzf - --overwrite -C '${DEPLOY_TARGET}'"
fi

echo
echo "上传完成 $(date -u '+%H:%M:%SZ')"
