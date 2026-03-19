import { api } from "./client";

export interface ModelEntry {
  id: string;
  name: string;
  path: string;
  category: string;
  description: string;
  role?: string;
}

export interface MethodEntry {
  id: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface StyleTransferConfig {
  references: ModelEntry[];
  targets: ModelEntry[];
  methods: MethodEntry[];
}

export async function getConfig(): Promise<StyleTransferConfig> {
  const { data } = await api.get<StyleTransferConfig>("/api/config");
  return data;
}

export async function getReferences(): Promise<ModelEntry[]> {
  const { data } = await api.get<ModelEntry[]>("/api/config/references");
  return data;
}

export async function getTargets(): Promise<ModelEntry[]> {
  const { data } = await api.get<ModelEntry[]>("/api/config/targets");
  return data;
}

export async function getMethods(): Promise<MethodEntry[]> {
  const { data } = await api.get<MethodEntry[]>("/api/config/methods");
  return data;
}
