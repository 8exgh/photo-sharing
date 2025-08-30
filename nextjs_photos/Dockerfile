# ---------- 1) build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Accept build arguments for git info
ARG NEXT_PUBLIC_GIT_HASH=unknown
ARG NEXT_PUBLIC_GIT_BRANCH=unknown
ARG NEXT_PUBLIC_BUILD_NUMBER=local
ARG NEXT_PUBLIC_BUILD_TIME

# Set them as environment variables for the build
ENV NEXT_PUBLIC_GIT_HASH=$NEXT_PUBLIC_GIT_HASH
ENV NEXT_PUBLIC_GIT_BRANCH=$NEXT_PUBLIC_GIT_BRANCH
ENV NEXT_PUBLIC_BUILD_NUMBER=$NEXT_PUBLIC_BUILD_NUMBER
ENV NEXT_PUBLIC_BUILD_TIME=$NEXT_PUBLIC_BUILD_TIME

# install deps
COPY package*.json ./
RUN npm install

# copy source
COPY . .

# copy env file if exists
COPY .env.local* ./

# build
RUN npm run build

# ---------- 2) runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install su-exec for dropping privileges
RUN apk add --no-cache su-exec

# Set data directory environment variables for volume mounts
ENV DATA_DIR=/app/data
ENV ALBUMS_DIR=/app/data/albums

# Create data directories and initial files with proper permissions
RUN mkdir -p /app/public/uploads /app/data /app/public/albums && \
    chown -R node:node /app/data /app/public && \
    chmod -R 755 /app/data && \
    chmod -R 755 /app/public/albums

# only bring over what the app needs at runtime
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/.env.local* ./
COPY --from=builder /app/node_modules ./node_modules

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure the copied public directory maintains correct permissions
RUN chown -R node:node /app/public

# Don't use USER directive, let entrypoint handle it
# USER node

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["su-exec", "node", "npm", "start"]