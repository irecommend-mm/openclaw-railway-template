#!/bin/bash
set -e

chown -R openclaw:openclaw /data
chmod 700 /data

# Persist meta-cli config/token store on the Railway volume.
# meta-cli stores config under ~/.meta-cli by default.
mkdir -p /data/.meta-cli
chown -R openclaw:openclaw /data/.meta-cli
mkdir -p /home/openclaw
chown -R openclaw:openclaw /home/openclaw
ln -sfn /data/.meta-cli /home/openclaw/.meta-cli

# Homebrew in this image is large (often 500MB+). Copying it onto a small Railway
# volume fills the disk and breaks mkdir for /data/.openclaw (ENOSPC). Keep brew in
# the image on Railway; persist only OpenClaw under /data.
if [ -n "${RAILWAY_ENVIRONMENT:-}" ] || [ "${OPENCLAW_USE_IMAGE_BREW:-}" = "1" ]; then
  echo "[entrypoint] Homebrew stays in container image (Railway / OPENCLAW_USE_IMAGE_BREW); /data reserved for OpenClaw state."
else
  if [ ! -d /data/.linuxbrew ]; then
    cp -a /home/linuxbrew/.linuxbrew /data/.linuxbrew
  fi
  rm -rf /home/linuxbrew/.linuxbrew
  ln -sfn /data/.linuxbrew /home/linuxbrew/.linuxbrew
fi

exec gosu openclaw node src/server.js
