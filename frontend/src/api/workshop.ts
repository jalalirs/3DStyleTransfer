import { api } from "./client";

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  negative_prompt: string;
}

export interface WorkshopSession {
  id: string;
  model_id: string;
  name: string;
  created_at: string;
  snapshots: { index: number; filename: string }[];
  styled: { index: number; filename: string }[];
  reconstruction: { filename: string } | null;
  status: string;
}

export async function getPromptTemplates(): Promise<PromptTemplate[]> {
  const { data } = await api.get<PromptTemplate[]>("/api/workshop/templates");
  return data;
}

export async function createSession(modelId: string, name?: string): Promise<WorkshopSession> {
  const { data } = await api.post<WorkshopSession>("/api/workshop/sessions", {
    model_id: modelId,
    name,
  });
  return data;
}

export async function getSession(sessionId: string): Promise<WorkshopSession> {
  const { data } = await api.get<WorkshopSession>(`/api/workshop/sessions/${sessionId}`);
  return data;
}

export async function uploadSnapshot(sessionId: string, blob: Blob): Promise<{ index: number; total: number }> {
  const form = new FormData();
  form.append("image", blob, "snapshot.png");
  const { data } = await api.post(`/api/workshop/sessions/${sessionId}/snapshots`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function stylizeSnapshots(
  sessionId: string,
  prompt: string,
  negativePrompt: string,
  strength: number,
): Promise<WorkshopSession> {
  const { data } = await api.post<WorkshopSession>(`/api/workshop/sessions/${sessionId}/stylize`, {
    prompt,
    negative_prompt: negativePrompt,
    strength,
  });
  return data;
}

export async function reconstructModel(
  sessionId: string,
  method: string = "triposr",
  imageIndex: number = 0,
): Promise<WorkshopSession> {
  const { data } = await api.post<WorkshopSession>(
    `/api/workshop/sessions/${sessionId}/reconstruct?method=${method}&image_index=${imageIndex}`,
  );
  return data;
}

export function snapshotUrl(sessionId: string, index: number): string {
  return `${api.defaults.baseURL}/api/workshop/sessions/${sessionId}/snapshots/${index}`;
}

export function styledUrl(sessionId: string, index: number): string {
  return `${api.defaults.baseURL}/api/workshop/sessions/${sessionId}/styled/${index}`;
}

export function reconstructionUrl(sessionId: string): string {
  return `${api.defaults.baseURL}/api/workshop/sessions/${sessionId}/reconstruction/model.obj`;
}
