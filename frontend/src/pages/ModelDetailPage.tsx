import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { getModel, listModels } from "../api/models";
import { getModelUrl } from "../api/client";
import {
  listViews, uploadView, deleteView, viewImageUrl,
  listStyled, createStyled, deleteStyled, styledImageUrl,
  listReconstructions, createReconstruction, reconstructionUrl,
  getTemplates,
  type ModelView, type StyledImage, type ReconstructionItem, type PromptTemplate,
} from "../api/modelAssets";
import { runMeshUp } from "../api/meshup";
import { ModelViewer } from "../components/viewer/ModelViewer";
import type { Model3D } from "../types/model";

type TransferMethod = "image-style" | "meshup" | "3d-to-3d";

const METHODS: { id: TransferMethod; label: string; desc: string; enabled: boolean }[] = [
  { id: "image-style", label: "Image Style Transfer", desc: "Capture view → Style with Gemini → Reconstruct 3D", enabled: true },
  { id: "meshup", label: "MeshUp", desc: "Text-guided mesh deformation (CLIP + SDS)", enabled: true },
  { id: "3d-to-3d", label: "3D-to-3D Transfer", desc: "Reference 3D + Target 3D → Styled 3D (coming soon)", enabled: false },
];

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
  const [method, setMethod] = useState<TransferMethod>("image-style");

  // Image style transfer state
  const [views, setViews] = useState<ModelView[]>([]);
  const [styled, setStyled] = useState<StyledImage[]>([]);
  const [recons, setRecons] = useState<ReconstructionItem[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedViewId, setSelectedViewId] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, modern, plastic");
  const [strength, setStrength] = useState(0.6);
  const [styling, setStyling] = useState(false);
  const [reconstructing, setReconstructing] = useState<string>("");

  // MeshUp state
  const [meshupPrompt, setMeshupPrompt] = useState("");
  const [meshupIterations, setMeshupIterations] = useState(500);
  const [meshupRunning, setMeshupRunning] = useState(false);

  // 3D-to-3D state
  const [referenceModels, setReferenceModels] = useState<Model3D[]>([]);
  const [selectedRefId, setSelectedRefId] = useState<string>("");

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

    // Load reference models for 3D-to-3D (faiza + base_shapes)
    const allModels = await listModels();
    setReferenceModels(allModels.filter((mm) =>
      mm.category === "faiza" || mm.category === "base_shapes" || mm.category === "templates"
    ));
  }

  // --- Image style transfer handlers ---
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

  async function handleReconstruct(styledId: string, method: string) {
    if (!modelId) return;
    setReconstructing(styledId + "_" + method);
    setError("");
    try {
      await createReconstruction(modelId, styledId, method);
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

  // --- MeshUp handler ---
  async function handleMeshUp() {
    if (!modelId || !meshupPrompt) return;
    setMeshupRunning(true);
    setError("");
    try {
      await runMeshUp(modelId, meshupPrompt, meshupIterations);
      setRecons(await listReconstructions(modelId));
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
    }
    setMeshupRunning(false);
  }

  if (!model || !modelId) return <p style={{ color: "#888" }}>Loading...</p>;

  // Separate reconstructions by type
  const meshupRecons = recons.filter((r) => r.method === "meshup");
  const imageRecons = recons.filter((r) => r.method !== "meshup");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>{model.name}</h1>
      <p style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
        {model.category} | {model.vertex_count.toLocaleString()} vertices | {model.original_format.toUpperCase()}
      </p>

      {error && (
        <div style={{ padding: 10, background: "#2a1a1a", border: "1px solid #d9534f", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "#ff8888" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#ff8888", cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* ---- 3D Viewer ---- */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
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
          {method === "image-style" && (
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
          )}
        </div>
      </div>

      {/* ---- Transfer Method Tabs ---- */}
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid #222", paddingBottom: 0 }}>
        {METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => m.enabled && setMethod(m.id)}
            disabled={!m.enabled}
            style={{
              padding: "10px 20px",
              background: method === m.id ? "#1a1a2e" : "transparent",
              border: "none",
              borderBottom: method === m.id ? "2px solid #4a9eff" : "2px solid transparent",
              color: !m.enabled ? "#444" : method === m.id ? "#fff" : "#888",
              cursor: m.enabled ? "pointer" : "not-allowed",
              fontSize: 13,
              fontWeight: method === m.id ? 600 : 400,
              opacity: m.enabled ? 1 : 0.5,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ===== IMAGE STYLE TRANSFER ===== */}
      {method === "image-style" && (
        <>
          {/* Views */}
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

          {/* Style Generator */}
          {views.length > 0 && (
            <section style={{ marginBottom: 32, padding: 20, background: "#111", borderRadius: 8, border: "1px solid #222" }}>
              <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>Generate Styled Variation</h2>

              {!selectedViewId && (
                <p style={{ color: "#f0ad4e", fontSize: 13, marginBottom: 12 }}>Click a view above to select it first.</p>
              )}

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

          {/* Styled Images */}
          {styled.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
                Styled Variations ({styled.length})
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {styled.map((s) => {
                  const sourceView = views.find((v) => v.id === s.view_id);
                  return (
                    <div key={s.id} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                      <div style={{ display: "grid", gridTemplateColumns: sourceView ? "1fr 1fr" : "1fr", gap: 2 }}>
                        {sourceView && (
                          <div>
                            <div style={{ padding: "6px 10px", fontSize: 11, color: "#666", background: "#0a0a0a" }}>Original</div>
                            <img src={viewImageUrl(modelId, sourceView.id)} alt="Original" style={{ width: "100%", display: "block" }} />
                          </div>
                        )}
                        <div>
                          <div style={{ padding: "6px 10px", fontSize: 11, color: "#4a9eff", background: "#0a0a0a" }}>Styled</div>
                          <img src={styledImageUrl(modelId, s.id)} alt="Styled" style={{ width: "100%", display: "block" }} />
                        </div>
                      </div>
                      <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, fontSize: 12, color: "#888", lineHeight: 1.4 }}>
                          {s.prompt}
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                          {["trellis", "hunyuan3d", "triposr"].map((m) => {
                            const existing = imageRecons.find((r) => r.styled_image_id === s.id && r.method === m);
                            const isRunning = reconstructing === s.id + "_" + m;
                            return existing ? (
                              <span key={m} style={{ fontSize: 11, color: "#5cb85c", padding: "4px 8px", background: "#1a2a1a", borderRadius: 4 }}>
                                {m}
                              </span>
                            ) : (
                              <button
                                key={m}
                                onClick={() => handleReconstruct(s.id, m)}
                                disabled={!!reconstructing}
                                style={{
                                  padding: "4px 10px", fontSize: 11, borderRadius: 4, cursor: isRunning ? "wait" : "pointer",
                                  background: isRunning ? "#333" : "#1a1a2e",
                                  border: "1px solid #4a9eff", color: "#4a9eff",
                                }}
                              >
                                {isRunning ? `${m}...` : m}
                              </button>
                            );
                          })}
                          <button
                            onClick={() => handleDeleteStyled(s.id)}
                            style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: "none", border: "1px solid #333", color: "#666" }}
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

          {/* Image-based 3D Reconstructions */}
          {imageRecons.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
                3D Reconstructions ({imageRecons.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 12 }}>
                {imageRecons.map((r) => {
                  const sourceStyled = styled.find((s) => s.id === r.styled_image_id);
                  return (
                    <div key={r.id} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                      <div style={{ padding: "6px 10px", fontSize: 12, color: "#4a9eff", background: "#0a0a0a", fontWeight: 600 }}>
                        {r.method.toUpperCase()}
                      </div>
                      <div style={{ height: 350 }}>
                        <ModelViewer url={reconstructionUrl(modelId, r.id, r.method)} />
                      </div>
                      {sourceStyled && (
                        <div style={{ padding: 10, display: "flex", gap: 8, alignItems: "center" }}>
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
        </>
      )}

      {/* ===== MESHUP ===== */}
      {method === "meshup" && (
        <>
          <section style={{ marginBottom: 32, padding: 20, background: "#111", borderRadius: 8, border: "1px solid #222" }}>
            <h2 style={{ fontSize: 16, marginBottom: 4, color: "#ccc" }}>Text-Guided Mesh Deformation</h2>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
              MeshUp uses CLIP + SDS to iteratively deform this mesh toward a text description. No image capture needed.
            </p>

            <textarea
              value={meshupPrompt}
              onChange={(e) => setMeshupPrompt(e.target.value)}
              placeholder="Describe the target shape (e.g., 'a cactus', 'a Gothic cathedral spire')..."
              rows={2}
              style={{ width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13, marginBottom: 12, resize: "vertical" }}
            />

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <div style={{ width: 200 }}>
                <label style={{ fontSize: 11, color: "#666" }}>Iterations: {meshupIterations}</label>
                <input type="range" min={100} max={1500} step={100} value={meshupIterations}
                  onChange={(e) => setMeshupIterations(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <button
                onClick={handleMeshUp}
                disabled={!meshupPrompt || meshupRunning}
                style={{
                  padding: "8px 24px",
                  background: meshupPrompt && !meshupRunning ? "#4a9eff" : "#333",
                  border: "none", color: "#fff", borderRadius: 6,
                  cursor: meshupRunning ? "wait" : "pointer", fontSize: 13, whiteSpace: "nowrap",
                }}
              >
                {meshupRunning ? "Deforming... (this takes minutes)" : "Run MeshUp"}
              </button>
            </div>
          </section>

          {/* MeshUp Results */}
          {meshupRecons.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>
                MeshUp Results ({meshupRecons.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 12 }}>
                {meshupRecons.map((r) => (
                  <div key={r.id} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                    <div style={{ padding: "6px 10px", fontSize: 12, color: "#e67e22", background: "#0a0a0a", fontWeight: 600 }}>
                      MESHUP
                    </div>
                    <div style={{ height: 350 }}>
                      <ModelViewer url={reconstructionUrl(modelId, r.id, "meshup")} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ===== 3D-TO-3D (FUTURE) ===== */}
      {method === "3d-to-3d" && (
        <section style={{ marginBottom: 32, padding: 20, background: "#111", borderRadius: 8, border: "1px solid #222" }}>
          <h2 style={{ fontSize: 16, marginBottom: 4, color: "#ccc" }}>3D-to-3D Style Transfer</h2>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
            Transfer the style of a reference 3D model onto this target mesh. Uses neural style transfer directly in 3D space (e.g., NVIDIA 3D style transfer).
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 8 }}>Select Reference Model</label>
            {referenceModels.length === 0 ? (
              <p style={{ color: "#666", fontSize: 12 }}>No reference models available. Add models to the faiza or base_shapes categories.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                {referenceModels.map((ref) => (
                  <div
                    key={ref.id}
                    onClick={() => setSelectedRefId(ref.id)}
                    style={{
                      padding: 12, cursor: "pointer", borderRadius: 8,
                      background: selectedRefId === ref.id ? "#1a1a2e" : "#0a0a0a",
                      border: selectedRefId === ref.id ? "2px solid #4a9eff" : "1px solid #222",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{ref.name}</div>
                    <div style={{ fontSize: 11, color: "#666" }}>{ref.category}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRefId && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#0a0a0a", borderRadius: 8, overflow: "hidden", height: 300, position: "relative" }}>
                <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#e67e22", padding: "4px 10px", borderRadius: 4, fontSize: 11 }}>
                  Reference
                </div>
                <ModelViewer url={getModelUrl(referenceModels.find((r) => r.id === selectedRefId)!.file_path)} />
              </div>
              <div style={{ background: "#0a0a0a", borderRadius: 8, overflow: "hidden", height: 300, position: "relative" }}>
                <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#4a9eff", padding: "4px 10px", borderRadius: 4, fontSize: 11 }}>
                  Target (this model)
                </div>
                <ModelViewer url={getModelUrl(model.file_path)} />
              </div>
            </div>
          )}

          <button
            disabled
            style={{
              padding: "8px 24px", background: "#333", border: "none", color: "#666",
              borderRadius: 6, cursor: "not-allowed", fontSize: 13,
            }}
          >
            Coming Soon
          </button>
        </section>
      )}
    </div>
  );
}
