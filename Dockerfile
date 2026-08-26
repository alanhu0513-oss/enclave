FROM node:20-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src

RUN mkdir -p /data && chown node:node /data

USER node

ENV NODE_ENV=production
ENV PORT=7860
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/enclave.json

EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:7860/api/health || exit 1

CMD ["node", "src/index.js"]
