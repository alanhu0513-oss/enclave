FROM node:20-alpine

WORKDIR /app

# Copy dependency manifest first (layer caching)
COPY backend/package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# Copy source
COPY backend/src ./src

# Create writable data directory
RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
