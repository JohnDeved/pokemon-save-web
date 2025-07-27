# mGBA Docker environment with Lua HTTP server support  
FROM ubuntu:22.04

# Set environment to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install build and runtime dependencies (matching native working environment)
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    qtbase5-dev \
    qtmultimedia5-dev \
    liblua5.4-dev \
    lua5.4 \
    libpng-dev \
    zlib1g-dev \
    libzip-dev \
    libedit-dev \
    libepoxy-dev \
    xvfb \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Build mGBA from source with exact flags that work in native environment
WORKDIR /build
RUN git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master
WORKDIR /build/mgba
RUN cmake -B build \
    -DBUILD_QT=ON \
    -DBUILD_SDL=OFF \
    -DUSE_LUA=ON \
    -DCMAKE_BUILD_TYPE=Release \
    -DUSE_FFMPEG=OFF \
    -DUSE_MINIZIP=OFF \
    -DUSE_LIBZIP=OFF \
    -DUSE_DISCORD_RPC=OFF \
    && cmake --build build --parallel \
    && cp build/qt/mgba-qt /usr/local/bin/mgba-qt \
    && cp build/libmgba.so.* /usr/local/lib/ \
    && ldconfig

# Create working directory and copy required files
WORKDIR /app
COPY docker/data/ /app/data/
COPY scripts/mgba-lua/http-server.lua /app/data/http-server.lua
COPY docker/entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]