import type {
  Alarm,
  ImportResult,
  Message,
  PlayerDetail,
  PlayerSummary,
  Session,
  StaffMember,
  TeamInfo,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let csrf = "";

export function setCsrf(token: string | undefined): void {
  csrf = token || "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const method = (options.method || "GET").toUpperCase();
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD" && csrf) {
    headers.set("X-CSRF-Token", csrf);
  }
  let response: Response;
  try {
    response = await fetch(path, { ...options, headers, credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Can’t reach idev. Start it with python3 app.py, then refresh.");
  }
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
}

export const api = {
  session: () => request<Session>("/api/session"),
  health: () => request<{ ok: boolean; app: string }>("/api/health"),
  login: (username: string, password: string) =>
    request<Session>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  players: () => request<{ players: PlayerSummary[] }>("/api/players"),
  player: (id: string) => request<PlayerDetail>(`/api/players/${encodeURIComponent(id)}`),
  addPlayer: (body: Record<string, unknown>) =>
    request<PlayerSummary>("/api/players", { method: "POST", body: JSON.stringify(body) }),
  updatePlayer: (id: string, body: Record<string, unknown>) =>
    request<PlayerSummary>(`/api/players/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deletePlayer: (id: string) =>
    request<{ ok: boolean }>(`/api/players/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setPlayerLogin: (id: string, username: string, password: string) =>
    request<PlayerSummary>(`/api/players/${encodeURIComponent(id)}/login`, {
      method: "PUT",
      body: JSON.stringify({ username, password }),
    }),
  clearPlayerLogin: (id: string) =>
    request<PlayerSummary>(`/api/players/${encodeURIComponent(id)}/login`, { method: "DELETE" }),
  rate: (id: string, skillId: string, score: number) =>
    request<unknown>(`/api/players/${encodeURIComponent(id)}/ratings`, {
      method: "POST",
      body: JSON.stringify({ skill_id: skillId, score }),
    }),
  addNote: (id: string, text: string, category: string) =>
    request<unknown>(`/api/players/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      body: JSON.stringify({ text, category }),
    }),
  deleteNote: (id: string) =>
    request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" }),
  addDrill: (id: string, body: { name: string; frequency: string; link: string }) =>
    request<unknown>(`/api/players/${encodeURIComponent(id)}/drills`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteDrill: (playerId: string, drillId: string) =>
    request<{ ok: boolean }>(
      `/api/players/${encodeURIComponent(playerId)}/drills/${encodeURIComponent(drillId)}`,
      { method: "DELETE" },
    ),
  logActivity: (id: string, text: string) =>
    request<unknown>(`/api/players/${encodeURIComponent(id)}/activity`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  saveStats: (id: string, counts: Record<string, number>) =>
    request<PlayerDetail["stats"]>(`/api/players/${encodeURIComponent(id)}/stats`, {
      method: "PUT",
      body: JSON.stringify(counts),
    }),
  importRoster: (text: string, preview: boolean) =>
    request<ImportResult>("/api/players/import", {
      method: "POST",
      body: JSON.stringify({ text, preview }),
    }),
  staff: () => request<{ staff: StaffMember[] }>("/api/staff"),
  addStaff: (body: Record<string, unknown>) =>
    request<StaffMember>("/api/staff", { method: "POST", body: JSON.stringify(body) }),
  updateStaff: (id: string, body: Record<string, unknown>) =>
    request<StaffMember>(`/api/staff/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  setStaffPassword: (id: string, password: string) =>
    request<StaffMember>(`/api/staff/${encodeURIComponent(id)}/password`, {
      method: "PUT",
      body: JSON.stringify({ password }),
    }),
  clearStaffPassword: (id: string) =>
    request<StaffMember>(`/api/staff/${encodeURIComponent(id)}/password`, { method: "DELETE" }),
  deleteStaff: (id: string) =>
    request<{ ok: boolean }>(`/api/staff/${encodeURIComponent(id)}`, { method: "DELETE" }),
  team: () => request<{ team: TeamInfo }>("/api/team"),
  saveTeam: (body: TeamInfo) =>
    request<{ team: TeamInfo }>("/api/team", { method: "PUT", body: JSON.stringify(body) }),
  alarms: () => request<{ alarms: Alarm[] }>("/api/alarms"),
  addAlarm: (text: string, target: string) =>
    request<Alarm>("/api/alarms", { method: "POST", body: JSON.stringify({ text, target }) }),
  deleteAlarm: (id: string) =>
    request<{ ok: boolean }>(`/api/alarms/${encodeURIComponent(id)}`, { method: "DELETE" }),
  markAlarmsRead: () => request<{ ok: boolean }>("/api/alarms/read", { method: "POST" }),
  messages: () => request<{ messages: Message[] }>("/api/messages"),
  addMessage: (body: { body: string; audience: string; recipient_id?: string }) =>
    request<Message>("/api/messages", { method: "POST", body: JSON.stringify(body) }),
  deleteMessage: (id: string) =>
    request<{ ok: boolean }>(`/api/messages/${encodeURIComponent(id)}`, { method: "DELETE" }),
  markMessagesRead: () => request<{ ok: boolean }>("/api/messages/read", { method: "POST" }),
};
