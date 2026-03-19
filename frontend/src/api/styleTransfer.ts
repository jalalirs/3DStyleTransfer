import { api } from "./client";

export interface ImageStyleResult {
  id: string;
  styled_image_path: string;
  output_path: string;
  method: string;
}

export async function runImageStyleTransfer(
  image: Blob,
  prompt: string,
  negativePrompt: string = "blurry, low quality, distorted, modern, plastic",
  strength: number = 0.6
): Promise<ImageStyleResult> {
  const form = new FormData();
  form.append("image", image, "capture.png");
  form.append("prompt", prompt);
  form.append("negative_prompt", negativePrompt);
  form.append("strength", String(strength));

  const { data } = await api.post<ImageStyleResult>(
    "/api/style-transfer/image",
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 600000, // 10 min — Gemini + TRELLIS
    }
  );
  return data;
}
