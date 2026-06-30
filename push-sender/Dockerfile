FROM node:22-alpine

WORKDIR /app

# 의존성만 먼저 설치해 레이어 캐시 활용
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
CMD ["node", "src/index.js"]
