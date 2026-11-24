"""Two-browser check that one user's change reaches another user's open page via /api/events (SSE) without reload.
Usage: BASE_URL=... PSQL_URL=... python tests/e2e/realtime.py"""
import re, subprocess, time
import os, struct, tempfile, zlib
BASE = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/"); PW = "ReliefGrid@2026"
DB = os.environ["PSQL_URL"]  # psql connection string for the *demo* database (assertions read it directly)
from playwright.sync_api import sync_playwright, expect
q=lambda s: subprocess.check_output(["psql",DB,"-Atc",s]).decode().strip()
rid, loc = q("select id, location from \"EmergencyRequest\" where status='PENDING' and location not like 'E2E%' order by \"createdAt\" desc limit 1").split("|")
def login(b, email):
    ctx=b.new_context(); ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort()); page=ctx.new_page()
    page.goto(BASE+"/login"); page.fill("input[type=email]",email); page.fill("input[type=password]",PW); page.click("button[type=submit]"); page.wait_for_url("**/dashboard"); return page
with sync_playwright() as p:
    b=p.chromium.launch(); a=login(b,"admin@reliefgrid.demo")
    a.goto(BASE+"/requests"); box=a.get_by_label(re.compile("^Search")); box.fill(loc); box.press("Enter")
    row=a.get_by_role("row").filter(has_text=loc).first; expect(row).to_contain_text(re.compile("Pending", re.I), timeout=15000)
    expect(a.get_by_role("status").filter(has_text="Live")).to_be_visible(timeout=15000); print("admin indicator: Live")
    c=login(b,"coordinator@reliefgrid.demo"); t0=time.time()
    print("coordinator verify:", c.request.fetch(BASE+f"/api/requests/{rid}", method="PATCH", data='{"action":"VERIFY"}', headers={"Content-Type":"application/json"}).status)
    expect(row).to_contain_text(re.compile("Verified", re.I), timeout=10000); print(f"admin list updated without reload after {time.time()-t0:.1f}s")
    b.close()
