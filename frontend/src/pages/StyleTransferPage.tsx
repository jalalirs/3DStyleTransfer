import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { getStaticUrl } from "../api/client";
import { getConfig, type ModelEntry } from "../api/config";
import { runMeshUp } from "../api/meshup";
import { runImageStyleTransfer } from "../api/styleTransfer";
import { ModelViewer } from "../components/viewer/ModelViewer";

type TransferMethod = "meshup" | "image-style" | "3d-to-3d";

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
    prompt: "Using this geometric pattern as the repeating decorative motif, create a photorealistic building facade section. The wall surface, window surrounds, and cornices should incorporate this pattern as carved relief and screen cutouts. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Dome",
    prompt: "Using this geometric pattern as the repeating motif, create a photorealistic dome on a cylindrical drum base. The pattern radiates from the crown and repeats around the circumference. Photorealistic stone material, studio lighting, clean white background.",
    negative_prompt: "blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface",
  },
  {
    name: "Ottoman Iznik",
    prompt: "Transform this pattern into Ottoman Iznik tile style — cobalt blue, turquoise, and red floral motifs covering the surface as a decorative panel. Photorealistic glazed ceramic material, studio lighting.",
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

export function StyleTransferPage() {
  const { refId } = useParams<{ refId: string }>();

  const [reference, setReference] = useState<ModelEntry | null>(null);
  const [method, setMethod] = useState<TransferMethod>("image-style");

  // MeshUp state
  const [meshupPrompt, setMeshupPrompt] = useState("");
  const [iterations, setIterations] = useState(500);

  // Image style state
  const [stylePrompt, setStylePrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, flat, 2D, cartoon, plain smooth surface");
  const [strength, setStrength] = useState(0.6);
  const [capturedView, setCapturedView] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  // Shared state
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [resultInfo, setResultInfo] = useState<{ output_path: string; styled_image_path?: string } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const captureRef = useRef<(() => Promise<Blob>) | null>(null);
  const handleCapture = useCallback((fn: () => Promise<Blob>) => { captureRef.current = fn; }, []);

  useEffect(() => {
    loadConfig();
  }, [refId]);

  async function loadConfig() {
    try {
      const cfg = await getConfig();
      setReference(cfg.references.find((r) => r.id === refId) || null);
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

  async function handleRun() {
    if (!reference) return;
    setRunning(true);
    setError("");
    setCompleted(false);
    setResultInfo(null);
    setResultUrl(null);

    try {
      if (method === "meshup") {
        if (!meshupPrompt) { setError("Enter a text prompt."); setRunning(false); return; }
        const res = await runMeshUp(reference.path, meshupPrompt, iterations);
        setResultInfo({ output_path: res.output_path });
        setResultUrl(getStaticUrl(res.output_path));
      } else if (method === "image-style") {
        if (!capturedBlob) { setError("Capture a view of the reference model first."); setRunning(false); return; }
        if (!stylePrompt) { setError("Enter a style prompt."); setRunning(false); return; }
        const res = await runImageStyleTransfer(capturedBlob, stylePrompt, negPrompt, strength);
        setResultInfo({ output_path: res.output_path, styled_image_path: res.styled_image_path });
        setResultUrl(getStaticUrl(res.output_path));
      } else {
        setError("3D-to-3D transfer is not yet available.");
        setRunning(false);
        return;
      }
      setCompleted(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail || String(e));
    }
    setRunning(false);
  }

  if (!reference) return <p style={{ color: "#888" }}>Loading reference model...</p>;

  return (
    <div>
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
            Sync this file to your Mac to view it, then refresh the page.
          </div>
        </div>
      )}

      {/* 3D Viewer — reference model with capture */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 10,
            background: "rgba(0,0,0,0.7)", color: "#e67e22", padding: "4px 10px",
            borderRadius: 4, fontSize: 11, fontWeight: 600,
          }}>
            Reference
          </div>
          <div style={{ height: 400, background: "#111", borderRadius: 8, overflow: "hidden", position: "relative" }}>
            <Canvas camera={{ position: [2, 1.5, 2], fov: 50 }} gl={{ preserveDrawingBuffer: true }}>
              <ambientLight intensity={0.4} />
              <directionalLight position={[5, 5, 5]} intensity={1} />
              <directionalLight position={[-3, 2, -3]} intensity={0.5} />
              <Center>
                <ModelLoader url={getStaticUrl(reference.path)} />
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

        {/* Captured view preview */}
        {method === "image-style" && capturedView && (
          <div style={{ width: 300 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>Captured view:</div>
            <img src={capturedView} alt="Captured" style={{ width: "100%", borderRadius: 8, border: "1px solid #333" }} />
          </div>
        )}

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
      </div>

      {/* Method tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 0, borderBottom: "1px solid #222" }}>
        {[
          { id: "image-style" as TransferMethod, label: "Image + Prompt (Gemini → TRELLIS)" },
          { id: "meshup" as TransferMethod, label: "Text Prompt (MeshUp)" },
          { id: "3d-to-3d" as TransferMethod, label: "3D-to-3D (coming soon)" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => m.id !== "3d-to-3d" && setMethod(m.id)}
            disabled={m.id === "3d-to-3d"}
            style={{
              padding: "10px 20px", background: "transparent", border: "none",
              borderBottom: method === m.id ? "2px solid #4a9eff" : "2px solid transparent",
              color: m.id === "3d-to-3d" ? "#444" : method === m.id ? "#fff" : "#888",
              cursor: m.id === "3d-to-3d" ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: method === m.id ? 600 : 400,
              opacity: m.id === "3d-to-3d" ? 0.5 : 1,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Image + Prompt panel */}
      {method === "image-style" && (
        <section style={{ padding: 20, background: "#111", borderRadius: "0 0 8px 8px", border: "1px solid #222", borderTop: "none", marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Capture a view of the reference model above, then describe what architectural element to create from it.
            Gemini will style the image, then TRELLIS reconstructs it into 3D.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
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
            placeholder="Describe what to create from this reference pattern..."
            rows={3}
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
              onClick={handleRun}
              disabled={!capturedBlob || !stylePrompt || running}
              style={{
                padding: "10px 28px",
                background: capturedBlob && stylePrompt && !running ? "#4a9eff" : "#333",
                border: "none", color: "#fff", borderRadius: 6,
                cursor: running ? "wait" : "pointer", fontSize: 14, whiteSpace: "nowrap",
              }}
            >
              {running ? "Styling + Reconstructing..." : "Run Style Transfer"}
            </button>
          </div>
        </section>
      )}

      {/* MeshUp panel */}
      {method === "meshup" && (
        <section style={{ padding: 20, background: "#111", borderRadius: "0 0 8px 8px", border: "1px solid #222", borderTop: "none", marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Describe what to deform the reference mesh toward using MeshUp (CLIP + SDS). No image capture needed.
          </p>

          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {MESHUP_TEMPLATES.map((t) => (
              <button key={t.name} onClick={() => setMeshupPrompt(t.prompt)}
                style={{
                  padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
                  background: meshupPrompt === t.prompt ? "#4a9eff" : "#1a1a1a",
                  border: "1px solid #333", color: meshupPrompt === t.prompt ? "#fff" : "#aaa",
                }}>
                {t.name}
              </button>
            ))}
          </div>

          <textarea
            value={meshupPrompt}
            onChange={(e) => setMeshupPrompt(e.target.value)}
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
              onClick={handleRun}
              disabled={!meshupPrompt || running}
              style={{
                padding: "10px 28px",
                background: meshupPrompt && !running ? "#4a9eff" : "#333",
                border: "none", color: "#fff", borderRadius: 6,
                cursor: running ? "wait" : "pointer", fontSize: 14,
              }}
            >
              {running ? "Running MeshUp..." : "Run Style Transfer"}
            </button>
          </div>
        </section>
      )}

      {/* 3D-to-3D placeholder */}
      {method === "3d-to-3d" && (
        <section style={{ padding: 40, background: "#111", borderRadius: "0 0 8px 8px", border: "1px solid #222", borderTop: "none", marginBottom: 24, textAlign: "center", color: "#666" }}>
          <p>Direct 3D-to-3D style transfer is coming soon.</p>
          <p style={{ fontSize: 12 }}>Reference 3D + Target 3D → Styled 3D using neural style transfer.</p>
        </section>
      )}
    </div>
  );
}
