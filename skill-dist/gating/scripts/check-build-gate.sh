#!/bin/bash
set -e

echo "🔍 Checking Build Gate..."

# TypeScript 检查
if [ -f "tsconfig.json" ]; then
  echo "  → Running TypeScript check..."
  npx tsc --noEmit || { echo "❌ FAIL: TypeScript compilation failed"; exit 1; }
fi

# ESLint 检查
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
  echo "  → Running ESLint..."
  npx eslint src/ --max-warnings=0 || { echo "❌ FAIL: ESLint found issues"; exit 1; }
fi

# 构建检查
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo "  → Running build..."
  npm run build || { echo "❌ FAIL: Build failed"; exit 1; }
fi

echo "✅ Build Gate passed"
exit 0
