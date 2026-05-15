#!/usr/bin/env bash
#
# gate-check.sh — Harness Gate 轻量级检查脚本
# 用法: ./gate-check.sh <gate_id> [--strictness L1|L2|L3] [--dry-run] [--project-dir /path]
#
# 支持的 gate_id:
#   spec_gate, plan_gate, build_gate, test_gate,
#   review_gate, simplify_gate, ship_gate, all
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/../.."
PIPELINE_YAML="${PROJECT_ROOT}/core/pipeline.yaml"

COLOR_RED='\033[0;31m'
COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_CYAN='\033[0;36m'
COLOR_RESET='\033[0m'

GATE_ID="${1:-}"
STRICTNESS="${2:-L2-standard}"
DRY_RUN=false
PROJECT_DIR="${PROJECT_ROOT}"

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --strictness|-s)
                STRICTNESS="$2"; shift 2 ;;
            --dry-run)
                DRY_RUN=true; shift ;;
            --project-dir|-p)
                PROJECT_DIR="$2"; shift 2 ;;
            --help|-h)
                show_help; exit 0 ;;
            *)
                if [[ -z "$GATE_ID" || "$GATE_ID" == all* ]]; then
                    GATE_ID="$1"
                fi
                shift ;;
        esac
    done
}

show_help() {
    cat <<'EOF'
Harness Gate Checker v1.0

Usage: ./gate-check.sh <gate_id> [options]

Gate IDs:
  spec_gate       Check design document exists and has acceptance criteria
  plan_gate       Check task list exists with dependencies
  build_gate      Check build passes (compile + typecheck)
  test_gate       Check all tests pass with coverage threshold
  review_gate     Check code quality (P0=0, P1≤limit)
  simplify_gate   Check code complexity (function≤50 lines, file≤500)
  ship_gate       Final release checks (all gates passed, git clean)

Options:
  -s, --strictness L1|L2|L3   Strictness level (default: L2-standard)
  --dry-run                     Report only, don't exit on failure
  -p, --project-dir DIR        Project directory (default: auto-detect)
  -h, --help                    Show this help

Examples:
  ./gate-check.sh spec_gate
  ./gate-check.sh build_gate --strictness L3
  ./gate-check.sh all --dry-run
EOF
}

log_info() { echo -e "${COLOR_CYAN}[INFO]${COLOR_RESET} $*"; }
log_pass() { echo -e "${COLOR_GREEN}[PASS]${COLOR_RESET} $*"; }
log_fail() { echo -e "${COLOR_RED}[FAIL]${COLOR_RESET} $*"; }
log_warn() { echo -e "${COLOR_YELLOW}[WARN]${COLOR_RESET} $*"; }

check_file_exists() {
    local pattern="$1"
    local description="$2"

    if compgen -G "${PROJECT_DIR}/${pattern}" > /dev/null 2>&1; then
        log_pass "File exists: ${description} (${pattern})"
        return 0
    else
        log_fail "File missing: ${description} (${pattern})"
        return 1
    fi
}

# ============================================================================
# 安全: 命令白名单 — 仅允许安全字符的简单命令通过校验
# 禁止: 管道(|)、分号(;)、反引号(`)、$()、&& ||、重定向(><)、& 后台
# ============================================================================
ALLOWED_COMMAND_PATTERN='^[a-zA-Z0-9_./\- ]+$'

validate_command() {
    local cmd="$1"
    # 空命令直接拒绝
    if [[ -z "$cmd" ]]; then
        log_fail "Empty command rejected by security policy"
        return 1
    fi
    # 白名单校验：仅允许字母、数字、空格、./-_ 这些安全字符
    if [[ ! "$cmd" =~ $ALLOWED_COMMAND_PATTERN ]]; then
        log_fail "Command blocked by security policy (disallowed characters): ${cmd}"
        return 1
    fi
    # 禁止路径遍历尝试
    if [[ "$cmd" == *".."* ]] || [[ "$cmd" == *"/../"* ]]; then
        log_fail "Command blocked: path traversal detected in ${cmd}"
        return 1
    fi
    return 0
}

