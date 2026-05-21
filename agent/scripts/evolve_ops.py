import os
from datetime import datetime

CONFIG_LOG = "./agent_config/rule_update.log"


def agent_self_evolve(problem: str, solution: str, rule_update: str) -> dict:
    time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    evolve_log = (
        f"【进化迭代时间】{time_str}\n"
        f"【问题复盘】{problem}\n"
        f"【优化方案】{solution}\n"
        f"【规则更新】{rule_update}\n"
        f"——————————————\n"
    )

    os.makedirs(os.path.dirname(CONFIG_LOG), exist_ok=True)

    with open(CONFIG_LOG, "a", encoding="utf-8") as f:
        f.write(evolve_log)

    return {"Agent进化完成": True, "已更新规则": rule_update}
