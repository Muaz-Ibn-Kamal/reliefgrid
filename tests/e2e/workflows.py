"""End-to-end UI checks for ReliefGrid core workflows.

Runs 21 role-based workflows in Chromium against a running server and a freshly seeded demo database, and checks
the database after each step. Usage:  BASE_URL=http://localhost:3000 PSQL_URL=postgresql://... python tests/e2e/workflows.py
Requires: pip install playwright && playwright install chromium; psql on PATH. Reseed afterwards (it creates records).
"""
import re, subprocess, time, random, json
import os, struct, tempfile, zlib
BASE = os.environ.get("BASE_URL", "http://localhost:3000").rstrip("/"); PW = "ReliefGrid@2026"
DB = os.environ["PSQL_URL"]  # psql connection string for the *demo* database (assertions read it directly)
def _png():
    c = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + c(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + c(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + c(b"IEND", b"")
    f = tempfile.NamedTemporaryFile(suffix=".png", delete=False); f.write(data); f.close(); return f.name
PNG = _png()
from playwright.sync_api import sync_playwright, expect

TS = str(int(time.time()))
def q(sql): return subprocess.check_output(["psql", DB, "-Atc", sql]).decode().strip()
results, page_errors = [], []

def step(name, fn):
    try:
        fn(); results.append((name, "PASS", ""))
    except Exception as e:
        results.append((name, "FAIL", str(e).splitlines()[0][:260]))

def new_ctx(b, mobile=False):
    ctx = b.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1366, "height": 900})
    ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) or r.request.url.startswith("data:") else r.abort())
    return ctx

def login(b, email):
    ctx = new_ctx(b); page = ctx.new_page()
    page.on("pageerror", lambda e: page_errors.append((email, str(e)[:200])))
    page.goto(BASE + "/login"); page.fill("input[type=email]", email); page.fill("input[type=password]", PW)
    page.click("button[type=submit]"); page.wait_for_url("**/dashboard", timeout=20000)
    return ctx, page

