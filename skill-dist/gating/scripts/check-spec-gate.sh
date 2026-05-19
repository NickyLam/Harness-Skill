#!/bin/bash
set -e

echo "🔍 Checking Spec Gate..."

SPEC_FILE=""

if [ -f ".harness/specs/"*.md ]; then
  SPEC_FILE=$(ls -t .harness/specs/*.md 2>/dev/null | head -1)
elif [ -f "docs/PRD.md" ]; then
  SPEC_FILE="docs/PRD.md"
fi

if [ -z "$SPEC_FILE" ]; then
  echo "❌ FAIL: No spec document found in .harness/specs/ or docs/PRD.md"
  exit 1
fi

echo "  → Found spec: $SPEC_FILE"

echo "  → Checking requirement completeness..."
MISSING_SECTIONS=$(grep -c "TODO\|FIXME\|待补充" "$SPEC_FILE" || true)
if [ "$MISSING_SECTIONS" -gt 0 ]; then
  echo "⚠️ WARNING: $MISSING_SECTIONS incomplete sections in $SPEC_FILE"
fi

if ! grep -q "验收标准\|Acceptance Criteria" "$SPEC_FILE"; then
  echo "❌ FAIL: No acceptance criteria found in $SPEC_FILE"
  exit 1
fi

echo "✅ Spec Gate passed"
exit 0