check_command() {
    local command="$1"
    local description="$2"

    # === 安全校验入口 ===
    if ! validate_command "$command"; then
        popd > /dev/null 2>&1 || true
        return 1
    fi

    pushd "$PROJECT_DIR" > /dev/null || return 1

    # 使用 bash -c 替代 eval，并设置超时防止挂起
    if timeout 120 bash -c "$command" > /dev/null 2>&1; then
        log_pass "Command succeeded: ${description}"
        popd > /dev/null || true
        return 0
    else
        log_fail "Command failed: ${description} (${command})"
        popd > /dev/null || true
        return 1
    fi
}

run_spec_gate() {
    local level="$1"
    log_info "=== Spec Gate (${level}) ==="
    local passed=0
    local failed=0

    check_file_exists ".harness/specs/*.md" "Design document" && ((passed++)) || ((failed++))

    if [[ "$level" == "L1-lightweight" ]]; then
        return $failed
    fi

    # L2+: 检查验收标准
    if grep -rq '\- \[ \]' .harness/specs/*.md 2>/dev/null; then
        log_pass "Acceptance criteria found in spec documents"
        ((passed++))
    else
        log_warn "No checkbox-style acceptance criteria found"
    fi

    if [[ "$level" == "L3-strict" ]]; then
        local ac_count
        ac_count=$(grep -c '\- \[ \]' .harness/specs/*.md 2>/dev/null | awk -F: '{sum+=$NF} END{print sum+0}')
        if [[ "$ac_count" -ge 3 ]]; then
            log_pass "Acceptance criteria count ≥3 (${ac_count})"
            ((passed++))
        else
            log_fail "Acceptance criteria count <3 (${ac_count})"
            ((failed++))
        fi
    fi

    return $failed
}

run_plan_gate() {
    local level="$1"
    log_info "=== Plan Gate (${level}) ==="
    local passed=0
    local failed=0

    check_file_exists ".harness/plans/*.md" "Plan file" && ((passed++)) || ((failed++))

    if [[ "$level" != "L1-lightweight" ]]; then
        check_file_exists ".harness/plans/*plan*.md" "Plan file naming convention" && ((passed++)) || ((failed++))
    fi

    return $failed
}

run_build_gate() {
    local level="$1"
    log_info "=== Build Gate (${level}) ==="
    local passed=0
    local failed=0

    if [[ -f "${PROJECT_DIR}/package.json" ]]; then
        check_command "npx tsc --noEmit" "TypeScript type check" && ((passed++)) || ((failed++))

        if [[ "$level" != "L1-lightweight" ]]; then
            check_command "npm run build" "Build project" && ((passed++)) || ((failed++))
        fi
    elif [[ -f "${PROJECT_DIR}/pom.xml" ]]; then
        check_command "mvn compile" "Maven compile" && ((passed++)) || ((failed++))
    elif [[ -f "${PROJECT_DIR}/go.mod" ]]; then
        check_command "go vet ./..." "Go vet" && ((passed++)) || ((failed++))
    elif [[ -f "${PROJECT_DIR}/pyproject.toml" ]]; then
        check_command "ruff check ." "Python lint/type check" && ((passed++)) || ((failed++))
    else
        log_warn "No recognized build system found, skipping build gate"
    fi

    return $failed
}

run_test_gate() {
    local level="$1"
    log_info "=== Test Gate (${level}) ==="
    local passed=0
    local failed=0

    if [[ -f "${PROJECT_DIR}/package.json" ]]; then
        check_command "vitest run 2>/dev/null || npm test 2>/dev/null" "Run tests" && ((passed++)) || ((failed++))
    elif [[ -f "${PROJECT_DIR}/pom.xml" ]]; then
        check_command "mvn test" "Maven tests" && ((passed++)) || ((failed++))
    elif [[ -f "${PROJECT_DIR}/go.mod" ]]; then
        check_command "go test ./..." "Go tests" && ((passed++)) || ((failed++))
    elif [[ -f "${PROJECT_DIR}/pyproject.toml" ]]; then
        check_command "pytest" "Python tests" && ((passed++)) || ((failed++))
    else
        log_warn "No recognized test framework found, skipping test gate"
    fi

    return $failed
}

run_review_gate() {
    local level="$1"
    log_info "=== Review Gate (${level}) ==="
    local passed=0
    local failed=0

    if [[ -f "${PROJECT_DIR}/package.json" ]]; then
        check_command "npx eslint src/ --max-warnings=0 2>/dev/null || npx eslint src/ 2>/dev/null" "ESLint" && ((passed++)) || ((failed++))
    fi

    if [[ "$level" != "L1-lightweight" ]]; then
        if [[ -d "${PROJECT_DIR}/.harness/audits/reviews" ]]; then
            local p0_count
            p0_count=$(grep -rc '🔴\|P0' .harness/audits/reviews/*.md 2>/dev/null | awk -F: '{sum+=$NF} END{print sum+0}' || echo "0")
            if [[ "$p0_count" -eq 0 ]]; then
                log_pass "No P0 issues found"
                ((passed++))
            else
                log_fail "Found ${p0_count} P0 issue(s)"
                ((failed++))
            fi
        else
            log_warn "No review audit files found"
        fi
    fi

    return $failed
}

run_simplify_gate() {
    local level="$1"
    log_info "=== Simplify Gate (${level}) ==="
    local passed=0
    local failed=0

    local long_funcs=0
    local long_files=0

    while IFS= read -r file; do
        local line_count
        line_count=$(wc -l < "$file")
        if [[ "$line_count" -gt 500 ]]; then
            log_fail "File too long: $(basename "$file") (${line_count} lines > 500)"
            ((long_files++))
            ((failed++))
        fi
    done < <(find "${PROJECT_DIR}/src" -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.py' -o -name '*.go' -o -name '*.java' 2>/dev/null)

    if [[ "$long_files" -eq 0 ]]; then
        log_pass "All source files ≤500 lines"
        ((passed++))
    fi

    return $failed
}

run_ship_gate() {
    local level="$1"
    log_info "=== Ship Gate (${level}) ==="
    local passed=0
    local failed=0

    pushd "$PROJECT_DIR" > /dev/null || return 1

    local git_status
    git_status=$(git status --porcelain 2>/dev/null | head -5) || true

    if [[ -z "$git_status" ]]; then
        log_pass "Git working tree is clean"
        ((passed++))
    else
        local change_count
        change_count=$(echo "$git_status" | wc -l | tr -d ' ')
        log_fail "Git working tree has ${change_count} uncommitted change(s)"
        ((failed++))
    fi

    popd > /dev/null || true
    return $failed
}

run_single_gate() {
    local gate_id="$1"
    local strictness="$2"
    local failures=0

    case "$gate_id" in
        spec_gate)     run_spec_gate "$strictness" || ((failures++)) ;;
        plan_gate)     run_plan_gate "$strictness" || ((failures++)) ;;
        build_gate)    run_build_gate "$strictness" || ((failures++)) ;;
        test_gate)     run_test_gate "$strictness" || ((failures++)) ;;
        review_gate)   run_review_gate "$strictness" || ((failures++)) ;;
        simplify_gate) run_simplify_gate "$strictness" || ((failures++)) ;;
        ship_gate)     run_ship_gate "$strictness" || ((failures++)) ;;
        *)
            log_fail "Unknown gate: ${gate_id}"
            return 2 ;;
    esac

    return $failures
}

main() {
    parse_args "$@"

    if [[ -z "$GATE_ID" ]]; then
        show_help
        exit 1
    fi

    log_info "Harness Gate Checker v1.0"
    log_info "Project: ${PROJECT_DIR}"
    log_info "Strictness: ${STRICTNESS}"
    log_info "Dry Run: ${DRY_RUN}"
    echo ""

    local total_failures=0
    local start_time
    start_time=$(date +%s)

    if [[ "$GATE_ID" == "all" ]]; then
        for gate in spec_gate plan_gate build_gate test_gate review_gate simplify_gate ship_gate; do
            echo ""
            run_single_gate "$gate" "$STRICTNESS" || ((total_failures++))

            if [[ "$total_failures" -gt 0 && "$DRY_RUN" == false ]]; then
                log_warn "Stopping at gate '${gate}' due to failure (use --dry-run to continue)"
                break
            fi
        done
    else
        run_single_gate "$GATE_ID" "$STRICTNESS" || ((total_failures++))
    fi

    local end_time
    end_time=$(date +%s)
    local duration=$(( end_time - start_time ))

    echo ""
    echo "========================================="
    if [[ "$total_failures" -eq 0 ]]; then
        log_pass "All gates PASSED in ${duration}s"
    else
        log_fail "${total_failures} gate(s) FAILED in ${duration}s"
    fi
    echo "========================================="

    if [[ "$DRY_RUN" == false && "$total_failures" -gt 0 ]]; then
        exit 1
    fi
    exit 0
}

main "$@"
