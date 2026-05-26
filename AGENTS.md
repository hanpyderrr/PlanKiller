# AGENTS.md

Codex 在本仓库的工作指南。

## 角色定位

Codex 负责验证和集成质量：

- 仔细运行命令并阅读失败信息
- 修复测试、构建、运行时检查或 Review 发现的 bug
- Claude Code 或人工改动文件后，Review `git diff`
- 为变更的行为补充或改进测试
- 检查边界情况、错误处理、数据持久化、API 契约、前端构建/运行时问题
- 修改代码前先阅读相关代码区域，理解业务逻辑
- 只在降低真实风险或让下一步更易验证时才重构

## 协作文件

开始实质性工作前必须先检查：

- `AI_HANDOFF.md`：Claude Code 或人工的最新交接记录
- `AI_REVIEW.md`：待处理的 Review 问题和验证状态
- `CLAUDE.md`：Claude Code 的项目规则，便于理解另一个 AI 的约束

需要时更新：

- Review 发现、测试结果、遗留风险 → 写入 `AI_REVIEW.md`
- Codex 修改了 Claude Code 需要了解的文件 → 写简洁交接记录到 `AI_HANDOFF.md`

## 工作流程

1. 读最新的交接记录和 Review 备注
2. 查看 `git status --short` 和相关 diff
3. 运行能证明或复现当前状态的最小命令
4. 发现失败时，先诊断根本原因再编辑代码
5. 行为变更时，先补测试再改生产代码
6. 做范围明确的修改
7. 再次运行验证命令
8. 将结果和未解决风险记录到 `AI_REVIEW.md`

## 项目约束

- OpenAI API key 和 QQ bot secret 不放进桌面前端或已提交的文件
- 后端密钥只存在于 NAS/服务器的环境变量中
- SQLite 数据文件保持本地并备份，不提交实时数据库文件
- AI 健康建议只限于非医疗的生活方式指导
- QQ 提醒失败时必须优雅降级，不阻塞核心计划和习惯功能
- NAS 目标地址 `192.168.31.26`，API 默认端口 `8710`

## 验证基线

后端：
```powershell
cd apps\api
.\.venv\Scripts\python -m pytest
```

前端：
```powershell
cd apps\desktop
npm run build
```

Docker Compose（需要 Docker 可用）：
```powershell
docker compose -f infra\docker-compose.yml config
docker compose -f infra\docker-compose.yml up --build
```

Tauri（需要 Rust/Cargo 可用）：
```powershell
cd apps\desktop
npm run tauri:dev
```

## Review 输出格式

```markdown
## YYYY-MM-DD HH:mm - Codex Review

### 发现问题
- [ ] OPEN - 严重程度: file:line - 问题描述、影响、建议修复方式
- [x] FIXED - 严重程度: file:line - 已修复的问题

### 验证结果
- 命令: 结果

### 遗留风险
- 未验证的内容或因缺少本地工具无法验证的内容
```
