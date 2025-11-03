#!/bin/bash
# Auto-detect platform and build omap_loader
# This script detects your OS and builds omap_loader for your platform

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN_DIR="$SCRIPT_DIR/bin"
SRC_DIR="$SCRIPT_DIR/src/omap_loader"
PATCH_FILE="$SCRIPT_DIR/patches/omap_loader_mac.patch"

# Detect OS
OS="$(uname -s)"
ARCH="$(uname -m)"

echo "========================================="
echo "OMAP Loader Build Script"
echo "========================================="
echo "Detected OS: $OS"
echo "Detected Architecture: $ARCH"
echo ""

# Determine platform-specific settings
case "$OS" in
    Linux*)
        PLATFORM="linux"
        TARGET_DIR="$BIN_DIR/linux-x64"
        BINARY_NAME="omap_loader"
        echo "Building for Linux..."

        # Check for required dependencies
        if ! command -v gcc &> /dev/null; then
            echo "Error: GCC not found. Install with:"
            echo "  sudo apt-get install build-essential"
            exit 1
        fi

        if ! pkg-config --exists libusb-1.0; then
            echo "Error: libusb-1.0 not found. Install with:"
            echo "  sudo apt-get install libusb-1.0-0-dev"
            exit 1
        fi
        ;;

    Darwin*)
        PLATFORM="macos"
        if [ "$ARCH" = "arm64" ]; then
            TARGET_DIR="$BIN_DIR/macos-arm64"
            echo "Building for macOS (Apple Silicon)..."
        else
            TARGET_DIR="$BIN_DIR/macos-x64"
            echo "Building for macOS (Intel)..."
        fi
        BINARY_NAME="omap_loader"

        # Check for required dependencies
        if ! command -v gcc &> /dev/null; then
            echo "Error: GCC/Clang not found. Install Xcode Command Line Tools:"
            echo "  xcode-select --install"
            exit 1
        fi

        # Check for libusb and attempt to install if missing
        echo "Checking for libusb..."
        if ! brew list libusb &> /dev/null && ! pkg-config --exists libusb-1.0; then
            echo "libusb not found. Attempting to install..."

            # Check for Homebrew
            if command -v brew &> /dev/null; then
                echo "Installing libusb via Homebrew..."
                brew install libusb
            # Check for MacPorts
            elif command -v port &> /dev/null; then
                echo "Installing libusb via MacPorts..."
                sudo port install libusb
            # Check for Fink
            elif command -v fink &> /dev/null; then
                echo "Installing libusb via Fink..."
                fink install libusb1
            else
                echo "Error: No package manager found (Homebrew, MacPorts, or Fink)"
                echo "Please install Homebrew first:"
                echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
                echo "Then run: brew install libusb"
                exit 1
            fi

            # Verify installation
            if ! brew list libusb &> /dev/null && ! pkg-config --exists libusb-1.0; then
                echo "Error: libusb installation failed"
                exit 1
            fi
            echo "libusb installed successfully!"
        else
            echo "libusb is already installed."
        fi
        echo ""
        ;;

    MINGW*|MSYS*|CYGWIN*)
        PLATFORM="windows"
        TARGET_DIR="$BIN_DIR/windows-x64"
        BINARY_NAME="omap_loader.exe"
        echo "Building for Windows (MinGW)..."

        # Check for required dependencies
        if ! command -v gcc &> /dev/null; then
            echo "Error: GCC not found. Install MSYS2 and run:"
            echo "  pacman -S mingw-w64-x86_64-gcc mingw-w64-x86_64-make"
            exit 1
        fi
        ;;

    *)
        echo "Error: Unsupported operating system: $OS"
        exit 1
        ;;
esac

echo ""

echo "Patching omap_loader for macOS..."
PATCH_APPLIED=0
if [ "$OS" = "Darwin" ] && [ -f "$PATCH_FILE" ]; then
    echo "Applying macOS libusb adjustments..."
    if patch -p0 --dry-run --silent < "$PATCH_FILE" 2>&1 | grep -q "previously applied"; then
        echo "macOS patch already applied."
    elif patch -p0 --dry-run --silent < "$PATCH_FILE" > /dev/null 2>&1; then
        patch -p0 < "$PATCH_FILE"
        PATCH_APPLIED=1
        echo "macOS patch applied successfully."
    else
        echo "Warning: Unable to apply patch cleanly. Continuing anyway..."
    fi
fi

cd "$SRC_DIR"

echo ""
echo "========================================="
echo "Building..."
echo "========================================="
make clean
make

echo ""
echo "========================================="
echo "Installing to $TARGET_DIR"
echo "========================================="
mkdir -p "$TARGET_DIR"
cp "$BINARY_NAME" "$TARGET_DIR/"
chmod +x "$TARGET_DIR/$BINARY_NAME"

if [ "$PATCH_APPLIED" = "1" ]; then
    echo "Reverting macOS adjustments..."
    cd "$SCRIPT_DIR"
    patch -p0 -R < "$PATCH_FILE"
fi

echo ""
echo "Cleaning build artifacts..."
rm -f "$BINARY_NAME"
make clean
echo "Returning to script directory..."
cd "$SCRIPT_DIR"

echo ""
echo "========================================="
echo "Build Complete!"
echo "========================================="
echo "Binary location: $TARGET_DIR/$BINARY_NAME"
echo ""
echo "You can now run the firmware loader with:"
if [ "$PLATFORM" = "windows" ]; then
    echo "  cd NoLongerEvil-Thermostat/FirmwareSetup"
    echo "  ./install.sh"
else
    echo "  cd NoLongerEvil-Thermostat/FirmwareSetup"
    echo "  sudo ./install.sh"
fi
echo ""

