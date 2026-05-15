#!/bin/bash
#
# Harness Skill 全局同步脚本
# 将优化后的 Harness Skill 同步到全局 Skill 目录
#
# 用法: ./sync-to-global.sh [--dry-run]
# 安全: 目标路径通过环境变量或脚本自动推断，不接受任意外部输入
#       使用 rm -rf 前强制校验目标路径前缀，防止路径遍历
#

set -e

# ============================================================================
# 安全策略: 目标路径白名单校验
# 仅允许同步到以下前缀下的目录，防止任意路径写入
# ============================================================================
readonly ALLOWED_TARGET_PREFIXES=(
  "$HOME/.trae-cn/skills"
  "$HOME/.config/opencode"
  "$HOME/.codebuddy"
  "$HOME/.workbuddy"
)

validate_target_dir() {
  local target="$1"
  for prefix in "${ALLOWED_TARGET_PREFIXES[@]}"; do
    if [[ "$target" == "${prefix}"* ]]; then
      return 0
    fi
  done
  echo "❌ SECURITY: 拒绝同步到非白名单路径: ${target}"
  echo "   允许的前缀: ${ALLOWED_TARGET_PREFIXES[*]}"
  return 1
}

# 自动推断源目录（脚本所在目录的 ../core/skills）
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="${SCRIPT_PATH}/../core/skills"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "❌ 源目录不存在: ${SOURCE_DIR}"
  exit 1
fi

# 目标目录（可通过环境变量覆盖，但有白名单校验）
TARGET_TRAE="${HARNESS_TARGET_TRAE:-$HOME/.trae-cn/skills/harness-skill}"
TARGET_OPENCODE="${HARNESS_TARGET_OPENCODE:-$HOME/.config/opencode/anthropics-skills/skills/harness-skill}"

# 安全校验: 目标路径必须在白名单内
validate_target_dir "$TARGET_TRAE" || exit 1
validate_target_dir "$TARGET_OPENCODE" || exit 1

echo "🚀 开始同步 Harness Skill 到全局目录..."
echo "   源: ${SOURCE_DIR}"
echo "   目标 Trae: ${TARGET_TRAE}"
echo "   目标 OpenCode: ${TARGET_OPENCODE}"
echo ""

# 同步到 ~/.trae-cn/skills/
echo "📦 [1/2] 同步到 ~/.trae-cn/skills/harness-skill/"
if [ -d "$TARGET_TRAE" ]; then
    # 安全删除: 再次确认路径前缀
    if [[ "$TARGET_TRAE" == "$HOME/.trae-cn/skills/"* ]]; then
      rm -rf "$TARGET_TRAE"
    else
      echo "❌ 安全校验失败，取消删除: ${TARGET_TRAE}"
      exit 1
    fi
fi
mkdir -p "$TARGET_TRAE"
cp -r "$SOURCE_DIR"/* "$TARGET_TRAE/"
echo "   ✅ 完成！已同步 $(ls -1 "$TARGET_TRAE" 2>/dev/null | wc -l | tr -d ' ') 个 skill 目录"

# 同步到 ~/.config/opencode/skills/
echo ""
echo "📦 [2/2] 同步到 ~/.config/opencode/anthropics-skills/skills/harness-skill/"
if [ -d "$TARGET_OPENCODE" ]; then
    if [[ "$TARGET_OPENCODE" == "$HOME/.config/opencode/"* ]]; then
      rm -rf "$TARGET_OPENCODE"
    else
      echo "❌ 安全校验失败，取消删除: ${TARGET_OPENCODE}"
      exit 1
    fi
fi
mkdir -p "$TARGET_OPENCODE"
cp -r "$SOURCE_DIR"/* "$TARGET_OPENCODE/"
echo "   ✅ 完成！已同步 $(ls -1 "$TARGET_OPENCODE" 2>/dev/null | wc -l | tr -d ' ') 个 skill 目录"

echo ""
echo "==========================================="
echo "  ✅ 同步完成！"
echo "==========================================="
echo ""
echo "📍 已同步的位置："
echo "   • $TARGET_TRAE"
echo "   • $TARGET_OPENCODE"
echo ""
echo "📋 包含的主要 Skills："
echo "   • Spec类: brainstorming, spec-generator, office-hours, deep-requirements..."
echo "   • Plan类: writing-plans"
echo "   • Build类: react-dnd-wrapper, subagent-driven-dev, systematic-debugging, tdd..."
echo "   • Test类: qa, e2e-qa, performance-testing, security-audit..."
echo "   • Review类: code-simplification, requesting-code-review, receiving-code-review..."
echo "   • Ship类: containerization, ci-cd-pipeline, ship-pipeline"
echo "   • Cross-Cutting: onboarding, gating, orchestrator, governance, gsd, project-init..."
echo ""
echo "⚠️  注意：以下 3 个 Skill 已添加醒目的用户交互警告："
echo "   • brainstorming (强制 Inversion 模式)"
echo "   • spec-generator (强制审批检查点)"
echo "   • office-hours (强制六问锁定)"
echo ""
echo "🎉 现在可以在任何 Trae/OpenCode 项目中使用这些优化的 Harness Skills 了！"
