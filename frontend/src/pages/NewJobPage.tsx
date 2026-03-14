import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { listModels } from "../api/models";
import { listPipelines, createJob, runJob } from "../api/jobs";
import { ModelViewer } from "../components/viewer/ModelViewer";
import { getModelUrl } from "../api/client";
import type { Model3D } from "../types/model";
import type { PipelineInfo } from "../types/job";

export function NewJobPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const preselectedModelId = (location.state as { modelId?: string })?.modelId;

  const [models, setModels] = useState<Model3D[]>([]);
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState(preselectedModelId || "");
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listModels().then(setModels);
    listPipelines().then((p) => {
      setPipelines(p);
      if (p.length > 0 && !selectedPipelineId) {
        setSelectedPipelineId(p[0].id);
        initConfig(p[0]);
      }
    });
  }, []);

  function initConfig(pipeline: PipelineInfo) {
    const schema = pipeline.config_schema as {
      properties?: Record<string, { default?: unknown }>;
    };
    const defaults: Record<string, unknown> = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (prop.default !== undefined) defaults[key] = prop.default;
      }
    }
    setConfig(defaults);
  }

  function handlePipelineChange(id: string) {
    setSelectedPipelineId(id);
    const p = pipelines.find((p) => p.id === id);
    if (p) initConfig(p);
  }

  async function handleSubmit() {
    if (!selectedModelId || !selectedPipelineId) return;
    setSubmitting(true);
    try {
      const job = await createJob(selectedPipelineId, selectedModelId, config);
      // Run immediately in dev mode
      await runJob(job.id);
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      console.error("Job creation failed:", err);
      setSubmitting(false);
    }
  }

  const selectedModel = models.find((m) => m.id === selectedModelId);
  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId);

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>New Style Transfer Job</h1>

      <div style={{ display: "flex", gap: 24 }}>
        {/* Left: Configuration */}
        <div style={{ flex: 1 }}>
          {/* Model selection */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
              1. Select Input Model
            </h3>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{
                width: "100%",
                padding: 10,
                background: "#111",
                border: "1px solid #333",
                color: "#fff",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              <option value="">-- Choose a model --</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.category})
                </option>
              ))}
            </select>
          </section>

          {/* Pipeline selection */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
              2. Select Pipeline
            </h3>
            {pipelines.map((p) => (
              <div
                key={p.id}
                onClick={() => handlePipelineChange(p.id)}
                style={{
                  padding: 12,
                  background: selectedPipelineId === p.id ? "#1a1a2e" : "#111",
                  border:
                    selectedPipelineId === p.id
                      ? "1px solid #4a9eff"
                      : "1px solid #222",
                  borderRadius: 8,
                  marginBottom: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                  {p.description}
                </div>
              </div>
            ))}
            {pipelines.length === 0 && (
              <p style={{ color: "#666", fontSize: 13 }}>
                No pipelines available. Start the backend first.
              </p>
            )}
          </section>

          {/* Pipeline config */}
          {selectedPipeline && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
                3. Configure
              </h3>
              <PipelineConfigForm
                schema={selectedPipeline.config_schema}
                config={config}
                onChange={setConfig}
              />
            </section>
          )}

          {/* Stages preview */}
          {selectedPipeline && (
            <section style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
                Pipeline Stages
              </h3>
              {selectedPipeline.stages.map((s, i) => (
                <div
                  key={s.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 0",
                    fontSize: 13,
                    color: "#aaa",
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#222",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {i + 1}
                  </span>
                  {s.description}
                </div>
              ))}
            </section>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!selectedModelId || !selectedPipelineId || submitting}
            style={{
              padding: "12px 32px",
              background:
                selectedModelId && selectedPipelineId && !submitting
                  ? "#4a9eff"
                  : "#333",
              border: "none",
              color: "#fff",
              borderRadius: 8,
              cursor: submitting ? "wait" : "pointer",
              fontSize: 15,
              width: "100%",
            }}
          >
            {submitting ? "Running..." : "Launch Style Transfer"}
          </button>
        </div>

        {/* Right: Preview */}
        <div style={{ width: 400, flexShrink: 0 }}>
          {selectedModel ? (
            <div
              style={{
                background: "#111",
                borderRadius: 8,
                border: "1px solid #222",
                overflow: "hidden",
              }}
            >
              <ModelViewer
                url={getModelUrl(selectedModel.file_path)}
                style={{ height: 400 }}
              />
              <div style={{ padding: 12, fontSize: 13, color: "#888" }}>
                {selectedModel.name}
              </div>
            </div>
          ) : (
            <div
              style={{
                height: 400,
                background: "#111",
                borderRadius: 8,
                border: "1px solid #222",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#444",
              }}
            >
              Select a model to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Dynamic form rendered from JSON Schema */
function PipelineConfigForm({
  schema,
  config,
  onChange,
}: {
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const properties = (schema as { properties?: Record<string, Record<string, unknown>> })
    .properties;
  if (!properties) return null;

  function update(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Object.entries(properties).map(([key, prop]) => {
        const type = prop.type as string;
        const title = (prop.title as string) || key;
        const description = prop.description as string | undefined;
        const enumValues = prop.enum as string[] | undefined;

        return (
          <div key={key}>
            <label
              style={{ display: "block", fontSize: 13, marginBottom: 4, color: "#ccc" }}
            >
              {title}
            </label>
            {description && (
              <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>
                {description}
              </div>
            )}
            {enumValues ? (
              <select
                value={String(config[key] || "")}
                onChange={(e) => update(key, e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#0a0a0a",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                {enumValues.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
            ) : type === "string" ? (
              <textarea
                value={String(config[key] || "")}
                onChange={(e) => update(key, e.target.value)}
                rows={key === "prompt" ? 3 : 1}
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#0a0a0a",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 13,
                  resize: "vertical",
                }}
              />
            ) : type === "number" || type === "integer" ? (
              <input
                type="number"
                value={Number(config[key] || 0)}
                min={prop.minimum as number | undefined}
                max={prop.maximum as number | undefined}
                step={type === "number" ? 0.05 : 1}
                onChange={(e) => update(key, Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#0a0a0a",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 4,
                  fontSize: 13,
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
