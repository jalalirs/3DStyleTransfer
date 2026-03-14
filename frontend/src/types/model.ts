export interface Model3D {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  license: string;
  file_path: string;
  original_format: string;
  thumbnail_path: string | null;
  vertex_count: number;
  face_count: number;
  created_at: string;
  source_job_id: string | null;
}
