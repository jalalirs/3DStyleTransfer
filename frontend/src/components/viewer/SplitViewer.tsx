import { ModelViewer } from "./ModelViewer";

interface SplitViewerProps {
  models: { url: string; label: string }[];
}

export function SplitViewer({ models }: SplitViewerProps) {
  const cols = models.length <= 2 ? models.length : 2;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 8,
        width: "100%",
        height: "100%",
      }}
    >
      {models.map((m, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            border: "1px solid #333",
            borderRadius: 8,
            overflow: "hidden",
            minHeight: 350,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 10,
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            {m.label}
          </div>
          <ModelViewer url={m.url} />
        </div>
      ))}
    </div>
  );
}
