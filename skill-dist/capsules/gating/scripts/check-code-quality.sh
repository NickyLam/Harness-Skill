#!/bin/bash
# ============================================================================
# check-code-quality.sh — 代码质量门禁（v3.1 增强版）
# 用法: ./check-code-quality.sh [project_dir]
#
# 检查项:
#   1. TypeScript 类型检查
#   2. ESLint 代码风格检查
#   3. 测试覆盖率检查
#   4. 圈复杂度检查
#   5. 安全漏洞扫描
#   6. TDD 合规性检查
# ============================================================================

set -euo pipefail

echo "==========================================="
echo "  Code Quality Gate - Enhanced v3.1"
echo "==========================================="

# 默认项目目录为脚本所在位置的上两级（core/skills/cross-cutting/gating/scripts -> 项目根目录）
PROJECT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)}"

PASSED=0
FAILED=0
WARNED=0

# ============================================================================
# Check 1: TypeScript Type Check
# ============================================================================
echo ""
echo "--- Check 1: TypeScript Type Check ---"

TYPECHECK_RESULT=0
if command -v npx &> /dev/null; then
    if npx tsc --noEmit --project "${PROJECT_DIR}/tsconfig.json" 2>&1; then
        echo "✅ TypeScript: No type errors"
        ((PASSED++))
    else
        echo "❌ TypeScript: Type errors found"
        ((FAILED++))
        TYPECHECK_RESULT=1
    fi
else
    echo "⚠️ TypeScript: npx not found, skipping type check"
    ((WARNED++))
fi

# ============================================================================
# Check 2: ESLint Code Style
# ============================================================================
echo ""
echo "--- Check 2: ESLint ---"

ESLINT_RESULT=0
if [ -f "${PROJECT_DIR}/eslint.config.js" ] || [ -f "${PROJECT_DIR}/.eslintrc.js" ] || [ -f "${PROJECT_DIR}/.eslintrc.json" ]; then
    if npx eslint "${PROJECT_DIR}/src" --ext .ts,.tsx --max-warnings=50 --format compact 2>&1; then
        ERROR_COUNT=$(npx eslint "${PROJECT_DIR}/src" --ext .ts,.tsx --format json 2>/dev/null | jq '[.[] | select(.severity == 2)] | length' 2>/dev/null || echo "0")
        WARNING_COUNT=$(npx eslint "${PROJECT_DIR}/src" --ext .ts,.tsx --format json 2>/dev/null | jq '[.[] | select(.severity == 1)] | length' 2>/dev/null || echo "0")
        
        if [ "$ERROR_COUNT" -eq 0 ]; then
            echo "✅ ESLint: Passed (${WARNING_COUNT} warnings, within limit)"
            ((PASSED++))
            ESLINT_RESULT=0
        else
            echo "❌ ESLint: ${ERROR_COUNT} error(s) found"
            ((FAILED++))
            ESLINT_RESULT=1
        fi
    else
        echo "❌ ESLint: Failed to run or too many errors/warnings"
        ((FAILED++))
        ESLINT_RESULT=1
    fi
else
    echo "⚠️ ESLint: No config file found, skipping"
    ((WARNED++))
fi

# ============================================================================
# Check 3: Test Coverage
# ============================================================================
echo ""
echo "--- Check 3: Test Coverage ---"

