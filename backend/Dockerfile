FROM alpine:3.18

# Install dependencies
RUN apk add --no-cache \
    ca-certificates \
    wget \
    unzip

# Create app directory
WORKDIR /app

# Download PocketBase
RUN wget https://github.com/pocketbase/pocketbase/releases/download/v0.20.0/pocketbase_0.20.0_linux_amd64.zip \
    && unzip pocketbase_0.20.0_linux_amd64.zip \
    && rm pocketbase_0.20.0_linux_amd64.zip \
    && chmod +x pocketbase

# Create data directory
RUN mkdir -p pb_data

# Copy initialization files
COPY pb_schema.json ./
COPY pb_hooks/ ./pb_hooks/

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

# Start PocketBase with initialization
CMD ["./start.sh"]