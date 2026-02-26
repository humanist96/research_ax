#!/bin/bash
set -e

echo "=== Research AX Batch Pipeline ==="
echo ""

echo "[1/4] Collecting news..."
npm run collect
echo ""

echo "[2/4] Analyzing with Claude CLI..."
npm run analyze
echo ""

echo "[3/4] Generating reports..."
npm run report
echo ""

echo "[4/4] Building static site..."
npm run build
echo ""

echo "=== Pipeline complete! ==="
