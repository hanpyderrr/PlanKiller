import React, { useState } from "react";
import { AiChatResponse, MemoryHit, aiRequest } from "../api";
import { MemoryHitList } from "./MemoryPage";

function AiPage({ apiBase }: { apiBase: string }) {
  const [message, setMessage] = useState("我今天没运动怎么办？");
  const [reply, setReply] = useState("");
  const [memoryHits, setMemoryHits] = useState<MemoryHit[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const response = await aiRequest<AiChatResponse>(
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

export default AiPage;
