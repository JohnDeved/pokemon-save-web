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
    bsdmainutils \
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
    && cmake --build build --parallel 2 \
    && cp build/qt/mgba-qt /usr/local/bin/mgba-qt \
    && cp build/libmgba.so.* /usr/local/lib/ \
    && ldconfig


# Create working directory and download/copy required files
WORKDIR /app
RUN mkdir -p /app/data \
    && url="piz.92%eporuE02%C2%ASU82%02%noisreV02%dlaremE02%-02%nomekoP/ABG/noitcelloc02%nmkp/noitcelloc_nmkp/daolnwod/gro.evihcra//:sptth" \
    && rev_url=$(echo "$url" | rev) \
    && echo "Downloading ROM from: $rev_url" \
    && curl -L -o /app/data/tmp_rom.zip "$rev_url" \
    && unzip -o /app/data/tmp_rom.zip -d /app/data/ \
    && mv /app/data/*.gba /app/data/emerald.gba \
    && rm -f /app/data/tmp_rom.zip
COPY src/lib/parser/__tests__/test_data/emerald.ss0 /app/data/
COPY scripts/mgba-lua/http-server.lua /app/data/mgba_http_server.lua
COPY docker/entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]