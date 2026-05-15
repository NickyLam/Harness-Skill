#!/bin/bash
set -e

echo "🔍 Checking Plan Gate..."

# 检查计划文档
if [ ! -f "docs/PLAN.md" ]; then
  echo "❌ FAIL: PLAN.md not found"
  exit 1
fi

# 检查任务拆分
echo "  → Checking task decomposition..."
TASK_COUNT=$(grep -c "^### Task" docs/PLAN.md || true)
if [ "$TASK_COUNT" -lt 1 ]; then
  echo "❌ FAIL: No tasks found in plan"
  exit 1
fi

# 检查依赖关系
if ! grep -q "依赖\|depends" docs/PLAN.md; then
  echo "⚠️ WARNING: No dependency analysis found"
fi

echo "✅ Plan Gate passed ($TASK_COUNT tasks found)"
exit 0
