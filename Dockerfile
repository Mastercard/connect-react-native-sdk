FROM cgr.dev/chainguard/node:latest-dev@sha256:cf779c59fe663d07b5c19e6f85a9286032c4ca097403a78e9b146626c06556ac AS build

USER root
RUN npm install --prefix /tmp/undici-patch --ignore-scripts --no-save \
      --package-lock=false --no-audit --no-fund undici@6.29.1 \
    && npm_root="$(npm root -g)" \
    && rm -rf "${npm_root}/npm/node_modules/undici" \
    && cp -R /tmp/undici-patch/node_modules/undici \
      "${npm_root}/npm/node_modules/undici" \
    && rm -rf /tmp/undici-patch

WORKDIR /home/code
COPY --chown=node:node . ./
RUN rm -rf node_modules
USER node
