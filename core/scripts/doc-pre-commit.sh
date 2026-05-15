#!/usr/bin/env bash
# ============================================================================
# doc-pre-commit.sh — Git Pre-commit 文档验证钩子
#
# 对暂存的 Markdown / YAML 文件执行轻量级文档校验，防止低质量文档进入仓库。
#
# 用法:
#   1. 复制到 .git/hooks/pre-commit (chmod +x)
#   2. 或通过 husky/lint-staged 集成
#   3. 直接运行: ./core/scripts/doc-pre-commit.sh
#
# 校验层级:
#   L1: 存在性 — 引用路径、必需章节
#   L2: 格式 — 模板变量、占位符、表格格式、标题层级
#   L3: 结构 — Frontmatter Schema（仅 SKILL.md）
#
# 退出码:
#   0 — 全部通过
#   1 — 存在 error 级别问题
# ============================================================================

set -euo pipefail

# ============================================================================
# 配置
# ============================================================================

readonly SCRIPT_NAME="doc-pre-commit"
readonly VERSION="1.0.0"

# 颜色输出（根据环境自动选择是否使用颜色）
if [ "${CI:-false}" = "true" ] || [ ! -t 1 ]; then
    readonly RED='\033[0m'
    readonly GREEN='\033[0m'
    readonly YELLOW='\033[0m'
    readonly CYAN='\033[0m'
    readonly BOLD='\033[0m'
    readonly RESET='\033[0m'
else
    readonly RED='\033[0;31m'
    readonly GREEN='\033[0;32m'
    readonly YELLOW='\033[1;33m'
    readonly CYAN='\033[0;36m'
    readonly BOLD='\033[1m'
    readonly RESET='\033[0m'
fi

# 校验严格度: L1 | L2 | L3
STRICTNESS="${DOC_PRE_COMMIT_STRICTNESS:-L2}"

# 计数器
ERROR_COUNT=0
WARN_COUNT=0
INFO_COUNT=0
CHECKED_FILES=0
PASS_COUNT=0

# 临时存储
TEMP_DIR=""

# ============================================================================
# 工具函数
# ============================================================================

cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}

trap cleanup EXIT

log_error() {
    echo -e "  ${RED}❌ ERROR${RESET}: $1" >&2
    ((ERROR_COUNT++)) || true
}

log_warn() {
    echo -e "  ${YELLOW}⚠️  WARN${RESET}: $1" >&2
    ((WARN_COUNT++)) || true
}

log_info() {
    echo -e "  ${CYAN}ℹ️  INFO${RESET}: $1"
    ((INFO_COUNT++)) || true
}

log_pass() {
    echo -e "  ${GREEN}✅ PASS${RESET}: $1"
    ((PASS_COUNT++)) || true
}

log_section() {
    echo ""
    echo -e "${BOLD}${CYAN}─── $1 ───${RESET}"
}

get_staged_files() {
    local extensions="${1:-md,yaml,yml,json}"

    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        git diff --cached --name-only --diff-filter=ACMR -- "*.${extensions//,/" *."}" 2>/dev/null || true
    else
        log_warn "不在 Git 仓库内，跳过暂存文件检测"
    fi
}

file_exists() {
    [ -f "$1" ]
}

# ============================================================================
# L1: 存在性校验
# ============================================================================

check_file_exists() {
    local file="$1"
    local rel_path="$2"

    if ! file_exists "$file"; then
        log_error "[L1] 文件不存在: ${rel_path}"
        return 1
    fi
    return 0
}

