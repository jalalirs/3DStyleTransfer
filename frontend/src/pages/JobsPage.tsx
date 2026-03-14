import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listJobs } from "../api/jobs";
import type { Job } from "../types/job";

const STATUS_COLORS: Record<string, string> = {
  pending: "#888",
  queued: "#f0ad4e",
  running: "#4a9eff",
  completed: "#5cb85c",
  failed: "#d9534f",
  cancelled: "#666",
};

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    listJobs().then((j) => {
      setJobs(j);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Jobs</h1>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : jobs.length === 0 ? (
        <div style={{ color: "#666", textAlign: "center", padding: 60 }}>
          <p>No jobs yet.</p>
          <button
            onClick={() => navigate("/new-job")}
            style={{
              padding: "10px 24px",
              background: "#4a9eff",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
              marginTop: 12,
            }}
          >
            Create First Job
          </button>
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #333", fontSize: 13, color: "#888" }}>
              <th style={{ textAlign: "left", padding: 10 }}>Status</th>
              <th style={{ textAlign: "left", padding: 10 }}>Pipeline</th>
              <th style={{ textAlign: "left", padding: 10 }}>Progress</th>
              <th style={{ textAlign: "left", padding: 10 }}>Stage</th>
              <th style={{ textAlign: "left", padding: 10 }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                style={{
                  borderBottom: "1px solid #1a1a1a",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                <td style={{ padding: 10 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: STATUS_COLORS[job.status] || "#888",
                      marginRight: 8,
                    }}
                  />
                  {job.status}
                </td>
                <td style={{ padding: 10, color: "#aaa" }}>{job.pipeline_id}</td>
                <td style={{ padding: 10 }}>
                  <div
                    style={{
                      width: 100,
                      height: 6,
                      background: "#222",
                      borderRadius: 3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${job.progress * 100}%`,
                        height: "100%",
                        background: STATUS_COLORS[job.status] || "#888",
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: 10, color: "#888" }}>{job.current_stage || "-"}</td>
                <td style={{ padding: 10, color: "#666" }}>
                  {new Date(job.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
