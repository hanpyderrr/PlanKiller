// Frontend entry: App shell and mount only
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { DailyPlan, Habit, WeeklyReport, apiRequest, defaultApiBase } from "./api";
import { localDateStr, today } from "./utils";
import HomePage from "./pages/HomePage";
import PlanPage from "./pages/PlanPage";
import ReviewPage from "./pages/ReviewPage";
import HabitPage from "./pages/HabitPage";
import HistoryPage from "./pages/HistoryPage";
import AiPage from "./pages/AiPage";
import MemoryPage from "./pages/MemoryPage";
import SettingsPage from "./pages/SettingsPage";
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
      ["review",   "🌙", "今日复盘"],
      ["history",  "📊", "历史"],
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
      const thirtyDaysAgo = localDateStr(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
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
        {tab === "home" && <HomePage apiBase={apiBase} plan={plan} habits={habits} report={report} onGoToPlan={() => setTab("plan")} onGoToReview={() => setTab("review")} onGoToSettings={() => setTab("settings")} onToggleItem={togglePlanItem} onLogHabit={logHabitFromHome} onUndoHabit={undoHabitFromHome} />}
        {tab === "plan" && <PlanPage apiBase={apiBase} plan={plan} onSaved={refresh} />}
        {tab === "review" && <ReviewPage apiBase={apiBase} plan={plan} onSaved={refresh} />}
        {tab === "habits" && <HabitPage apiBase={apiBase} habits={habits} onSaved={refresh} />}
        {tab === "history" && <HistoryPage history={history} />}
        {tab === "ai" && <AiPage apiBase={apiBase} />}
        {tab === "memory" && <MemoryPage apiBase={apiBase} />}
        {tab === "settings" && <SettingsPage apiBase={apiBase} onSave={saveApiBase} onRefresh={refresh} />}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
