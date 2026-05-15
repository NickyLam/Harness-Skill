# 发布检查清单

> ship Skill 的 references/ 目录文件

## Gate 1：自动化检查

- [ ] 单元测试全部通过：`npm run test`
- [ ] TypeScript 编译无错误：`npx tsc --noEmit`
- [ ] ESLint 检查通过：`npm run lint`
- [ ] 构建成功：`npm run build`

## Gate 2：功能验证

- [ ] 验收标准逐项确认
- [ ] /qa 浏览器验证通过（如适用）
- [ ] 代码审查通过（/review 无 P0）

## Gate 3：版本管理

- [ ] package.json 版本号已更新
- [ ] CHANGELOG 更新（如有）
- [ ] Git 提交已完成
- [ ] Git 标签已创建：`git tag v<版本号>`
- [ ] 代码已推送：`git push origin main --tags`

## Gate 4：部署验证

- [ ] 构建产物存在于 dist/
- [ ] 线上环境可访问（如适用）
- [ ] /canary 监控正常（如适用）

## 一键验证命令

```bash
npx tsc --noEmit && npm run test && npm run lint && npm run build
```
