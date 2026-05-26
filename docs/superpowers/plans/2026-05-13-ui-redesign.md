# UI 重设计实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Daily Companion 前端从深绿色暗色风格重设计为「简伴」温暖奶油风格，新增首页总览 Dashboard。

**Architecture:** 仅改动前端两个文件。`styles.css` 全量替换为新色彩系统和组件样式；`main.tsx` 新增 `HomePage` Dashboard 组件，侧边栏从 260px 文字版改为 64px icon-only 版，其余页面保留逻辑仅更新样式。不改动 `api.ts` 和后端。

**Tech Stack:** React 18, TypeScript, Vite, lucide-react（已安装）

---

## 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/desktop/src/styles.css` | 全量替换 | 新色彩系统 + 所有组件样式 |
| `apps/desktop/src/main.tsx` | 修改 | 新增 HomePage，侧边栏重构，各页面 JSX 更新 |

---

## Task 1：替换 styles.css

**Files:**
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1：全量替换 styles.css**

用以下内容完整替换文件（不保留旧内容）：

```css
/* ===== 设计令牌 ===== */
:root {
  --cream:       #F5F0E8;
  --cream-2:     #EDE7DA;
  --cream-3:     #DDD4C4;
  --amber:       #C47A3A;
  --amber-2:     #A36128;
  --amber-bg:    #FBF3E8;
  --text-1:      #3A2E22;
  --text-2:      #7A6A56;
  --text-3:      #B0A090;
  --white:       #FFFFFF;
  --shadow-sm:   0 1px 3px rgba(58,46,34,0.06), 0 1px 2px rgba(58,46,34,0.04);
  --shadow-md:   0 4px 16px rgba(58,46,34,0.08), 0 1px 4px rgba(58,46,34,0.04);
  --r:           14px;

  color: var(--text-1);
  background: var(--cream);
  font-family: 'PingFang SC', 'Microsoft YaHei UI', 'Segoe UI', system-ui, sans-serif;
  line-height: 1.5;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body { min-width: 960px; min-height: 100vh; }

button, input, textarea { font: inherit; }

/* ===== 应用外壳 ===== */
.shell {
  display: grid;
  grid-template-columns: 64px 1fr;
  min-height: 100vh;
}

/* ===== 侧边栏 ===== */
.sidebar {
  background: var(--white);
  border-right: 1px solid var(--cream-2);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0 16px;
  gap: 4px;
  position: sticky;
  top: 0;
  height: 100vh;
}

.brand {
  width: 40px;
  height: 40px;
  background: linear-gradient(145deg, #D4894A, var(--amber-2));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  margin-bottom: 18px;
  box-shadow: 0 3px 10px rgba(163,97,40,0.25);
  flex-shrink: 0;
}

/* 隐藏旧版 brand 文字 */
.brand > div { display: none; }
.brandMark { display: none; }

.navSpacer { flex: 1; }

.navItem {
  width: 44px;
  height: 44px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  color: var(--text-3);
  border: none;
  background: transparent;
}

.navItem:hover {
  background: var(--cream);
  color: var(--text-2);
}

.navItem.active {
  background: var(--amber-bg);
  color: var(--amber);
  position: relative;
}

.navItem.active::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--amber);
  border-radius: 0 3px 3px 0;
}

/* ===== 工作区 ===== */
.workspace {
  padding: 32px 36px 40px;
  overflow-y: auto;
}

/* ===== 通用：页面标题 ===== */
.pageHeader {
  margin-bottom: 24px;
}

.pageHeader .dateLine {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.pageHeader h1 {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
  margin: 0;
}

.pageHeader h1 em {
  font-style: normal;
  color: var(--amber);
}

.pageHeader p {
  color: var(--text-3);
  font-size: 13px;
  margin-top: 4px;
}

/* ===== 通用：面板/卡片 ===== */
.panel {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: var(--r);
  box-shadow: var(--shadow-md);
  display: grid;
  gap: 14px;
  padding: 22px 24px;
}

.card {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: var(--r);
  box-shadow: var(--shadow-md);
  padding: 20px 22px 22px;
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0; left: 20px; right: 20px;
  height: 2px;
  background: linear-gradient(90deg, var(--amber) 0%, transparent 100%);
  border-radius: 0 0 2px 2px;
  opacity: 0.4;
}

.cardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cardTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-2);
  letter-spacing: 0.02em;
}

.cardIcon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--amber-bg);
  border: 1px solid rgba(196,122,58,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--amber);
  flex-shrink: 0;
}

.badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--cream);
  color: var(--text-3);
  border: 1px solid var(--cream-2);
}

/* ===== 通用：按钮 ===== */
button {
  border: 1px solid var(--cream-2);
  background: var(--white);
  border-radius: 8px;
  color: var(--text-2);
  cursor: pointer;
  min-height: 36px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}

button:hover { border-color: var(--cream-3); background: var(--cream); }

button:disabled { cursor: not-allowed; opacity: 0.5; }

.btnPrimary {
  background: linear-gradient(145deg, #D4894A, var(--amber-2));
  border-color: var(--amber-2);
  color: var(--white);
  font-weight: 700;
  box-shadow: 0 3px 10px rgba(163,97,40,0.25);
}

.btnPrimary:hover {
  box-shadow: 0 4px 14px rgba(163,97,40,0.35);
  background: linear-gradient(145deg, #DC9358, #B36D30);
  border-color: #B36D30;
}

/* ===== 通用：表单元素 ===== */
input, textarea {
  width: 100%;
  border: 1px solid var(--cream-2);
  border-radius: 8px;
  background: var(--white);
  color: var(--text-1);
  padding: 9px 12px;
  font-size: 13.5px;
  resize: vertical;
  transition: border-color 0.15s;
}

input:focus, textarea:focus {
  outline: none;
  border-color: var(--amber);
  box-shadow: 0 0 0 3px rgba(196,122,58,0.10);
}

label {
  color: var(--text-2);
  display: grid;
  font-size: 12.5px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: 0.01em;
}

/* ===== 通用：错误提示 ===== */
.error {
  background: #FFF4F1;
  border: 1px solid #FFCAB8;
  border-radius: 8px;
  color: #8B2F17;
  margin-bottom: 18px;
  padding: 11px 14px;
  font-size: 13px;
}

.muted { color: var(--text-3); font-size: 13px; }

code {
  background: var(--cream);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 12px;
}

/* ===== Home Dashboard ===== */
.homeHeader {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}

.homeHeaderRight {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
}

.streakBadge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--white);
  border: 1px solid var(--cream-2);
  box-shadow: var(--shadow-sm);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--amber-2);
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(145deg, #D4894A, var(--amber-2));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--white);
  box-shadow: 0 2px 8px rgba(163,97,40,0.25);
}

.sectionLabel {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.sectionLabel::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--cream-2);
}

.cardsRow {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

/* 计划进度环 */
.planBody { display: flex; align-items: center; gap: 18px; }

.ringWrap {
  position: relative;
  width: 72px; height: 72px;
  flex-shrink: 0;
}

.ringCenter {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ringPct {
  font-size: 17px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.03em;
  line-height: 1;
}

.ringSub {
  font-size: 9px;
  color: var(--text-3);
  font-weight: 500;
  letter-spacing: 0.04em;
  margin-top: 1px;
}

.planItems { flex: 1; display: flex; flex-direction: column; gap: 5px; }

.planItem {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  color: var(--text-2);
}

.planItem.done { color: var(--text-3); }
.planItem.done span { text-decoration: line-through; }

.pCheck {
  width: 15px; height: 15px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}

.pCheck.done {
  background: linear-gradient(145deg, #D4894A, var(--amber-2));
  color: var(--white);
  font-size: 8px;
  box-shadow: 0 1px 3px rgba(196,122,58,0.3);
}

.pCheck.todo {
  border: 1.5px solid var(--cream-3);
}

/* 习惯点阵 */
.habitList { display: flex; flex-direction: column; gap: 10px; }

.habitItem { display: flex; align-items: center; gap: 10px; }

.habitEmoji {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--cream);
  display: flex; align-items: center; justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.habitInfo { flex: 1; }
.habitName { font-size: 12.5px; font-weight: 600; color: var(--text-1); }
.habitStreak { font-size: 11px; color: var(--text-3); margin-top: 1px; }

.dots { display: flex; gap: 3px; align-items: center; }

.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--cream-2);
}

.dot.filled { background: var(--amber); }

.dot.today {
  width: 9px; height: 9px;
  background: var(--amber);
  box-shadow: 0 0 0 2px rgba(196,122,58,0.18);
}

.dot.todayEmpty {
  width: 9px; height: 9px;
  background: transparent;
  border: 1.5px solid var(--cream-3);
}

/* AI 气泡 */
.aiBubble {
  background: var(--amber-bg);
  border: 1px solid rgba(196,122,58,0.12);
  border-radius: 12px 12px 12px 4px;
  padding: 13px 15px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.65;
  margin-bottom: 12px;
}

.aiActions { display: flex; gap: 8px; }

/* 任务列表卡片 */
.taskCard {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: var(--r);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  margin-bottom: 28px;
}

.taskCardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 22px;
  border-bottom: 1px solid var(--cream);
}

.taskRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 22px;
  border-bottom: 1px solid var(--cream);
  transition: background 0.12s;
}

.taskRow:last-of-type { border-bottom: none; }
.taskRow:hover { background: rgba(245,240,232,0.5); }

.tCheck {
  width: 18px; height: 18px;
  border-radius: 5px;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
}

.tCheck.done {
  background: linear-gradient(145deg, #D4894A, var(--amber-2));
  color: var(--white);
  font-size: 10px;
  box-shadow: 0 1px 4px rgba(163,97,40,0.25);
}

.tCheck.todo { border: 1.5px solid var(--cream-3); }

.tText {
  flex: 1;
  font-size: 13.5px;
  color: var(--text-1);
}

.tText.done { color: var(--text-3); text-decoration: line-through; }

.tTag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--cream);
  color: var(--text-3);
  border: 1px solid var(--cream-2);
}

.addRow {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 22px;
  cursor: pointer;
  color: var(--text-3);
  font-size: 13px;
  border-top: 1px solid var(--cream);
  transition: color 0.15s;
  background: none;
  border-left: none;
  border-right: none;
  border-bottom: none;
  border-radius: 0;
  width: 100%;
  text-align: left;
  min-height: unset;
}

.addRow:hover { color: var(--amber); background: none; border-top: 1px solid var(--cream); }

/* 数据统计行 */
.statsRow {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.statCard {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-sm);
}

.statIcon {
  width: 36px; height: 36px;
  border-radius: 10px;
  background: var(--amber-bg);
  border: 1px solid rgba(196,122,58,0.10);
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  flex-shrink: 0;
}

.statVal {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: -0.03em;
  line-height: 1;
}

.statLabel {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 2px;
  font-weight: 500;
}

/* ===== 计划页（PlanPage）===== */
.grid { display: grid; gap: 18px; }
.gridTwo { grid-template-columns: minmax(400px, 0.9fr) minmax(320px, 0.7fr); }

.taskList { display: grid; gap: 8px; }

.task {
  align-items: center;
  background: var(--cream);
  border: 1px solid var(--cream-2);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  grid-template-columns: 18px 1fr;
  padding: 9px 12px;
  font-size: 13.5px;
  cursor: pointer;
  transition: background 0.12s;
}

.task:hover { background: var(--cream-2); }
.task input { width: 18px; accent-color: var(--amber); }

.compactForm {
  align-items: end;
  grid-template-columns: 1fr 150px auto;
  margin-bottom: 16px;
}

/* ===== 习惯打卡页（HabitPage）===== */
.habitCards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.habitCard {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  padding: 18px;
  display: grid;
  gap: 10px;
}

.habitCardTitle {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  justify-content: space-between;
}

.statusBadge {
  border: 1px solid var(--cream-2);
  border-radius: 999px;
  color: var(--text-3);
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 9px;
}

.statusBadge.done { background: #E8F8EF; border-color: #A8D9B8; color: #1D6845; }
.statusBadge.skip { background: #FFF1E8; border-color: #F2C0A3; color: #8A3C18; }
.statusBadge.pending { background: var(--cream); }

/* ===== 历史周报页（HistoryPage）===== */
.metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  margin-bottom: 18px;
}

.metric {
  background: var(--white);
  border: 1px solid var(--cream-2);
  border-radius: var(--r);
  box-shadow: var(--shadow-sm);
  padding: 18px 20px;
  display: grid;
  gap: 3px;
}

.metric strong { font-size: 26px; font-weight: 800; color: var(--text-1); letter-spacing: -0.02em; }
.metric span { color: var(--text-3); font-size: 12px; }

.historyRow {
  align-items: center;
  border-bottom: 1px solid var(--cream);
  display: grid;
  gap: 12px;
  grid-template-columns: 110px 1fr 60px;
  padding: 10px 0;
  font-size: 13.5px;
}

.historyRow:last-child { border-bottom: 0; }

/* ===== AI 页 ===== */
.reply {
  background: var(--amber-bg);
  border: 1px solid rgba(196,122,58,0.12);
  border-radius: 8px;
  margin: 0;
  padding: 14px;
  white-space: pre-wrap;
  font-size: 13.5px;
  color: var(--text-2);
  line-height: 1.65;
}
```

