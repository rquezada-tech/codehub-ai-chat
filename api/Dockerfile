FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Environment variables (set in CapRover)
ENV API_SECRET_KEY=CHANGE_ME_IN_CAPROVER
ENV OLLAMA_HOST=http://host.docker.internal:11434
ENV OLLAMA_MODEL=llama3.2:1b
ENV MYSQL_HOST=srv-captain--mysql-db
ENV MYSQL_USER=store
ENV MYSQL_PASSWORD=StoreCodeHub2026!
ENV MYSQL_DATABASE=store
ENV ERPNEXT_URL=http://erpnext:8088

EXPOSE 3001

CMD ["node", "dist/index.js"]
