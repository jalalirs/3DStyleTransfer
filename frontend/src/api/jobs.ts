import { api } from "./client";
import type { Job, PipelineInfo } from "../types/job";

export async function listPipelines(): Promise<PipelineInfo[]> {
  const { data } = await api.get<PipelineInfo[]>("/api/pipelines");
  return data;
}

export async function listJobs(status?: string): Promise<Job[]> {
  const params = status ? { status } : {};
  const { data } = await api.get<Job[]>("/api/jobs", { params });
  return data;
}

export async function getJob(id: string): Promise<Job> {
  const { data } = await api.get<Job>(`/api/jobs/${id}`);
  return data;
}

export async function createJob(
  pipelineId: string,
  inputModelId: string,
  config: Record<string, unknown>
): Promise<Job> {
  const { data } = await api.post<Job>("/api/jobs", {
    pipeline_id: pipelineId,
    input_model_id: inputModelId,
    config,
  });
  return data;
}

export async function runJob(jobId: string): Promise<Job> {
  const { data } = await api.post<Job>(`/api/jobs/${jobId}/run`);
  return data;
}

export async function cancelJob(jobId: string): Promise<void> {
  await api.post(`/api/jobs/${jobId}/cancel`);
}
