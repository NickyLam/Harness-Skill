#!/bin/bash
set -e

echo "🔍 Checking Ship Gate (Final)..."

# 1. 快速重跑关键门禁
echo "  → Re-running critical gates..."
npx tsc --noEmit || { echo "❌ FAIL: Build Gate re-check failed"; exit 1; }
npm run test -- --bail 2>&1 | tail -5 || { echo "❌ FAIL: Test Gate re-check failed"; exit 1; }

# 2. Git 检查
echo "  → Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ FAIL: Working directory not clean"
  git status --short
  exit 1
fi

# 3. 版本检查
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "  → Current version: $CURRENT_VERSION"

echo ""
echo "🎉 All gates passed! Ready to ship v$CURRENT_VERSION"
echo ""
echo "Next steps:"
echo "  1. Create git tag: git tag v$CURRENT_VERSION"
echo "  2. Push tag: git push origin v$CURRENT_VERSION"
echo "  3. Run deploy script (if applicable)"

exit 0
