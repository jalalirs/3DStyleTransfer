import { api } from "./client";

export interface JobMeta {
  job_id: string;
  reference_id: string;
  method: string;
  prompt: string;
  negative_prompt: string;
  strength: number;
  input_path: string;
  styled_image_path: string | null;
  output_path: string | null;
  status: "styled" | "done";
  created_at: string;
  completed_at?: string;
}

/** List all previous jobs for a reference model */
export async function listJobs(referenceId: string): Promise<JobMeta[]> {
  const { data } = await api.get<JobMeta[]>(`/api/style-transfer/jobs/${referenceId}`);
  return data;
}

/** Step 1: Send captured view + prompt → Gemini styles it */
export async function styleImage(
  image: Blob,
  prompt: string,
  negativePrompt: string,
  strength: number,
  referenceId: string,
): Promise<JobMeta> {
  const form = new FormData();
  form.append("image", image, "capture.png");
  form.append("prompt", prompt);
  form.append("negative_prompt", negativePrompt);
  form.append("strength", String(strength));
  form.append("reference_id", referenceId);

  const { data } = await api.post<JobMeta>(
    "/api/style-transfer/style",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 }
  );
  return data;
}

/** Step 2: Reconstruct 3D from styled image with TRELLIS */
export async function reconstructStyled(
  jobId: string,
  referenceId: string,
  styledImagePath: string,
): Promise<JobMeta> {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("reference_id", referenceId);
  form.append("styled_image_path", styledImagePath);

  const { data } = await api.post<JobMeta>(
    "/api/style-transfer/reconstruct",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 }
  );
  return data;
}
