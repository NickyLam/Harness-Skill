import os
import re
from datetime import datetime

MEMORY_DIR = "./agent_memory"
MEMORY_FILE = f"{MEMORY_DIR}/memory_list.md"


def save_standard_memory(task_data: dict) -> dict:
    if not os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "w", encoding="utf-8") as f:
            f.write("# Agent 专属记忆库（自动迭代）\n\n")

    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    memory_block = (
        f"## 记忆更新 | {time_str}\n"
        f"- 核心需求: {task_data.get('需求', '无')}\n"
        f"- 最优方案: {task_data.get('方案', '无')}\n"
        f"- 落地成果: {task_data.get('成果', '无')}\n"
        f"- 避坑清单: {task_data.get('避坑', '无')}\n"
        f"- 用户偏好: {task_data.get('偏好', '无')}\n\n"
    )

    with open(MEMORY_FILE, "r", encoding="utf-8") as f:
        old_content = f.read()

    if memory_block not in old_content:
        with open(MEMORY_FILE, "a", encoding="utf-8") as f:
            f.write(memory_block)
        return {"记忆更新完成": True}
    return {"记忆已存在": True}


def append_daily_log(log_entry: str) -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    log_path = f"{MEMORY_DIR}/logs/{today}.md"

    if not os.path.exists(log_path):
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"# 工作日志 {today}\n\n")

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(log_entry + "\n")

    return {"日志追加完成": True, "路径": log_path}
