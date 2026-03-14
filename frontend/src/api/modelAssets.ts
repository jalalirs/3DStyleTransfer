import { api } from "./client";

export interface ModelView {
  id: string;
  model_id: string;
  name: string;
  file_path: string;
  created_at: string;
}

export interface StyledImage {
  id: string;
  model_id: string;
  view_id: string;
  prompt: string;
  negative_prompt: string;
  strength: number;
  file_path: string;
  created_at: string;
}

export interface ReconstructionItem {
  id: string;
  model_id: string;
  styled_image_id: string;
  method: string;
  file_path: string;
  created_at: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  prompt: string;
  negative_prompt: string;
}

const base = (modelId: string) => `/api/models/${modelId}`;

export const getTemplates = async (modelId: string) =>
  (await api.get<PromptTemplate[]>(`${base(modelId)}/templates`)).data;

// Views
export const listViews = async (modelId: string) =>
  (await api.get<ModelView[]>(`${base(modelId)}/views`)).data;

export const uploadView = async (modelId: string, blob: Blob, name?: string) => {
  const form = new FormData();
  form.append("image", blob, "snapshot.png");
  form.append("name", name || "View");
  return (await api.post<ModelView>(`${base(modelId)}/views`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  })).data;
};

export const deleteView = async (modelId: string, viewId: string) =>
  api.delete(`${base(modelId)}/views/${viewId}`);

export const viewImageUrl = (modelId: string, viewId: string) =>
  `${api.defaults.baseURL}${base(modelId)}/views/${viewId}/image`;

// Styled
export const listStyled = async (modelId: string) =>
  (await api.get<StyledImage[]>(`${base(modelId)}/styled`)).data;

export const createStyled = async (
  modelId: string, viewId: string, prompt: string, negativePrompt: string, strength: number
) =>
  (await api.post<StyledImage>(`${base(modelId)}/styled`, {
    view_id: viewId, prompt, negative_prompt: negativePrompt, strength,
  }, { timeout: 120000 })).data;

export const deleteStyled = async (modelId: string, styledId: string) =>
  api.delete(`${base(modelId)}/styled/${styledId}`);

export const styledImageUrl = (modelId: string, styledId: string) =>
  `${api.defaults.baseURL}${base(modelId)}/styled/${styledId}/image`;

// Reconstructions
export const listReconstructions = async (modelId: string) =>
  (await api.get<ReconstructionItem[]>(`${base(modelId)}/reconstructions`)).data;

export const createReconstruction = async (modelId: string, styledImageId: string, method = "triposr") =>
  (await api.post<ReconstructionItem>(`${base(modelId)}/reconstructions`, {
    styled_image_id: styledImageId, method,
  }, { timeout: 300000 })).data;

export const reconstructionUrl = (modelId: string, reconId: string) =>
  `${api.defaults.baseURL}${base(modelId)}/reconstructions/${reconId}/model.obj`;
