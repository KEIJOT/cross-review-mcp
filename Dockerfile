FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist/ dist/
COPY llmapi.config.json ./

EXPOSE 6280

CMD ["node", "dist/index.js", "--mode", "http", "--port", "6280"]
