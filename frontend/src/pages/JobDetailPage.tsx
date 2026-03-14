import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getJob } from "../api/jobs";
import { getModel } from "../api/models";
import { ModelViewer } from "../components/viewer/ModelViewer";
import { SplitViewer } from "../components/viewer/SplitViewer";
import { getModelUrl, api } from "../api/client";
import type { Job } from "../types/job";
import type { Model3D } from "../types/model";

function artifactUrl(jobId: string, type: string, filename: string) {
  return `${api.defaults.baseURL}/api/jobs/${jobId}/artifacts/${type}/${filename}`;
}

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [inputModel, setInputModel] = useState<Model3D | null>(null);
  const [outputModel, setOutputModel] = useState<Model3D | null>(null);

  useEffect(() => {
    if (!jobId) return;
    loadJob();
  }, [jobId]);

  async function loadJob() {
    if (!jobId) return;
    const j = await getJob(jobId);
    setJob(j);
    const im = await getModel(j.input_model_id);
    setInputModel(im);
    if (j.output_model_id) {
      const om = await getModel(j.output_model_id);
      setOutputModel(om);
    }
  }

  if (!job) return <p style={{ color: "#888" }}>Loading...</p>;

  const statusColor =
    job.status === "completed"
      ? "#5cb85c"
      : job.status === "failed"
      ? "#d9534f"
      : job.status === "running"
      ? "#4a9eff"
      : "#888";

  // Extract image filenames from artifact paths
  const renderedViews = (job.intermediate_artifacts.rendered_views as string[] | undefined) || [];
  const styledViews = (job.intermediate_artifacts.styled_views as string[] | undefined) || [];

  const renderFilenames = renderedViews.map((p) => p.split("/").pop() || "");
  const styledFilenames = styledViews.map((p) => p.split("/").pop() || "");

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Job Detail</h1>
        <span
          style={{
            padding: "4px 12px",
            background: statusColor + "22",
            color: statusColor,
            borderRadius: 12,
            fontSize: 13,
          }}
        >
          {job.status}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: "#888",
            marginBottom: 6,
          }}
        >
          <span>{job.current_stage || "Waiting..."}</span>
          <span>{Math.round(job.progress * 100)}%</span>
        </div>
        <div
          style={{
            width: "100%",
            height: 8,
            background: "#222",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${job.progress * 100}%`,
              height: "100%",
              background: statusColor,
              transition: "width 0.5s",
            }}
          />
        </div>
      </div>

      {/* Error message */}
      {job.error_message && (
        <div
          style={{
            padding: 12,
            background: "#2a1a1a",
            border: "1px solid #d9534f",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 13,
            color: "#ff8888",
          }}
        >
          {job.error_message}
        </div>
      )}

      {/* Config */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Configuration</h3>
        <div
          style={{
            background: "#111",
            border: "1px solid #222",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            fontFamily: "monospace",
            color: "#aaa",
          }}
        >
          {Object.entries(job.config).map(([k, v]) => (
            <div key={k} style={{ marginBottom: 4 }}>
              <span style={{ color: "#4a9eff" }}>{k}</span>: {JSON.stringify(v)}
            </div>
          ))}
        </div>
      </div>

      {/* 3D comparison */}
      {inputModel && outputModel && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            Result Comparison
          </h3>
          <div style={{ height: 450 }}>
            <SplitViewer
              models={[
                {
                  url: getModelUrl(inputModel.file_path),
                  label: `Input: ${inputModel.name}`,
                },
                {
                  url: getModelUrl(outputModel.file_path),
                  label: `Output: ${outputModel.name}`,
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Input model only */}
      {inputModel && !outputModel && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>Input Model</h3>
          <div
            style={{
              height: 400,
              background: "#111",
              borderRadius: 8,
              border: "1px solid #222",
              overflow: "hidden",
            }}
          >
            <ModelViewer url={getModelUrl(inputModel.file_path)} />
          </div>
        </div>
      )}

      {/* Rendered views */}
      {renderFilenames.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            Rendered Views ({renderFilenames.length})
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(renderFilenames.length, 4)}, 1fr)`,
              gap: 8,
            }}
          >
            {renderFilenames.map((fname, i) => (
              <div
                key={i}
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <img
                  src={artifactUrl(job.id, "renders", fname)}
                  alt={`View ${i}`}
                  style={{ width: "100%", display: "block" }}
                />
                <div style={{ padding: 6, fontSize: 11, color: "#666", textAlign: "center" }}>
                  View {i}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Styled views */}
      {styledFilenames.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            Styled Views — Google Imagen ({styledFilenames.length})
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(styledFilenames.length, 4)}, 1fr)`,
              gap: 8,
            }}
          >
            {styledFilenames.map((fname, i) => (
              <div
                key={i}
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <img
                  src={artifactUrl(job.id, "styled", fname)}
                  alt={`Styled ${i}`}
                  style={{ width: "100%", display: "block" }}
                />
                <div style={{ padding: 6, fontSize: 11, color: "#666", textAlign: "center" }}>
                  Styled {i}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side render vs styled */}
      {renderFilenames.length > 0 && styledFilenames.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            Before / After Comparison
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(renderFilenames.length, 4)}, 1fr)`,
              gap: 8,
            }}
          >
            {renderFilenames.map((fname, i) => (
              <div
                key={i}
                style={{
                  background: "#111",
                  border: "1px solid #222",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex" }}>
                  <img
                    src={artifactUrl(job.id, "renders", fname)}
                    alt={`Original ${i}`}
                    style={{ width: "50%", display: "block" }}
                  />
                  <img
                    src={artifactUrl(job.id, "styled", styledFilenames[i])}
                    alt={`Styled ${i}`}
                    style={{ width: "50%", display: "block" }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 10,
                    color: "#666",
                    textAlign: "center",
                  }}
                >
                  <div style={{ flex: 1, padding: 4 }}>Original</div>
                  <div style={{ flex: 1, padding: 4 }}>Styled</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
