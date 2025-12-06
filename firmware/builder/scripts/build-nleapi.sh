#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK_DIR="/work"
cd "$BUILD_DIR"

# This script is called from inside Docker - no platform checks needed
# Docker ensures we're always running on Linux

echo "═══════════════════════════════════════════════════════"
echo " Setting up NLEAPI"
echo "═══════════════════════════════════════════════════════"
echo

LINUXROOT="${BUILD_DIR}/deps/root"
NLEAPIINSTALLDIR="${LINUXROOT}/tmp/nleapi"
mkdir -p ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/install_httpd.sh ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/nleapi ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/httpd.monitrc ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/version ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/update ${NLEAPIINSTALLDIR}
cp $WORK_DIR/deps/settings ${NLEAPIINSTALLDIR}