check_internal_links() {
    local file="$1"
    local rel_path="$2"
    local broken_count=0

    # 提取内部链接目标（非 http/https/mailto/# 开头）
    while IFS= read -r link_target; do
        [ -z "$link_target" ] && continue

        # 去掉锚点部分
        local clean_path="${link_target%%\#*}"

        # 跳过空路径和纯锚点
        [ -z "$clean_path" ] && continue
        [ "$clean_path" = "$link_target" ] || continue

        # 解析相对路径
        local dir_name
        dir_name=$(dirname "$file")
        local target_path="${dir_name}/${clean_path}"

        # 安全检查：防止路径遍历
        case "$clean_path" in
            ../*|../) 
                log_warn "[L1] 链接使用相对父目录路径可能不安全: ${link_target} (${rel_path})"
                ((broken_count++)) || true
                continue
                ;;
        esac

        if ! file_exists "$target_path"; then
            log_warn "[L1] 内部链接目标不存在: ${link_target} → ${target_path} (${rel_path})"
            ((broken_count++)) || true
        fi
    done < <(grep -oE '\]\([^)]+\)' "$file" 2>/dev/null \
        | grep -oE '\(([^)#][^)]*)' \
        | tr -d '()' \
        | grep -vE '^(https?://|mailto:|#|data:|ftp:)')

    if [ "$broken_count" -eq 0 ]; then
        return 0
    fi
    return 1
}

check_required_sections() {
    local file="$1"
    local rel_path="$2"
    local missing_sections=()

    # 根据文件类型确定必需章节
    local required=()

    if [[ "$rel_path" == *"SKILL.md" ]]; then
        required=("## 执行流程" "## 产出物" "### Step 1:" "### Step 2:")
    elif [[ "$rel_path" == *"REQUIREMENTS.md" ]]; then
        required=("# Deep Requirements Analysis" "## 1." "## 2." "## 3.")
    elif [[ "$rel_path" == *"PLAN.md" ]]; then
        required=("# 任务列表" "## Phase" "验收标准")
    fi

    if [ ${#required[@]} -eq 0 ]; then
        return 0
    fi

    for section in "${required[@]}"; do
        if ! grep -qF "$section" "$file" 2>/dev/null; then
            missing_sections+=("$section")
        fi
    done

    if [ ${#missing_sections[@]} -gt 0 ]; then
        log_warn "[L1] 缺少必需章节: $(IFS=', '; echo "${missing_sections[*]}") (${rel_path})"
        return 1
    fi
    return 0
}

# ============================================================================
# L2: 格式校验
# ============================================================================

check_unresolved_templates() {
    local file="$1"
    local rel_path="$2"

    # 检查未填充的 {{变量}} 模板
    local unresolved
    unresolved=$(grep -oE '\{\{[^}]+\}\}' "$file" 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//') || true

    if [ -n "$unresolved" ]; then
        log_error "[L2] 发现未填充的模板变量: ${unresolved} (${rel_path})"
        return 1
    fi
    return 0
}

check_placeholders() {
    local file="$1"
    local rel_path="$2"

    # 检查占位符文本
    local placeholders
    placeholders=$(grep -oiE '\b(TBD|TODO|FIXME|TBA|待定|待补充)\b' "$file" 2>/dev/null \
        | sort -u | tr '\n' ',' | sed 's/,$//') || true

    if [ -n "$placeholders" ]; then
        log_warn "[L2] 发现占位符文本: ${placeholders} (${rel_path})"
        return 1
    fi
    return 0
}

check_table_format() {
    local file="$1"
    local rel_path="$2"
    local in_table=false
    local header_cols=0
    local line_num=0
    local errors=0

    while IFS= read -r line; do
        ((line_num++)) || true

        # 检测表格开始
        if [[ "$line" =~ ^\| ]] && [[ "$line" =~ \|$ ]]; then
            if [ "$in_table" = false ]; then
                # 新表格：解析表头
                header_cols=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $0); NF=nf; print nf-2}' 2>/dev/null || echo "0")
                in_table=true
                continue
            fi

            # 检查是否为分隔行
            local sep_content
            sep_content=$(echo "$line" | awk -F'|' '{for(i=2;i<NF;i++) printf "%s", $i}')
            if echo "$sep_content" | grep -qE '^:?-+:?(:-+)*$'; then
                continue
            fi

            # 数据行：检查列数
            local data_cols
            data_cols=$(echo "$line" | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/, "", $0); NF=nf; print nf-2}' 2>/dev/null || echo "0")

            if [ "$header_cols" -ne "$data_cols" ] && [ "$data_cols" -gt 0 ]; then
                log_error "[L2] 表格列数不一致 (表头=${header_cols}, 数据行=${data_cols}) 于第 ${line_num} 行 (${rel_path})"
                ((errors++)) || true
            fi
        else
            in_table=false
        fi
    done < "$file"

    if [ "$errors" -gt 0 ]; then
        return 1
    fi
    return 0
}

check_heading_hierarchy() {
    local file="$1"
    local rel_path="$2"
    local prev_level=0
    local line_num=0
    local jumps=0

    while IFS= read -r line; do
        ((line_num++)) || true

        if [[ "$line" =~ ^(#{1,6})[[:space:]]+ ]]; then
            local level="${BASH_REMATCH[1]}"
            local current_level=${#level}

            if [ "$prev_level" -gt 0 ]; then
                local diff=$((current_level - prev_level))
                if [ "$diff" -gt 1 ]; then
                    log_warn "[L2] 标题层级跳跃: H${prev_level} → H${current_level} 于第 ${line_num} 行 (${rel_path})"
                    ((jumps++)) || true
                fi
            fi
            prev_level=$current_level
        fi
    done < "$file"

    if [ "$jumps" -gt 0 ]; then
        return 1
    fi
    return 0
}

check_mermaid_blocks() {
    local file="$1"
    local rel_path="$2"
    local empty_blocks=0

    # 检查空的 Mermaid 代码块
    while IFS= read -r block; do
        local content_lines
        content_lines=$(echo "$block" | grep -cve '```mermaid' -ve '```' -ve '^$' 2>/dev/null || echo "0")

        if [ "$content_lines" -le 1 ]; then
            ((empty_blocks++)) || true
        fi
    done < <(sed -n '/^```mermaid$/,/^```$/p' "$file" 2>/dev/null)

    if [ "$empty_blocks" -gt 0 ]; then
        log_warn "[L2] ${empty_blocks} 个空的 Mermaid 代码块 (${rel_path})"
        return 1
    fi
    return 0
}

# ============================================================================
# L3: 结构校验（Frontmatter）
# ============================================================================

check_frontmatter_schema() {
    local file="$1"
    local rel_path="$2"

    # 仅对 SKILL.md 和 .harness/specs/*.md 进行 Frontmatter 校验
    if [[ ! "$rel_path" == *"SKILL.md" ]] && [[ ! "$rel_path" == *".harness/specs/"* ]]; then
        return 0
    fi

    # 检查是否有 YAML frontmatter
    if ! head -1 "$file" | grep -q '^---'; then
        log_warn "[L3] 缺少 YAML frontmatter (${rel_path})"
        return 1
    fi

    # 提取 frontmatter 内容
    local fm_content
    fm_content=$(sed -n '2,/^(---)/p' "$file" | sed '$d' 2>/dev/null || echo "")

    # 检查 frontmatter 是否正确关闭
    local fm_end_line
    fm_end_line=$(grep -n '^---' "$file" | tail -1 | cut -d: -f1 2>/dev/null || echo "0")

    if [ "$fm_end_line" -le 1 ]; then
        log_error "[L3] YAML frontmatter 未正确关闭（缺少结尾 ---）(${rel_path})"
        return 1
    fi

    # SKILL.md 特有字段校验
    if [[ "$rel_path" == *"SKILL.md" ]]; then
        local required_fields=("id:" "name:" "stage:" "roles:" "pattern:" "mandatory:")
        
        for field in "${required_fields[@]}"; do
            if ! echo "$fm_content" | grep -q "^${field}"; then
                log_error "[L3] Frontmatter 缺少必需字段: ${field} (${rel_path})"
                return 1
            fi
        done

        # stage 值域校验
        local stage_value
        stage_value=$(echo "$fm_content" | grep '^stage:' | head -1 | sed 's/^stage:[[:space:]]*//' || echo "")
        
        if [ -n "$stage_value" ]; then
            case "$stage_value" in
                spec|plan|build|test|review|simplify|ship|cross-cutting) ;;
                *)
                    log_error "[L3] stage 值无效: '${stage_value}' (${rel_path})"
                    return 1
                    ;;
            esac
        fi
    fi

    return 0
}

