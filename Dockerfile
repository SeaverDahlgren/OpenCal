FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY apps/mobile/package*.json apps/mobile/
RUN npm install
RUN npm --prefix apps/web install

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY package*.json ./
COPY apps ./apps
COPY docs ./docs
COPY scripts ./scripts
COPY src ./src
COPY tests ./tests
COPY tsconfig*.json ./
COPY .env.example ./
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web ./apps/web
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY README.md ./
COPY docs ./docs
COPY scripts ./scripts
COPY .env.example ./
EXPOSE 8787
CMD ["npm", "run", "api:dev"]
