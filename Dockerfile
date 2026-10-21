FROM cgr.dev/chainguard/node:latest-dev@sha256:cf779c59fe663d07b5c19e6f85a9286032c4ca097403a78e9b146626c06556ac AS build

USER root
RUN npm install --prefix /tmp/undici-patch --ignore-scripts --no-save \
      --package-lock=false --no-audit --no-fund undici@6.29.1 \
    && npm_bin="$(command -v npm)" \
    && npm_real="$(node -e "console.log(require('fs').realpathSync(process.argv[1]))" "${npm_bin}")" \
    && npm_pkg_dir="$(dirname "$(dirname "${npm_real}")")" \
    && if [ ! -d "${npm_pkg_dir}/node_modules" ]; then \
         for candidate in /usr/lib/node_modules/npm /usr/local/lib/node_modules/npm /usr/share/nodejs/npm; do \
           if [ -d "${candidate}/node_modules" ]; then \
             npm_pkg_dir="${candidate}"; \
             break; \
           fi; \
         done; \
       fi \
    && if [ ! -d "${npm_pkg_dir}/node_modules" ]; then \
         echo "Unable to locate npm package directory (npm_bin=${npm_bin}, npm_real=${npm_real}, npm_pkg_dir=${npm_pkg_dir})" >&2; \
         exit 1; \
       fi \
    && echo "Patching undici in ${npm_pkg_dir}" \
    && undici_target="${npm_pkg_dir}/node_modules/undici" \
    && mkdir -p "$(dirname "${undici_target}")" \
    && rm -rf "${undici_target}" \
    && cp -R /tmp/undici-patch/node_modules/undici "${undici_target}" \
    && rm -rf /tmp/undici-patch

WORKDIR /home/code
COPY --chown=node:node . ./
RUN rm -rf node_modules
USER node
