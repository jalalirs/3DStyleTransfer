import { Link, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Models", icon: "🕌" },
  { path: "/jobs", label: "Jobs", icon: "⚙" },
  { path: "/new-job", label: "New Job", icon: "+" },
  { path: "/compare", label: "Compare", icon: "⇔" },
];

export function MainLayout() {
  const location = useLocation();

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0a0a0a", color: "#e0e0e0" }}>
      {/* Sidebar */}
      <nav
        style={{
          width: 220,
          borderRight: "1px solid #222",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div style={{ padding: "0 16px 20px", borderBottom: "1px solid #222" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#fff" }}>3D Style Transfer</h2>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>
            Islamic Architecture
          </p>
        </div>
        <div style={{ padding: "12px 0", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 16px",
                  color: active ? "#fff" : "#999",
                  background: active ? "#1a1a2e" : "transparent",
                  borderRight: active ? "2px solid #4a9eff" : "2px solid transparent",
                  textDecoration: "none",
                  fontSize: 14,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}
