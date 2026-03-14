export interface Job {
  id: string;
  pipeline_id: string;
  status: "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
  input_model_id: string;
  config: Record<string, unknown>;
  current_stage: string;
  progress: number;
  error_message: string | null;
  output_model_id: string | null;
  intermediate_artifacts: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface PipelineStage {
  name: string;
  description: string;
  progress_weight: number;
}

export interface PipelineInfo {
  id: string;
  name: string;
  description: string;
  config_schema: Record<string, unknown>;
  stages: PipelineStage[];
}
