#!/bin/bash
#
# FreeSWITCH Installer for Redline Conference Bridge
#
# Installs FreeSWITCH 1.10.12 inside this repo folder and copies all
# config files so it's ready to use immediately after the script finishes.
#
# Directory layout (all inside the repo):
#   freeswitch_build/       — source code, support libs (build artifacts)
#   freeswitch_install/     — the running FreeSWITCH installation
#     ├── bin/              — freeswitch, fs_cli binaries
#     ├── etc/freeswitch/   — live config (synced from config/freeswitch/)
#     ├── lib/              — modules (.so files)
#     └── var/log/          — runtime logs
#
# Usage:
#   ./install_freeswitch.sh            Full build + install (first time)
#   ./install_freeswitch.sh --debug    Full build with verbose output
#   ./install_freeswitch.sh --sync     Sync repo configs to live FS + restart
#
# After install:
#   freeswitch_install/bin/freeswitch -nc     Start FreeSWITCH
#   freeswitch_install/bin/fs_cli             Connect to CLI
#   freeswitch_install/bin/freeswitch -stop   Stop FreeSWITCH
#
set -e

FREESWITCH_VERSION=1.10.12
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR=$SCRIPT_DIR/freeswitch_build
SUPPORT_LIB_DIR=$BUILD_DIR/support_libs
INSTALL_DIR=$SCRIPT_DIR/freeswitch_install
CONFIG_SRC="$SCRIPT_DIR/config/freeswitch"
FS_CONF="$INSTALL_DIR/etc/freeswitch"
LOG_FILE="$BUILD_DIR/install_freeswitch.log"

DEBUG=false
if [[ "$1" == "--debug" ]]; then
    DEBUG=true
fi

