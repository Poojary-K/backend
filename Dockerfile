# syntax=docker/dockerfile:1

FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build
RUN mkdir -p dist/config \
  && cp src/config/emailTemplates.json dist/config/emailTemplates.json \
  && cp src/config/emailLayout.html dist/config/emailLayout.html

FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/server.js"]