# ============================================================================
# 主校验流程
# ============================================================================

validate_single_file() {
    local file="$1"
    local rel_path="$2"
    local file_errors=0
    local file_warnings=0

    ((CHECKED_FILES++)) || true

    # L1: 存在性
    check_file_exists "$file" "$rel_path" || ((file_errors++)) || true
    check_required_sections "$file" "$rel_path" || ((file_warnings++)) || true
    check_internal_links "$file" "$rel_path" || ((file_warnings++)) || true

    # L2: 格式
    if [ "$STRICTNESS" != "L1" ]; then
        check_unresolved_templates "$file" "$rel_path" || ((file_errors++)) || true
        check_placeholders "$file" "$rel_path" || ((file_warnings++)) || true
        check_table_format "$file" "$rel_path" || ((file_errors++)) || true
        check_heading_hierarchy "$file" "$rel_path" || ((file_warnings++)) || true
        check_mermaid_blocks "$file" "$rel_path" || ((file_warnings++)) || true
    fi

    # L3: 结构
    if [ "$STRICTNESS" = "L3" ]; then
        check_frontmatter_schema "$file" "$rel_path" || ((file_errors++)) || true
    fi

    if [ "$file_errors" -eq 0 ] && [ "$file_warnings" -eq 0 ]; then
        log_pass "${rel_path}"
    elif [ "$file_errors" -eq 0 ] && [ "$file_warnings" -gt 0 ]; then
        log_pass "${rel_path} (${file_warnings} warnings)"
    fi
}