# ─── Sync configs to live FreeSWITCH ─────────────────────────────────────────
sync_configs() {
    if [ ! -d "$CONFIG_SRC" ]; then
        echo "ERROR: Config source not found at $CONFIG_SRC"
        return 1
    fi
    if [ ! -d "$FS_CONF" ]; then
        echo "ERROR: FreeSWITCH config dir not found at $FS_CONF. Run full install first."
        return 1
    fi

    echo "Syncing repo configs → $FS_CONF ..."

    # SIP profiles
    cp -f $CONFIG_SRC/sip_profiles/internal.xml $FS_CONF/sip_profiles/internal.xml

    # Dialplan
    cp -f $CONFIG_SRC/dialplan/default.xml $FS_CONF/dialplan/default.xml
    rm -f $FS_CONF/dialplan/default/*.xml 2>/dev/null || true
    mkdir -p $FS_CONF/dialplan/default
    cp -f $CONFIG_SRC/dialplan/redline.xml $FS_CONF/dialplan/default/01_redline.xml

    # Chatplan (if exists)
    if [ -d "$CONFIG_SRC/chatplan" ]; then
        mkdir -p $FS_CONF/chatplan
        cp -f $CONFIG_SRC/chatplan/*.xml $FS_CONF/chatplan/ 2>/dev/null || true
    fi

    # Autoload configs
    for f in modules.conf.xml conference.conf.xml event_socket.conf.xml xml_curl.conf.xml; do
        if [ -f "$CONFIG_SRC/autoload_configs/$f" ]; then
            cp -f "$CONFIG_SRC/autoload_configs/$f" "$FS_CONF/autoload_configs/$f"
        fi
    done

    echo "Config sync complete."
}

if [[ "$1" == "--sync" ]]; then
    sync_configs || exit 1

    # Restart FreeSWITCH if running
    if $INSTALL_DIR/bin/freeswitch -stop 2>/dev/null; then
        echo "Stopping FreeSWITCH..."
        sleep 3
    fi
    echo "Starting FreeSWITCH..."
    $INSTALL_DIR/bin/freeswitch -nc
    echo "Done. Use '$INSTALL_DIR/bin/fs_cli' to verify."
    exit 0
fi

# ─── Full install starts here ─────────────────────────────────────────────────

mkdir -p $BUILD_DIR/support_libs
cd $BUILD_DIR

exec > >(tee -a "$LOG_FILE") 2>&1

log() {
    echo "[ $(date +"%Y-%m-%d %H:%M:%S") ] $1"
}

run_cmd() {
    if $DEBUG; then
        eval "$1"
    else
        eval "$1" >/dev/null 2>&1
    fi
}

patch_sofia_sip_session_timer() {
    local target="$BUILD_DIR/sofia-sip/libsofia-sip-ua/nua/nua_session.c"

    python3 - "$target" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
text = path.read_text()
old = """    if (t->local.refresher == nua_local_refresher)
      refresher = nua_local_refresher;
    else if (!initial)
      refresher = t->refresher;
"""
new = """    if (t->local.refresher == nua_local_refresher ||
\tt->local.refresher == nua_remote_refresher)
      refresher = t->local.refresher;
    else if (!initial)
      refresher = t->refresher;
"""

if new in text:
    sys.exit(0)
if old not in text:
    raise SystemExit(f"Unable to patch {path}: session refresher block not found")

path.write_text(text.replace(old, new, 1))
PY
}

patch_freeswitch_session_refresher() {
    local src="$BUILD_DIR/freeswitch-src"

    python3 - "$src" <<'PY'
import sys
from pathlib import Path

src = Path(sys.argv[1])

header = src / "src/mod/endpoints/mod_sofia/mod_sofia.h"
text = header.read_text()
if '#define SOFIA_SESSION_REFRESHER "sofia_session_refresher"' not in text:
    old = '#define SOFIA_SESSION_TIMEOUT "sofia_session_timeout"\n'
    new = old + '#define SOFIA_SESSION_REFRESHER "sofia_session_refresher"\n'
    if old not in text:
        raise SystemExit(f"Unable to patch {header}: SOFIA_SESSION_TIMEOUT define not found")
    header.write_text(text.replace(old, new, 1))

old_line = "\t\ttech_pvt->session_refresher = switch_channel_direction(channel) == SWITCH_CALL_DIRECTION_OUTBOUND ? nua_local_refresher : nua_remote_refresher;\n"
override = old_line + """\t\tif ((val = switch_channel_get_variable(channel, SOFIA_SESSION_REFRESHER))) {
\t\t\tif (!strcasecmp(val, "remote") || !strcasecmp(val, "uas")) {
\t\t\t\ttech_pvt->session_refresher = nua_remote_refresher;
\t\t\t} else if (!strcasecmp(val, "local") || !strcasecmp(val, "uac")) {
\t\t\t\ttech_pvt->session_refresher = nua_local_refresher;
\t\t\t} else if (!strcasecmp(val, "none") || !strcasecmp(val, "no")) {
\t\t\t\ttech_pvt->session_refresher = nua_no_refresher;
\t\t\t}
\t\t}
"""

for relative in (
    "src/mod/endpoints/mod_sofia/mod_sofia.c",
    "src/mod/endpoints/mod_sofia/sofia_glue.c",
):
    path = src / relative
    text = path.read_text()
    if "SOFIA_SESSION_REFRESHER" in text:
        continue
    if old_line not in text:
        raise SystemExit(f"Unable to patch {path}: session_refresher assignment not found")
    path.write_text(text.replace(old_line, override, 1))
PY
}

TOTAL_STEPS=16
CURRENT_STEP=0
progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    PERCENT=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    echo "[Step $CURRENT_STEP/$TOTAL_STEPS — $PERCENT%] $1"
}

log "Starting FreeSWITCH $FREESWITCH_VERSION installation..."
log "Build directory:   $BUILD_DIR"
log "Install directory: $INSTALL_DIR"

# Step 1: Enable repos
progress "Enabling required repositories..."
run_cmd "sudo dnf install -y epel-release"
run_cmd "sudo dnf config-manager --set-enabled crb"

# Step 2: Install system dependencies
progress "Installing system dependencies..."
run_cmd "sudo dnf install -y git wget gcc gcc-c++ make autoconf automake libtool \
    pkgconfig cmake meson ninja-build python3 htop \
    ncurses-devel sqlite-devel pcre-devel speex-devel speexdsp-devel \
    ldns-devel opus-devel libedit-devel libuuid-devel \
    libjpeg-devel libtiff-devel libsndfile-devel libcurl-devel \
    openssl-devel libatomic libpq-devel lua-devel \
    libpcap-devel curl-devel json-c-devel libevent-devel \
    yasm nasm diffutils which zlib-devel libshout-devel libmpg123-devel \
    libvpx-devel unixODBC-devel e2fsprogs-devel \
    ffmpeg-free flite flite-devel"

# Step 3: Install autoconf 2.71 (required by FreeSWITCH)
progress "Installing autoconf 2.71..."
if ! autoconf --version 2>/dev/null | grep -q "2.71"; then
    run_cmd "wget http://ftp.gnu.org/gnu/autoconf/autoconf-2.71.tar.gz"
    run_cmd "tar -xzf autoconf-2.71.tar.gz"
    cd autoconf-2.71
    run_cmd "./configure"
    run_cmd "make"
    run_cmd "sudo make install"
    cd $BUILD_DIR
else
    log "autoconf 2.71 already installed, skipping."
fi

# Step 4: Build Sofia-SIP (FreeSWITCH's SIP library)
progress "Building Sofia-SIP from source..."
if [ ! -d "sofia-sip" ]; then
    run_cmd "git clone https://github.com/freeswitch/sofia-sip.git"
fi
cd sofia-sip
patch_sofia_sip_session_timer
run_cmd "sh bootstrap.sh"
run_cmd "./configure --prefix=$SUPPORT_LIB_DIR"
run_cmd "make -j$(nproc)"
run_cmd "sudo make install"
cd $BUILD_DIR

# Step 5: Build SpanDSP (telephony DSP library)
progress "Building SpanDSP from source..."
if [ ! -d "spandsp" ]; then
    run_cmd "git clone https://github.com/freeswitch/spandsp.git"
fi
cd spandsp
run_cmd "sh bootstrap.sh"
run_cmd "./configure --prefix=$SUPPORT_LIB_DIR"
run_cmd "make -j$(nproc)"
run_cmd "sudo make install"
cd $BUILD_DIR

# Step 6: Update linker
progress "Updating linker settings..."
run_cmd "cp -r '$SUPPORT_LIB_DIR/lib64'/* '$SUPPORT_LIB_DIR/lib'/ 2>/dev/null || true"
echo "$SUPPORT_LIB_DIR/lib" | sudo tee /etc/ld.so.conf.d/freeswitch_libs.conf >/dev/null 2>&1
run_cmd "sudo ldconfig"

# Step 7: Set environment for FreeSWITCH build
progress "Setting environment variables..."
export PKG_CONFIG_PATH=$SUPPORT_LIB_DIR/lib/pkgconfig:$SUPPORT_LIB_DIR/lib64/pkgconfig:$PKG_CONFIG_PATH
export LD_LIBRARY_PATH=$SUPPORT_LIB_DIR/lib:$SUPPORT_LIB_DIR/lib64:$LD_LIBRARY_PATH
export LIBRARY_PATH=$SUPPORT_LIB_DIR/lib:$SUPPORT_LIB_DIR/lib64:$LIBRARY_PATH
export CFLAGS="-I$SUPPORT_LIB_DIR/include"
export LDFLAGS="-L$SUPPORT_LIB_DIR/lib"

# Step 8: Verify dependencies
progress "Verifying dependencies..."
log "Sofia-SIP: $(pkg-config --modversion sofia-sip-ua 2>/dev/null || echo 'NOT FOUND')"
log "SpanDSP: $(pkg-config --modversion spandsp 2>/dev/null || echo 'NOT FOUND')"

# Step 9: Clone FreeSWITCH
progress "Cloning FreeSWITCH v$FREESWITCH_VERSION..."
if [ ! -d "freeswitch-src" ]; then
    run_cmd "git clone https://github.com/signalwire/freeswitch.git freeswitch-src"
fi
cd freeswitch-src
run_cmd "git checkout v$FREESWITCH_VERSION"
patch_freeswitch_session_refresher

# Step 10: Configure build modules (modules.conf controls what gets compiled)
progress "Configuring build modules..."
run_cmd "sh bootstrap.sh"

# Disable modules we don't need (won't compile)
sed -i 's/^applications\/mod_signalwire/#applications\/mod_signalwire/' modules.conf
sed -i 's/^applications\/mod_verto/#applications\/mod_verto/' modules.conf
sed -i 's/^applications\/mod_av$/#applications\/mod_av/' modules.conf
sed -i 's/^applications\/mod_spandsp/#applications\/mod_spandsp/' modules.conf
sed -i 's/^endpoints\/mod_verto/#endpoints\/mod_verto/' modules.conf
sed -i 's/^endpoints\/mod_skinny/#endpoints\/mod_skinny/' modules.conf

# Enable modules we need
sed -i 's/^#xml_int\/mod_xml_curl/xml_int\/mod_xml_curl/' modules.conf
sed -i 's/^#\(applications\/mod_conference\)/\1/' modules.conf
sed -i 's/^#\(codecs\/mod_opus\)/\1/' modules.conf
sed -i 's/^#\(formats\/mod_sndfile\)/\1/' modules.conf
sed -i 's/^#\(asr_tts\/mod_tts_commandline\)/\1/' modules.conf

log "Key modules: mod_sofia, mod_conference, mod_event_socket, mod_xml_curl, mod_opus, mod_dptools, mod_commands, mod_sndfile, mod_tts_commandline"

# Step 11: Build FreeSWITCH
progress "Configuring FreeSWITCH build (this may take a few minutes)..."
run_cmd "./configure --prefix=$INSTALL_DIR"

progress "Compiling FreeSWITCH (this will take several minutes)..."
run_cmd "make -j$(nproc)"

# Step 12: Install FreeSWITCH
progress "Installing FreeSWITCH..."
run_cmd "make install"
run_cmd "make cd-sounds-install cd-moh-install"

# Step 13: Copy project configs from repo → live FreeSWITCH
progress "Deploying project configuration files..."
sync_configs

# Step 14: Generate self-signed TLS certs (for WSS and SIP-TLS)
progress "Setting up TLS certificates..."
TLS_DIR="$FS_CONF/tls"
mkdir -p "$TLS_DIR"
if [ ! -f "$TLS_DIR/wss.pem" ]; then
    PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "127.0.0.1")
    openssl req -x509 -nodes -days 1095 -newkey rsa:2048 \
        -keyout "$TLS_DIR/dtls-srtp.pem" \
        -out "$TLS_DIR/wss.pem" \
        -subj "/CN=$PUBLIC_IP" 2>/dev/null
    cat "$TLS_DIR/wss.pem" "$TLS_DIR/dtls-srtp.pem" > "$TLS_DIR/agent.pem"
    cat "$TLS_DIR/wss.pem" "$TLS_DIR/dtls-srtp.pem" > "$TLS_DIR/dtls-srtp.pem.tmp"
    mv "$TLS_DIR/dtls-srtp.pem.tmp" "$TLS_DIR/dtls-srtp.pem"
    log "Generated self-signed TLS certs for $PUBLIC_IP"
else
    log "TLS certs already exist, skipping."
fi

# Step 15: Build whisper.cpp (local speech-to-text)
progress "Building whisper.cpp..."
WHISPER_DIR="$SCRIPT_DIR/whisper_build"
if [ ! -d "$WHISPER_DIR" ]; then
    run_cmd "git clone https://github.com/ggerganov/whisper.cpp.git $WHISPER_DIR"
fi
cd "$WHISPER_DIR"
if [ ! -f "$WHISPER_DIR/build/bin/whisper-cli" ]; then
    run_cmd "cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF"
    run_cmd "cmake --build build -j$(nproc)"
fi
# Install shared libraries so whisper-cli can find them
\cp -f "$WHISPER_DIR"/build/ggml/src/libggml*.so* /usr/local/lib/
\cp -f "$WHISPER_DIR"/build/src/libwhisper.so* /usr/local/lib/
echo "/usr/local/lib" > /etc/ld.so.conf.d/whisper.conf
run_cmd "ldconfig"
log "whisper.cpp ready at $WHISPER_DIR/build/bin/whisper-cli"
cd $BUILD_DIR

# Step 16: Download Whisper tiny.en model
progress "Downloading Whisper tiny.en model..."
if [ ! -f "$WHISPER_DIR/models/ggml-tiny.en.bin" ]; then
    cd "$WHISPER_DIR"
    run_cmd "bash models/download-ggml-model.sh tiny.en"
    cd $BUILD_DIR
else
    log "Whisper model already downloaded, skipping."
fi

log ""
log "============================================"
log " FreeSWITCH $FREESWITCH_VERSION — READY"
log "============================================"
log ""
log "Install path: $INSTALL_DIR"
log ""
log "  Start:   $INSTALL_DIR/bin/freeswitch -nc"
log "  CLI:     $INSTALL_DIR/bin/fs_cli -H 127.0.0.1 -P 8021 -p <password>"
log "  Stop:    $INSTALL_DIR/bin/freeswitch -stop"
log "  Sync:    $0 --sync"
log ""
log "Ports:"
log "  5070  SIP (UDP/TCP)"
log "  5071  SIP-TLS (Yealink phones)"
log "  5072  WSS (web clients)"
log "  8021  Event Socket (ESL, localhost only)"
log ""
log "Config source:  $CONFIG_SRC/"
log "Live config:    $FS_CONF/"
log ""
log "Whisper.cpp:"
log "  Binary: $WHISPER_DIR/build/bin/whisper-cli"
log "  Model:  $WHISPER_DIR/models/ggml-tiny.en.bin"
log ""
log "After editing config/freeswitch/*, run:"
log "  $0 --sync"
log "to deploy changes and restart FreeSWITCH."
log ""

if $DEBUG; then
    log "Debug mode was enabled. Full build logs were displayed."
else
    log "Run with --debug for verbose build output."
fi
