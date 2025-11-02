#!/bin/bash
# Auto-detect platform and build omap_loader
# This script detects your OS and builds omap_loader for your platform

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BIN_DIR="$SCRIPT_DIR/bin"
SRC_DIR="$SCRIPT_DIR/src/omap_loader"

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
echo "========================================="
echo "Checking source directory..."
echo "========================================="
if [ ! -d "$SRC_DIR" ]; then
    echo "Error: Source directory not found at: $SRC_DIR"
    echo "Please ensure omap_loader is cloned in the src/ directory"
    exit 1
fi

echo ""
echo "========================================="
echo "Building from source..."
echo "========================================="
cd "$SRC_DIR"

echo ""
echo "========================================="
echo "Building..."
echo "========================================="
make

echo ""
echo "========================================="
echo "Installing to $TARGET_DIR"
echo "========================================="
mkdir -p "$TARGET_DIR"
cp "$BINARY_NAME" "$TARGET_DIR/"
chmod +x "$TARGET_DIR/$BINARY_NAME"

# Cleanup
echo ""
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
    echo "  ./load_firmware.sh"
else
    echo "  cd NoLongerEvil-Thermostat/FirmwareSetup"
    echo "  sudo ./load_firmware.sh"
fi
echo ""

