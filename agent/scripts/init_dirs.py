import os
from datetime import datetime

MEMORY_DIR = "./agent_memory"
CONFIG_DIR = "./agent_config"

os.makedirs(f"{MEMORY_DIR}/logs", exist_ok=True)
os.makedirs(CONFIG_DIR, exist_ok=True)

if not os.path.exists(f"{MEMORY_DIR}/memory_list.md"):
    with open(f"{MEMORY_DIR}/memory_list.md", "w", encoding="utf-8") as f:
        f.write("# Agent 专属记忆库（自动迭代）\n\n")

if not os.path.exists(f"{CONFIG_DIR}/rule_update.log"):
    with open(f"{CONFIG_DIR}/rule_update.log", "w", encoding="utf-8") as f:
        f.write(f"【初始化】{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Agent 自我进化系统初始化完成\n")

print(f"Agent 自我进化系统目录初始化完成 ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})")
