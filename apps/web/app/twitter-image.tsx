import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background:
          "radial-gradient(circle at 18% 18%, #f3d7bc, transparent 34%), radial-gradient(circle at 86% 8%, #d2e7e5, transparent 29%), #f7f4ee",
        fontFamily: "Arial, sans-serif",
        color: "#2f241d",
        padding: 60,
        justifyContent: "space-between",
      }}
    >
      <div style={{ width: 700, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "inline-flex",
            alignSelf: "flex-start",
            padding: "7px 13px",
            borderRadius: 999,
            background: "#9a5425",
            color: "#fff7ef",
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 18,
          }}
        >
          City Map Poster Generator
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 64,
            lineHeight: 1.03,
            letterSpacing: -1,
          }}
        >
          Generate map posters
          <br />
          people want to share
        </h1>
        <p
          style={{
            marginTop: 18,
            fontSize: 30,
            lineHeight: 1.24,
            color: "#5c4a3f",
          }}
        >
          No signup. Built-in themes. Export-ready in PNG, SVG, PDF.
        </p>
      </div>
      <div
        style={{
          width: 320,
          height: 480,
          borderRadius: 18,
          border: "1px solid #d9c8b8",
          background:
            "linear-gradient(160deg, #f5efe6 0%, #f4ede2 42%, #efe6da 100%)",
          boxShadow: "0 16px 42px rgba(80, 50, 28, 0.12)",
        }}
      />
    </div>,
    size,
  );
}
