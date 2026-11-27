import Link from "next/link";

const BEAMS = [
  { x: 230, y: 250, c: "#ff5c5c" },
  { x: 400, y: 180, c: "#ff5c5c" },
  { x: 340, y: 400, c: "#ff5c5c" },
  { x: 450, y: 330, c: "#ff9a6b" },
  { x: 160, y: 360, c: "#fab219" },
  { x: 300, y: 300, c: "#3ddc84" },
];

/** The left half of the sign-in and register pages: a slowly turning 3D map with incident beacons, the logo and the pitch. */
export function AuthHero({ title, text }: { title: string; text: string }) {
  return (
    <section className="ag-hero">
      <div className="ag-scene" aria-hidden="true">
        <div className="ag-floor">
          <div className="ag-grid" />
          <div className="ag-ring r1" />
          <div className="ag-ring r2" />
          <div className="ag-ping" />
          <div className="ag-ping late" />
          <div className="ag-sweep" />
          {BEAMS.map((b) => (
            <div key={`${b.x}-${b.y}`} className="ag-beam" style={{ left: b.x, top: b.y }}>
              <div className="mast" style={{ background: `linear-gradient(to top, ${b.c}, rgba(255,255,255,0))` }}>
                <div className="tip" style={{ background: b.c }} />
              </div>
              <div className="foot" style={{ background: b.c }} />
            </div>
          ))}
        </div>
      </div>
      <Link href="/login" className="ag-brand">
        <svg width="28" height="28" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" rx="3" fill="#ff5c5c" />
          <rect x="15" y="1" width="10" height="10" rx="3" fill="#5aa2ff" />
          <rect x="1" y="15" width="10" height="10" rx="3" fill="#fab219" />
          <rect x="15" y="15" width="10" height="10" rx="3" fill="#3ddc84" />
        </svg>
        ReliefGrid
      </Link>
      <div className="ag-copy">
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      <div className="ag-spacer" />
    </section>
  );
}
