#!/bin/bash
# Auto-detect platform and install firmware to OMAP device

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "========================================="
echo "NoLongerEvil Firmware Installer"
echo "========================================="
echo "Detected OS: $OS"
echo "Detected Architecture: $ARCH"
echo ""

# Determine which binary to use
case "$OS" in
    Linux*)
        OMAP_LOADER="$SCRIPT_DIR/bin/linux-x64/omap_loader"
        USE_SUDO="sudo"
        ;;
    Darwin*)
        if [ "$ARCH" = "arm64" ]; then
            OMAP_LOADER="$SCRIPT_DIR/bin/macos-arm64/omap_loader"
        else
            OMAP_LOADER="$SCRIPT_DIR/bin/macos-x64/omap_loader"
        fi
        USE_SUDO="sudo"
        ;;
    MINGW*|MSYS*|CYGWIN*)
        OMAP_LOADER="$SCRIPT_DIR/bin/windows-x64/omap_loader.exe"
        USE_SUDO=""
        ;;
    *)
        echo "Error: Unsupported operating system: $OS"
        exit 1
        ;;
esac

# Check if binary exists
if [ ! -f "$OMAP_LOADER" ]; then
    echo "Error: omap_loader binary not found at: $OMAP_LOADER"
    echo ""
    echo "Please build it first by running:"
    echo "  ./build.sh"
    exit 1
fi

echo "Using omap_loader: $OMAP_LOADER"
echo ""
echo "========================================="
echo "Waiting for device to enter DFU mode..."
echo "========================================="
echo ""
echo "Instructions:"
echo "1. Ensure your Nest is charged (50%+ recommended)"
echo "2. Remove the Nest from the wall mount"
echo "3. Connect it to your computer via micro USB"
echo "4. Press and hold the display for 10-15 seconds"
echo "5. The device will reboot and enter DFU mode"
echo ""
echo "The installer will automatically detect the device and begin flashing..."
echo ""

# Set firmware paths (use absolute paths to avoid issues with sudo)
XLOAD_BIN="$(cd "$SCRIPT_DIR/bin/firmware" && pwd)/x-load.bin"
UBOOT_BIN="$(cd "$SCRIPT_DIR/bin/firmware" && pwd)/u-boot.bin"
UIMAGE_BIN="$(cd "$SCRIPT_DIR/bin/firmware" && pwd)/uImage"

# Verify firmware files exist
if [ ! -f "$XLOAD_BIN" ]; then
    echo "Error: x-load.bin not found at: $XLOAD_BIN"
    exit 1
fi

if [ ! -f "$UBOOT_BIN" ]; then
    echo "Error: u-boot.bin not found at: $UBOOT_BIN"
    exit 1
fi

if [ ! -f "$UIMAGE_BIN" ]; then
    echo "Error: uImage not found at: $UIMAGE_BIN"
    exit 1
fi

echo "Firmware files verified:"
echo "  x-load: $XLOAD_BIN"
echo "  u-boot: $UBOOT_BIN"
echo "  uImage: $UIMAGE_BIN"
echo ""

# Load firmware (expand all variables before sudo to prevent path issues)
if [ -n "$USE_SUDO" ]; then
    sudo "$OMAP_LOADER" \
        -f "$XLOAD_BIN" \
        -f "$UBOOT_BIN" \
        -a 0x80100000 \
        -f "$UIMAGE_BIN" \
        -a 0x80A00000 \
        -v \
        -j 0x80100000
else
    "$OMAP_LOADER" \
        -f "$XLOAD_BIN" \
        -f "$UBOOT_BIN" \
        -a 0x80100000 \
        -f "$UIMAGE_BIN" \
        -a 0x80A00000 \
        -v \
        -j 0x80100000
fi

# Check if successful
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "Firmware installed successfully!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "1. Keep the device plugged in via USB"
    echo "2. Wait 2-3 minutes for the device to boot"
    echo "3. You should see the NoLongerEvil logo"
    echo "4. Visit https://nolongerevil.com to register"
    echo "5. Link your device using the entry code from:"
    echo "   Settings → Nest App → Get Entry Code"
    echo ""
else
    echo ""
    echo "========================================="
    echo "Installation failed!"
    echo "========================================="
    echo ""
    echo "Please check:"
    echo "- Device is properly connected via USB"
    echo "- Device entered DFU mode correctly"
    echo "- USB drivers are installed (Windows)"
    echo ""
    exit 1
fi

