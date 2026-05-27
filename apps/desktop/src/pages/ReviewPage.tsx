import React, { useEffect, useState } from "react";
import { DailyPlan, apiRequest } from "../api";
import { localDateStr } from "../utils";

function ReviewPage({ apiBase, plan, onSaved }: { apiBase: string; plan: DailyPlan | null; onSaved: () => void }) {
  const [summary, setSummary] = useState(plan?.review?.completed_summary || "");
  const [tomorrow, setTomorrow] = useState(plan?.review?.tomorrow_hint || "");

  useEffect(() => {
    setSummary(plan?.review?.completed_summary || "");
    setTomorrow(plan?.review?.tomorrow_hint || "");
  }, [plan]);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "saved" | "error">("idle");

  async function save() {
    try {
      await apiRequest(
        `/plans/${localDateStr()}/review`,
        { method: "POST", body: JSON.stringify({ completed_summary: summary, blockers: "", mood: "steady", tomorrow_hint: tomorrow }) },
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
        <h1>今日复盘</h1>
        <p>把完成和明天的第一步留下来。</p>
      </header>
      <div className="panel">
        <label>今天完成了什么
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} />
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

export default ReviewPage;