- [ ] **Step 2：前端构建验证**

```powershell
cd apps\desktop
npm run build
```

期望：无报错，`dist/` 目录生成成功。若有 CSS 语法错误会在此暴露。

- [ ] **Step 3：Commit**

```powershell
git add apps/desktop/src/styles.css
git commit -m "style: replace CSS with 简伴 warm cream design system"
```

---

## Task 2：重构侧边栏（64px icon-only）

**Files:**
- Modify: `apps/desktop/src/main.tsx`（`App` 函数的 `nav` 数据和 `<aside>` JSX）

- [ ] **Step 1：更新 Tab 类型，在 nav 数组加 home**

在 `main.tsx` 中，将 `Tab` 类型和 `nav` 数组替换为：

```typescript
type Tab = "home" | "plan" | "review" | "habits" | "history" | "ai" | "settings";
```

`nav` 数组改为只保存 key + 图标 + tooltip（不再需要 label 文字）：

```typescript
const nav = useMemo(
  () => [
    ["home",     "🏠", "今日总览"],
    ["plan",     "📋", "今日计划"],
    ["habits",   "✅", "习惯打卡"],
    ["review",   "🌙", "下班复盘"],
    ["history",  "📊", "历史周报"],
  ] as const,
  [],
);

const bottomNav = useMemo(
  () => [
    ["ai",       "🤖", "AI 监督"],
    ["settings", "⚙️", "设置"],
  ] as const,
  [],
);
```

