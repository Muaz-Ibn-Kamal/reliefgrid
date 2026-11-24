// Kept separate from _map.tsx so server-rendered code never imports Leaflet (which touches `window`).
export const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#d03b3b", HIGH: "#ec835a", MEDIUM: "#fab219", LOW: "#0ca30c" };
