# Context Handoff Protocol — 上下文交接协议

> **目的**: 确保角色切换时信息不丢失、不遗漏
> **触发**: 每次从一个 Stage/Role 切换到下一个时

## 为什么需要交接协议

Harness 采用角色隔离模式（PO / Architect / Implementer / Tester / Reviewer / Shipper），
每个角色在独立的上下文中工作。当流水线从一个阶段进入下一个阶段时，
必须进行标准化的上下文交接，确保下游角色拥有完整的信息。

## 交接格式模板

```markdown
## 上下文交接

**从**: {源角色}
**到**: {目标角色}
**时间**: YYYY-MM-DD HH:MM
**功能**: {功能名}

### 当前状态
- {当前阶段名称}: ✅ Gate PASS / ❌ Gate FAIL
- {简短状态描述（1-2 句）}

### 已完成工作
- {工作项 1 及其产出物路径}
- {工作项 2 及其产出物路径}
- ...

### 关键交付物
| 交付物 | 路径 | 说明 |
|--------|------|------|
| 设计文档 | .harness/specs/... | 已审批 ✅ |
| 实施计划 | .harness/plans/... | Wave 数: N |
| 源代码 | src/... | +N/-M 行 |
| 测试报告 | .harness/audits/test-... | 覆盖率: XX% |
| 审查报告 | .harness/audits/review-... | P0=0, P1=0 |

### 技术决策与约束
- {决策 1}: {为什么选这个方案}
- {约束 1}: {必须遵守的技术限制}

### 已知问题
- {问题 1} → {状态: 待处理/已处理/已规避}

### 下一步
- {目标角色的具体任务}
- {需要特别注意的事项}

### 参考文件
- {文件路径 1}
- {文件路径 2}
```

## 各阶段交接清单

### PO → Architect (spec → plan)
- [ ] 设计文档路径正确且可读
- [ ] 文档状态为"已审批"
- [ ] 验收标准 ≥1 条（L2）或 ≥3 条（L3）
- [ ] 推荐方案明确
- [ ] 技术风险已标注

### Architect → Coordinator (plan → build)
- [ ] 计划文件格式正确（Wave 可执行格式）
- [ ] 所有任务有明确的输出文件路径
- [ ] 依赖关系完整无误
- [ ] Wave 验证点已定义
- [ ] 高风险 Wave 已标注

### Coordinator → Tester (build → test)
- [ ] 所有 Wave 执行完成
- [ ] 所有产出文件存在于预期路径
- [ ] Build Gate 已通过
- [ ] Git commits 记录完整
- [ ] 变更文件列表准确

### Tester → Reviewer (test → review)
- [ ] Test Gate 已通过
- [ ] 测试报告完整（含覆盖率数据）
- [ ] 自动化验证全部 PASS
- [ ] 功能验收逐项确认
- [ ] Bug 修复记录（如有）

### Reviewer → Shipper (review → ship)
- [ ] Review Gate 已通过（P0=0, P1 在阈值内或已修复）
- [ ] 审查报告完整
- [ ] Mini-Wave 修复记录（如有）
- [ ] 最终变更集明确
- [ ] Simplify Gate 已通过（如有简化阶段）

## 交接检查机制

接收方角色在开始工作前必须:
1. 读取交接文档
2. 确认所有参考文件存在且可读
3. 验证前一阶段的 Gate 状态为 PASS
4. 如有疑问立即向 Coordinator（或用户）提出

## 交接文档存储位置

所有交接文档追加到 `.harness/progress/current.md` 中的"上下文摘要"区域，
同时完整的交接记录保存在 `.harness/audits/handoffs/` 目录下。
