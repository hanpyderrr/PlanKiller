// 前端 API 层：类型定义 + 统一请求函数
// API 地址可在"设置"页面修改并持久化到 localStorage，默认指向本机

export type PlanItem = {
  id: number;
  title: string;
  category: string;
  priority: number;
  estimated_minutes: number;
  done: boolean;
  start_time?: string | null;
  end_time?: string | null;
  position: number;
};

export type DailyPlan = {
  id: number;
  plan_date: string;
  focus: string;
  energy_level: number;
  notes: string;
  items: PlanItem[];
  review?: {
    id: number;
    completed_summary: string;
    blockers: string;
    mood: string;
    tomorrow_hint: string;
  } | null;
};

export type Habit = {
  id: number;
  name: string;
  description: string;
  schedule_type: string;
  reminder_time: string;
  active: boolean;
  emoji: string;      // 习惯图标（默认 ✨）
  position: number;   // 排序权重
  today_status?: string | null; // 后端注入的当日打卡状态（done/skip/null）
};

export type WeeklyReport = {
  start_date: string;
  end_date: string;
  plan_completion_rate: number;
  habit_completion_rate: number;
  total_plan_items: number;
  completed_plan_items: number;
  habit_logs: number;
  repeated_blockers: string[];
  skipped_habits: string[];
  unfinished_categories: string[];
  energy_completion_notes: string[];
  narrative: string;
};

export type MemoryHit = {
  document_id: number;
  chunk_id: number;
  source_type: string;
  source_id: number;
  title: string;
  content: string;
  score: number;
  target_date?: string | null;
};

export type MemorySearchResponse = {
  query: string;
  hits: MemoryHit[];
};

export type MemoryReindexResponse = {
  documents: number;
  chunks: number;
};

export type ManualMemory = {
  id: number;
  source_type: string;
  source_id: number;
  title: string;
  content: string;
  target_date?: string | null;
};

export type AiChatResponse = {
  content: string;
  used_provider: string;
  memory_hits: MemoryHit[];
};

// 优先读取用户在设置页面保存的地址，否则指向本机
export const defaultApiBase = localStorage.getItem("plankiller-api") || "http://127.0.0.1:8710";

export async function apiRequest<T>(path: string, options: RequestInit = {}, apiBase = defaultApiBase): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json() as Promise<T>;
}
