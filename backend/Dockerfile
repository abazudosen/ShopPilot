FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce?schema=public

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/prisma.config.ts
RUN npm ci --workspace=backend --include-workspace-root

COPY backend backend
RUN npm run build --workspace=backend

FROM build AS production-deps
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY backend/prisma backend/prisma
COPY --from=production-deps /app/node_modules node_modules
COPY --from=production-deps /app/backend/node_modules backend/node_modules

COPY --from=build /app/backend/dist backend/dist

EXPOSE 3500
CMD ["node", "backend/dist/main.js"]
