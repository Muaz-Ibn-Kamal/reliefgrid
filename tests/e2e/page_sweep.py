"""Opens every page as each of the five demo roles (desktop) plus public pages on mobile, and reports JS errors,
console errors, 5xx responses and error screens. Usage: BASE_URL=... PSQL_URL=... python tests/e2e/page_sweep.py"""
import json, os, subprocess
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/"); PW = "ReliefGrid@2026"
q = lambda sql: subprocess.check_output(["psql", os.environ["PSQL_URL"], "-Atc", sql]).decode().strip()
INC = q('select id from "Incident" order by "priorityScore" desc limit 1')
SH = q("select s.id from \"Shelter\" s join \"User\" u on u.id=s.\"managerId\" where u.email='shelter@reliefgrid.demo' limit 1")
PLAN = {
    "admin@reliefgrid.demo": ["/dashboard", "/incidents", f"/incidents/{INC}", "/incidents/new", "/requests", "/resources", "/allocations", "/shelters", f"/shelters/{SH}", "/volunteers", "/teams", "/map", "/reports", "/users", "/profile"],
    "coordinator@reliefgrid.demo": ["/dashboard", "/requests", "/allocations", "/volunteers"],
    "org@reliefgrid.demo": ["/dashboard", "/resources", "/allocations", "/requests", "/teams"],
    "volunteer@reliefgrid.demo": ["/dashboard", "/tasks", "/teams", "/map", "/profile", "/incidents"],
    "shelter@reliefgrid.demo": ["/dashboard", "/shelters", f"/shelters/{SH}", "/map"],
}
own = lambda r: r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith("data:") else r.abort()  # offline: skip map tiles
report = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for email, paths in PLAN.items():
        ctx = b.new_context(viewport={"width": 1366, "height": 900}); ctx.route("**/*", own)
        page = ctx.new_page(); cur = {"p": "login"}; errs = []
        page.on("pageerror", lambda e: errs.append((cur["p"], "JS", str(e)[:300])))
        page.on("console", lambda m: errs.append((cur["p"], "console", m.text[:300])) if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.on("response", lambda r: errs.append((cur["p"], "HTTP", f"{r.status} {r.url[len(BASE):][:120]}")) if r.url.startswith(BASE) and r.status >= 500 else None)
        page.goto(BASE + "/login"); page.fill("input[type=email]", email); page.fill("input[type=password]", PW)
        page.click("button[type=submit]"); page.wait_for_url("**/dashboard", timeout=20000)
        for path in paths:
            cur["p"] = path; page.goto(BASE + path); page.wait_for_load_state("networkidle", timeout=25000); page.wait_for_timeout(800)
            text = page.inner_text("body")
            errs += [(path, "UI", w) for w in ("This view hit an unexpected error", "Internal server error", "couldn’t load") if w in text]
        report[email.split("@")[0]] = errs; ctx.close()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True); ctx.route("**/*", own)
    page = ctx.new_page(); errs = []; page.on("pageerror", lambda e: errs.append(("public", "JS", str(e)[:300])))
    for path in ["/help", "/register", "/login"]:
        page.goto(BASE + path); page.wait_for_load_state("networkidle")
    report["public-mobile"] = errs; b.close()
print(json.dumps(report, indent=1))
raise SystemExit(1 if any(report.values()) else 0)
