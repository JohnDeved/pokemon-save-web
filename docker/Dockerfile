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
RUN mkdir -p /app/roms \
    # Download Emerald ROM
    && url="piz.92%eporuE02%C2%ASU82%02%noisreV02%dlaremE02%-02%nomekoP/ABG/noitcelloc02%nmkp/noitcelloc_nmkp/daolnwod/gro.evihcra//:sptth" \
    && rev_url=$(echo "$url" | rev) \
    && echo "Downloading Emerald ROM from: $rev_url" \
    && curl -L -o /app/roms/tmp_emerald.zip "$rev_url" \
    && unzip -o /app/roms/tmp_emerald.zip -d /app/roms/ \
    && mv /app/roms/*.gba /app/roms/emerald.gba \
    && rm -f /app/roms/tmp_emerald.zip \
    # Download Quetzal ROM
    && curl -L -o /app/roms/tmp_quetzal.zip "https://ia601003.us.archive.org/27/items/pokemon-quetzal-english-alpha-8v-2/PokemonQuetzalEnglishAlpha8v2.zip" \
    && unzip -o /app/roms/tmp_quetzal.zip -d /app/roms/ \
    && find /app/roms -iname "*quetzal*.gba" -exec mv {} /app/roms/quetzal.gba \; \
    && rm -f /app/roms/tmp_quetzal.zip
COPY entrypoint.sh /app/entrypoint.sh

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Expose HTTP server port
EXPOSE 7102

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]