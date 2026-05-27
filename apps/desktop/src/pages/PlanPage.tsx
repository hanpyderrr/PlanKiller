import React, { useEffect, useRef, useState } from "react";
import { DailyPlan, apiRequest } from "../api";
import { localDateStr } from "../utils";

type ItemDraft = { id?: number; title: string; start_time: string; end_time: string; priority: number; category: string };

function PlanPage({ apiBase, plan, onSaved }: { apiBase: string; plan: DailyPlan | null; onSaved: () => void }) {
  const [focus, setFocus] = useState(plan?.focus || "");
  const [notes, setNotes] = useState(plan?.notes || "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const emptyDraft = (): ItemDraft => ({ title: "", start_time: "", end_time: "", priority: 2, category: "work" });
  const fromPlan = (items: NonNullable<typeof plan>["items"]) =>
    items.length > 0
      ? items.map((i) => ({ id: i.id, title: i.title, start_time: i.start_time || "", end_time: i.end_time || "", priority: i.priority ?? 2, category: i.category ?? "work" }))
      : [emptyDraft()];

  const [drafts, setDrafts] = useState<ItemDraft[]>(
    () => fromPlan(plan?.items ?? [])
  );
  const [doneOverride, setDoneOverride] = useState<Record<number, boolean>>({});
  const titleRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    setFocus(plan?.focus || "");
    setNotes(plan?.notes || "");
    setDrafts(fromPlan(plan?.items ?? []));
    setDoneOverride({});
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
        plan_date: localDateStr(),
        focus,
        energy_level: 3,
        notes,
        items: drafts
          .filter((d) => d.title.trim())
          .map((d) => ({
            id: d.id,
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
    setDoneOverride((prev) => ({ ...prev, [itemId]: done }));
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
        <p>{localDateStr()}</p>
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
        <div className="panel" style={{ display: "block" }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)", marginBottom: 10 }}>执行状态</h3>
          {(!plan || plan.items.length === 0) ? (
            <p className="muted" style={{ fontSize: 13 }}>还没有计划。</p>
          ) : (
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
              {plan.items.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 0",
                    borderBottom: idx < plan.items.length - 1 ? "1px solid var(--cream-2)" : "none",
                  }}
                >
                  <input
                    type="checkbox"
                    style={{ flexShrink: 0, width: "auto", accentColor: "var(--amber)" }}
                    checked={doneOverride[item.id] ?? item.done}
                    onChange={(e) => toggle(item.id, e.target.checked)}
                  />
                  <span
                    style={{
                      flexShrink: 0,
                      display: "inline-block",
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: item.priority === 3 ? "#e74c3c" : item.priority === 1 ? "var(--text-3)" : "var(--amber)",
                    }}
                  />
                  {(item.start_time || item.end_time) && (
                    <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>
                      {item.start_time ?? ""}{item.start_time && item.end_time ? "–" : ""}{item.end_time ?? ""}
                    </span>
                  )}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 14,
                      ...(item.done
                        ? { textDecoration: "line-through", color: "var(--text-3)" }
                        : { color: "var(--text-1)" }),
                    }}
                  >
                    {item.title}
                  </span>
                  <button
                    className="btnX"
                    style={{ flexShrink: 0 }}
                    onClick={() => deleteItem(item.id)}
                    title="删除此任务"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ItemDraft };
export default PlanPage;
