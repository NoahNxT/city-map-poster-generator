import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        background:
          "radial-gradient(circle at 20% 20%, #f3d7bc, transparent 35%), radial-gradient(circle at 85% 10%, #d2e7e5, transparent 30%), #f7f4ee",
        color: "#2f241d",
        padding: 56,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 56,
          width: 360,
          height: 480,
          borderRadius: 18,
          border: "1px solid #d9c8b8",
          overflow: "hidden",
          background: "#f4eee4",
          boxShadow: "0 18px 48px rgba(80, 50, 28, 0.12)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            height: 360,
            background:
              "linear-gradient(160deg, #f5efe6 0%, #f4ede2 42%, #efe6da 100%)",
            borderBottom: "1px solid #e1d4c6",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(24deg, transparent 0 9px, rgba(163,99,58,0.16) 9px 11px)",
              opacity: 0.45,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -30,
              right: -30,
              top: 140,
              height: 52,
              background: "#9fced5",
              transform: "rotate(-10deg)",
              opacity: 0.9,
            }}
          />
        </div>
        <div
          style={{
            padding: "20px 24px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "#8d4b1a",
          }}
        >
          <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 12 }}>
            PARIS
          </div>
          <div style={{ fontSize: 28, fontWeight: 400 }}>FRANCE</div>
        </div>
      </div>
      <div style={{ width: 690, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "8px 14px",
            borderRadius: 999,
            background: "#9a5425",
            color: "#fff7ef",
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          City Map Poster Generator
        </div>
        <h1
          style={{
            fontSize: 68,
            lineHeight: 1.02,
            margin: 0,
            letterSpacing: -1,
          }}
        >
          Design city map
          <br />
          posters in minutes
        </h1>
        <p
          style={{
            marginTop: 20,
            fontSize: 30,
            lineHeight: 1.25,
            color: "#5c4a3f",
          }}
        >
          Themes, typography controls, and export-ready PNG, SVG, PDF.
        </p>
      </div>
    </div>,
    size,
  );
}
