# mGBA Docker environment with Lua HTTP server support  
FROM ubuntu:22.04

# Set environment to avoid interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install build and runtime dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    pkg-config \
    qtbase5-dev \
    qtmultimedia5-dev \
    liblua5.4-dev \
    lua5.4 \
    zlib1g-dev \
    libpng-dev \
    libsdl2-dev \
    libedit-dev \
    libsqlite3-dev \
    xvfb \
    curl \
    unzip \
    netcat \
    && rm -rf /var/lib/apt/lists/*

# Build mGBA from source with Lua support
WORKDIR /build
RUN git clone https://github.com/mgba-emu/mgba.git --depth 1 --branch master
WORKDIR /build/mgba
RUN mkdir build && cd build && \
    cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local -DUSE_LUA=ON -DBUILD_QT=ON -DUSE_DISCORD_RPC=OFF -DUSE_FFMPEG=OFF -DUSE_MINIZIP=OFF -DUSE_LIBZIP=OFF \
    && make -j$(nproc) && make install

# Configure library path
RUN ldconfig

# Create working directory and copy data
WORKDIR /app
COPY docker/data/ /app/data/
COPY docker/entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]