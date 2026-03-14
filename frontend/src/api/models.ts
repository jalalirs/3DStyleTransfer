import { api } from "./client";
import type { Model3D } from "../types/model";

export async function listModels(category?: string): Promise<Model3D[]> {
  const params = category ? { category } : {};
  const { data } = await api.get<Model3D[]>("/api/models", { params });
  return data;
}

export async function getModel(id: string): Promise<Model3D> {
  const { data } = await api.get<Model3D>(`/api/models/${id}`);
  return data;
}

export async function uploadModel(
  file: File,
  name?: string,
  category?: string
): Promise<{ id: string; name: string; message: string }> {
  const form = new FormData();
  form.append("file", file);
  if (name) form.append("name", name);
  if (category) form.append("category", category);
  const { data } = await api.post("/api/models", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
