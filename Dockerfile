# A Dockerfile is a recipe for an image. Each instruction adds a "layer".
# Docker caches layers, so the order matters: things that change rarely
# go first, things that change often (your code) go last.
#
# This is a MULTI-STAGE build: stage 1 installs packages with npm,
# stage 2 is the image that actually ships. Only what we COPY across
# ends up in the final image, so build tools stay behind.

# ── Stage 1: install dependencies ──────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app

# Copy ONLY the dependency list first, then install. As long as
# package.json doesn't change, Docker reuses this layer from cache and
# skips the install, even when you edit the code.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: the runtime image ─────────────────────────────────
FROM node:24-alpine

# The app runs with plain `node`, so remove the package managers that
# ship with the base image. They're the biggest source of security
# findings (npm bundles its own copies of tar, semver, etc.) and an
# attacker who got in could use them to install tools.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Tell Node and libraries this is production (less logging, faster).
ENV NODE_ENV=production
WORKDIR /app

# Take the installed packages from stage 1, then add the code.
# Editing a .js file only rebuilds from here down.
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY targets.json ./

# Don't run as root. The node image ships a "node" user for this. If
# someone ever breaks into the app, they get a powerless user.
USER node

# Documentation: the app listens on this port inside the container.
EXPOSE 3000

# Docker calls /health on a schedule and marks the container
# "healthy" or "unhealthy". Orchestrators restart unhealthy ones.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3000}/health" > /dev/null || exit 1

# Start Node directly (not "npm start"). npm doesn't pass SIGTERM on to
# the app, so `docker stop` would wait 10 s and then force-kill it.
CMD ["node", "src/index.js"]
