# Simple Docker for mGBA test environment using pre-built packages
FROM ubuntu:22.04

# Set environment to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install runtime dependencies and mGBA
RUN apt-get update && apt-get install -y \
    mgba-qt \
    lua5.4 \
    xvfb \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy test data and scripts
COPY test_data/ /app/test_data/
COPY scripts/ /app/scripts/

# Copy entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]