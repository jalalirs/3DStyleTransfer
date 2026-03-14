import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { getModel } from "../api/models";
import { getModelUrl } from "../api/client";
import {
  listViews, uploadView, deleteView, viewImageUrl,
  listStyled, createStyled, deleteStyled, styledImageUrl,
  listReconstructions, createReconstruction, reconstructionUrl,
  getTemplates,
  type ModelView, type StyledImage, type ReconstructionItem, type PromptTemplate,
} from "../api/modelAssets";
import { ModelViewer } from "../components/viewer/ModelViewer";
import type { Model3D } from "../types/model";

function CanvasCapture({ onCapture }: { onCapture: (fn: () => Promise<Blob>) => void }) {
  const { gl } = useThree();
  useEffect(() => {
    onCapture(async () => {
      const canvas = gl.domElement;
      return new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), "image/png");
      });
    });
  }, [gl, onCapture]);
  return null;
}

export function ModelDetailPage() {
  const { modelId } = useParams<{ modelId: string }>();
  const [model, setModel] = useState<Model3D | null>(null);
  const [views, setViews] = useState<ModelView[]>([]);
  const [styled, setStyled] = useState<StyledImage[]>([]);
  const [recons, setRecons] = useState<ReconstructionItem[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);

  // Style form state
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, modern, plastic");
  const [strength, setStrength] = useState(0.6);
  const [styling, setStyling] = useState(false);
  const [reconstructing, setReconstructing] = useState<string>("");
  const [error, setError] = useState("");

  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const handleCapture = useCallback((fn: () => Promise<Blob>) => { captureRef.current = fn; }, []);

  useEffect(() => {
    if (!modelId) return;
    loadAll();
  }, [modelId]);

  async function loadAll() {
    if (!modelId) return;
    const [m, v, s, r, t] = await Promise.all([
      getModel(modelId),
      listViews(modelId),
      listStyled(modelId),
      listReconstructions(modelId),
      getTemplates(modelId),
    ]);
    setModel(m);
    setViews(v);
    setStyled(s);
    setRecons(r);
    setTemplates(t);
  }

  async function handleCaptureView() {
    if (!modelId || !captureRef.current) return;
    const blob = await captureRef.current();
    await uploadView(modelId, blob, `View ${views.length + 1}`);
    setViews(await listViews(modelId));
  }

  async function handleDeleteView(viewId: string) {
    if (!modelId) return;
    await deleteView(modelId, viewId);
    setViews(await listViews(modelId));
  }

  async function handleStyle() {
    if (!modelId || !selectedViewId || !prompt) return;
    setStyling(true);
    setError("");
    try {
      await createStyled(modelId, selectedViewId, prompt, negPrompt, strength);
      setStyled(await listStyled(modelId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
    }
    setStyling(false);
  }

  async function handleReconstruct(styledId: string) {
    if (!modelId) return;
    setReconstructing(styledId);
    setError("");
    try {
      await createReconstruction(modelId, styledId);
      setRecons(await listReconstructions(modelId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
    }
    setReconstructing("");
  }

  async function handleDeleteStyled(styledId: string) {
    if (!modelId) return;
    await deleteStyled(modelId, styledId);
    setStyled(await listStyled(modelId));
  }

  if (!model || !modelId) return <p style={{ color: "#888" }}>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{model.name}</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
        {model.category} | {model.vertex_count.toLocaleString()} vertices
      </p>

      {error && (
        <div style={{ padding: 10, background: "#2a1a1a", border: "1px solid #d9534f", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "#ff8888" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#ff8888", cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* ---- 3D Viewer + Capture ---- */}
      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        <div style={{ flex: 1, height: 450, background: "#111", borderRadius: 8, overflow: "hidden", position: "relative" }}>
          <Canvas camera={{ position: [2, 1.5, 2], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, 2, -3]} intensity={0.5} />
            <Center>
              <ModelLoader url={getModelUrl(model.file_path)} />
            </Center>
            <OrbitControls makeDefault />
            <Environment preset="city" />
            <CanvasCapture onCapture={handleCapture} />
          </Canvas>
          <button
            onClick={handleCaptureView}
            style={{
              position: "absolute", bottom: 12, right: 12,
              padding: "8px 20px", background: "#4a9eff", border: "none", color: "#fff",
              borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            Capture View
          </button>
        </div>
      </div>

      {/* ---- Views ---- */}
      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
          Views ({views.length})
        </h2>
        {views.length === 0 ? (
          <p style={{ color: "#666", fontSize: 13 }}>Rotate the model above and click "Capture View" to save angles.</p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {views.map((v) => (
              <div
                key={v.id}
                onClick={() => setSelectedViewId(v.id)}
                style={{
                  width: 140, borderRadius: 6, overflow: "hidden", cursor: "pointer",
                  border: selectedViewId === v.id ? "2px solid #4a9eff" : "1px solid #333",
                  position: "relative",
                }}
              >
                <img src={viewImageUrl(modelId, v.id)} alt={v.name} style={{ width: "100%", display: "block" }} />
                <div style={{ padding: 4, fontSize: 10, color: "#888", textAlign: "center", background: "#111" }}>
                  {selectedViewId === v.id ? "Selected" : v.name}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteView(v.id); }}
                  style={{
                    position: "absolute", top: 4, right: 4, width: 20, height: 20,
                    background: "rgba(0,0,0,0.6)", border: "none", color: "#888",
                    borderRadius: 3, cursor: "pointer", fontSize: 11, lineHeight: "20px",
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Style Generator ---- */}
      {views.length > 0 && (
        <section style={{ marginBottom: 32, padding: 20, background: "#111", borderRadius: 8, border: "1px solid #222" }}>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>Generate Styled Variation</h2>

          {!selectedViewId && (
            <p style={{ color: "#f0ad4e", fontSize: 13, marginBottom: 12 }}>Click a view above to select it first.</p>
          )}

          {/* Templates */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => { setPrompt(t.prompt); setNegPrompt(t.negative_prompt); }}
                style={{
                  padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
                  background: prompt === t.prompt ? "#4a9eff" : "#1a1a1a",
                  border: "1px solid #333", color: prompt === t.prompt ? "#fff" : "#aaa",
                }}
              >
                {t.name}
              </button>
            ))}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the style..."
            rows={2}
            style={{ width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13, marginBottom: 10, resize: "vertical" }}
          />

          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#666" }}>Negative prompt</label>
              <input value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)}
                style={{ width: "100%", padding: 6, background: "#0a0a0a", border: "1px solid #333", color: "#aaa", borderRadius: 4, fontSize: 12 }} />
            </div>
            <div style={{ width: 120 }}>
              <label style={{ fontSize: 11, color: "#666" }}>Strength {strength}</label>
              <input type="range" min={0.1} max={0.9} step={0.05} value={strength}
                onChange={(e) => setStrength(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <button
              onClick={handleStyle}
              disabled={!selectedViewId || !prompt || styling}
              style={{
                padding: "8px 24px", background: selectedViewId && prompt && !styling ? "#4a9eff" : "#333",
                border: "none", color: "#fff", borderRadius: 6, cursor: styling ? "wait" : "pointer", fontSize: 13, whiteSpace: "nowrap",
              }}
            >
              {styling ? "Generating..." : "Generate"}
            </button>
          </div>
        </section>
      )}

      {/* ---- Styled Images ---- */}
      {styled.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
            Styled Variations ({styled.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {styled.map((s) => {
              const sourceView = views.find((v) => v.id === s.view_id);
              const hasRecon = recons.some((r) => r.styled_image_id === s.id);
              return (
                <div key={s.id} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                  {/* Before/After */}
                  <div style={{ display: "flex" }}>
                    {sourceView && (
                      <img src={viewImageUrl(modelId, sourceView.id)} alt="Original" style={{ width: "50%" }} />
                    )}
                    <img src={styledImageUrl(modelId, s.id)} alt="Styled" style={{ width: sourceView ? "50%" : "100%" }} />
                  </div>
                  <div style={{ padding: 10 }}>
                    <div style={{ fontSize: 11, color: "#888", marginBottom: 6, lineHeight: 1.4 }}>
                      {s.prompt.length > 80 ? s.prompt.slice(0, 80) + "..." : s.prompt}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!hasRecon && (
                        <button
                          onClick={() => handleReconstruct(s.id)}
                          disabled={reconstructing === s.id}
                          style={{
                            padding: "4px 12px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                            background: reconstructing === s.id ? "#333" : "#4a9eff",
                            border: "none", color: "#fff",
                          }}
                        >
                          {reconstructing === s.id ? "Generating 3D..." : "Generate 3D"}
                        </button>
                      )}
                      {hasRecon && (
                        <span style={{ fontSize: 11, color: "#5cb85c", padding: "4px 0" }}>3D generated</span>
                      )}
                      <button
                        onClick={() => handleDeleteStyled(s.id)}
                        style={{ padding: "4px 10px", fontSize: 11, borderRadius: 4, cursor: "pointer", background: "none", border: "1px solid #333", color: "#666" }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ---- 3D Reconstructions ---- */}
      {recons.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
            3D Reconstructions ({recons.length})
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 12 }}>
            {recons.map((r) => {
              const sourceStyled = styled.find((s) => s.id === r.styled_image_id);
              return (
                <div key={r.id} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                  <div style={{ height: 300 }}>
                    <ModelViewer url={reconstructionUrl(modelId, r.id)} />
                  </div>
                  {sourceStyled && (
                    <div style={{ padding: 8, display: "flex", gap: 8, alignItems: "center" }}>
                      <img src={styledImageUrl(modelId, sourceStyled.id)} alt="" style={{ width: 50, height: 50, borderRadius: 4, objectFit: "cover" }} />
                      <div style={{ fontSize: 11, color: "#888", flex: 1 }}>
                        {sourceStyled.prompt.length > 60 ? sourceStyled.prompt.slice(0, 60) + "..." : sourceStyled.prompt}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