- [ ] **Step 2：替换 `<aside>` JSX**

将 `App` 组件 return 里的 `<aside className="sidebar">` 整块替换为：

```tsx
<aside className="sidebar">
  <div className="brand">🌱</div>
  <nav>
    {nav.map(([key, icon, tip]) => (
      <button
        key={key}
        className={`navItem${tab === key ? " active" : ""}`}
        onClick={() => setTab(key)}
        title={tip}
      >
        {icon}
      </button>
    ))}
  </nav>
  <div className="navSpacer" />
  <nav>
    {bottomNav.map(([key, icon, tip]) => (
      <button
        key={key}
        className={`navItem${tab === key ? " active" : ""}`}
        onClick={() => setTab(key)}
        title={tip}
      >
        {icon}
      </button>
    ))}
  </nav>
</aside>
```

- [ ] **Step 3：在 `<section className="workspace">` 里加 HomePage 分支**

在现有各 tab 条件渲染最前面加一行：

```tsx
{tab === "home" && <HomePage apiBase={apiBase} plan={plan} habits={habits} report={report} />}
```

初始 tab 改为 `"home"`：

```typescript
const [tab, setTab] = useState<Tab>("home");
```

- [ ] **Step 4：构建验证**

```powershell
cd apps\desktop
npm run build
```

