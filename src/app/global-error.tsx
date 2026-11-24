"use client"; // Replaces the root layout when it fails, so it renders its own <html> and <body>.

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div role="alert" style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>ReliefGrid could not load</h1>
          <p style={{ color: "#475569" }}>A temporary problem stopped the application from starting. Please try again.</p>
          <button onClick={() => retry()} style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: 0, background: "#c2410c", color: "#fff", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
