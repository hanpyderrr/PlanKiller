import React, { useState } from "react";
import { DailyPlan } from "../api";
import { today } from "../utils";

function HistoryPage({ history }: { history: DailyPlan[] }) {
  const [showList, setShowList] = useState(false);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const currentMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

  const monthHistory = history.filter((p) => p.plan_date.startsWith(currentMonth));
  const monthTotal = monthHistory.reduce((s, p) => s + p.items.length, 0);
  const monthDone = monthHistory.reduce((s, p) => s + p.items.filter((i) => i.done).length, 0);
  const monthRate = monthTotal > 0 ? Math.round((monthDone / monthTotal) * 100) : 0;
  const monthDays = monthHistory.length;

  // calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const dayMap = new Map<string, DailyPlan>();
  monthHistory.forEach((p) => dayMap.set(p.plan_date, p));

  function dayClass(pct: number, isFuture: boolean, isToday: boolean): string {
    let cls = "dayCell";
    if (isFuture) return cls + " future";
    if (pct === 0) cls += " done-none";
    else if (pct < 50) cls += " done-low";
    else if (pct < 80) cls += " done-mid";
    else if (pct < 100) cls += " done-high";
    else cls += " done-full";
    if (isToday) cls += " today";
    return cls;
  }

  const weekHeaders = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div>
      <header className="pageHeader">
        <h1>历史</h1>
        <p>用数据看见真实节奏。</p>
      </header>
      <div className="metrics">
        <div className="metric"><strong>{monthRate}%</strong><span>本月完成率</span></div>
        <div className="metric"><strong>{monthDone}/{monthTotal}</strong><span>完成任务</span></div>
        <div className="metric"><strong>{monthDays}</strong><span>记录天数</span></div>
      </div>

      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", margin: 0 }}>
            {year}年{month + 1}月情况
          </h3>
          <button
            className="btnSecondary"
            style={{ fontSize: 12, padding: "4px 10px" }}
            onClick={() => setShowList((v) => !v)}
          >
            {showList ? "收起历史" : "查看历史"}
          </button>
        </div>

        <div className="monthGrid">
          {weekHeaders.map((d) => (
            <div key={d} className="dayCell weekHeader">{d}</div>
          ))}
          {Array.from({ length: firstWeekday }, (_, i) => (
            <div key={`empty-${i}`} className="dayCell empty" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
            const isFuture = dateStr > today;
            const isToday = dateStr === today;
            const p = dayMap.get(dateStr);
            const pct = p && p.items.length > 0
              ? Math.round((p.items.filter((it) => it.done).length / p.items.length) * 100)
              : 0;
            return (
              <div key={dateStr} className={dayClass(pct, isFuture, isToday)}>
                <span className="dayNum">{day}</span>
                {!isFuture && p && p.items.length > 0 && (
                  <span className="dayPct">{pct}%</span>
                )}
              </div>
            );
          })}
        </div>

        {showList && (
          <div style={{ marginTop: 16 }}>
            {history.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>暂无历史记录。</p>
            ) : (
              history.map((p) => (
                <div className="historyRow" key={p.id}>
                  <strong>{p.plan_date}</strong>
                  <span>{p.focus || "无焦点"}</span>
                  <small className="muted">{p.items.filter((i) => i.done).length}/{p.items.length}</small>
                </div>
              ))
            )}
          </div>
        )}
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

export { PatternList };
export default HistoryPage;
