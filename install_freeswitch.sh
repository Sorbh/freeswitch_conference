#!/bin/bash
set -e

DEBUG=false
if [[ "$1" == "--debug" ]]; then
    DEBUG=true
fi

FREESWITCH_VERSION=1.10.12
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_FOLDER=$SCRIPT_DIR/freeswitch_build
SUPPORT_LIB_DIR=$ROOT_FOLDER/support_libs
INSTALL_DIR=$SCRIPT_DIR/freeswitch_install
LOG_FILE="$ROOT_FOLDER/install_freeswitch.log"

mkdir -p $ROOT_FOLDER/support_libs
cd $ROOT_FOLDER

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

TOTAL_STEPS=14
CURRENT_STEP=0
progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    PERCENT=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    echo "[Progress: $PERCENT%] $1"
}

log "Starting FreeSWITCH $FREESWITCH_VERSION installation..."
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
    libvpx-devel unixODBC-devel e2fsprogs-devel"

# Step 3: Install autoconf 2.71 (required by FreeSWITCH)
progress "Installing autoconf 2.71..."
if ! autoconf --version 2>/dev/null | grep -q "2.71"; then
    run_cmd "wget http://ftp.gnu.org/gnu/autoconf/autoconf-2.71.tar.gz"
    run_cmd "tar -xzf autoconf-2.71.tar.gz"
    cd autoconf-2.71
    run_cmd "./configure"
    run_cmd "make"
    run_cmd "sudo make install"
    cd $ROOT_FOLDER
else
    log "autoconf 2.71 already installed, skipping."
fi

# Step 4: Build Sofia-SIP (FreeSWITCH's SIP library)
progress "Building Sofia-SIP from source..."
if [ ! -d "sofia-sip" ]; then
    run_cmd "git clone https://github.com/freeswitch/sofia-sip.git"
fi
cd sofia-sip
run_cmd "sh bootstrap.sh"
run_cmd "./configure --prefix=$SUPPORT_LIB_DIR"
run_cmd "make -j$(nproc)"
run_cmd "sudo make install"
cd $ROOT_FOLDER

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
cd $ROOT_FOLDER

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

# Step 10: Configure modules.conf
progress "Configuring modules..."
run_cmd "sh bootstrap.sh"

# Disable modules we don't need
sed -i 's/^applications\/mod_signalwire/#applications\/mod_signalwire/' modules.conf
sed -i 's/^applications\/mod_verto/#applications\/mod_verto/' modules.conf
sed -i 's/^applications\/mod_av$/#applications\/mod_av/' modules.conf
sed -i 's/^applications\/mod_spandsp/#applications\/mod_spandsp/' modules.conf
sed -i 's/^#xml_int\/mod_xml_curl/xml_int\/mod_xml_curl/' modules.conf
sed -i 's/^endpoints\/mod_verto/#endpoints\/mod_verto/' modules.conf
sed -i 's/^endpoints\/mod_skinny/#endpoints\/mod_skinny/' modules.conf

# Ensure required modules are enabled
sed -i 's/^#\(applications\/mod_conference\)/\1/' modules.conf
sed -i 's/^#\(codecs\/mod_opus\)/\1/' modules.conf
sed -i 's/^#\(formats\/mod_sndfile\)/\1/' modules.conf

log "Enabled modules: mod_sofia, mod_conference, mod_event_socket, mod_opus, mod_dptools, mod_commands, mod_sndfile"

# Step 11: Build FreeSWITCH
progress "Configuring FreeSWITCH build (this may take a few minutes)..."
run_cmd "./configure --prefix=$INSTALL_DIR"

progress "Compiling FreeSWITCH (this will take several minutes)..."
run_cmd "make -j$(nproc)"

# Step 12: Install FreeSWITCH
progress "Installing FreeSWITCH..."
run_cmd "make install"
run_cmd "make cd-sounds-install cd-moh-install"

# Step 13: Copy POC configs
progress "Copying POC configuration files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_SRC="$SCRIPT_DIR/config/freeswitch"
FS_CONF="$INSTALL_DIR/etc/freeswitch"

if [ -d "$CONFIG_SRC" ]; then
    # SIP profiles
    yes | cp -f $CONFIG_SRC/sip_profiles/internal.xml $FS_CONF/sip_profiles/internal.xml 2>/dev/null || true

    # Dialplan — replace default with minimal config, keep only our conference routing
    yes | cp -f $CONFIG_SRC/dialplan/default.xml $FS_CONF/dialplan/default.xml 2>/dev/null || true
    rm -f $FS_CONF/dialplan/default/*.xml 2>/dev/null || true
    mkdir -p $FS_CONF/dialplan/default
    yes | cp -f $CONFIG_SRC/dialplan/redline.xml $FS_CONF/dialplan/default/01_redline.xml 2>/dev/null || true

    # Autoload configs
    yes | cp -f $CONFIG_SRC/autoload_configs/conference.conf.xml $FS_CONF/autoload_configs/conference.conf.xml 2>/dev/null || true
    yes | cp -f $CONFIG_SRC/autoload_configs/event_socket.conf.xml $FS_CONF/autoload_configs/event_socket.conf.xml 2>/dev/null || true
    yes | cp -f $CONFIG_SRC/autoload_configs/xml_curl.conf.xml $FS_CONF/autoload_configs/xml_curl.conf.xml 2>/dev/null || true

    log "POC configs copied to $FS_CONF/"
else
    log "WARNING: Config source directory not found at $CONFIG_SRC. Using default configs."
fi

# Step 14: Add to PATH
progress "Finalizing installation..."
if ! grep -q "$INSTALL_DIR/bin" ~/.bashrc; then
    echo "export PATH=\$PATH:$INSTALL_DIR/bin" >> ~/.bashrc
    log "Added $INSTALL_DIR/bin to PATH in ~/.bashrc"
fi

log "============================================"
log "FreeSWITCH $FREESWITCH_VERSION installed successfully!"
log "Install path: $INSTALL_DIR"
log "Binary: $INSTALL_DIR/bin/freeswitch"
log "Config: $INSTALL_DIR/etc/freeswitch/"
log "============================================"
log ""
log "To start FreeSWITCH:"
log "  $INSTALL_DIR/bin/freeswitch -nc"
log ""
log "To connect to CLI:"
log "  $INSTALL_DIR/bin/fs_cli"
log ""
log "To stop FreeSWITCH:"
log "  $INSTALL_DIR/bin/freeswitch -stop"

if $DEBUG; then
    log "Debug mode enabled. Full logs were displayed during installation."
else
    log "Run the script with --debug for full logs."
fi
