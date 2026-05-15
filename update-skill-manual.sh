#!/bin/bash
#
# 手动更新 Harness Skill 到 ~/.trae-cn/skills 的脚本
# 请在终端中手动执行此脚本
#

set -e

SOURCE_DIR="/Users/linmaogui/VSCodeProjects/VSCodeProjects/LLM/Trae SOLO/Harness_Skill/skill-dist"
TARGET_DIR="$HOME/.trae-cn/skills/harness-skill"

echo "🚀 开始更新 Harness Skill..."
echo "   源目录: ${SOURCE_DIR}"
echo "   目标目录: ${TARGET_DIR}"
echo ""

# 备份旧版本
if [ -d "$TARGET_DIR" ]; then
    BACKUP_DIR="$HOME/.trae-cn/skills/harness-skill-backup-$(date +%Y%m%d-%H%M%S)"
    echo "📦 备份旧版本到: ${BACKUP_DIR}"
    cp -r "$TARGET_DIR" "$BACKUP_DIR"
    echo "   ✅ 备份完成"
    echo ""
fi

# 删除旧版本并创建新目录
echo "🗑️  删除旧版本..."
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

# 复制新版本
echo "📋 复制新版本..."
cp -r "$SOURCE_DIR"/* "$TARGET_DIR/"

echo ""
echo "==========================================="
echo "  ✅ 更新完成！"
echo "==========================================="
echo ""
echo "📍 Skill 已安装到: ${TARGET_DIR}"
echo ""
echo "📋 包含的主要 Skills："
ls -1 "$TARGET_DIR/capsules" 2>/dev/null | sed 's/^/   • /'
echo ""
echo "🎉 现在可以在任何 Trae 项目中使用这些优化的 Harness Skills 了！"
