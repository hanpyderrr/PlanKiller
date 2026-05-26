import React, { useEffect, useRef, useState } from "react";
import { AiChatResponse, DailyPlan, Habit, WeeklyReport, aiRequest } from "../api";

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
  onGoToSettings,
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
  onGoToSettings: () => void;
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

  const aiName = localStorage.getItem("plankiller-ai-name") || "AI 助手";
  const hasAiKey = !!localStorage.getItem("plankiller-ai-key");

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
      const res = await aiRequest<{ content: string }>(
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
          <div className="avatar" style={{ cursor: "pointer" }} onClick={onGoToSettings} title="前往设置">你</div>
        </div>
      </div>

      {/* 三栏主内容 */}
      <div className="cardsRow" style={{ alignItems: "stretch" }}>
        {/* 左 - 今日计划 */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">📋</div>
              今日计划
            </div>
            <span className="badge">
              {doneItems.length} / {totalItems.length}
            </span>
          </div>
          <div className="planBody" style={{ marginBottom: 14 }}>
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
            <div style={{ flex: 1, fontSize: 12, color: "var(--text-3)" }}>
              {pct >= 80 ? "表现出色 ✨" : pct >= 50 ? "进展不错 💪" : totalItems.length === 0 ? "今日暂无计划" : "加油 🌱"}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 260 }}>
            {totalItems.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
                  borderBottom: "1px solid var(--cream)", cursor: "pointer" }}
                onClick={() => onToggleItem(item.id, !item.done)}
              >
                <div className={`tCheck${item.done ? " done" : " todo"}`}>{item.done ? "✓" : ""}</div>
                <span className={`tText${item.done ? " done" : ""}`} style={{ flex: 1, fontSize: 13 }}>
                  <span className={`priorityDot p${item.priority}`} />
                  {(item.start_time || item.end_time) && (
                    <span className="itemTime">
                      {item.start_time ?? ""}{item.start_time && item.end_time ? "–" : ""}{item.end_time ?? ""}
                    </span>
                  )}
                  {item.title}
                </span>
                {item.done ? (
                  <button className="btnUndoTask"
                    onClick={(e) => { e.stopPropagation(); onToggleItem(item.id, false); }}>撤销</button>
                ) : (
                  <span className="tTag">{item.category || "任务"}</span>
                )}
              </div>
            ))}
            {totalItems.length === 0 && <p className="muted" style={{ padding: "4px 0" }}>今日暂无任务，去添加吧</p>}
          </div>
          <button className="addRow" onClick={onGoToPlan}>
            <span style={{ fontSize: 16, marginRight: 2 }}>+</span> 添加新任务…
          </button>
        </div>

        {/* 中 - 习惯打卡 */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">✅</div>
              习惯打卡
            </div>
            <span className="badge">
              {todayDoneHabits} / {habits.length}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 320 }}>
            <div className="habitList">
              {habits.map((habit) => (
                <div key={habit.id} className="habitItem">
                  <div className="habitEmoji">{habit.emoji || "✨"}</div>
                  <div className="habitInfo">
                    <div className="habitName">{habit.name}</div>
                    <div className="habitStreak">
                      {habit.is_scheduled_today === false
                        ? "非计划日"
                        : habit.today_status === "done" ? "今日已完成" : "今日待打卡"}
                    </div>
                  </div>
                  <div className="habitQuickBtns">
                    {habit.today_status === "done" ? (
                      <button className="doneCheck"
                        onClick={(e) => { e.stopPropagation(); onUndoHabit(habit.id); }}
                        title="点击撤销">✓</button>
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
        </div>

        {/* 右 - AI */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="cardHeader">
            <div className="cardTitle">
              <div className="cardIcon">🤖</div>
              {aiName}
            </div>
            <span className="muted" style={{ fontSize: 11 }}>Enter 发送</span>
          </div>
          <div className="aiMessages" style={{ flex: 1, maxHeight: 260 }}>
            {chatMessages.length === 0 && (
              <div className="aiMsg bot">
                {!hasAiKey ? (
                  <>
                    还没有配置 API Key，AI 对话功能暂不可用。
                    <br />
                    <button onClick={onGoToSettings} style={{ marginTop: 8, fontSize: 12, padding: "4px 10px", minHeight: "unset" }}>
                      去设置配置 Key
                    </button>
                  </>
                ) : pct >= 80
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

export default HomePage;
