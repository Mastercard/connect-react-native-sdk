FROM cgr.dev/chainguard/node:latest-dev AS build

USER root
# Keep Wolfi packages patched so vulnerability scans don't flag stale base deps.
RUN apk update && apk upgrade --no-cache

WORKDIR /home/code
COPY --chown=node:node . ./
RUN rm -rf node_modules
USER node
