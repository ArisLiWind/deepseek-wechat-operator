#!/usr/bin/env bash
# Compile the Vision-framework OCR helper used by wechat_desktop_read.
# macOS only. Output: src/ocr
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$DIR/src/.swift-cache"
swiftc -O -module-cache-path "$DIR/src/.swift-cache" "$DIR/src/ocr.swift" -o "$DIR/src/ocr"
echo "OCR built → $DIR/src/ocr"
