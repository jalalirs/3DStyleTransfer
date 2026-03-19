import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { getStaticUrl } from "../api/client";
import { getConfig, type ModelEntry } from "../api/config";
import { runMeshUp } from "../api/meshup";
import { styleImage, reconstructStyled } from "../api/styleTransfer";
import { ModelViewer } from "../components/viewer/ModelViewer";

type TransferMethod = "image-style" | "meshup" | "3d-to-3d";
type ImageStep = "capture" | "prompt" | "styling" | "review" | "reconstructing" | "done";

const MESHUP_TEMPLATES = [
  { name: "Doric Column", prompt: "a tall classical Roman Doric column with fluted shaft and simple capital" },
  { name: "Gothic Spire", prompt: "a Gothic cathedral spire with pointed arches and ornate tracery" },
  { name: "Minaret", prompt: "an Islamic minaret tower with geometric carved patterns and balcony" },
  { name: "Muqarnas Dome", prompt: "a hemispherical dome covered in muqarnas honeycomb vaulting" },
  { name: "Arabesque Panel", prompt: "a flat decorative panel with intricate arabesque floral patterns" },
  { name: "Mashrabiya Screen", prompt: "a lattice window screen with repeating geometric star patterns" },
];

const IMAGE_STYLE_TEMPLATES = [
  {
    name: "Islamic Column",
    prompt: "Using this geometric pattern as the repeating decorative motif, create a photorealistic tall architectural column. The shaft, base, and capital should all be shaped using this pattern as carved relief wrapping around the surface. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Archway",
    prompt: "Using this geometric pattern as the repeating decorative motif, create a photorealistic architectural archway with two supporting pillars. The arch profile, pillar surfaces, and keystone should all be carved using this pattern. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Building Facade",
    prompt: "Using this geometric pattern, create a photorealistic building facade section with this pattern as carved relief and screen cutouts. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Dome",
    prompt: "Using this geometric pattern as the repeating motif, create a photorealistic dome on a cylindrical drum. The pattern radiates from the crown. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Ottoman Iznik",
    prompt: "Transform this pattern into Ottoman Iznik tile style — cobalt blue, turquoise, and red floral motifs. Photorealistic glazed ceramic, studio lighting.",
    negative_prompt: "blurry, low quality, distorted, modern, plastic",
  },
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

function Spinner({ color = "#4a9eff" }: { color?: string }) {
  return (
    <>
      <div style={{
        width: 48, height: 48, border: "3px solid #222", borderTop: `3px solid ${color}`,
        borderRadius: "50%", margin: "0 auto", animation: "spin 1s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}


export function StyleTransferPage() {
  const { refId } = useParams<{ refId: string }>();
  const navigate = useNavigate();

  const [reference, setReference] = useState<ModelEntry | null>(null);
  const [method, setMethod] = useState<TransferMethod>("image-style");

  // Image style state
  const [imageStep, setImageStep] = useState<ImageStep>("capture");
  const [stylePrompt, setStylePrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, flat, 2D, cartoon");
  const [strength, setStrength] = useState(0.6);
  const [capturedView, setCapturedView] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [styledImagePath, setStyledImagePath] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  // MeshUp state
  const [meshupPrompt, setMeshupPrompt] = useState("");
  const [iterations, setIterations] = useState(500);
  const [meshupRunning, setMeshupRunning] = useState(false);
  const [meshupResult, setMeshupResult] = useState<string | null>(null);

  const [error, setError] = useState("");
  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const handleCapture = useCallback((fn: () => Promise<Blob>) => { captureRef.current = fn; }, []);

  useEffect(() => { loadConfig(); }, [refId]);

  async function loadConfig() {
    try {
      const cfg = await getConfig();
      setReference(cfg.references.find((r) => r.id === refId) || null);
    } catch (e) { console.error(e); }
  }

  function resetImageFlow() {
    setImageStep("capture");
    setCapturedView(null);
    setCapturedBlob(null);
    setJobId(null);
    setStyledImagePath(null);
    setOutputPath(null);
    setError("");
  }

  async function handleCaptureView() {
    if (!captureRef.current) return;
    const blob = await captureRef.current();
    setCapturedBlob(blob);
    setCapturedView(URL.createObjectURL(blob));
    setImageStep("prompt");
  }

  async function handleStyle() {
    if (!capturedBlob || !stylePrompt) return;
    setImageStep("styling");
    setError("");
    try {
      const res = await styleImage(capturedBlob, stylePrompt, negPrompt, strength);
      setJobId(res.job_id);
      setStyledImagePath(res.styled_image_path);
      setImageStep("review");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || String(e));
      setImageStep("prompt");
    }
  }

  async function handleReconstruct() {
    if (!jobId || !styledImagePath) return;
    setImageStep("reconstructing");
    setError("");
    try {
      const res = await reconstructStyled(jobId, styledImagePath);
      setOutputPath(res.output_path);
      setImageStep("done");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || String(e));
      setImageStep("review");
    }
  }

  async function handleMeshUp() {
    if (!reference || !meshupPrompt) return;
    setMeshupRunning(true);
    setError("");
    setMeshupResult(null);
    try {
      const res = await runMeshUp(reference.path, meshupPrompt, iterations);
      setMeshupResult(res.output_path);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || String(e));
    }
    setMeshupRunning(false);
  }

  if (!reference) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", color: "#666" }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid #333", color: "#888", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Back</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>Style Transfer</h1>
          <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
            Reference: <span style={{ color: "#4a9eff" }}>{reference.name}</span> — {reference.description}
          </p>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "#2a1a1a", border: "1px solid #d9534f", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#ff8888", display: "flex", justifyContent: "space-between" }}>
          <span>{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", color: "#ff8888", cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* Method tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: "#0a0a0a", borderRadius: 8, padding: 4, border: "1px solid #222" }}>
        {([
          { id: "image-style", label: "Image + Prompt", sub: "Gemini → TRELLIS", disabled: false },
          { id: "meshup", label: "Text Prompt", sub: "MeshUp", disabled: false },
          { id: "3d-to-3d", label: "3D → 3D", sub: "Coming soon", disabled: true },
        ] as const).map((m) => (
          <button key={m.id}
            onClick={() => { if (!m.disabled) { setMethod(m.id); resetImageFlow(); setMeshupResult(null); } }}
            disabled={m.disabled}
            style={{
              flex: 1, padding: "10px 16px", border: "none", borderRadius: 6,
              background: method === m.id ? "#1a1a2e" : "transparent",
              color: m.disabled ? "#444" : method === m.id ? "#fff" : "#888",
              cursor: m.disabled ? "not-allowed" : "pointer",
              opacity: m.disabled ? 0.4 : 1, textAlign: "center",
            }}>
            <div style={{ fontSize: 13, fontWeight: method === m.id ? 600 : 400 }}>{m.label}</div>
            <div style={{ fontSize: 10, color: method === m.id ? "#4a9eff" : "#555", marginTop: 1 }}>{m.sub}</div>
          </button>
        ))}
      </div>

      {/* ==================== IMAGE STYLE: 3-STEP FLOW ==================== */}
      {method === "image-style" && (
        <>
          {/* Step indicator */}
          <div style={{ display: "flex", gap: 0, alignItems: "center", marginBottom: 20 }}>
            {["Capture", "Style", "Reconstruct"].map((label, i) => {
              const stepOrder = { capture: 0, prompt: 1, styling: 1, review: 2, reconstructing: 2, done: 3 };
              const current = stepOrder[imageStep];
              const active = current >= i;
              return (
                <div key={label} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : undefined }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: active ? "#4a9eff" : "#222",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff",
                    }}>{i + 1}</div>
                    <span style={{ fontSize: 12, color: active ? "#fff" : "#666" }}>{label}</span>
                  </div>
                  {i < 2 && <div style={{ flex: 1, height: 1, background: active && current > i ? "#4a9eff" : "#222", margin: "0 12px" }} />}
                </div>
              );
            })}
          </div>

          {/* STEP 1: Capture */}
          {imageStep === "capture" && (
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #222" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Rotate the reference model and capture a view</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Find the best angle showing the pattern you want to transfer</div>
              </div>
              <div style={{ height: 520, position: "relative" }}>
                <Canvas camera={{ position: [2, 1.5, 2], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
                  <ambientLight intensity={0.4} />
                  <directionalLight position={[5, 5, 5]} intensity={1} />
                  <directionalLight position={[-3, 2, -3]} intensity={0.5} />
                  <Center><ModelLoader url={getStaticUrl(reference.path)} /></Center>
                  <OrbitControls makeDefault />
                  <Environment preset="city" />
                  <CanvasCapture onCapture={handleCapture} />
                </Canvas>
                <button onClick={handleCaptureView} style={{
                  position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
                  padding: "14px 48px", background: "#4a9eff", border: "none", color: "#fff",
                  borderRadius: 10, cursor: "pointer", fontSize: 15, fontWeight: 600,
                  boxShadow: "0 4px 20px rgba(74,158,255,0.3)",
                }}>
                  Capture View
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Prompt */}
          {imageStep === "prompt" && (
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Describe the style to apply</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>What architectural element should this pattern become?</div>
                </div>
                <button onClick={resetImageFlow} style={{ background: "none", border: "1px solid #333", color: "#888", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                  Recapture
                </button>
              </div>

              <div style={{ padding: 20, display: "flex", gap: 24 }}>
                {/* Captured image */}
                <div style={{ width: 300, flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Captured View</div>
                  <img src={capturedView!} alt="Captured" style={{ width: "100%", borderRadius: 10, border: "1px solid #333" }} />
                </div>

                {/* Prompt controls */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Quick Templates</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {IMAGE_STYLE_TEMPLATES.map((t) => (
                      <button key={t.name} onClick={() => { setStylePrompt(t.prompt); setNegPrompt(t.negative_prompt); }}
                        style={{
                          padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                          background: stylePrompt === t.prompt ? "#4a9eff" : "#1a1a1a",
                          border: stylePrompt === t.prompt ? "1px solid #4a9eff" : "1px solid #333",
                          color: stylePrompt === t.prompt ? "#fff" : "#aaa",
                        }}>
                        {t.name}
                      </button>
                    ))}
                  </div>

                  <textarea value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)}
                    placeholder="Describe what to create from this pattern..."
                    rows={4}
                    style={{ width: "100%", padding: 12, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 8, fontSize: 13, marginBottom: 12, resize: "vertical", lineHeight: 1.5, flex: 1 }}
                  />

                  <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Negative prompt</label>
                      <input value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)}
                        style={{ width: "100%", padding: 8, background: "#0a0a0a", border: "1px solid #333", color: "#aaa", borderRadius: 6, fontSize: 12 }} />
                    </div>
                    <div style={{ width: 130 }}>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 4 }}>Strength: {strength}</label>
                      <input type="range" min={0.1} max={0.9} step={0.05} value={strength}
                        onChange={(e) => setStrength(Number(e.target.value))} style={{ width: "100%", marginTop: 6 }} />
                    </div>
                  </div>

                  <button onClick={handleStyle} disabled={!stylePrompt}
                    style={{
                      padding: "14px 0", width: "100%",
                      background: stylePrompt ? "linear-gradient(135deg, #4a9eff, #6c5ce7)" : "#333",
                      border: "none", color: "#fff", borderRadius: 10, cursor: stylePrompt ? "pointer" : "default",
                      fontSize: 15, fontWeight: 600,
                    }}>
                    Generate Styled Image
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STYLING spinner */}
          {imageStep === "styling" && (
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", padding: 60, textAlign: "center" }}>
              <Spinner />
              <div style={{ fontSize: 18, marginTop: 20, color: "#fff" }}>Styling with Gemini...</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>This usually takes 15-30 seconds</div>
            </div>
          )}

          {/* STEP 3: Review styled image */}
          {imageStep === "review" && styledImagePath && (
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #222" }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Review the styled image</div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>If you like it, proceed to 3D reconstruction. Otherwise, go back and adjust.</div>
              </div>

              <div style={{ padding: 20 }}>
                {/* Before / After */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Original Capture</div>
                    <img src={capturedView!} alt="Original" style={{ width: "100%", borderRadius: 10, border: "1px solid #333" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#9b59b6", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>Styled by Gemini</div>
                    <img src={getStaticUrl(styledImagePath)} alt="Styled" style={{ width: "100%", borderRadius: 10, border: "1px solid #9b59b6" }} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => setImageStep("prompt")} style={{
                    padding: "12px 28px", background: "#222", border: "1px solid #333", color: "#aaa",
                    borderRadius: 8, cursor: "pointer", fontSize: 13,
                  }}>
                    Try Different Style
                  </button>
                  <button onClick={handleReconstruct} style={{
                    padding: "12px 28px", flex: 1,
                    background: "linear-gradient(135deg, #27ae60, #2ecc71)",
                    border: "none", color: "#fff", borderRadius: 8, cursor: "pointer",
                    fontSize: 15, fontWeight: 600,
                  }}>
                    Reconstruct 3D with TRELLIS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* RECONSTRUCTING spinner */}
          {imageStep === "reconstructing" && (
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", padding: 60, textAlign: "center" }}>
              <Spinner color="#27ae60" />
              <div style={{ fontSize: 18, marginTop: 20, color: "#fff" }}>Reconstructing 3D with TRELLIS...</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>This may take 1-3 minutes</div>
            </div>
          )}

          {/* DONE: Final result */}
          {imageStep === "done" && outputPath && (
            <div>
              <div style={{ padding: "14px 20px", background: "#0d1f0d", border: "1px solid #2d5a2d", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 20, color: "#5cb85c" }}>✓</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#5cb85c" }}>Style transfer complete</div>
                    <div style={{ fontSize: 11, color: "#888" }}><code>{outputPath}</code></div>
                  </div>
                </div>
                <button onClick={resetImageFlow} style={{
                  padding: "8px 20px", background: "#1a1a2e", border: "1px solid #333",
                  color: "#aaa", borderRadius: 6, cursor: "pointer", fontSize: 12,
                }}>New Transfer</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 12, color: "#e67e22", fontWeight: 600 }}>Reference</div>
                  <div style={{ height: 350 }}><ModelViewer url={getStaticUrl(reference.path)} /></div>
                </div>
                <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 12, color: "#9b59b6", fontWeight: 600 }}>Styled Image</div>
                  <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
                    <img src={getStaticUrl(styledImagePath!)} alt="Styled" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
                  </div>
                </div>
                <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 12, color: "#5cb85c", fontWeight: 600 }}>3D Result</div>
                  <div style={{ height: 350 }}><ModelViewer url={getStaticUrl(outputPath)} /></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ==================== MESHUP FLOW ==================== */}
      {method === "meshup" && !meshupRunning && !meshupResult && (
        <div style={{ display: "flex", gap: 20 }}>
          <div style={{ flex: 1, background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 11, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>Reference Model</div>
            <div style={{ height: 450 }}><ModelViewer url={getStaticUrl(reference.path)} /></div>
          </div>
          <div style={{ width: 360, background: "#111", borderRadius: 12, border: "1px solid #222", padding: 20, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Text-Guided Deformation</div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>MeshUp deforms this mesh toward your description using CLIP.</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
              {MESHUP_TEMPLATES.map((t) => (
                <button key={t.name} onClick={() => setMeshupPrompt(t.prompt)}
                  style={{
                    padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11,
                    background: meshupPrompt === t.prompt ? "#e67e22" : "#1a1a1a",
                    border: meshupPrompt === t.prompt ? "1px solid #e67e22" : "1px solid #333",
                    color: meshupPrompt === t.prompt ? "#fff" : "#aaa",
                  }}>
                  {t.name}
                </button>
              ))}
            </div>

            <textarea value={meshupPrompt} onChange={(e) => setMeshupPrompt(e.target.value)}
              placeholder="Describe the target shape..." rows={5}
              style={{ width: "100%", padding: 12, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 8, fontSize: 13, marginBottom: 12, resize: "vertical", lineHeight: 1.5, flex: 1 }}
            />

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: "#555" }}>Iterations: {iterations}</label>
              <input type="range" min={100} max={1500} step={100} value={iterations}
                onChange={(e) => setIterations(Number(e.target.value))} style={{ width: "100%", marginTop: 4 }} />
            </div>

            <button onClick={handleMeshUp} disabled={!meshupPrompt}
              style={{
                padding: "14px 0", width: "100%",
                background: meshupPrompt ? "linear-gradient(135deg, #e67e22, #d35400)" : "#333",
                border: "none", color: "#fff", borderRadius: 10, cursor: meshupPrompt ? "pointer" : "default",
                fontSize: 15, fontWeight: 600,
              }}>
              Run MeshUp
            </button>
          </div>
        </div>
      )}

      {method === "meshup" && meshupRunning && (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", padding: 60, textAlign: "center" }}>
          <Spinner color="#e67e22" />
          <div style={{ fontSize: 18, marginTop: 20, color: "#fff" }}>MeshUp is running...</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 6 }}>Deforming mesh — 5-30 minutes depending on iterations</div>
        </div>
      )}

      {method === "meshup" && meshupResult && (
        <div>
          <div style={{ padding: "14px 20px", background: "#0d1f0d", border: "1px solid #2d5a2d", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20, color: "#5cb85c" }}>✓</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#5cb85c" }}>MeshUp complete</div>
                <div style={{ fontSize: 11, color: "#888" }}><code>{meshupResult}</code></div>
              </div>
            </div>
            <button onClick={() => setMeshupResult(null)} style={{
              padding: "8px 20px", background: "#1a1a2e", border: "1px solid #333",
              color: "#aaa", borderRadius: 6, cursor: "pointer", fontSize: 12,
            }}>New Transfer</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 12, color: "#e67e22", fontWeight: 600 }}>Reference</div>
              <div style={{ height: 400 }}><ModelViewer url={getStaticUrl(reference.path)} /></div>
            </div>
            <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid #222", fontSize: 12, color: "#5cb85c", fontWeight: 600 }}>Result</div>
              <div style={{ height: 400 }}><ModelViewer url={getStaticUrl(meshupResult)} /></div>
            </div>
          </div>
        </div>
      )}

      {method === "3d-to-3d" && (
        <div style={{ background: "#111", borderRadius: 12, border: "1px solid #222", padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 18, color: "#666" }}>3D-to-3D Style Transfer — Coming Soon</div>
          <div style={{ fontSize: 13, color: "#444", marginTop: 8 }}>Reference 3D + Target 3D → Styled 3D</div>
        </div>
      )}
    </div>
  );
}