main() {
    local start_time
    start_time=$(date +%s%N 2>/dev/null || date +%s)

    echo -e "${BOLD}${CYAN}📋 ${SCRIPT_NAME} v${VERSION} — 文档预提交校验${RESET}"
    echo -e "   严格度: ${BOLD}${STRICTNESS}${RESET}"

    # 获取暂存文件
    local staged_files
    staged_files=$(get_staged_files "md,yaml,yml,json")

    if [ -z "$staged_files" ]; then
        log_info "没有需要校验的暂存文档文件"
        exit 0
    fi

    local file_count
    file_count=$(echo "$staged_files" | wc -l | tr -d ' ')
    log_section "校验 ${file_count} 个暂存文件 (严格度: ${STRICTNESS})"

    TEMP_DIR=$(mktemp -d 2>/dev/null || echo "/tmp/doc-pre-commit-$$")

    # 逐文件校验
    while IFS= read -r rel_path; do
        [ -z "$rel_path" ] && continue

        local abs_path="./${rel_path}"

        if file_exists "$abs_path"; then
            validate_single_file "$abs_path" "$rel_path"
        else
            log_warn "暂存文件无法读取: ${rel_path}（可能已被删除）"
        fi
    done <<< "$staged_files"

    # 输出摘要
    log_section "校验摘要"
    
    local end_time
    end_time=$(date +%s%N 2>/dev/null || date +%s)
    local elapsed_ms=0
    
    if command -v date >/dev/null 2>&1; then
        if [ "$end_time" -gt "$start_time" ] 2>/dev/null; then
            elapsed_ms=$(( (end_time - start_time) / 1000000 ))
        fi
    fi

    echo -e "   📁 已检查: ${CHECKED_FILES} 个文件"
    echo -e "   ${GREEN}✅ 通过${RESET}: ${PASS_COUNT}"
    
    if [ "$WARN_COUNT" -gt 0 ]; then
        echo -e "   ${YELLOW}⚠️  警告${RESET}: ${WARN_COUNT}"
    fi
    
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "   ${RED}❌ 错误${RESET}: ${ERROR_COUNT}"
    fi

    echo -e "   ⏱️  耗时: ${elapsed_ms}ms"

    # 判断结果
    echo ""

    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo -e "${RED}${BOLD}❌ 预提交校验失败: ${ERROR_COUNT} 个错误${RESET}"
        echo -e "   请修复上述错误后重新提交，或使用 --no-verify 跳过（不推荐）"
        exit 1
    elif [ "$WARN_COUNT" -gt 0 ]; then
        echo -e "${YELLOW}${BOLD}⚠️  预提交校验通过但有 ${WARN_COUNT} 个警告${RESET}"
        exit 0
    else
        echo -e "${GREEN}${BOLD}✅ 预提交校验全部通过${RESET}"
        exit 0
    fi
}

# 支持直接运行（非 git hook 场景）
if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
    echo "用法: $0 [--help|--install]"
    echo ""
    echo "选项:"
    echo "  --help     显示帮助信息"
    echo "  --install  安装为 Git pre-commit hook"
    echo ""
    echo "环境变量:"
    echo "  DOC_PRE_COMMIT_STRICTNESS=L1|L2|L3  设置校验严格度 (默认: L2)"
    echo "  CI=true                             在 CI 模式下运行（禁用颜色）"
    exit 0
fi

if [ "${1:-}" = "--install" ]; then
    HOOK_PATH=".git/hooks/pre-commit"
    SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

    if [ ! -d ".git/hooks" ]; then
        echo "错误: .git/hooks 目录不存在，请确认当前目录是 Git 仓库"
        exit 1
    fi

    cp "$SCRIPT_PATH" "$HOOK_PATH"
    chmod +x "$HOOK_PATH"
    echo "✅ 已安装 pre-commit hook 到 ${HOOK_PATH}"
    exit 0
fi

main "$@"
