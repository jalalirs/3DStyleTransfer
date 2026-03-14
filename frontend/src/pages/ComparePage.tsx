import { useEffect, useState } from "react";
import { listJobs } from "../api/jobs";
import { getModel } from "../api/models";
import { SplitViewer } from "../components/viewer/SplitViewer";
import { getModelUrl } from "../api/client";
import type { Job } from "../types/job";

export function ComparePage() {
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [viewerModels, setViewerModels] = useState<{ url: string; label: string }[]>([]);

  useEffect(() => {
    listJobs("completed").then(setCompletedJobs);
  }, []);

  useEffect(() => {
    loadViewerModels();
  }, [selectedJobIds]);

  async function loadViewerModels() {
    const models: { url: string; label: string }[] = [];
    for (const jobId of selectedJobIds) {
      const job = completedJobs.find((j) => j.id === jobId);
      if (job?.output_model_id) {
        const m = await getModel(job.output_model_id);
        models.push({
          url: getModelUrl(m.file_path),
          label: `${m.name}`,
        });
      }
    }
    setViewerModels(models);
  }

  function toggleJob(jobId: string) {
    setSelectedJobIds((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : prev.length < 4
        ? [...prev, jobId]
        : prev
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Compare Results</h1>

      {completedJobs.length === 0 ? (
        <p style={{ color: "#666" }}>
          No completed jobs yet. Run some style transfers first!
        </p>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Job selector */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
              Select up to 4 results
            </h3>
            {completedJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => toggleJob(job.id)}
                style={{
                  padding: 10,
                  background: selectedJobIds.includes(job.id) ? "#1a1a2e" : "#111",
                  border: selectedJobIds.includes(job.id)
                    ? "1px solid #4a9eff"
                    : "1px solid #222",
                  borderRadius: 6,
                  marginBottom: 6,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 500 }}>{job.pipeline_id}</div>
                <div style={{ color: "#888", fontSize: 11, marginTop: 2 }}>
                  {new Date(job.created_at).toLocaleString()}
                </div>
                {"prompt" in job.config && (
                  <div
                    style={{
                      color: "#666",
                      fontSize: 11,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    &quot;{String(job.config.prompt)}&quot;
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Viewer */}
          <div style={{ flex: 1, minHeight: 500 }}>
            {viewerModels.length > 0 ? (
              <SplitViewer models={viewerModels} />
            ) : (
              <div
                style={{
                  height: 500,
                  background: "#111",
                  borderRadius: 8,
                  border: "1px solid #222",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#444",
                }}
              >
                Select jobs to compare
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
