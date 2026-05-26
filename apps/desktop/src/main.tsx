// 前端主文件：包含所有页面组件（单文件结构，适合个人小应用）
// 页面：首页 / 今日计划 / 下班复盘 / 习惯打卡 / 历史周报 / AI 监督 / 设置
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AiChatResponse,
  DailyPlan,
  Habit,
  ManualMemory,
  MemoryHit,
  MemoryReindexResponse,
  MemorySearchResponse,
  WeeklyReport,
  apiRequest,
  defaultApiBase,
} from "./api";
import "./styles.css";

const today = new Date().toISOString().slice(0, 10);

type Tab = "home" | "plan" | "review" | "habits" | "history" | "ai" | "memory" | "settings";

function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [apiBase, setApiBase] = useState(defaultApiBase);
  const [status, setStatus] = useState("正在连接后端...");
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [history, setHistory] = useState<DailyPlan[]>([]);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState("");

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
      ["memory",   "🧠", "长期记忆"],
      ["settings", "⚙️", "设置"],
    ] as const,
    [],
  );

  async function refresh() {
    setError("");
    try {
      const health = await apiRequest<{ status: string }>("/health", {}, apiBase);
      setStatus(health.status === "ok" ? "后端已连接" : "后端状态异常");
      const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      // 并行拉取所有初始数据，减少等待时间
      const [habitsData, todayPlans, historyData, reportData] = await Promise.all([
        apiRequest<Habit[]>("/habits", {}, apiBase),
        apiRequest<DailyPlan[]>(`/plans?start=${today}&end=${today}`, {}, apiBase),
        apiRequest<DailyPlan[]>(`/plans?start=${thirtyDaysAgo}&end=${today}`, {}, apiBase),
        apiRequest<WeeklyReport>("/ai/reports/weekly", {}, apiBase),
      ]);
      setHabits(habitsData);
      setHistory(historyData);
      setPlan(todayPlans[0] || null);
      setReport(reportData);
    } catch (exc) {
      setStatus("后端未连接");
      setError(exc instanceof Error ? exc.message : String(exc));
    }
  }

  async function togglePlanItem(itemId: number, done: boolean) {
    await apiRequest(`/plans/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ done }) }, apiBase);
    await refresh();
  }

  async function logHabitFromHome(id: number, status: "done" | "skip") {
    await apiRequest(`/habits/${id}/logs`, { method: "POST", body: JSON.stringify({ log_date: today, status }) }, apiBase);
    await refresh();
  }

  async function undoHabitFromHome(id: number) {
    await apiRequest(`/habits/${id}/logs/${today}`, { method: "DELETE" }, apiBase);
    await refresh();
  }

  // apiBase 变化时（用户在设置页修改地址）自动重新连接
  useEffect(() => {
    void refresh();
  }, [apiBase]);

  function saveApiBase(next: string) {
    localStorage.setItem("plankiller-api", next);
    setApiBase(next);
  }

  return (
    <main className="shell">
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

      <section className="workspace">
        {error && <div className="error">连接失败：{error}</div>}
        {tab === "home" && <HomePage apiBase={apiBase} plan={plan} habits={habits} report={report} onGoToPlan={() => setTab("plan")} onGoToReview={() => setTab("review")} onToggleItem={togglePlanItem} onLogHabit={logHabitFromHome} onUndoHabit={undoHabitFromHome} />}
        {tab === "plan" && <PlanPage apiBase={apiBase} plan={plan} onSaved={refresh} />}
        {tab === "review" && <ReviewPage apiBase={apiBase} plan={plan} onSaved={refresh} />}
        {tab === "habits" && <HabitPage apiBase={apiBase} habits={habits} onSaved={refresh} />}
        {tab === "history" && <HistoryPage history={history} report={report} />}
        {tab === "ai" && <AiPage apiBase={apiBase} />}
        {tab === "memory" && <MemoryPage apiBase={apiBase} />}
        {tab === "settings" && <SettingsPage apiBase={apiBase} onSave={saveApiBase} onRefresh={refresh} />}
      </section>
    </main>
  );
}

// ── 首页 Dashboard ────────────────────────────────────────────────────────────
function HomePage({
  apiBase,
  plan,
  habits,
  report,
  onGoToPlan,
  onGoToReview,
  onToggleItem,
  onLogHabit,
  onUndoHabit,
}: {
  apiBase: string;
  plan: DailyPlan | null;
  habits: Habit[];
  report: WeeklyReport | null;
  onGoToPlan: () => void;
  onGoToReview: () => void;
  onToggleItem: (itemId: number, done: boolean) => void;
  onLogHabit: (id: number, status: "done" | "skip") => void;
  onUndoHabit: (id: number) => void;
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

  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "bot"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user" as const, content: msg }]);
    setChatLoading(true);
    try {
      const res = await apiRequest<{ content: string }>(
        "/ai/chat",
        { method: "POST", body: JSON.stringify({ message: msg }) },
        apiBase,
      );
      setChatMessages((prev) => [...prev, { role: "bot" as const, content: res.content }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "bot" as const, content: "连接失败，请检查后端服务是否运行。" }]);
    } finally {
      setChatLoading(false);
    }
  }

  const doneItems = plan?.items.filter((i) => i.done) ?? [];
  const totalItems = plan?.items ?? [];
  const pct = totalItems.length > 0 ? Math.round((doneItems.length / totalItems.length) * 100) : 0;

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
                  {habit.emoji || "✨"}
                </div>
                <div className="habitInfo">
                  <div className="habitName">{habit.name}</div>
                  <div className="habitStreak">
                    {habit.today_status === "done" ? "今日已完成" : "今日待打卡"}
                  </div>
                </div>
                <div className="habitQuickBtns">
                  {habit.today_status === "done" ? (
                    <button
                      className="doneCheck"
                      onClick={(e) => { e.stopPropagation(); onUndoHabit(habit.id); }}
                      title="点击撤销"
                    >✓</button>
                  ) : (
                    <>
                      <button className="btnHabitDone" onClick={(e) => { e.stopPropagation(); onLogHabit(habit.id, "done"); }}>✓</button>
                      <button className="btnHabitSkip" onClick={(e) => { e.stopPropagation(); onLogHabit(habit.id, "skip"); }}>—</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {habits.length === 0 && <p className="muted">还没有习惯，去添加吧</p>}
          </div>
        </div>

        {/* AI 对话卡 */}
        <div className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">🤖</div>
              AI 陪伴
            </div>
            <span className="muted" style={{ fontSize: 11 }}>Enter 发送</span>
          </div>
          <div className="aiMessages">
            {chatMessages.length === 0 && (
              <div className="aiMsg bot">
                {pct >= 80
                  ? `完成率已达 ${pct}%，今天表现出色！继续保持 ✨`
                  : pct >= 50
                  ? `已完成 ${pct}%，进展不错。还有 ${totalItems.length - doneItems.length} 件事待处理，加油 💪`
                  : totalItems.length === 0
                  ? "今天还没有计划，去添加今天要做的事吧 📋 有什么想聊的也可以告诉我～"
                  : `今天刚开始，${totalItems.length} 件事等着你，一步一步来 🌱 有什么困难尽管说～`}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} className={`aiMsg ${m.role}`}>{m.content}</div>
            ))}
            {chatLoading && <div className="aiMsg bot aiLoading">正在思考…</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="aiInputRow">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
              placeholder="问问 AI，或说说今天的状态…"
              disabled={chatLoading}
            />
            <button className="btnPrimary" onClick={() => void sendChat()} disabled={chatLoading || !chatInput.trim()}>
              发送
            </button>
          </div>
          <div className="aiQuickActions">
            <button onClick={onGoToReview}>开始复盘</button>
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
          <div
            key={item.id}
            className="taskRow"
            style={{ cursor: item.done ? "default" : "pointer" }}
            onClick={() => { if (!item.done) onToggleItem(item.id, true); }}
          >
            <div className={`tCheck${item.done ? " done" : " todo"}`}>
              {item.done ? "✓" : ""}
            </div>
            <span className={`tText${item.done ? " done" : ""}`}>
              <span className={`priorityDot p${item.priority}`} />
              {(item.start_time || item.end_time) && (
                <span className="itemTime">
                  {item.start_time ?? ""}
                  {item.start_time && item.end_time ? "–" : ""}
                  {item.end_time ?? ""}
                </span>
              )}
              {item.title}
            </span>
            {item.done ? (
              <button
                className="btnUndoTask"
                onClick={(e) => { e.stopPropagation(); onToggleItem(item.id, false); }}
                title="撤销完成"
              >撤销</button>
            ) : (
              <span className="tTag">{item.category || "任务"}</span>
            )}
          </div>
        ))}
        {totalItems.length === 0 && (
          <div className="taskRow">
            <span className="muted" style={{ padding: "4px 0" }}>今日暂无任务，去计划页添加</span>
          </div>
        )}
        <button className="addRow" onClick={onGoToPlan}>
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

// ── 今日计划页 ────────────────────────────────────────────────────────────────
type ItemDraft = { title: string; start_time: string; end_time: string; priority: number; category: string };

function PlanPage({ apiBase, plan, onSaved }: { apiBase: string; plan: DailyPlan | null; onSaved: () => void }) {
  const [focus, setFocus] = useState(plan?.focus || "");
  const [notes, setNotes] = useState(plan?.notes || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const emptyDraft = (): ItemDraft => ({ title: "", start_time: "", end_time: "", priority: 2, category: "work" });
  const fromPlan = (items: NonNullable<typeof plan>["items"]) =>
    items.length > 0
      ? items.map((i) => ({ title: i.title, start_time: i.start_time || "", end_time: i.end_time || "", priority: i.priority ?? 2, category: i.category ?? "work" }))
      : [emptyDraft()];

  const [drafts, setDrafts] = useState<ItemDraft[]>(
    () => fromPlan(plan?.items ?? [])
  );
  const titleRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setFocus(plan?.focus || "");
    setNotes(plan?.notes || "");
    setDrafts(fromPlan(plan?.items ?? []));
  }, [plan]);

  function addDraft() {
    setDrafts((prev) => {
      const next = [...prev, emptyDraft()];
      // 下一帧聚焦新行的标题输入框
      setTimeout(() => titleRefs.current[next.length - 1]?.focus(), 0);
      return next;
    });
  }
  function removeDraft(idx: number) { setDrafts((prev) => prev.filter((_, i) => i !== idx)); }
  function updateDraft(idx: number, field: keyof ItemDraft, val: string | number) {
    setDrafts((prev) => prev.map((d, i) => i === idx ? { ...d, [field]: val } : d));
  }

  async function save() {
    setSaveStatus("saving");
    try {
      const payload = {
        plan_date: today,
        focus,
        energy_level: 3,
        notes,
        items: drafts
          .filter((d) => d.title.trim())
          .map((d) => ({
            title: d.title.trim(),
            priority: d.priority,
            category: d.category,
            estimated_minutes: 30,
            start_time: d.start_time || null,
            end_time: d.end_time || null,
          })),
      };
      await apiRequest("/plans", { method: "POST", body: JSON.stringify(payload) }, apiBase);
      setSaveStatus("saved");
      onSaved();
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  async function toggle(itemId: number, done: boolean) {
    await apiRequest(`/plans/items/${itemId}`, { method: "PATCH", body: JSON.stringify({ done }) }, apiBase);
    onSaved();
  }

  async function deleteItem(itemId: number) {
    await apiRequest(`/plans/items/${itemId}`, { method: "DELETE" }, apiBase);
    onSaved();
  }

  return (
    <div>
      <header className="pageHeader">
        <h1>今日计划</h1>
        <p>{today}</p>
      </header>
      <div className="grid gridTwo">
        <div className="panel">
          <label>今天最重要的焦点
            <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="例如：完成 API MVP" />
          </label>
          <div>
            <div className="labelRow">
              <span className="fieldLabel">任务清单</span>
              <button type="button" className="btnLink" onClick={addDraft}>+ 添加</button>
            </div>
            <div className="draftList">
              {drafts.map((d, idx) => (
                <div key={idx} className="draftRow">
                  <input
                    type="time"
                    value={d.start_time}
                    onChange={(e) => updateDraft(idx, "start_time", e.target.value)}
                    className="timeInput"
                    title="开始时间"
                  />
                  <span className="timeSep">–</span>
                  <input
                    type="time"
                    value={d.end_time}
                    onChange={(e) => updateDraft(idx, "end_time", e.target.value)}
                    className="timeInput"
                    title="结束时间"
                  />
                  <input
                    ref={(el) => { titleRefs.current[idx] = el; }}
                    value={d.title}
                    onChange={(e) => updateDraft(idx, "title", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDraft(); } }}
                    placeholder={`任务 ${idx + 1}，按 Enter 继续添加`}
                    style={{ flex: 1 }}
                  />
                  <select
                    value={d.priority}
                    onChange={(e) => updateDraft(idx, "priority", Number(e.target.value))}
                    className="prioritySelect"
                    title="优先级"
                  >
                    <option value={3}>高</option>
                    <option value={2}>中</option>
                    <option value={1}>低</option>
                  </select>
                  <button type="button" className="btnX" onClick={() => removeDraft(idx)}>×</button>
                </div>
              ))}
            </div>
          </div>
          <label>备注
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
          </label>
          <button
            className="btnPrimary"
            onClick={save}
            disabled={saveStatus === "saving"}
          >
            {saveStatus === "saving" ? "保存中…"
              : saveStatus === "saved" ? "✓ 已保存"
              : saveStatus === "error" ? "保存失败，重试"
              : "保存今日计划"}
          </button>
          {saveStatus === "error" && (
            <p style={{ color: "#c0392b", fontSize: 12, marginTop: 4 }}>保存失败，请检查后端连接。</p>
          )}
        </div>
        <div className="panel">
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", margin: 0 }}>执行状态</h3>
          <div className="taskList">
            {plan?.items.map((item) => (
              <div className="taskExecRow" key={item.id}>
                <input type="checkbox" checked={item.done} onChange={(e) => toggle(item.id, e.target.checked)} />
                <span style={{ flex: 1 }}>
                  <span className={`priorityDot p${item.priority}`} title={item.priority === 3 ? "高优先" : item.priority === 1 ? "低优先" : "中优先"} />
                  {(item.start_time || item.end_time) && (
                    <span className="itemTime">
                      {item.start_time ?? ""}
                      {item.start_time && item.end_time ? "–" : ""}
                      {item.end_time ?? ""}
                    </span>
                  )}
                  <span style={item.done ? { textDecoration: "line-through", color: "var(--text-3)" } : {}}>
                    {item.title}
                  </span>
                </span>
                <button
                  className="btnX"
                  onClick={() => deleteItem(item.id)}
                  title="删除此任务"
                >×</button>
              </div>
            )) ?? <p className="muted">还没有计划。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 下班复盘页 ────────────────────────────────────────────────────────────────
function ReviewPage({ apiBase, plan, onSaved }: { apiBase: string; plan: DailyPlan | null; onSaved: () => void }) {
  const [summary, setSummary] = useState(plan?.review?.completed_summary || "");
  const [blockers, setBlockers] = useState(plan?.review?.blockers || "");
  const [tomorrow, setTomorrow] = useState(plan?.review?.tomorrow_hint || "");
  const [reviewStatus, setReviewStatus] = useState<"idle" | "saved" | "error">("idle");

  async function save() {
    try {
      await apiRequest(
        `/plans/${today}/review`,
        { method: "POST", body: JSON.stringify({ completed_summary: summary, blockers, mood: "steady", tomorrow_hint: tomorrow }) },
        apiBase,
      );
      setReviewStatus("saved");
      onSaved();
      setTimeout(() => setReviewStatus("idle"), 2000);
    } catch {
      setReviewStatus("error");
      setTimeout(() => setReviewStatus("idle"), 3000);
    }
  }

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
        <button className="btnPrimary" onClick={save} disabled={!plan}>
          {reviewStatus === "saved" ? "✓ 已提交" : reviewStatus === "error" ? "提交失败" : "提交复盘"}
        </button>
      </div>
    </div>
  );
}

// ── Emoji 选择器 ──────────────────────────────────────────────────────────────
function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const EMOJIS = ["✨","🏃","📚","🧘","💧","💪","🎯","📝","🍎","🌙","⭐","🔥","🎵","🧹","🛁","💊"];
  return (
    <div className="emojiPicker">
      {EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          className={`emojiBtn${value === e ? " selected" : ""}`}
          onClick={() => onChange(e)}
        >{e}</button>
      ))}
    </div>
  );
}

// ── 习惯打卡页 ────────────────────────────────────────────────────────────────
function HabitPage({ apiBase, habits, onSaved }: { apiBase: string; habits: Habit[]; onSaved: () => void }) {
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("21:30");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("✨");

  async function createHabit() {
    if (!newName.trim()) return;
    await apiRequest("/habits", { method: "POST", body: JSON.stringify({ name: newName.trim(), reminder_time: newTime, emoji: newEmoji }) }, apiBase);
    setNewName(""); setNewEmoji("✨");
    onSaved();
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditTime(habit.reminder_time);
    setEditEmoji(habit.emoji || "✨");
  }

  async function saveEdit(id: number) {
    await apiRequest(`/habits/${id}`, { method: "PUT", body: JSON.stringify({ name: editName.trim(), reminder_time: editTime, emoji: editEmoji }) }, apiBase);
    setEditingId(null);
    onSaved();
  }

  async function deleteHabit(id: number, name: string) {
    if (!window.confirm(`删除习惯「${name}」？历史打卡记录也会一并删除。`)) return;
    await apiRequest(`/habits/${id}`, { method: "DELETE" }, apiBase);
    onSaved();
  }

  async function logHabit(id: number, status: "done" | "skip") {
    await apiRequest(`/habits/${id}/logs`, { method: "POST", body: JSON.stringify({ log_date: today, status }) }, apiBase);
    onSaved();
  }

  async function undoHabit(id: number) {
    await apiRequest(`/habits/${id}/logs/${today}`, { method: "DELETE" }, apiBase);
    onSaved();
  }

  async function moveHabit(idx: number, dir: -1 | 1) {
    const sorted = [...habits].sort((a, b) => a.position - b.position);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    const reordered = sorted.map((h, i) => {
      if (i === idx) return { id: h.id, position: sorted[target].position };
      if (i === target) return { id: h.id, position: sorted[idx].position };
      return { id: h.id, position: h.position };
    });
    await apiRequest("/habits/reorder", { method: "PATCH", body: JSON.stringify({ habits: reordered }) }, apiBase);
    onSaved();
  }

  const sorted = [...habits].sort((a, b) => a.position - b.position);

  return (
    <div>
      <header className="pageHeader">
        <h1>习惯打卡</h1>
        <p>起床、睡觉、运动、冥想，都先从可持续的小动作开始。</p>
      </header>
      {/* 新建习惯 */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="fieldLabel" style={{ marginBottom: 8 }}>添加新习惯</div>
        <EmojiPicker value={newEmoji} onChange={setNewEmoji} />
        <div className="compactForm" style={{ marginTop: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="习惯名称" onKeyDown={e => { if (e.key === "Enter") void createHabit(); }} />
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
          <button className="btnPrimary" onClick={createHabit} disabled={!newName.trim()}>添加</button>
        </div>
      </div>
      {/* 习惯列表 */}
      <div className="habitCards">
        {sorted.map((habit, idx) => {
          const sv = habitStatusView(habit.today_status);
          const isEditing = editingId === habit.id;
          return (
            <div className="habitCard" key={habit.id}>
              {isEditing ? (
                <div className="habitEditForm">
                  <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                  <div className="compactForm" style={{ marginTop: 8 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} />
                    <input type="time" value={editTime} onChange={e => setEditTime(e.target.value)} />
                    <button className="btnPrimary" onClick={() => saveEdit(habit.id)} disabled={!editName.trim()}>保存</button>
                    <button onClick={() => setEditingId(null)}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="habitCardTitle">
                    <span className="habitCardEmoji">{habit.emoji || "✨"}</span>
                    <strong style={{ fontSize: 14 }}>{habit.name}</strong>
                    <span className={`statusBadge${sv.className ? " " + sv.className : ""}`}>{sv.label}</span>
                  </div>
                  <small className="muted">{habit.reminder_time}</small>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    <button onClick={() => logHabit(habit.id, "done")} disabled={habit.today_status === "done"}>完成</button>
                    <button onClick={() => logHabit(habit.id, "skip")} disabled={habit.today_status === "skip"}>跳过</button>
                    {habit.today_status && <button onClick={() => undoHabit(habit.id)} style={{ color: "var(--text-3)" }}>撤销</button>}
                    <div style={{ flex: 1 }} />
                    <button onClick={() => moveHabit(idx, -1)} disabled={idx === 0} title="上移">↑</button>
                    <button onClick={() => moveHabit(idx, 1)} disabled={idx === sorted.length - 1} title="下移">↓</button>
                    <button onClick={() => startEdit(habit)}>编辑</button>
                    <button onClick={() => deleteHabit(habit.id, habit.name)} style={{ color: "#c0392b" }}>删除</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
        {habits.length === 0 && <p className="muted">还没有习惯，在上方添加第一个吧</p>}
      </div>
    </div>
  );
}

// 将后端 today_status 字段转换为展示用的文字和 CSS 类名
function habitStatusView(status: string | null | undefined) {
  if (status === "done") {
    return { label: "今日完成", className: "done" };
  }
  if (status === "skip") {
    return { label: "今日跳过", className: "skip" };
  }
  if (status) {
    return { label: status, className: "other" };
  }
  return { label: "待打卡", className: "pending" };
}

// ── 历史与周报页 ──────────────────────────────────────────────────────────────
function HistoryPage({ history, report }: { history: DailyPlan[]; report: WeeklyReport | null }) {
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
      {report?.narrative && (
        <div className="panel weeklyInsight">
          <h3>本周模式</h3>
          <p>{report.narrative}</p>
          <PatternList label="重复阻碍" items={report.repeated_blockers || []} />
          <PatternList label="习惯中断" items={report.skipped_habits || []} />
          <PatternList label="未完成类别" items={report.unfinished_categories || []} />
          <PatternList label="能量关联" items={report.energy_completion_notes || []} />
        </div>
      )}
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
}

function PatternList({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="patternList">
      <strong>{label}</strong>
      <div>
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ── AI 监督页 ─────────────────────────────────────────────────────────────────
function AiPage({ apiBase }: { apiBase: string }) {
  const [message, setMessage] = useState("我今天没运动怎么办？");
  const [reply, setReply] = useState("");
  const [memoryHits, setMemoryHits] = useState<MemoryHit[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const response = await apiRequest<AiChatResponse>(
        "/ai/chat",
        { method: "POST", body: JSON.stringify({ message }) },
        apiBase,
      );
      setReply(`${response.content}\n\n来源：${response.used_provider}`);
      setMemoryHits(response.memory_hits || []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="pageHeader">
        <h1>AI 监督机器人</h1>
        <p>朋友式陪伴，轻督促，不做医疗诊断。</p>
      </header>
      <div className="panel">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} />
        <button className="btnPrimary" onClick={ask} disabled={busy || !message.trim()}>
          {busy ? "思考中..." : "问问 AI"}
        </button>
        {reply && <pre className="reply">{reply}</pre>}
        {memoryHits.length > 0 && <MemoryHitList title="本次参考的长期记忆" hits={memoryHits} />}
      </div>
    </div>
  );
}

// ── 设置页 ────────────────────────────────────────────────────────────────────
// 允许切换 API 地址，方便在本机开发和 NAS 部署之间切换
function MemoryPage({ apiBase }: { apiBase: string }) {
  const [query, setQuery] = useState("运动");
  const [hits, setHits] = useState<MemoryHit[]>([]);
  const [manualMemories, setManualMemories] = useState<ManualMemory[]>([]);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContent, setManualContent] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadManualMemories();
  }, [apiBase]);

  async function loadManualMemories() {
    try {
      const response = await apiRequest<ManualMemory[]>("/memory/manual", {}, apiBase);
      setManualMemories(response);
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    }
  }

  async function searchMemory() {
    if (!query.trim()) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await apiRequest<MemorySearchResponse>(
        `/memory/search?q=${encodeURIComponent(query.trim())}`,
        {},
        apiBase,
      );
      setHits(response.hits);
      setStatus(response.hits.length ? `找到 ${response.hits.length} 条相关记忆` : "没有找到相关记忆");
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function reindexMemory() {
    setBusy(true);
    setStatus("正在重建记忆索引...");
    try {
      const response = await apiRequest<MemoryReindexResponse>("/memory/reindex", { method: "POST" }, apiBase);
      setStatus(`索引已更新：${response.documents} 个文档，${response.chunks} 个片段`);
      await searchMemory();
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function createManualMemory() {
    if (!manualTitle.trim() || !manualContent.trim()) return;
    setBusy(true);
    try {
      await apiRequest<ManualMemory>(
        "/memory/manual",
        { method: "POST", body: JSON.stringify({ title: manualTitle, content: manualContent }) },
        apiBase,
      );
      setManualTitle("");
      setManualContent("");
      setStatus("手动记忆已保存");
      await loadManualMemories();
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function updateManualMemory(memory: ManualMemory, content: string) {
    setBusy(true);
    try {
      await apiRequest<ManualMemory>(
        `/memory/manual/${memory.id}`,
        { method: "PATCH", body: JSON.stringify({ content }) },
        apiBase,
      );
      setStatus("手动记忆已更新");
      await loadManualMemories();
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  async function deleteManualMemory(memory: ManualMemory) {
    setBusy(true);
    try {
      await apiRequest<{ deleted: boolean }>(`/memory/manual/${memory.id}`, { method: "DELETE" }, apiBase);
      setStatus("手动记忆已删除");
      await loadManualMemories();
    } catch (exc) {
      setStatus(exc instanceof Error ? exc.message : String(exc));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="pageHeader">
        <h1>长期记忆</h1>
        <p>搜索计划、复盘、习惯和 AI 洞察留下来的线索。</p>
      </header>
      <div className="memoryGrid">
        <div className="panel">
          <h3>新增手动记忆</h3>
          <label>
            标题
            <input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} placeholder="例如：工作节奏偏好" />
          </label>
          <label>
            内容
            <textarea
              value={manualContent}
              onChange={(e) => setManualContent(e.target.value)}
              rows={4}
              placeholder="例如：我更适合上午处理高认知任务。"
            />
          </label>
          <button className="btnPrimary" onClick={createManualMemory} disabled={busy || !manualTitle.trim() || !manualContent.trim()}>
            保存记忆
          </button>
        </div>
        <div className="panel manualMemoryList">
          <h3>手动记忆</h3>
          {manualMemories.length === 0 ? (
            <p className="muted">还没有手动记忆。</p>
          ) : (
            manualMemories.map((memory) => (
              <ManualMemoryCard
                key={memory.id}
                memory={memory}
                disabled={busy}
                onSave={updateManualMemory}
                onDelete={deleteManualMemory}
              />
            ))
          )}
        </div>
      </div>
      <div className="panel memorySearch">
        <label>
          搜索记忆
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void searchMemory();
            }}
            placeholder="例如：运动、拖延、睡眠、卡住的地方"
          />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btnPrimary" onClick={searchMemory} disabled={busy || !query.trim()}>搜索</button>
          <button onClick={reindexMemory} disabled={busy}>重建索引</button>
        </div>
        {status && <p className="muted">{status}</p>}
      </div>
      <MemoryHitList title="搜索结果" hits={hits} emptyText="还没有结果。先重建索引，或换一个关键词。" />
    </div>
  );
}

function ManualMemoryCard({
  memory,
  disabled,
  onSave,
  onDelete,
}: {
  memory: ManualMemory;
  disabled: boolean;
  onSave: (memory: ManualMemory, content: string) => void;
  onDelete: (memory: ManualMemory) => void;
}) {
  const [content, setContent] = useState(memory.content);

  useEffect(() => {
    setContent(memory.content);
  }, [memory.content]);

  return (
    <article className="manualMemory">
      <strong>{memory.title}</strong>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => onSave(memory, content)} disabled={disabled || !content.trim()}>更新</button>
        <button onClick={() => onDelete(memory)} disabled={disabled}>删除</button>
      </div>
    </article>
  );
}

function MemoryHitList({ title, hits, emptyText }: { title: string; hits: MemoryHit[]; emptyText?: string }) {
  return (
    <div className="memoryResults">
      <h3>{title}</h3>
      {hits.length === 0 ? (
        emptyText ? <p className="muted">{emptyText}</p> : null
      ) : (
        hits.map((hit) => <MemoryHitCard hit={hit} key={`${hit.document_id}-${hit.chunk_id}`} />)
      )}
    </div>
  );
}

function MemoryHitCard({ hit }: { hit: MemoryHit }) {
  return (
    <article className="memoryHit">
      <div className="memoryMeta">
        <span>{sourceLabel(hit.source_type)}</span>
        <span>{hit.target_date || "未标日期"}</span>
        <span>score {hit.score.toFixed(1)}</span>
      </div>
      <strong>{hit.title}</strong>
      <p>{hit.content}</p>
    </article>
  );
}

function sourceLabel(source: string) {
  const labels: Record<string, string> = {
    daily_plan: "计划",
    daily_review: "复盘",
    habit_log: "习惯",
    ai_insight: "洞察",
    manual: "手动",
  };
  return labels[source] || source;
}

function SettingsPage({ apiBase, onSave, onRefresh }: { apiBase: string; onSave: (next: string) => void; onRefresh: () => void }) {
  const [next, setNext] = useState(apiBase);
  const [dataDir, setDataDir] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiRequest<{ data_dir: string }>("/info", {}, apiBase)
      .then((r) => setDataDir(r.data_dir))
      .catch(() => setDataDir(""));
  }, [apiBase]);

  function copyPath() {
    if (!dataDir) return;
    navigator.clipboard.writeText(dataDir).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

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
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="fieldLabel" style={{ marginBottom: 8 }}>数据存储</div>
        <p className="muted" style={{ marginBottom: 8 }}>应用数据保存在本机，关闭窗口后不会丢失，重启后自动读取同一目录。</p>
        {dataDir ? (
          <div className="dataDirRow">
            <code className="dataDirPath">{dataDir}</code>
            <button onClick={copyPath} className="btnLink">
              {copied ? "✓ 已复制" : "复制路径"}
            </button>
          </div>
        ) : (
          <p className="muted">数据目录：{apiBase === "http://127.0.0.1:8710" ? "开发模式（路径由后端 DC_DATA_DIR 决定）" : "连接后端后显示"}</p>
        )}
        <p className="muted" style={{ marginTop: 8, fontSize: 11 }}>
          SQLite 数据库文件位于数据目录下的 <code>plankiller.db</code>
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
