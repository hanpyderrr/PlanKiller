import React, { useEffect, useState } from "react";
import { ManualMemory, MemoryHit, MemoryReindexResponse, MemorySearchResponse, apiRequest } from "../api";

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

export { ManualMemoryCard, MemoryHitList, MemoryHitCard, sourceLabel };
export default MemoryPage;