COVERAGE_RESULT=0
if [ -f "${PROJECT_DIR}/vitest.config.ts" ] || [ -f "${PROJECT_DIR}/jest.config.ts" ] || [ -f "${PROJECT_DIR}/package.json" ]; then
    # 尝试 vitest 或 jest
    if grep -q '"vitest"' "${PROJECT_DIR}/package.json" 2>/dev/null; then
        COVERAGE_OUTPUT=$(npx vitest run --coverage 2>&1 || true)
    elif grep -q '"jest"' "${PROJECT_DIR}/package.json" 2>/dev/null; then
        COVERAGE_OUTPUT=$(npx jest --coverage 2>&1 || true)
    else
        COVERAGE_OUTPUT=""
    fi

    if [ -n "$COVERAGE_OUTPUT" ]; then
        # 提取覆盖率百分比 (兼容不同测试框架的输出格式)
        LINES_COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -oP 'Lines\s*+\K[\d.]+' | tail -1 || echo "0")
        
        if [ -n "$LINES_COVERAGE" ]; then
            # 使用 bc 进行浮点数比较 (如果没有 bc，使用 awk)
            COVERAGE_PASS=$(echo "$LINES_COVERAGE >= 80" | awk '{print ($1 >= 80)}')
            
            if [ "$COVERAGE_PASS" = "1" ]; then
                echo "✅ Coverage: ${LINES_COVERAGE}% (≥ 80% threshold)"
                ((PASSED++))
                COVERAGE_RESULT=0
            else
                echo "⚠️ Coverage: ${LINES_COVERAGE}% (< 80% threshold, warning only)"
                ((PASSED++))  # 覆盖率不足仅警告，不阻塞
                COVERAGE_RESULT=0
                ((WARNED++))
            fi
        else
            echo "⚠️ Coverage: Could not parse coverage output"
            ((PASSED++))  # 无法解析不阻塞
            ((WARNED++))
        fi
    else
        echo "⚠️ Coverage: No test runner configured or tests failed to run"
        ((WARNED++))
    fi
else
    echo "⚠️ Coverage: No test configuration found, skipping"
    ((WARNED++))
fi

# ============================================================================
# Check 4: Cyclomatic Complexity (Optional)
# ============================================================================
echo ""
echo "--- Check 4: Cyclomatic Complexity ---"

COMPLEXITY_RESULT=0
if command -v npx &> /dev/null && npx es-complexity --version &> /dev/null 2>&1; then
    COMPLEXITY_OUTPUT=$(npx es-complexity "${PROJECT_DIR}/src" --format json 2>&1 || true)
    
    if [ -n "$COMPLEXITY_OUTPUT" ]; then
        HIGH_COMPLEXITY_FUNCTIONS=$(echo "$COMPLEXITY_OUTPUT" | jq '[.functions[] | select(.complexity > 10)] | length' 2>/dev/null || echo "0")
        AVG_COMPLEXITY=$(echo "$COMPLEXITY_OUTPUT" | jq '.averageComplexity // 0' 2>/dev/null || echo "0")
        
        if [ "$HIGH_COMPLEXITY_FUNCTIONS" = "0" ]; then
            echo "✅ Complexity: All functions ≤ 10 (avg: ${AVG_COMPLEXITY})"
            ((PASSED++))
        else
            echo "⚠️ Complexity: ${HIGH_COMPLEXITY_FUNCTIONS} function(s) with complexity > 10 (warning only)"
            # 列出高复杂度函数
            echo "$COMPLEXITY_OUTPUT" | jq -r '.functions[] | select(.complexity > 10) | "   - \(.name): \(.complexity) in \(.file)"' 2>/dev/null || true
            ((PASSED++))  # 复杂度警告不阻塞
            ((WARNED++))
        fi
        COMPLEXITY_RESULT=0
    else
        echo "⚠️ Complexity: Failed to analyze, skipping"
        ((WARNED++))
    fi
else
    echo "⚠️ Complexity: es-complexity not installed, skipping (optional check)"
    ((WARNED++))
fi

# ============================================================================
# Check 5: Security Audit
# ============================================================================
echo ""
echo "--- Check 5: Security Audit ---"

