import { useEffect, useState, useRef, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import { ModelLoader } from "../components/viewer/ModelLoader";
import { listModels } from "../api/models";
import { getModelUrl } from "../api/client";
import {
  createSession,
  uploadSnapshot,
  getPromptTemplates,
  stylizeSnapshots,
  reconstructModel,
  snapshotUrl,
  styledUrl,
  reconstructionUrl,
  type WorkshopSession,
  type PromptTemplate,
} from "../api/workshop";
import { ModelViewer } from "../components/viewer/ModelViewer";
import type { Model3D } from "../types/model";

// Component to capture canvas screenshots
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

export function WorkshopPage() {
  const [step, setStep] = useState<"select" | "capture" | "prompt" | "style" | "styling" | "reconstruct" | "reconstructing" | "done">("select");
  const [models, setModels] = useState<Model3D[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model3D | null>(null);
  const [session, setSession] = useState<WorkshopSession | null>(null);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [prompt, setPrompt] = useState("");
  const [negPrompt, setNegPrompt] = useState("blurry, low quality, distorted, modern, plastic");
  const [strength, setStrength] = useState(0.6);
  const [selectedStyleIndex, setSelectedStyleIndex] = useState(0);
  const [error, setError] = useState("");

  const captureRef = useRef<(() => Promise<Blob>) | null>(null);

  useEffect(() => {
    listModels().then((ms) => setModels(ms.filter((m) => m.source === "builtin")));
    getPromptTemplates().then(setTemplates);
  }, []);

  const handleCapture = useCallback((fn: () => Promise<Blob>) => {
    captureRef.current = fn;
  }, []);

  async function startSession() {
    if (!selectedModel) return;
    const s = await createSession(selectedModel.id, selectedModel.name);
    setSession(s);
    setStep("capture");
  }

  async function takeSnapshot() {
    if (!session || !captureRef.current) return;
    const blob = await captureRef.current();
    const result = await uploadSnapshot(session.id, blob);
    setSession({ ...session, snapshots: [...session.snapshots, { index: result.index, filename: "" }] });
  }

  async function goToPrompt() {
    if (!session || session.snapshots.length === 0) return;
    setStep("prompt");
  }

  function selectTemplate(t: PromptTemplate) {
    setPrompt(t.prompt);
    setNegPrompt(t.negative_prompt);
  }

  async function runStylize() {
    if (!session || !prompt) return;
    setStep("styling");
    setError("");
    try {
      const updated = await stylizeSnapshots(session.id, prompt, negPrompt, strength);
      setSession(updated);
      setStep("style");
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
      setStep("prompt");
    }
  }

  async function runReconstruct() {
    if (!session) return;
    setStep("reconstructing");
    setError("");
    try {
      const updated = await reconstructModel(session.id, "triposr", selectedStyleIndex);
      setSession(updated);
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.detail || String(e));
      setStep("style");
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>Design Workshop</h1>

      {/* Step indicator */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {["select", "capture", "prompt", "style", "reconstruct"].map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: step === s || (["styling", "reconstructing", "done"].includes(step) && i <= 4) ? "#4a9eff" : "#222",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600,
              }}
            >
              {i + 1}
            </div>
            <span style={{ fontSize: 12, color: "#888", marginRight: 12 }}>
              {["Model", "Capture", "Prompt", "Style", "3D"][i]}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ padding: 12, background: "#2a1a1a", border: "1px solid #d9534f", borderRadius: 8, marginBottom: 16, fontSize: 13, color: "#ff8888" }}>
          {error}
        </div>
      )}

      {/* Step 1: Select Model */}
      {step === "select" && (
        <div>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Select a model</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, marginBottom: 20 }}>
            {models.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m)}
                style={{
                  padding: 12, cursor: "pointer", borderRadius: 8,
                  background: selectedModel?.id === m.id ? "#1a1a2e" : "#111",
                  border: selectedModel?.id === m.id ? "1px solid #4a9eff" : "1px solid #222",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{m.category}</div>
              </div>
            ))}
          </div>
          {selectedModel && (
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ flex: 1, height: 400, background: "#111", borderRadius: 8, overflow: "hidden" }}>
                <ModelViewer url={getModelUrl(selectedModel.file_path)} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button onClick={startSession} style={{ padding: "12px 32px", background: "#4a9eff", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 15 }}>
                  Start Workshop
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Capture Views */}
      {step === "capture" && selectedModel && session && (
        <div>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 8 }}>
            Rotate the model and capture {4 - session.snapshots.length} more views
          </h3>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>
            Rotate to a good angle, then click "Capture View". Get front, side, back, and 3/4 views.
          </p>

          <div style={{ display: "flex", gap: 20 }}>
            {/* 3D Viewer with capture */}
            <div style={{ flex: 1, height: 500, background: "#111", borderRadius: 8, overflow: "hidden", position: "relative" }}>
              <Canvas
                camera={{ position: [2, 1.5, 2], fov: 50 }}
                gl={{ preserveDrawingBuffer: true }}
              >
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <directionalLight position={[-3, 2, -3]} intensity={0.5} />
                <Center>
                  <ModelLoader url={getModelUrl(selectedModel.file_path)} />
                </Center>
                <OrbitControls makeDefault />
                <Environment preset="city" />
                <CanvasCapture onCapture={handleCapture} />
              </Canvas>

              <button
                onClick={takeSnapshot}
                style={{
                  position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                  padding: "10px 28px", background: "#4a9eff", border: "none", color: "#fff",
                  borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                Capture View ({session.snapshots.length}/4)
              </button>
            </div>

            {/* Captured snapshots */}
            <div style={{ width: 200, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Captured Views</div>
              {session.snapshots.map((_, i) => (
                <div key={i} style={{ background: "#111", borderRadius: 6, overflow: "hidden", border: "1px solid #333" }}>
                  <img
                    src={snapshotUrl(session.id, i)}
                    alt={`View ${i}`}
                    style={{ width: "100%", display: "block" }}
                  />
                </div>
              ))}
              {session.snapshots.length >= 1 && (
                <button
                  onClick={goToPrompt}
                  style={{
                    marginTop: 8, padding: "10px 0", background: "#4a9eff", border: "none",
                    color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13,
                  }}
                >
                  Next: Choose Style
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Prompt */}
      {step === "prompt" && session && (
        <div>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Choose a style</h3>

          {/* Template buttons */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => selectTemplate(t)}
                style={{
                  padding: 14, cursor: "pointer", borderRadius: 8, textAlign: "center",
                  background: prompt === t.prompt ? "#1a1a2e" : "#111",
                  border: prompt === t.prompt ? "2px solid #4a9eff" : "1px solid #222",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "#888", lineHeight: 1.4 }}>{t.prompt.slice(0, 60)}...</div>
              </div>
            ))}
          </div>

          {/* Custom prompt */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 4 }}>Style Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              style={{ width: "100%", padding: 10, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13, resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 4 }}>Negative Prompt</label>
              <input
                value={negPrompt}
                onChange={(e) => setNegPrompt(e.target.value)}
                style={{ width: "100%", padding: 8, background: "#0a0a0a", border: "1px solid #333", color: "#fff", borderRadius: 6, fontSize: 13 }}
              />
            </div>
            <div style={{ width: 150 }}>
              <label style={{ fontSize: 13, color: "#aaa", display: "block", marginBottom: 4 }}>Strength ({strength})</label>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Preview snapshots */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {session.snapshots.map((_, i) => (
              <img key={i} src={snapshotUrl(session.id, i)} alt={`View ${i}`} style={{ width: 120, borderRadius: 6, border: "1px solid #333" }} />
            ))}
          </div>

          <button
            onClick={runStylize}
            disabled={!prompt}
            style={{
              padding: "12px 40px", background: prompt ? "#4a9eff" : "#333", border: "none",
              color: "#fff", borderRadius: 8, cursor: prompt ? "pointer" : "default", fontSize: 15,
            }}
          >
            Generate Styled Views
          </button>
        </div>
      )}

      {/* Step 3.5: Styling in progress */}
      {step === "styling" && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>Generating styled views with Gemini...</div>
          <div style={{ fontSize: 13, color: "#888" }}>This may take 30-60 seconds</div>
        </div>
      )}

      {/* Step 4: Review styled images */}
      {step === "style" && session && (
        <div>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Styled Results</h3>

          {/* Before/After */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${session.snapshots.length}, 1fr)`, gap: 10, marginBottom: 24 }}>
            {session.snapshots.map((_, i) => (
              <div key={i} style={{ background: "#111", borderRadius: 8, overflow: "hidden", border: "1px solid #222" }}>
                <div style={{ display: "flex" }}>
                  <img src={snapshotUrl(session.id, i)} alt="Original" style={{ width: "50%" }} />
                  <img src={styledUrl(session.id, i)} alt="Styled" style={{ width: "50%" }} />
                </div>
                <div style={{ display: "flex", fontSize: 11, color: "#666", textAlign: "center" }}>
                  <div style={{ flex: 1, padding: 4 }}>Original</div>
                  <div style={{ flex: 1, padding: 4 }}>Styled</div>
                </div>
              </div>
            ))}
          </div>

          {/* Full styled images */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${session.styled.length}, 1fr)`, gap: 10, marginBottom: 24 }}>
            {session.styled.map((_, i) => (
              <div
                key={i}
                onClick={() => setSelectedStyleIndex(i)}
                style={{
                  borderRadius: 8, overflow: "hidden", cursor: "pointer",
                  border: selectedStyleIndex === i ? "2px solid #4a9eff" : "1px solid #222",
                }}
              >
                <img src={styledUrl(session.id, i)} alt={`Styled ${i}`} style={{ width: "100%", display: "block" }} />
                <div style={{ padding: 6, fontSize: 11, color: "#888", textAlign: "center", background: "#111" }}>
                  {selectedStyleIndex === i ? "Selected for 3D" : `View ${i}`}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => setStep("prompt")}
              style={{ padding: "10px 24px", background: "#222", border: "1px solid #333", color: "#aaa", borderRadius: 8, cursor: "pointer" }}
            >
              Try Different Style
            </button>
            <button
              onClick={runReconstruct}
              style={{ padding: "12px 40px", background: "#4a9eff", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 15 }}
            >
              Generate 3D Model
            </button>
          </div>
        </div>
      )}

      {/* Step 4.5: Reconstructing */}
      {step === "reconstructing" && (
        <div style={{ textAlign: "center", padding: 80 }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>Reconstructing 3D model...</div>
          <div style={{ fontSize: 13, color: "#888" }}>Running TripoSR on GPU — may take 15-30 seconds</div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && session && selectedModel && (
        <div>
          <h3 style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Result</h3>

          {/* Side by side 3D */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
            <div style={{ background: "#111", borderRadius: 8, overflow: "hidden", height: 450, position: "relative" }}>
              <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 12 }}>
                Original
              </div>
              <ModelViewer url={getModelUrl(selectedModel.file_path)} />
            </div>
            <div style={{ background: "#111", borderRadius: 8, overflow: "hidden", height: 450, position: "relative" }}>
              <div style={{ position: "absolute", top: 8, left: 8, zIndex: 10, background: "rgba(0,0,0,0.7)", color: "#fff", padding: "4px 10px", borderRadius: 4, fontSize: 12 }}>
                Styled 3D
              </div>
              <ModelViewer url={reconstructionUrl(session.id)} />
            </div>
          </div>

          {/* Styled image used */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Source styled image:</div>
            <img src={styledUrl(session.id, selectedStyleIndex)} alt="Source" style={{ height: 200, borderRadius: 8, border: "1px solid #333" }} />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => { setStep("style"); }}
              style={{ padding: "10px 24px", background: "#222", border: "1px solid #333", color: "#aaa", borderRadius: 8, cursor: "pointer" }}
            >
              Try Different View
            </button>
            <button
              onClick={() => { setSession(null); setSelectedModel(null); setStep("select"); setPrompt(""); }}
              style={{ padding: "10px 24px", background: "#222", border: "1px solid #333", color: "#aaa", borderRadius: 8, cursor: "pointer" }}
            >
              New Workshop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
