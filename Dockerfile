FROM cgr.dev/chainguard/node:latest-dev@sha256:cf779c59fe663d07b5c19e6f85a9286032c4ca097403a78e9b146626c06556ac AS build

USER root
RUN npm install --prefix /tmp/undici-patch --ignore-scripts --no-save \
      --package-lock=false --no-audit --no-fund undici@6.29.1 \
    && npm_pkg_dir="$(node -p "require('path').dirname(require.resolve('npm/package.json'))")" \
    && undici_target="${npm_pkg_dir}/node_modules/undici" \
    && mkdir -p "$(dirname "${undici_target}")" \
    && rm -rf "${undici_target}" \
    && cp -R /tmp/undici-patch/node_modules/undici "${undici_target}" \
    && rm -rf /tmp/undici-patch

WORKDIR /home/code
COPY --chown=node:node . ./
RUN rm -rf node_modules
USER node
