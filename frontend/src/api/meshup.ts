import { api } from "./client";

export interface MeshUpResult {
  id: string;
  model_id: string;
  prompt: string;
  file_path: string;
  method: string;
}

export async function runMeshUp(
  modelId: string,
  textPrompt: string,
  numIterations: number = 500
): Promise<MeshUpResult> {
  const { data } = await api.post<MeshUpResult>(
    "/api/meshup",
    { model_id: modelId, text_prompt: textPrompt, num_iterations: numIterations },
    { timeout: 1800000 } // 30 min — MeshUp is slow
  );
  return data;
}
