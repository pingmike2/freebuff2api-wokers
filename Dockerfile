FROM node:20-alpine
WORKDIR /app

# Only server.js + worker.js needed; no npm deps
COPY package.json server.js worker.js ./

# Create credentials dir (mounted at runtime)
RUN mkdir -p /app/credentials && chown -R node:node /app

USER node
EXPOSE 8787

CMD ["node", "server.js"]