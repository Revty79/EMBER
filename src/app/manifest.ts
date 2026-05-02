import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EMBER",
    short_name: "EMBER",
    description: "Enhanced Memory Backbone for Everyday Reasoning",
    start_url: "/",
    display: "standalone",
    background_color: "#15110f",
    theme_color: "#15110f",
    icons: [
      {
        src: "/ember-app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/ember-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/ember-app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