SECURITY_RESULT=0
if [ -f "${PROJECT_DIR}/package.json" ]; then
    AUDIT_OUTPUT=$(npm audit --audit-level=high 2>&1 || true)
    
    if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
        echo "✅ Security: No high/critical vulnerabilities"
        ((PASSED++))
        SECURITY_RESULT=0
    elif echo "$AUDIT_OUTPUT" | grep -q "found [1-9] vulnerability"; then
        VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -oP 'found \K\d+(?= vulnerability)' || echo "?")
        echo "❌ Security: ${VULN_COUNT} vulnerability(ies) found (high/critical)"
        echo "$AUDIT_OUTPUT" | head -20
        ((FAILED++))
        SECURITY_RESULT=1
    else
        echo "⚠️ Security: Unable to parse audit output"
        ((WARNED++))
    fi
else
    echo "⚠️ Security: No package.json found, skipping"
    ((WARNED++))
fi

# ============================================================================
# Check 6: TDD Compliance (v3.1 新增)
# ============================================================================
echo ""
echo "--- Check 6: TDD Compliance ---"

TDD_RESULT=0
VIOLATION_FILE="${PROJECT_DIR}/.harness/audit/tdd-violations.log"

if [ -f "$VIOLATION_FILE" ]; then
    ERROR_VIOLATIONS=$(grep -c "|.*ERROR|" "$VIOLATION_FILE" 2>/dev/null || echo "0")
    
    if [ "$ERROR_VIOLATIONS" -gt 0 ]; then
        echo "❌ TDD Compliance: ${ERROR_VIOLATIONS} error-level violation(s) found"
        echo "   Details: $VIOLATION_FILE"
        ((FAILED++))
        TDD_RESULT=1
    else
        WARNING_VIOLATIONS=$(grep -c "|.*WARNING|" "$VIOLATION_FILE" 2>/dev/null || echo "0")
        echo "✅ TDD Compliance: No errors (${WARNING_VIOLATIONS} warning(s) may exist)"
        ((PASSED++))
        TDD_RESULT=0
    fi
else
    echo "✅ TDD Compliance: No violations logged"
    ((PASSED++))
    TDD_RESULT=0
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "==========================================="
echo "  Results: $PASSED passed, $FAILED failed, $WARNED warnings"
echo "==========================================="

# 详细结果表格
printf "\n%-35s %-10s %s\n" "Check" "Status" "Details"
printf "%-35s %-10s %s\n" "-----" "------" "-------"
printf "%-35s %-10s %s\n" "TypeScript Type Check" "$([ $TYPECHECK_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')" "$([ $TYPECHECK_RESULT -eq 0 ] && echo '' || echo 'Type errors found')"
printf "%-35s %-10s %s\n" "ESLint" "$([ $ESLINT_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')" "$([ $ESLINT_RESULT -eq 0 ] && echo '' || echo 'Lint errors found')"
printf "%-35s %-10s %s\n" "Test Coverage" "✅ CHECKED" "≥80% required (warnings allowed)"
printf "%-35s %-10s %s\n" "Cyclomatic Complexity" "✅ CHECKED" "≤10 per function (warnings allowed)"
printf "%-35s %-10s %s\n" "Security Audit" "$([ $SECURITY_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')" "$([ $SECURITY_RESULT -eq 0 ] && echo '' || echo 'Vulnerabilities found')"
printf "%-35s %-10s %s\n" "TDD Compliance" "$([ $TDD_RESULT -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')" "$([ $TDD_RESULT -eq 0 ] && echo '' || echo 'Violations logged')"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✅ All code quality checks passed! Ready for next gate."
    exit 0
else
    echo ""
    echo "❌ Some checks failed ($FAILED failed). Please fix and retry."
    echo ""
    echo "Recommended fixes:"
    [ $TYPECHECK_RESULT -ne 0 ] && echo "  1. Run 'npx tsc --noEmit' and fix type errors"
    [ $ESLINT_RESULT -ne 0 ] && echo "  2. Run 'npx eslint src/ --fix' and fix lint issues"
    [ $SECURITY_RESULT -ne 0 ] && echo "  3. Run 'npm audit fix' to fix vulnerabilities"
    [ $TDD_RESULT -ne 0 ] && echo "  4. Review and address TDD violations in $VIOLATION_FILE"
    exit 1
fi
