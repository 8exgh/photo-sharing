# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install docker CLI for compose commands
RUN apk add --no-cache docker-cli docker-cli-compose

ENV NODE_ENV=production

# Copy only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built files
COPY --from=builder /app/dist ./dist

# Create directories for volumes
RUN mkdir -p /data /backups /deploy

EXPOSE 4000

CMD ["node", "dist/index.js"]
