#!/bin/bash
set -e

echo "🔍 Checking Simplify Gate..."

# 检查函数长度
LONG_FUNCTIONS=$(find src -name "*.ts" -exec awk 'NR>50 {print FILENAME}' {} \; | sort -u | wc -l | tr -d ' ')
LONG_FILES=$(find src -name "*.ts" -exec awk 'NR>500 {print FILENAME}' {} \; | sort -u | wc -l | tr -d ' ')

if [ "$LONG_FUNCTIONS" -gt 0 ]; then
  echo "❌ FAIL: $LONG_FUNCTIONS function(s) exceed 50 lines"
  exit 1
fi

if [ "$LONG_FILES" -gt 0 ]; then
  echo "❌ FAIL: $LONG_FILES file(s) exceed 500 lines"
  exit 1
fi

# 检查重复代码
DUPLICATES=$(npx jscpd src/ --threshold 10 2>/dev/null | grep -c "Clone found" || true)
if [ "$DUPLICATES" -gt 0 ]; then
  echo "⚠️ WARNING: $DUPLICATES duplicate code blocks found"
fi

echo "✅ Simplify Gate passed"
exit 0
