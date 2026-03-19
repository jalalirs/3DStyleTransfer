import { api } from "./client";

export interface StyleResult {
  job_id: string;
  input_path: string;
  styled_image_path: string;
}

export interface ReconstructResult {
  job_id: string;
  output_path: string;
  method: string;
}

/** Step 1: Send captured view + prompt → Gemini styles it */
export async function styleImage(
  image: Blob,
  prompt: string,
  negativePrompt: string,
  strength: number
): Promise<StyleResult> {
  const form = new FormData();
  form.append("image", image, "capture.png");
  form.append("prompt", prompt);
  form.append("negative_prompt", negativePrompt);
  form.append("strength", String(strength));

  const { data } = await api.post<StyleResult>(
    "/api/style-transfer/style",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 }
  );
  return data;
}

/** Step 2: Reconstruct 3D from styled image with TRELLIS */
export async function reconstructStyled(
  jobId: string,
  styledImagePath: string,
): Promise<ReconstructResult> {
  const form = new FormData();
  form.append("job_id", jobId);
  form.append("styled_image_path", styledImagePath);

  const { data } = await api.post<ReconstructResult>(
    "/api/style-transfer/reconstruct",
    form,
    { headers: { "Content-Type": "multipart/form-data" }, timeout: 600000 }
  );
  return data;
}
