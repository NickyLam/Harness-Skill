#!/bin/bash
set -e

echo "🔍 Checking Review Gate..."

# 检查代码审查记录
if [ ! -f ".harness/reviews/latest.md" ]; then
  echo "⚠️ WARNING: No review record found"
fi

# 检查复杂度
COMPLEXITY=$(find src -name "*.ts" -exec npx complexity-report {} \; 2>/dev/null | grep -c "high" || true)
if [ "$COMPLEXITY" -gt 5 ]; then
  echo "❌ FAIL: $COMPLEXITY high-complexity functions found"
  exit 1
fi

# 检查安全问题
if grep -r "eval(\|innerHTML\|document.write" --include="*.ts" --include="*.js" src/ 2>/dev/null; then
  echo "❌ FAIL: Security issues detected"
  exit 1
fi

echo "✅ Review Gate passed"
exit 0
