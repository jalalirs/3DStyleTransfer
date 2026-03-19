import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { getStaticUrl } from "../api/client";
import { getConfig, type ModelEntry, type MethodEntry } from "../api/config";
import { runMeshUp, type MeshUpResult } from "../api/meshup";
import { runImageStyleTransfer, type ImageStyleResult } from "../api/styleTransfer";
import { ModelViewer } from "../components/viewer/ModelViewer";

type TargetType = "text" | "3d-render" | "3d-direct";

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
    name: "Islamic Geometric",
    prompt: "Using this 3D design element as the repeating decorative motif, create a photorealistic architectural element. The surfaces should be shaped using Islamic geometric patterns as carved relief. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Ottoman Iznik",
    prompt: "Transform this architectural element with Ottoman Iznik tile patterns — cobalt blue, turquoise, and red floral motifs covering all surfaces. Photorealistic glazed ceramic material, studio lighting.",
    negative_prompt: "blurry, low quality, distorted, modern, plastic",
  },
  {
    name: "Moorish Carved Stone",
    prompt: "Transform this into a Moorish carved stone element with deep relief geometric patterns, arabesques, and calligraphic bands. Weathered sandstone material, warm lighting.",
    negative_prompt: "blurry, low quality, distorted, flat, modern, plastic",
  },
  {
    name: "Gothic Tracery",
    prompt: "Transform this architectural element with Gothic tracery patterns — pointed arches, quatrefoils, and flowing stone carvings. Limestone material, dramatic lighting.",
    negative_prompt: "blurry, low quality, distorted, modern, smooth",
  },
  {
    name: "Art Deco",
    prompt: "Transform this into an Art Deco architectural element with bold geometric shapes, sunburst patterns, and stepped forms. Polished brass and marble materials, elegant lighting.",
    negative_prompt: "blurry, low quality, distorted, rustic, worn",
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

export function StyleTransferPage() {
  const { refId } = useParams<{ refId: string }>();

  // Config data
  const [reference, setReference] = useState<ModelEntry | null>(null);
  const [targets, setTargets] = useState<ModelEntry[]>([]);
  const [, setMethods] = useState<MethodEntry[]>([]);

  // UI state
  const [targetType, setTargetType] = useState<TargetType>("text");
  const [selectedTarget, setSelectedTarget] = useState<ModelEntry | null>(null);
  const [targetCategory, setTargetCategory] = useState("all");
  const [prompt, setPrompt] = useState("");
  const [iterations, setIterations] = useState(500);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [resultInfo, setResultInfo] = useState<{ output_path: string; styled_image_path?: string } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Image style transfer fields
  const [stylePrompt, setStylePrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, modern, plastic");
  const [strength, setStrength] = useState(0.6);

  // For image capture from 3d-render flow
  const [capturedView, setCapturedView] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const handleCapture = useCallback((fn: () => Promise<Blob>) => { captureRef.current = fn; }, []);

  useEffect(() => {
    loadConfig();
  }, [refId]);

  async function loadConfig() {
    try {
      const cfg = await getConfig();
      const ref = cfg.references.find((r) => r.id === refId);
      setReference(ref || null);
      setTargets(cfg.targets);
      setMethods(cfg.methods);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }

  async function handleCaptureView() {
    if (!captureRef.current) return;
    const blob = await captureRef.current();
    setCapturedBlob(blob);
    setCapturedView(URL.createObjectURL(blob));
  }

  async function handleRunTransfer() {
    if (!reference) return;
    setRunning(true);
    setError("");
    setCompleted(false);
    setResultInfo(null);
    setResultUrl(null);

    try {
      if (targetType === "text") {
        const res = await runMeshUp(reference.path, prompt, iterations);
        setResultInfo({ output_path: res.output_path });
        setCompleted(true);
        setResultUrl(getStaticUrl(res.output_path));
      } else if (targetType === "3d-render") {
        if (!capturedBlob) {
          setError("Capture a view of the target model first.");
          setRunning(false);
          return;
        }
        if (!stylePrompt) {
          setError("Enter a style prompt describing how to transform the captured view.");
          setRunning(false);
          return;
        }
        const res = await runImageStyleTransfer(capturedBlob, stylePrompt, negPrompt, strength);
        setResultInfo({ output_path: res.output_path, styled_image_path: res.styled_image_path });
        setCompleted(true);
        setResultUrl(getStaticUrl(res.output_path));
      } else {
        setError("3D-to-3D transfer is not yet available.");
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
    }
    setRunning(false);
  }

  const targetCategories = ["all", ...Array.from(new Set(targets.map((t) => t.category)))];
  const filteredTargets = targetCategory === "all"
    ? targets
    : targets.filter((t) => t.category === targetCategory);

  if (!reference) return <p style={{ color: "#888" }}>Loading reference model...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Style Transfer</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#888" }}>
          Reference: <span style={{ color: "#4a9eff" }}>{reference.name}</span>
        </p>
      </div>

      {error && (
        <div style={{ padding: 10, background: "#2a1a1a", border: "1px solid #d9534f", borderRadius: 6, marginBottom: 16, fontSize: 13, color: "#ff8888" }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: "#ff8888", cursor: "pointer" }}>x</button>
        </div>
      )}

      {/* Completed banner */}
      {completed && resultInfo && (
        <div style={{ padding: 16, background: "#1a2a1a", border: "1px solid #5cb85c", borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#5cb85c", marginBottom: 6 }}>
            Generation completed!
          </div>
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 4 }}>
            Output: <code style={{ color: "#ccc" }}>{resultInfo.output_path}</code>
          </div>
          {resultInfo.styled_image_path && (
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 4 }}>
              Styled image: <code style={{ color: "#ccc" }}>{resultInfo.styled_image_path}</code>
            </div>
          )}
          <div style={{ fontSize: 12, color: "#888" }}>
            Sync this file to your Mac to view it below, then refresh the page.
          </div>
        </div>
      )}

      {/* Reference 3D viewer (+ result if available) */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 10,
            background: "rgba(0,0,0,0.7)", color: "#e67e22", padding: "4px 10px",
            borderRadius: 4, fontSize: 11, fontWeight: 600,
          }}>
            Reference
          </div>
          <div style={{ height: 400, background: "#111", borderRadius: 8, overflow: "hidden" }}>
            <ModelViewer url={getStaticUrl(reference.path)} />
          </div>
        </div>

        {/* Result viewer */}
        {resultUrl && (
          <div style={{ flex: 1, position: "relative" }}>
            <div style={{
              position: "absolute", top: 8, left: 8, zIndex: 10,
              background: "rgba(0,0,0,0.7)", color: "#5cb85c", padding: "4px 10px",
              borderRadius: 4, fontSize: 11, fontWeight: 600,
            }}>
              Result
            </div>
            <div style={{ height: 400, background: "#111", borderRadius: 8, overflow: "hidden" }}>
              <ModelViewer url={resultUrl} />
            </div>
          </div>
        )}

        {/* Target preview for 3d-render */}
        {!resultUrl && targetType === "3d-render" && selectedTarget && (
          <div style={{ flex: 1, position: "relative" }}>
            <div style={{
              position: "absolute", top: 8, left: 8, zIndex: 10,
              background: "rgba(0,0,0,0.7)", color: "#4a9eff", padding: "4px 10px",
              borderRadius: 4, fontSize: 11, fontWeight: 600,
            }}>
              Target
            </div>
            <div style={{ height: 400, background: "#111", borderRadius: 8, overflow: "hidden", position: "relative" }}>
              <Canvas camera={{ position: [2, 1.5, 2], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <directionalLight position={[-3, 2, -3]} intensity={0.5} />
                <Center>
                  <ModelLoader url={getStaticUrl(selectedTarget.path)} />
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
        )}
      </div>

      {/* Captured view preview */}
      {capturedView && targetType === "3d-render" && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Captured view:</div>
          <img src={capturedView} alt="Captured" style={{ height: 150, borderRadius: 6, border: "1px solid #333" }} />
        </div>
      )}

      {/* Target type selector */}
      <section style={{ marginBottom: 24, padding: 20, background: "#111", borderRadius: 8, border: "1px solid #222" }}>
        <h2 style={{ fontSize: 16, marginBottom: 12, color: "#ccc" }}>Choose Target</h2>
        <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid #222" }}>
          <button
            onClick={() => setTargetType("text")}
            style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: targetType === "text" ? "2px solid #4a9eff" : "2px solid transparent",
              color: targetType === "text" ? "#fff" : "#888",
              cursor: "pointer", fontSize: 13, fontWeight: targetType === "text" ? 600 : 400,
            }}
          >
            Text Prompt
          </button>
          <button
            onClick={() => setTargetType("3d-render")}
            style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: targetType === "3d-render" ? "2px solid #4a9eff" : "2px solid transparent",
              color: targetType === "3d-render" ? "#fff" : "#888",
              cursor: "pointer", fontSize: 13, fontWeight: targetType === "3d-render" ? 600 : 400,
            }}
          >
            3D Model (render to image)
          </button>
          <button
            onClick={() => setTargetType("3d-direct")}
            style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: targetType === "3d-direct" ? "2px solid #4a9eff" : "2px solid transparent",
              color: targetType === "3d-direct" ? "#fff" : "#666",
              cursor: "pointer", fontSize: 13, fontWeight: targetType === "3d-direct" ? 600 : 400,
              opacity: 0.5,
            }}
            disabled
          >
            3D Model (direct — coming soon)
          </button>
        </div>

        {/* Text prompt target */}
        {targetType === "text" && (
          <div>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              Describe what to deform the reference mesh toward using MeshUp (CLIP + SDS).
            </p>

            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {MESHUP_TEMPLATES.map((t) => (
                <button key={t.name} onClick={() => setPrompt(t.prompt)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
                    background: prompt === t.prompt ? "#4a9eff" : "#1a1a1a",
                    border: "1px solid #333", color: prompt === t.prompt ? "#fff" : "#aaa",
                  }}>
                  {t.name}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the target shape..."
              rows={3}
              style={{ width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13, marginBottom: 12, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <div style={{ width: 200 }}>
                <label style={{ fontSize: 11, color: "#666" }}>Iterations: {iterations}</label>
                <input type="range" min={100} max={1500} step={100} value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))} style={{ width: "100%" }} />
              </div>
              <button
                onClick={handleRunTransfer}
                disabled={!prompt || running}
                style={{
                  padding: "10px 28px",
                  background: prompt && !running ? "#4a9eff" : "#333",
                  border: "none", color: "#fff", borderRadius: 6,
                  cursor: running ? "wait" : "pointer", fontSize: 14,
                }}
              >
                {running ? "Running MeshUp..." : "Run Style Transfer"}
              </button>
            </div>
          </div>
        )}

        {/* 3D model target (render to image) */}
        {targetType === "3d-render" && (
          <div>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
              Select a target 3D model. Rotate it to a good angle, capture a view, then style it with the reference.
            </p>

            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {targetCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setTargetCategory(cat)}
                  style={{
                    padding: "4px 12px", fontSize: 11, borderRadius: 16, cursor: "pointer",
                    background: targetCategory === cat ? "#4a9eff" : "#1a1a1a",
                    border: "1px solid #333",
                    color: targetCategory === cat ? "#fff" : "#aaa",
                  }}
                >
                  {cat.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 8,
              maxHeight: 300,
              overflowY: "auto",
              marginBottom: 16,
            }}>
              {filteredTargets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTarget(t)}
                  style={{
                    padding: 10, cursor: "pointer", borderRadius: 6,
                    background: selectedTarget?.id === t.id ? "#1a1a2e" : "#0a0a0a",
                    border: selectedTarget?.id === t.id ? "2px solid #4a9eff" : "1px solid #222",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: "#666" }}>{t.category}</div>
                </div>
              ))}
            </div>

            {selectedTarget && capturedView && (
              <div style={{ marginTop: 16, padding: 16, background: "#0a0a0a", borderRadius: 8, border: "1px solid #222" }}>
                <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>Style prompt</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  {IMAGE_STYLE_TEMPLATES.map((t) => (
                    <button key={t.name} onClick={() => { setStylePrompt(t.prompt); setNegPrompt(t.negative_prompt); }}
                      style={{
                        padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
                        background: stylePrompt === t.prompt ? "#4a9eff" : "#1a1a1a",
                        border: "1px solid #333", color: stylePrompt === t.prompt ? "#fff" : "#aaa",
                      }}>
                      {t.name}
                    </button>
                  ))}
                </div>
                <textarea
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  placeholder="Describe the style to apply..."
                  rows={2}
                  style={{ width: "100%", padding: 10, background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13, marginBottom: 10, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, color: "#666" }}>Negative prompt</label>
                    <input value={negPrompt} onChange={(e) => setNegPrompt(e.target.value)}
                      style={{ width: "100%", padding: 6, background: "#111", border: "1px solid #333", color: "#aaa", borderRadius: 4, fontSize: 12 }} />
                  </div>
                  <div style={{ width: 120 }}>
                    <label style={{ fontSize: 11, color: "#666" }}>Strength {strength}</label>
                    <input type="range" min={0.1} max={0.9} step={0.05} value={strength}
                      onChange={(e) => setStrength(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                  <button
                    onClick={handleRunTransfer}
                    disabled={!stylePrompt || running}
                    style={{
                      padding: "10px 28px",
                      background: stylePrompt && !running ? "#4a9eff" : "#333",
                      border: "none", color: "#fff", borderRadius: 6,
                      cursor: running ? "wait" : "pointer", fontSize: 14, whiteSpace: "nowrap",
                    }}
                  >
                    {running ? "Styling + Reconstructing..." : "Run Style Transfer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3D-to-3D (future) */}
        {targetType === "3d-direct" && (
          <div style={{ padding: 20, textAlign: "center", color: "#666" }}>
            <p>Direct 3D-to-3D style transfer is coming soon.</p>
            <p style={{ fontSize: 12 }}>This will use neural style transfer directly between 3D meshes.</p>
          </div>
        )}
      </section>
    </div>
  );
}
