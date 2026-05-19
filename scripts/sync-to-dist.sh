#!/bin/bash
#
# sync-to-dist.sh — 自动同步 core/ → skill-dist/ 的映射
# 使用方法: bash scripts/sync-to-dist.sh
#
# 确保 skill-dist/ 与 core/ 的 v4.0 改造保持一致
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/skill-dist"

echo "🚀 Syncing core/ → skill-dist/ (v4.0 Expert Team mode)"
echo "   Root: $ROOT_DIR"
echo "   Dist: $DIST_DIR"
echo ""

# === 1. SKILL.md (入口文件) ===
echo "📋 Syncing SKILL.md..."
cp "$ROOT_DIR/SKILL.md" "$DIST_DIR/SKILL.md"

# === 2. Pipeline 定义 ===
echo "📋 Syncing pipeline.yaml..."
cp "$ROOT_DIR/core/pipeline.yaml" "$DIST_DIR/pipeline.yaml"
cp "$ROOT_DIR/core/pipeline.yaml" "$DIST_DIR/gating/gate-definitions.yaml"

# === 3. Registry ===
echo "📋 Syncing registry.yaml..."
cp "$ROOT_DIR/core/registry.yaml" "$DIST_DIR/capsules/registry.yaml"

# === 4. 核心 Capsule SKILL.md (v4.0 改造的三个) ===
echo "📋 Syncing core capsules (orchestrator, gsd, gating)..."
cp "$ROOT_DIR/core/skills/cross-cutting/orchestrator/SKILL.md" "$DIST_DIR/capsules/orchestrator/SKILL.md"
cp "$ROOT_DIR/core/skills/cross-cutting/gsd/SKILL.md" "$DIST_DIR/capsules/gsd/SKILL.md"
cp "$ROOT_DIR/core/skills/cross-cutting/gating/SKILL.md" "$DIST_DIR/capsules/gating/SKILL.md"

# === 5. Gate 脚本 ===
echo "📋 Syncing gate scripts..."
mkdir -p "$DIST_DIR/gating/scripts"
cp "$ROOT_DIR/core/skills/cross-cutting/gating/scripts/"*.sh "$DIST_DIR/gating/scripts/"

# === 6. Protocol 文件 ===
echo "📋 Syncing protocols..."
cp "$ROOT_DIR/core/protocol/agent-conflict-resolution.md" "$DIST_DIR/protocol/agent-conflict-resolution.md"

# === 7. Agent YAML ===
echo "📋 Syncing Agent YAMLs..."
mkdir -p "$DIST_DIR/agents"
cp "$ROOT_DIR/.workbuddy/agents/harness-"*.yaml "$DIST_DIR/agents/"

# === 8. 版本一致性检查 ===
echo ""
echo "🔍 Checking version alignment..."
SKILL_VER=$(grep "^Version:" "$ROOT_DIR/SKILL.md" | awk '{print $2}')
REG_VER=$(grep '^version:' "$ROOT_DIR/core/registry.yaml" | head -1 | awk '{print $2}' | tr -d '"')
PIPE_VER=$(grep '^version:' "$ROOT_DIR/core/pipeline.yaml" | head -1 | awk '{print $2}' | tr -d '"')
PKG_VER=$(python3 -c "import json; print(json.load(open('$ROOT_DIR/package.json'))['version'])")

echo "   SKILL.md:        $SKILL_VER"
echo "   registry.yaml:   $REG_VER"
echo "   pipeline.yaml:   $PIPE_VER"
echo "   package.json:    $PKG_VER"

if [ "$SKILL_VER" = "$REG_VER" ] && [ "$SKILL_VER" = "$PIPE_VER" ] && [ "$SKILL_VER" = "$PKG_VER" ]; then
    echo "   ✅ All versions aligned!"
else
    echo "   ❌ VERSION MISMATCH! Please fix before release."
    exit 1
fi

echo ""
echo "==========================================="
echo "  ✅ Sync complete!"
echo "==========================================="
