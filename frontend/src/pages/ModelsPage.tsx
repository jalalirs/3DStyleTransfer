import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getConfig, type ModelEntry } from "../api/config";
import { getStaticUrl } from "../api/client";
import { ModelViewer } from "../components/viewer/ModelViewer";

export function ModelsPage() {
  const [references, setReferences] = useState<ModelEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const cfg = await getConfig();
      setReferences(cfg.references);
    } catch (e) {
      console.error("Failed to load config:", e);
    }
    setLoading(false);
  }

  const categories = ["all", ...Array.from(new Set(references.map((r) => r.category)))];
  const filtered = selectedCategory === "all"
    ? references
    : references.filter((r) => r.category === selectedCategory);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Reference Models</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#888" }}>
          Select a style reference to begin style transfer
        </p>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {categories.map((cat) => (
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
            {cat.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "#888" }}>Loading...</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((ref) => (
            <div
              key={ref.id}
              onClick={() => navigate(`/transfer/${encodeURIComponent(ref.id)}`)}
              onMouseEnter={() => setHoveredId(ref.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                background: "#111",
                border: hoveredId === ref.id ? "1px solid #4a9eff" : "1px solid #222",
                borderRadius: 10,
                overflow: "hidden",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {/* 3D preview */}
              <div style={{ height: 200, background: "#0a0a0a", pointerEvents: "none" }}>
                <ModelViewer url={getStaticUrl(ref.path)} />
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
                  {ref.name}
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
                  {ref.description}
                </div>
                <div style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  fontSize: 10,
                  color: "#4a9eff",
                  background: "#1a1a2e",
                  borderRadius: 10,
                }}>
                  {ref.category}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p style={{ color: "#666" }}>No reference models found. Check backend connection.</p>
          )}
        </div>
      )}
    </div>
  );
}