def toast(page, text): expect(page.get_by_text(text).first).to_be_visible(timeout=15000)
def api(page, method, path, data=None):
    r = page.request.fetch(BASE + path, method=method, data=json.dumps(data) if data is not None else None, headers={"Content-Type": "application/json"})
    return r.status

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- Volunteer: task lifecycle + authorization
    ctx, page = login(b, "volunteer@reliefgrid.demo")
    def vol_start():
        page.goto(BASE + "/tasks")
        page.locator("li button").filter(has=page.get_by_text(re.compile(r"^assigned$", re.I))).first.click()
        page.get_by_role("button", name="Start task").click(); toast(page, "Task started")
        page.get_by_role("button", name="Close").click()
    def vol_report_complete():
        page.locator("li button").filter(has=page.get_by_text(re.compile(r"^in progress$", re.I))).first.click()
        page.get_by_label("What happened on site?").fill("E2E: delivered 40 food packs; all registered families reached.")
        page.get_by_role("dialog").locator("input[type=file]").set_input_files(PNG)
        expect(page.get_by_role("dialog").locator("img[src^='/api/uploads/']").first).to_be_visible(timeout=15000)
        page.get_by_role("button", name="Submit report").click(); toast(page, "Field report submitted")
        url = q("select \"photoUrl\" from \"FieldReport\" where content like 'E2E: delivered%' order by \"createdAt\" desc limit 1")
        r = page.request.get(BASE + url); assert r.status == 200 and r.headers["content-type"] == "image/png", f"photo {url} -> {r.status}"
        page.get_by_role("button", name="Complete task").click(); toast(page, "Task completed")
        expect(page.get_by_role("dialog").get_by_text(re.compile("reports are preserved", re.I))).to_be_visible()
    def vol_forbidden():
        other = q("select t.id from \"Task\" t join \"Volunteer\" v on v.id=t.\"volunteerId\" join \"User\" u on u.id=v.\"userId\" where u.email<>'volunteer@reliefgrid.demo' and t.status='ASSIGNED' limit 1")
        s = api(page, "PATCH", f"/api/tasks/{other}", {"status": "IN_PROGRESS"}); assert s in (403, 404), f"expected 403/404, got {s}"
        s = api(page, "GET", "/api/resources"); assert s == 403, f"volunteer read resources: {s}"
    def vol_profile():
        page.goto(BASE + "/profile"); page.get_by_label("Phone").fill("+8801700000000")
        page.get_by_role("button", name="Save changes").click(); toast(page, "Profile updated")
    step("Volunteer starts an assigned task", vol_start)
    step("Volunteer files field report and completes task", vol_report_complete)
    step("Volunteer cannot touch others' tasks or org resources (server)", vol_forbidden)
    step("Volunteer updates profile", vol_profile)
    ctx.close()

    # ---------------- Coordinator: request -> duplicate -> verify -> allocate -> distribute -> QR verify; team deploy
    ctx, page = login(b, "coordinator@reliefgrid.demo")
    lat, lng = f"{24.9 + random.random() * 0.05:.5f}", f"{88.30 + random.random() * 0.05:.5f}"
    loc = f"E2E camp {TS}"
    def fill_request(dlg):
        dlg.get_by_label("What is needed?").select_option("FOOD")
        dlg.get_by_label("Quantity").fill("60"); dlg.get_by_label("Number of affected people").fill("25")
        dlg.get_by_label("Location (address or landmark)").fill(loc)
        dlg.get_by_label("Latitude").fill(lat); dlg.get_by_label("Longitude").fill(lng)
        dlg.get_by_label("Description").fill("E2E: families displaced, need food packs")
        dlg.get_by_label("Your name").fill(f"E2E Tester {TS}")
    def coord_new_request():
        page.goto(BASE + "/requests"); page.get_by_role("button", name="New request").click()
        dlg = page.get_by_role("dialog"); fill_request(dlg)
        dlg.get_by_role("button", name="Submit request").click(); toast(page, "Request submitted")
    def coord_duplicate():
        page.get_by_role("button", name="New request").click(); dlg = page.get_by_role("dialog"); fill_request(dlg)
        dlg.get_by_role("button", name="Submit request").click()
        expect(dlg.get_by_text(re.compile("Possible duplicate", re.I)).first).to_be_visible(timeout=15000)
        expect(dlg.get_by_role("button", name=re.compile("Submit anyway"))).to_be_visible()
        page.get_by_role("button", name="Close").click()
    rid = {}
    def coord_verify():
        rid["id"] = q(f"select id from \"EmergencyRequest\" where location='{loc}' order by \"createdAt\" limit 1"); assert rid["id"]
        box = page.get_by_label(re.compile("^Search")); box.fill(loc); box.press("Enter")
        page.get_by_role("row").filter(has_text=loc).first.click()
        page.get_by_role("dialog").get_by_role("button", name="Verify").click(); toast(page, "Request verified")
        assert q(f"select status from \"EmergencyRequest\" where id='{rid['id']}'") == "VERIFIED"
    alloc = {}
    def coord_allocate():
        page.goto(BASE + f"/allocations?requestId={rid['id']}")
        sel = page.get_by_label("Compatible resource (highest stock first)")
        expect(sel.locator("option").nth(1)).to_be_attached(timeout=15000)
        sel.select_option(index=1)
        res_id = sel.input_value(); before = int(q(f"select quantity from \"Resource\" where id='{res_id}'"))
        page.get_by_role("button", name="Use max").click(); page.get_by_role("button", name="Allocate", exact=True).click(); toast(page, "Resources allocated")
        after = int(q(f"select quantity from \"Resource\" where id='{res_id}'"))
        row = q(f"select id, quantity from \"Allocation\" where \"requestId\"='{rid['id']}'").split("|")
        alloc.update(id=row[0], qty=int(row[1]))
        assert before - after == alloc["qty"] == 60, f"stock {before}->{after}, allocated {alloc['qty']}"
        assert q(f"select count(*) from \"StockMovement\" where \"allocationId\"='{alloc['id']}'") == "1", "stock movement missing"
    def coord_overallocate_rejected():
        res = q("select id from \"Resource\" where category='FOOD' and quantity>0 limit 1")
        s = api(page, "POST", "/api/allocations", {"requestId": rid["id"], "resourceId": res, "quantity": 10_000_000})
        assert s in (400, 409), f"expected 409, got {s}"
    def coord_distribution_and_qr():
        page.reload(); page.get_by_role("row").filter(has_text=loc).first.click()
        dlg = page.get_by_role("dialog"); dlg.get_by_label("New status").select_option("IN_TRANSIT")
        dlg.get_by_role("button", name="Save update").click(); toast(page, "Distribution updated")
        page.get_by_role("row").filter(has_text=loc).first.click()
        token = page.get_by_test_id("qr-token").inner_text(); page.get_by_role("button", name="Close").click()
        page.get_by_label("Scanned or typed token").fill(token); page.get_by_role("button", name="Confirm delivery").click(); toast(page, "Delivery verified")
        assert q(f"select status from \"Allocation\" where id='{alloc['id']}'") == "DELIVERED"
        assert int(q(f"select count(*) from \"DistributionRecord\" where \"allocationId\"='{alloc['id']}'")) >= 2
    def coord_team_deploy():
        page.goto(BASE + "/teams"); page.locator("li button").first.click(); dlg = page.get_by_role("dialog")
        dlg.get_by_label("Deploy to incident").select_option(index=1); dlg.get_by_role("button", name="Deploy").click(); toast(page, "Team deployed")
        dlg.get_by_role("button", name="Recall to standby").click(); toast(page, "Team recalled")
    step("Coordinator submits emergency request", coord_new_request)
    step("Duplicate request is detected with override option", coord_duplicate)
    step("Coordinator verifies request", coord_verify)
    step("Allocation deducts exact stock + stock movement recorded", coord_allocate)
    step("Over-allocation rejected by server", coord_overallocate_rejected)
    step("Distribution update + QR delivery verification", coord_distribution_and_qr)
    step("Team deploy and recall", coord_team_deploy)
    ctx.close()

    # ---------------- Shelter manager: capacity rule
    ctx, page = login(b, "shelter@reliefgrid.demo")
    sh_id, occ, cap = q("select s.id, s.occupancy, s.\"totalCapacity\" from \"Shelter\" s join \"User\" u on u.id=s.\"managerId\" where u.email='shelter@reliefgrid.demo' order by s.name limit 1").split("|"); occ, cap = int(occ), int(cap)
    def shelter_client_block():
        page.goto(BASE + f"/shelters/{sh_id}"); page.get_by_label("New occupancy").fill(str(cap + 1))
        expect(page.get_by_text(re.compile("Would exceed capacity"))).to_be_visible(); expect(page.get_by_role("button", name="Save occupancy")).to_be_disabled()
    def shelter_server_block():
        s = api(page, "POST", f"/api/shelters/{sh_id}/occupancy", {"occupancy": cap + 1}); assert s in (400, 409), f"got {s}"
        assert int(q(f"select occupancy from \"Shelter\" where id='{sh_id}'")) == occ
    def shelter_update():
        logs = int(q(f"select count(*) from \"ShelterOccupancyLog\" where \"shelterId\"='{sh_id}'")); new = occ - 1 if occ > 0 else 1
        page.get_by_label("New occupancy").fill(str(new)); page.get_by_label("Note (kept in history)").fill("E2E headcount")
        page.get_by_role("button", name="Save occupancy").click(); toast(page, "Occupancy updated")
        o = int(q(f"select occupancy from \"Shelter\" where id='{sh_id}'")); a = page.request.get(f"{BASE}/api/shelters/{sh_id}").json()["availableCapacity"]
        assert o == new and a == cap - new, f"occupancy {o}, available {a}"
        assert int(q(f"select count(*) from \"ShelterOccupancyLog\" where \"shelterId\"='{sh_id}'")) == logs + 1
    step("Shelter: UI blocks occupancy above capacity", shelter_client_block)
    step("Shelter: server rejects occupancy above capacity, no change", shelter_server_block)
    step("Shelter: occupancy update recalculates availability + logs history", shelter_update)
    ctx.close()

    # ---------------- Admin: incident create + priority override history, user create
    ctx, page = login(b, "admin@reliefgrid.demo")
    inc = {}
    def admin_create_incident():
        page.goto(BASE + "/incidents/new")
        page.get_by_label("Title").fill(f"E2E landslide {TS}"); page.get_by_label("Description").fill("E2E: hillside collapse blocking the main road, homes at risk.")
        page.get_by_label("Category").select_option("LANDSLIDE"); page.get_by_label("Location", exact=True).fill("Rangamati, Bangladesh")
        page.get_by_label("Latitude").fill("22.65"); page.get_by_label("Longitude").fill("92.17")
        page.get_by_label("Severity").select_option("4"); page.get_by_label("Location risk").select_option("4"); page.get_by_label("Affected population").fill("1800")
        page.get_by_role("button", name="Report incident").click(); page.wait_for_url(re.compile(r"/incidents/(?!new)[a-z0-9]+$"), timeout=20000)
        inc["id"] = page.url.rsplit("/", 1)[1]; expect(page.get_by_role("heading", name=f"E2E landslide {TS}")).to_be_visible()
    def admin_priority_override():
        page.get_by_label("Priority override").select_option("LOW"); page.get_by_label("Note (recorded in history)").fill("E2E: local team already on site")
        page.get_by_role("button", name="Save changes").click(); toast(page, "Incident updated")
        n = int(q(f"select count(*) from \"ActivityLog\" where \"entityId\"='{inc['id']}' and action ilike '%PRIORITY%'")); assert n >= 1, "priority change not in activity history"
    def admin_create_user():
        page.goto(BASE + "/users"); page.get_by_role("button", name="New user").click(); dlg = page.get_by_role("dialog")
        dlg.get_by_label("Full name").fill("E2E Person"); dlg.get_by_label("Email").fill(f"e2e{TS}@example.org"); dlg.get_by_label("Temporary password").fill("Sup3rSecret!")
        dlg.get_by_role("button", name="Create user").click(); toast(page, "User created")
    step("Admin reports an incident (form -> detail page)", admin_create_incident)
    step("Priority override recorded in activity history", admin_priority_override)
    step("Admin creates a user", admin_create_user)
    ctx.close()

    # ---------------- Relief organization: register resource, org scoping
    ctx, page = login(b, "org@reliefgrid.demo")
    def org_register():
        page.goto(BASE + "/resources"); page.get_by_role("button", name="Register resource").click(); dlg = page.get_by_role("dialog")
        dlg.get_by_label("Name").fill(f"E2E blankets {TS}"); dlg.get_by_label("Category").select_option("BLANKET"); dlg.get_by_label("Unit").fill("pieces")
        dlg.get_by_label("Initial quantity").fill("250"); dlg.get_by_label("Storage location").fill("E2E depot")
        dlg.get_by_role("button", name=re.compile("^Register")).click(); page.wait_for_timeout(2500)
        row = q(f"select r.quantity, o.name from \"Resource\" r join \"Organization\" o on o.id=r.\"organizationId\" where r.name='E2E blankets {TS}'")
        own = q("select o.name from \"User\" u join \"Organization\" o on o.id=u.\"organizationId\" where u.email='org@reliefgrid.demo'")
        assert row == f"250|{own}", f"got {row!r}, own org {own!r}"
    def org_scoping():
        other = q("select r.id from \"Resource\" r where r.\"organizationId\" <> (select \"organizationId\" from \"User\" where email='org@reliefgrid.demo') limit 1")
        s = api(page, "POST", f"/api/resources/{other}/stock", {"type": "RESTOCK", "delta": 5}); assert s in (403, 404), f"got {s}"
    step("Relief org registers resource (bound to own org)", org_register)
    step("Relief org cannot change another org's stock (server)", org_scoping)
    ctx.close()

    # ---------------- Public citizen form (mobile)
    ctx = new_ctx(b, mobile=True); page = ctx.new_page(); page.on("pageerror", lambda e: page_errors.append(("public", str(e)[:200])))
    plat, plng = f"{25.6 + random.random() * 0.05:.5f}", f"{89.10 + random.random() * 0.05:.5f}"
    def fill_public():
        page.get_by_label("What is needed?").select_option("WATER"); page.get_by_label("Quantity").fill("300"); page.get_by_label("Number of affected people").fill("60")
        page.get_by_label("Location (address or landmark)").fill(f"E2E village {TS}"); page.get_by_label("Latitude").fill(plat); page.get_by_label("Longitude").fill(plng)
        page.get_by_label("Description").fill("E2E: tube wells contaminated by flood water"); page.get_by_label("Your name").fill("E2E Citizen")
    def public_submit():
        page.goto(BASE + "/help"); fill_public(); page.get_by_role("button", name="Send request for help").click()
        expect(page.get_by_text("Request received")).to_be_visible(timeout=15000)
    def public_duplicate():
        page.get_by_role("button", name="Submit another request").click(); fill_public(); page.get_by_role("button", name="Send request for help").click()
        expect(page.get_by_text(re.compile("Possible duplicate", re.I)).first).to_be_visible(timeout=15000)
    step("Citizen submits public help request (mobile)", public_submit)
    step("Citizen duplicate is detected", public_duplicate)
    ctx.close(); b.close()

w = max(len(r[0]) for r in results)
for n, s, d in results: print(f"{s}  {n.ljust(w)}  {d}")
print(f"\n{sum(r[1] == 'PASS' for r in results)}/{len(results)} passed; page errors: {page_errors or 'none'}")
