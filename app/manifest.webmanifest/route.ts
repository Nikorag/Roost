export function GET() {
  const manifest = {
    name: "Roost — Household projects",
    short_name: "Roost",
    description: "Plan and track every household project in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf8f4",
    theme_color: "#cdeedd",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
