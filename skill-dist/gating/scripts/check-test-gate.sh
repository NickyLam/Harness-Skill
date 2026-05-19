#!/bin/bash
set -e

echo "🔍 Checking Test Gate..."

# 检查测试文件存在
TEST_COUNT=$(find . -name "*.test.*" -o -name "*.spec.*" | wc -l | tr -d ' ')
if [ "$TEST_COUNT" -eq 0 ]; then
  echo "❌ FAIL: No test files found"
  exit 1
fi

# 运行测试
echo "  → Running tests ($TEST_COUNT files found)..."
npm test -- --coverage --coverageThreshold=80 || { echo "❌ FAIL: Tests failed or coverage < 80%"; exit 1; }

# 检查测试质量
FLAKY=$(grep -r "setTimeout\|setInterval" --include="*.test.*" . | wc -l | tr -d ' ')
if [ "$FLAKY" -gt 0 ]; then
  echo "⚠️ WARNING: $FLAKY potential flaky test patterns detected"
fi

echo "✅ Test Gate passed"
exit 0
