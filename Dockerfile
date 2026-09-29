# A Dockerfile is a recipe for an image. Each instruction adds a "layer".
# Docker caches layers, so the order matters: things that change rarely
# go first, things that change often (your code) go last.

# Start from the official Node.js 24 image on Alpine Linux (~50 MB base).
FROM node:24-alpine

# Tell Node and libraries this is production (less logging, faster).
ENV NODE_ENV=production

# All following commands run inside /app in the image.
WORKDIR /app

# Copy ONLY the dependency list first, then install. As long as
# package.json doesn't change, Docker reuses this layer from cache and
# skips the install, even when you edit the code.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Now copy the code. Editing a .js file only rebuilds from here down.
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
