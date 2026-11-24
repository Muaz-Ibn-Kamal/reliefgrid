// Kept separate from _map.tsx so server-rendered code never imports Leaflet (which touches `window`).
export const PRIORITY_COLOR: Record<string, string> = { CRITICAL: "#D55E00", HIGH: "#E69F00", MEDIUM: "#0072B2", LOW: "#009E73" };
