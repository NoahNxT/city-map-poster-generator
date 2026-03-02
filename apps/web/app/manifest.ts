import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "City Map Poster Generator",
    short_name: "Map Posters",
    description:
      "Generate and export beautiful city map posters online in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#ede6db",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
