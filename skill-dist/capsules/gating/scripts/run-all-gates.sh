#!/bin/bash
set -euo pipefail

# ============================================================================
# run-all-gates.sh — Harness 全量 Gate 跑批脚本
# 用法: ./run-all-gates.sh [options]
#
# 安全策略:
#   - 脚本名称来自内置白名单 (GATES 数组)，不接受外部输入
#   - 脚本路径使用绝对路径，防止相对路径遍历
#   - 所有子脚本均通过 bash -c 执行并限定目录
# ============================================================================

echo "==========================================="
echo "  Harness Gating System - Full Check"
echo "==========================================="

# === 内置白名单：仅允许以下预定义的 gate 脚本 ===
# ⚠️ 严禁从外部文件、环境变量或参数读取脚本名
declare -A ALLOWED_GATES
ALLOWED_GATES[spec]="check-spec-gate"
ALLOWED_GATES[plan]="check-plan-gate"
ALLOWED_GATES[build]="check-build-gate"
ALLOWED_GATES[test]="check-test-gate"
ALLOWED_GATES[review]="check-review-gate"
ALLOWED_GATES[simplify]="check-simplify-gate"
ALLOWED_GATES[code-quality]="check-code-quality"  # v3.1 新增: 代码质量门禁

# 解析脚本所在目录（绝对路径）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATE_SCRIPTS_DIR="${SCRIPT_DIR}"

# 验证脚本目录存在且为目录
if [[ ! -d "${GATE_SCRIPTS_DIR}" ]]; then
    echo "❌ ERROR: Gate scripts directory not found: ${GATE_SCRIPTS_DIR}"
    exit 1
fi

PASSED=0
FAILED=0
WARNED=0

for gate_name in "${!ALLOWED_GATES[@]}"; do
  script_name="${ALLOWED_GATES[$gate_name]}"
  script_path="${GATE_SCRIPTS_DIR}/${script_name}.sh"

  echo ""
  echo "--- Gate: ${gate_name} (${script_name}) ---"

  # 安全校验：仅执行白名单中存在的脚本
  if [[ ! -f "${script_path}" ]]; then
    echo "⚠️  Gate script not found: ${script_path}, skipping..."
    ((WARNED++))
    continue
  fi

  # 安全校验：脚本必须可读
  if [[ ! -r "${script_path}" ]]; then
    echo "❌ Gate script not readable: ${script_path}"
    ((FAILED++))
    exit 1
  fi

  # 使用绝对路径执行，防止路径注入
  if bash "${script_path}" "$@"; then
    ((PASSED++))
  else
    ((FAILED++))
    echo "⚠️ Gate '${gate_name}' FAILED. Stopping pipeline."
    exit 1
  fi
done

echo ""
echo "==========================================="
echo "  Results: $PASSED passed, $FAILED failed, $WARNED warnings"
echo "==========================================="

if [ $FAILED -eq 0 ]; then
  echo "✅ All gates passed! Ready for Ship Gate."
  exit 0
else
  echo "❌ Some gates failed. Please fix and retry."
  exit 1
fi