期望：无 TypeScript 报错（此时 `HomePage` 尚未实现会报错，报错正常，记录错误信息继续）。

---

## Task 3：实现 HomePage（首页 Dashboard）

**Files:**
- Modify: `apps/desktop/src/main.tsx`（新增 `HomePage` 函数组件）

在 `PlanPage` 函数上方插入以下完整组件：

- [ ] **Step 1：插入 HomePage 组件**

```tsx
// ── 首页 Dashboard ────────────────────────────────────────────────────────────
function HomePage({
  apiBase,
  plan,
  habits,
  report,
}: {
  apiBase: string;
  plan: DailyPlan | null;
  habits: Habit[];
  report: WeeklyReport | null;
}) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  const dateStr = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const doneItems = plan?.items.filter((i) => i.done) ?? [];
  const totalItems = plan?.items ?? [];
  const pct = totalItems.length > 0 ? Math.round((doneItems.length / totalItems.length) * 100) : 0;

  // 环形进度 SVG 参数
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  const todayDoneHabits = habits.filter((h) => h.today_status === "done").length;

  return (
    <div>
      {/* 问候头部 */}
      <div className="homeHeader">
        <div className="pageHeader" style={{ marginBottom: 0 }}>
          <div className="dateLine">{dateStr}</div>
          <h1>
            {greeting}，<em>你</em> 👋
          </h1>
        </div>
        <div className="homeHeaderRight">
          <div className="streakBadge">
            <span>🔥</span>
            连续打卡 {report?.habit_logs ?? 0} 天
          </div>
          <div className="avatar">你</div>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="sectionLabel">今日概览</div>
      <div className="cardsRow">
        {/* 计划进度卡 */}
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">📋</div>
              今日计划
            </div>
            <span className="badge">
              {doneItems.length} / {totalItems.length}
            </span>
          </div>
          <div className="planBody">
            <div className="ringWrap">
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="36" cy="36" r={r} fill="none" stroke="var(--cream-2)" strokeWidth="6" />
                <circle
                  cx="36"
                  cy="36"
                  r={r}
                  fill="none"
                  stroke="var(--amber)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="ringCenter">
                <div className="ringPct">{pct}%</div>
                <div className="ringSub">完成</div>
              </div>
            </div>
            <div className="planItems">
              {totalItems.slice(0, 5).map((item) => (
                <div key={item.id} className={`planItem${item.done ? " done" : ""}`}>
                  <div className={`pCheck${item.done ? " done" : " todo"}`}>
                    {item.done ? "✓" : ""}
                  </div>
                  <span>{item.title}</span>
                </div>
              ))}
              {totalItems.length === 0 && <p className="muted">今日暂无计划</p>}
            </div>
          </div>
        </div>

        {/* 习惯打卡卡 */}
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">✅</div>
              习惯打卡
            </div>
            <span className="badge">
              {todayDoneHabits} / {habits.length}
            </span>
          </div>
          <div className="habitList">
            {habits.slice(0, 4).map((habit) => (
              <div key={habit.id} className="habitItem">
                <div className="habitEmoji">
                  {habit.name.includes("运动") || habit.name.includes("跑") ? "🏃"
                    : habit.name.includes("读") || habit.name.includes("书") ? "📚"
                    : habit.name.includes("冥想") ? "🧘"
                    : habit.name.includes("水") ? "💧"
                    : "✨"}
                </div>
                <div className="habitInfo">
                  <div className="habitName">{habit.name}</div>
                  <div className="habitStreak">
                    {habit.today_status === "done" ? "今日已完成" : "今日待打卡"}
                  </div>
                </div>
                <div className="dots">
                  <div className={`dot${habit.today_status === "done" ? " filled" : " todayEmpty"}`} />
                </div>
              </div>
            ))}
            {habits.length === 0 && <p className="muted">还没有习惯，去添加吧</p>}
          </div>
        </div>

        {/* AI 提示卡 */}
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">🤖</div>
              AI 提醒
            </div>
          </div>
          <div className="aiBubble">
            {pct >= 80
              ? `完成率已达 ${pct}%，今天表现出色！继续保持 ✨`
              : pct >= 50
              ? `已完成 ${pct}%，进展不错。还有 ${totalItems.length - doneItems.length} 件事待处理，加油 💪`
              : totalItems.length === 0
              ? "今天还没有计划，去「今日计划」页面添加今天要做的事吧 📋"
              : `今天刚开始，${totalItems.length} 件事等着你，一步一步来 🌱`}
          </div>
          <div className="aiActions">
            <button>稍后提醒</button>
            <button className="btnPrimary">开始复盘</button>
          </div>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="sectionLabel">详细任务</div>
      <div className="taskCard">
        <div className="taskCardHeader">
          <div className="cardTitle">
            <div className="cardIcon">📌</div>
            今日任务清单
          </div>
          <span className="badge">
            {doneItems.length} 已完成 · {totalItems.length - doneItems.length} 待处理
          </span>
        </div>
        {totalItems.map((item) => (
          <div key={item.id} className="taskRow">
            <div className={`tCheck${item.done ? " done" : " todo"}`}>
              {item.done ? "✓" : ""}
            </div>
            <span className={`tText${item.done ? " done" : ""}`}>{item.title}</span>
            <span className="tTag">{item.category || "任务"}</span>
          </div>
        ))}
        {totalItems.length === 0 && (
          <div className="taskRow">
            <span className="muted" style={{ padding: "4px 0" }}>今日暂无任务，去计划页添加</span>
          </div>
        )}
        <button className="addRow">
          <span style={{ fontSize: 16, marginRight: 2 }}>+</span> 添加新任务…
        </button>
      </div>

      {/* 数据统计 */}
      <div className="sectionLabel">数据一览</div>
      <div className="statsRow">
        <div className="statCard">
          <div className="statIcon">🔥</div>
          <div>
            <div className="statVal">{report?.habit_logs ?? 0}</div>
            <div className="statLabel">本周打卡次数</div>
          </div>
        </div>
        <div className="statCard">
          <div className="statIcon">✅</div>
          <div>
            <div className="statVal">{report?.completed_plan_items ?? 0}</div>
            <div className="statLabel">本周完成任务</div>
          </div>
        </div>
        <div className="statCard">
          <div className="statIcon">📈</div>
          <div>
            <div className="statVal">{Math.round((report?.plan_completion_rate ?? 0) * 100)}%</div>
            <div className="statLabel">本周完成率</div>
          </div>
        </div>
        <div className="statCard">
          <div className="statIcon">🌙</div>
          <div>
            <div className="statVal">{Math.round((report?.habit_completion_rate ?? 0) * 100)}%</div>
            <div className="statLabel">习惯坚持率</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2：构建验证**

```powershell
cd apps\desktop
npm run build
```

期望：无 TypeScript/JSX 报错，`dist/` 成功生成。

- [ ] **Step 3：Commit**

```powershell
git add apps/desktop/src/main.tsx
git commit -m "feat: add HomePage dashboard + icon-only sidebar"
```

---

## Task 4：更新各页面 JSX 样式类名

**Files:**
- Modify: `apps/desktop/src/main.tsx`（`PlanPage` / `HabitPage` / `HistoryPage` / `AiPage` / `SettingsPage`）

- [ ] **Step 1：更新 PlanPage**

将 `PlanPage` 的 return 改为：

```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>今日计划</h1>
      <p>{today}</p>
    </header>
    <div className={`grid gridTwo`}>
      <div className="panel">
        <label>今天最重要的焦点
          <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="例如：完成 API MVP" />
        </label>
        <label>任务清单，每行一件事
          <textarea value={items} onChange={(e) => setItems(e.target.value)} rows={8} />
        </label>
        <label>备注
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        </label>
        <button className="btnPrimary" onClick={save}>保存今日计划</button>
      </div>
      <div className="panel">
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", margin: 0 }}>执行状态</h3>
        <div className="taskList">
          {plan?.items.map((item) => (
            <label className="task" key={item.id}>
              <input type="checkbox" checked={item.done} onChange={(e) => toggle(item.id, e.target.checked)} />
              <span>{item.title}</span>
            </label>
          )) || <p className="muted">还没有计划。</p>}
        </div>
      </div>
    </div>
  </div>
);
```

- [ ] **Step 2：更新 HabitPage**

将 `HabitPage` 的 return 改为：

```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>习惯打卡</h1>
      <p>起床、睡觉、运动、冥想，都先从可持续的小动作开始。</p>
    </header>
    <div className={`panel compactForm`} style={{ marginBottom: 18 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新习惯名称" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      <button className="btnPrimary" onClick={createHabit} disabled={!name.trim()}>添加习惯</button>
    </div>
    <div className="habitCards">
      {habits.map((habit) => {
        const sv = habitStatusView(habit.today_status);
        return (
          <div className="habitCard" key={habit.id}>
            <div className="habitCardTitle">
              <strong style={{ fontSize: 14 }}>{habit.name}</strong>
              <span className={`statusBadge${sv.className ? " " + sv.className : ""}`}>{sv.label}</span>
            </div>
            <small className="muted">{habit.reminder_time}</small>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => logHabit(habit.id, "done")}>完成</button>
              <button onClick={() => logHabit(habit.id, "skip")}>跳过</button>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
```

- [ ] **Step 3：更新 ReviewPage / HistoryPage / AiPage / SettingsPage**

将各页面的 `<section>` 改为 `<div>`，`<Header>` 改为内联 `<header className="pageHeader">`，`button className="primary"` 改为 `button className="btnPrimary"`：

**ReviewPage return：**
```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>下班复盘</h1>
      <p>把完成、阻碍和明天的第一步留下来。</p>
    </header>
    <div className="panel">
      <label>今天完成了什么
        <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
      </label>
      <label>卡住的地方
        <textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={4} />
      </label>
      <label>明天优先处理
        <textarea value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} rows={3} />
      </label>
      <button className="btnPrimary" onClick={save} disabled={!plan}>提交复盘</button>
    </div>
  </div>
);
```

**HistoryPage return：**
```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>历史与周报</h1>
      <p>用数据看见真实节奏。</p>
    </header>
    <div className="metrics">
      <div className="metric"><strong>{Math.round((report?.plan_completion_rate || 0) * 100)}%</strong><span>计划完成率</span></div>
      <div className="metric"><strong>{Math.round((report?.habit_completion_rate || 0) * 100)}%</strong><span>习惯坚持率</span></div>
      <div className="metric"><strong>{report?.completed_plan_items || 0}/{report?.total_plan_items || 0}</strong><span>完成任务</span></div>
    </div>
    <div className="panel">
      {history.map((p) => (
        <div className="historyRow" key={p.id}>
          <strong>{p.plan_date}</strong>
          <span>{p.focus || "无焦点"}</span>
          <small className="muted">{p.items.filter((i) => i.done).length}/{p.items.length}</small>
        </div>
      ))}
    </div>
  </div>
);
```

**AiPage return：**
```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>AI 监督机器人</h1>
      <p>朋友式陪伴，轻督促，不做医疗诊断。</p>
    </header>
    <div className="panel">
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
      <button className="btnPrimary" onClick={ask}>问问 AI</button>
      {reply && <pre className="reply">{reply}</pre>}
    </div>
  </div>
);
```

**SettingsPage return：**
```tsx
return (
  <div>
    <header className="pageHeader">
      <h1>设置</h1>
      <p>开发期可在本机和 NAS 服务之间切换。</p>
    </header>
    <div className="panel">
      <label>API 服务地址
        <input value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btnPrimary" onClick={() => onSave(next)}>保存地址</button>
        <button onClick={onRefresh}>重新连接</button>
      </div>
      <p className="muted">NAS 默认地址：<code>http://192.168.31.26:8710</code></p>
    </div>
  </div>
);
```

- [ ] **Step 4：删除不再使用的 `Header` 和 `Metric` 通用组件**

在 `main.tsx` 末尾找到并删除：

```typescript
function Header({ title, subtitle }: { title: string; subtitle: string }) { ... }
function Metric({ label, value }: { label: string; value: string }) { ... }
```

- [ ] **Step 5：构建验证**

```powershell
cd apps\desktop
npm run build
```

期望：0 TypeScript 错误，0 警告（除第三方库警告外），`dist/` 生成成功。

- [ ] **Step 6：Commit**

```powershell
git add apps/desktop/src/main.tsx
git commit -m "style: update all pages to 简伴 design system"
```

---

## Task 5：本地运行目视验证

- [ ] **Step 1：启动后端**

```powershell
cd apps\api
.\.venv\Scripts\uvicorn app.main:app --reload --port 8710
```

- [ ] **Step 2：启动前端**

另开 PowerShell 窗口：

```powershell
cd apps\desktop
npm run dev
```

- [ ] **Step 3：浏览器打开 `http://localhost:5173` 逐页检查**

检查清单：
- [ ] 首页 Dashboard 显示问候语 + 日期
- [ ] 侧边栏为 64px icon-only，激活项有左侧橙色竖条
- [ ] 三张概览卡（计划进度 / 习惯 / AI）正常渲染
- [ ] 任务列表卡片显示，空状态时显示「今日暂无任务」
- [ ] 数据统计四个 pill 正常
- [ ] 切换到「今日计划」页：表单 + 右侧勾选列表正常
- [ ] 切换到「习惯打卡」页：卡片 + 按钮正常
- [ ] 切换到「历史周报」页：指标 + 历史列表正常
- [ ] 切换到「AI 监督」页：输入框 + 发送按钮正常
- [ ] 切换到「设置」页：API 地址输入正常
- [ ] 整体底色为奶油 `#F5F0E8`，主色为琥珀 `#C47A3A`

- [ ] **Step 4：后端未启动时验证降级**

停止后端，刷新前端，应显示红色「连接失败」错误条，其余布局不崩。

- [ ] **Step 5：最终 Commit（如有遗漏修复）**

```powershell
git add -p
git commit -m "fix: ui polish after visual review"
```
