已完成委派任务，未 commit。

**Changed Files**
- `apps/desktop/src/main.tsx`：缩减为 App shell + mount，当前 129 行。
- `apps/desktop/src/utils.ts`：新增并导出 `localDateStr`、`today`。
- `apps/desktop/src/pages/HomePage.tsx`
- `apps/desktop/src/pages/PlanPage.tsx`
- `apps/desktop/src/pages/ReviewPage.tsx`
- `apps/desktop/src/pages/HabitPage.tsx`
- `apps/desktop/src/pages/HistoryPage.tsx`
- `apps/desktop/src/pages/AiPage.tsx`
- `apps/desktop/src/pages/MemoryPage.tsx`
- `apps/desktop/src/pages/SettingsPage.tsx`
- `docs/agent-work/AI_HANDOFF.md`
- `docs/agent-work/AI_REVIEW.md`

**Verification**
- `cd apps/desktop && npm run build`
- 结果：通过，`tsc && vite build` 成功，25 modules transformed。

**Risks**
- 本次只做代码搬移，没有做浏览器手工 UI 回归。
- 工作树里仍有既有未提交改动，例如 `apps/desktop/src/api.ts`、`apps/desktop/src/styles.css` 和后端文件；我没有处理这些无关改动。

**Next-Agent Handoff**
- 下一位 agent 可重点 review `main.tsx` 的导入和各 `pages/*` 的导出边界。
- 若继续验证，建议启动前端做一次页面切换 smoke test，确认 8 个 tab 都能渲染。