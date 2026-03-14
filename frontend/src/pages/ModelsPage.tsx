import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listModels, uploadModel } from "../api/models";
import { ModelViewer } from "../components/viewer/ModelViewer";
import { getModelUrl } from "../api/client";
import type { Model3D } from "../types/model";

const CATEGORIES = [
  "all",
  "muqarnas",
  "arches",
  "domes",
  "geometric_patterns",
  "mashrabiya",
  "other",
];

export function ModelsPage() {
  const [models, setModels] = useState<Model3D[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedModel, setSelectedModel] = useState<Model3D | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadModels();
  }, [selectedCategory]);

  async function loadModels() {
    setLoading(true);
    try {
      const cat = selectedCategory === "all" ? undefined : selectedCategory;
      const data = await listModels(cat);
      setModels(data);
    } catch (e) {
      console.error("Failed to load models:", e);
    }
    setLoading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadModel(file);
      loadModels();
    } catch (err) {
      console.error("Upload failed:", err);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>Model Library</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileInput}
            type="file"
            accept=".obj,.gltf,.glb,.stl"
            onChange={handleUpload}
            style={{ display: "none" }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            style={{
              padding: "8px 16px",
              background: "#1a1a2e",
              border: "1px solid #333",
              color: "#fff",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Upload Model
          </button>
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: "6px 14px",
              background: selectedCategory === cat ? "#4a9eff" : "#1a1a1a",
              border: "1px solid #333",
              color: selectedCategory === cat ? "#fff" : "#aaa",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {cat.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Loading models...</p>
      ) : (
        <div style={{ display: "flex", gap: 20 }}>
          {/* Model grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
              flex: 1,
            }}
          >
            {models.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m)}
                style={{
                  background: selectedModel?.id === m.id ? "#1a1a2e" : "#111",
                  border:
                    selectedModel?.id === m.id
                      ? "1px solid #4a9eff"
                      : "1px solid #222",
                  borderRadius: 8,
                  padding: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                  {m.name}
                </div>
                <div style={{ fontSize: 11, color: "#888" }}>
                  {m.category} | {m.original_format.toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                  {m.vertex_count > 0
                    ? `${m.vertex_count.toLocaleString()} verts`
                    : m.source}
                </div>
              </div>
            ))}
            {models.length === 0 && (
              <p style={{ color: "#666" }}>No models found. Start the backend to seed built-in models.</p>
            )}
          </div>

          {/* Preview panel */}
          {selectedModel && (
            <div
              style={{
                width: 450,
                flexShrink: 0,
                background: "#111",
                borderRadius: 8,
                border: "1px solid #222",
                overflow: "hidden",
              }}
            >
              <ModelViewer
                url={getModelUrl(selectedModel.file_path)}
                style={{ height: 350 }}
              />
              <div style={{ padding: 16 }}>
                <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
                  {selectedModel.name}
                </h3>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.8 }}>
                  <div>Category: {selectedModel.category}</div>
                  <div>Format: {selectedModel.original_format}</div>
                  <div>Vertices: {selectedModel.vertex_count.toLocaleString()}</div>
                  <div>Faces: {selectedModel.face_count.toLocaleString()}</div>
                  <div>Source: {selectedModel.source}</div>
                  {selectedModel.license && <div>License: {selectedModel.license}</div>}
                </div>
                <button
                  onClick={() =>
                    navigate("/new-job", { state: { modelId: selectedModel.id } })
                  }
                  style={{
                    marginTop: 12,
                    padding: "8px 20px",
                    background: "#4a9eff",
                    border: "none",
                    color: "#fff",
                    borderRadius: 6,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Use in Style Transfer
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
