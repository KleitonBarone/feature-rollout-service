FROM node:24-bookworm-slim AS build
WORKDIR /source
RUN npm install -g pnpm@11.24.0
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build
RUN pnpm --filter @feature-rollout/service deploy --legacy --prod /release

FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
WORKDIR /app
COPY --from=build --chown=node:node /release .
USER node
EXPOSE 3100
CMD ["node", "dist/main.js"]
