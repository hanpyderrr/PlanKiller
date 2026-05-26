import React, { useEffect, useState } from "react";
import { apiRequest } from "../api";

function SettingsPage({ apiBase, onSave, onRefresh }: { apiBase: string; onSave: (next: string) => void; onRefresh: () => void }) {
  const [next, setNext] = useState(apiBase);
  const [dataDir, setDataDir] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [aiKeyInput, setAiKeyInput] = useState("");
  const [savedAiKey, setSavedAiKey] = useState(() => localStorage.getItem("plankiller-ai-key") || "");
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiNameInput, setAiNameInput] = useState(() => localStorage.getItem("plankiller-ai-name") || "");

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

  function saveAiKey() {
    const trimmed = aiKeyInput.trim();
    localStorage.setItem("plankiller-ai-key", trimmed);
    setSavedAiKey(trimmed);
    setAiKeyInput("");
  }

  function clearAiKey() {
    localStorage.removeItem("plankiller-ai-key");
    setSavedAiKey("");
    setAiKeyInput("");
  }

  const maskedAiKey = savedAiKey ? `${savedAiKey.slice(0, 7)}...${savedAiKey.slice(-4)}` : "";

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
        <div className="fieldLabel" style={{ marginBottom: 8 }}>AI API Key</div>
        {savedAiKey ? (
          <p className="muted" style={{ marginBottom: 8 }}>
            <span className="badge" style={{ background: "#e8f5e9", borderColor: "#b7dfba", color: "#1f7a3a" }}>已配置</span> {maskedAiKey}
          </p>
        ) : (
          <p className="muted" style={{ marginBottom: 8 }}>未配置，使用后端 .env 中的 key</p>
        )}
        <input
          type={showAiKey ? "text" : "password"}
          value={aiKeyInput}
          onChange={(e) => setAiKeyInput(e.target.value)}
          placeholder="粘贴新的 API Key..."
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btnPrimary" onClick={saveAiKey} disabled={!aiKeyInput.trim()}>保存 Key</button>
          <button onClick={() => setShowAiKey((v) => !v)}>显示/隐藏</button>
          <button onClick={clearAiKey} disabled={!savedAiKey} style={{ color: "#b42318" }}>清除</button>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Key 仅存储在本浏览器，不上传服务器。支持 OpenAI（sk-...）格式。
        </p>
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="fieldLabel" style={{ marginBottom: 8 }}>AI 名称</div>
        <p className="muted" style={{ marginBottom: 8 }}>自定义 AI 助手的称呼，显示在首页对话卡片中。</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={aiNameInput}
            onChange={(e) => setAiNameInput(e.target.value)}
            placeholder={localStorage.getItem("plankiller-ai-name") || "AI 助手"}
            style={{ flex: 1 }}
          />
          <button className="btnPrimary" onClick={() => {
            const name = aiNameInput.trim();
            if (name) localStorage.setItem("plankiller-ai-name", name);
            else localStorage.removeItem("plankiller-ai-name");
            setAiNameInput(name);
          }}>保存</button>
        </div>
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

export default SettingsPage;
