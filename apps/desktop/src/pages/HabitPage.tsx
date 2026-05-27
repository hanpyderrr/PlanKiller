import React, { useState } from "react";
import { Habit, apiRequest } from "../api";
import { localDateStr } from "../utils";

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

const DEFAULT_SCHEDULE_DAYS = "0,1,2,3,4,5,6";
const DAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function parseScheduleDays(value: string): number[] {
  return value
    .split(",")
    .map((d) => Number(d.trim()))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
}

function formatScheduleDays(schedule_days: string): string {
  const selected = [...new Set(parseScheduleDays(schedule_days))].sort((a, b) => a - b);
  if (selected.length === 7) return "每天";
  if (selected.length === 0) return "无计划";
  return selected.map((day) => `周${DAY_LABELS[day]}`).join("");
}

function DayPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = new Set(parseScheduleDays(value));

  function toggle(day: number) {
    const next = new Set(selected);
    if (next.has(day)) {
      if (next.size <= 1) return;
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange([...next].sort((a, b) => a - b).join(","));
  }

  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {DAY_LABELS.map((label, idx) => {
        const active = selected.has(idx);
        return (
          <button
            key={idx}
            type="button"
            onClick={() => toggle(idx)}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: `1px solid ${active ? "var(--amber)" : "var(--cream-3)"}`,
              background: active ? "var(--amber)" : "var(--cream-2)",
              color: active ? "#fff" : "var(--text-3)",
              fontSize: 11,
              fontWeight: 700,
              padding: 0,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── 习惯打卡页 ────────────────────────────────────────────────────────────────
function HabitPage({ apiBase, habits, onSaved }: { apiBase: string; habits: Habit[]; onSaved: () => void }) {
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("21:30");
  const [newEmoji, setNewEmoji] = useState("✨");
  const [newScheduleDays, setNewScheduleDays] = useState(DEFAULT_SCHEDULE_DAYS);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editEmoji, setEditEmoji] = useState("✨");
  const [editScheduleDays, setEditScheduleDays] = useState(DEFAULT_SCHEDULE_DAYS);

  async function createHabit() {
    if (!newName.trim()) return;
    await apiRequest("/habits", { method: "POST", body: JSON.stringify({ name: newName.trim(), reminder_time: newTime, emoji: newEmoji, schedule_days: newScheduleDays }) }, apiBase);
    setNewName(""); setNewEmoji("✨"); setNewScheduleDays(DEFAULT_SCHEDULE_DAYS);
    onSaved();
  }

  function startEdit(habit: Habit) {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditTime(habit.reminder_time);
    setEditEmoji(habit.emoji || "✨");
    setEditScheduleDays(habit.schedule_days ?? DEFAULT_SCHEDULE_DAYS);
  }

  async function saveEdit(id: number) {
    await apiRequest(`/habits/${id}`, { method: "PUT", body: JSON.stringify({ name: editName.trim(), reminder_time: editTime, emoji: editEmoji, schedule_days: editScheduleDays }) }, apiBase);
    setEditingId(null);
    onSaved();
  }

  async function deleteHabit(id: number, name: string) {
    if (!window.confirm(`删除习惯「${name}」？历史打卡记录也会一并删除。`)) return;
    await apiRequest(`/habits/${id}`, { method: "DELETE" }, apiBase);
    onSaved();
  }

  async function logHabit(id: number, status: "done" | "skip") {
    await apiRequest(`/habits/${id}/logs`, { method: "POST", body: JSON.stringify({ log_date: localDateStr(), status }) }, apiBase);
    onSaved();
  }

  async function undoHabit(id: number) {
    await apiRequest(`/habits/${id}/logs/${localDateStr()}`, { method: "DELETE" }, apiBase);
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
        <div style={{ marginTop: 8 }}>
          <DayPicker value={newScheduleDays} onChange={setNewScheduleDays} />
        </div>
        <div className="compactForm" style={{ marginTop: 8, gridTemplateColumns: "1fr 104px auto" }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="习惯名称" onKeyDown={e => { if (e.key === "Enter") void createHabit(); }} />
          <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
          <button className="btnPrimary" onClick={createHabit} disabled={!newName.trim()}>添加</button>
        </div>
      </div>
      {/* 习惯列表 */}
      <div className="habitCards">
        {sorted.map((habit, idx) => {
          const sv = habitStatusView(habit);
          const isEditing = editingId === habit.id;
          return (
            <div className="habitCard" key={habit.id}>
              {isEditing ? (
                <div className="habitEditForm">
                  <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                  <div style={{ marginTop: 8 }}>
                    <DayPicker value={editScheduleDays} onChange={setEditScheduleDays} />
                  </div>
                  <div className="compactForm" style={{ marginTop: 8, gridTemplateColumns: "1fr 104px auto auto" }}>
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
                  <small className="muted">{habit.reminder_time} · {formatScheduleDays(habit.schedule_days ?? DEFAULT_SCHEDULE_DAYS)}</small>
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

function habitStatusView(habit: Habit) {
  if (habit.is_scheduled_today === false) return { label: "非计划日", className: "pending" };
  if (habit.today_status === "done") return { label: "今日完成", className: "done" };
  if (habit.today_status === "skip") return { label: "今日跳过", className: "skip" };
  return { label: "待打卡", className: "pending" };
}

export { EmojiPicker, DayPicker, DEFAULT_SCHEDULE_DAYS, DAY_LABELS, parseScheduleDays, formatScheduleDays, habitStatusView };
export default HabitPage;
