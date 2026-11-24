"""Security regression checks against a running server, from the 2026-11-25 audit (see docs/SECURITY.md).

Usage: BASE_URL=http://localhost:3100 PSQL_URL=postgresql://postgres@localhost:5433/reliefgrid python tests/e2e/security.py
Run it against a local or staging copy with the demo seed, never production: it signs in, changes a password and
probes limits. Every probe that changes data restores it. Demo-account checks run only when the server has DEMO_MODE=true.
"""
import json, os, subprocess, sys, urllib.error, urllib.request

BASE = os.environ.get("BASE_URL", "http://localhost:3100").rstrip("/")
PW = "ReliefGrid@2026"
q = lambda sql: subprocess.check_output(["psql", os.environ["PSQL_URL"], "-Atc", sql]).decode().strip()
results: list[bool] = []


class Client:
    """Carries the session cookie by hand: urllib's cookie jar won't send a Secure cookie to http://localhost."""

    def __init__(self):
        self.session = None
        self.opener = urllib.request.build_opener()

    def req(self, method, path, data=None, origin=BASE, raw=None, ctype=None):
        headers = {"Origin": origin} if origin else {}
        if self.session:
            headers["Cookie"] = f"rg_session={self.session}"
        body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
        if data is not None or ctype:
            headers["Content-Type"] = ctype or "application/json"
        r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
        try:
            resp = self.opener.open(r, timeout=30)
            status, payload, hdrs = resp.status, resp.read(), resp.headers
        except urllib.error.HTTPError as e:
            status, payload, hdrs = e.code, e.read(), e.headers
        for c in hdrs.get_all("Set-Cookie") or []:
            if c.startswith("rg_session="):
                value = c.split(";", 1)[0].split("=", 1)[1]
                self.session = value or None
        return status, payload, hdrs

    def login(self, email, pw=PW):
        return self.req("POST", "/api/auth/login", {"email": email, "password": pw})[0]


def check(name, ok, detail=""):
    results.append(bool(ok))
    print(("PASS  " if ok else "FAIL  ") + name + (f"  ({detail})" if detail else ""))


def multipart(filename, ctype, payload):
    b = "----rgsec"
    body = f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + payload + f"\r\n--{b}--\r\n".encode()
    return body, f"multipart/form-data; boundary={b}"


anon = Client()
check("unauthenticated API calls are refused", all(anon.req("GET", p)[0] == 401 for p in ["/api/auth/me", "/api/incidents", "/api/export/requests", "/api/events"]))
for path, payload in [("/api/auth/login", {"email": "admin@reliefgrid.demo", "password": PW}), ("/api/auth/register", {}), ("/api/public/requests", {}), ("/api/auth/logout", {})]:
    check(f"cross-site POST {path} is refused", anon.req("POST", path, payload, origin="https://evil.example")[0] == 403)

status, _, headers = anon.req("GET", "/login")
for h in ["Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options", "X-Content-Type-Options", "Cross-Origin-Opener-Policy", "Cross-Origin-Resource-Policy"]:
    check(f"header {h}", headers.get(h))

codes = [anon.req("POST", "/api/auth/login", {"email": "rate-probe@example.com", "password": "wrong-password"})[0] for _ in range(10)]
check("sign-in attempts are rate limited", codes[-1] == 429, " ".join(map(str, codes)))

org = Client(); org.login("org@reliefgrid.demo")
my_org = q("select \"organizationId\" from \"User\" where email='org@reliefgrid.demo'")
teams = json.loads(org.req("GET", "/api/teams?pageSize=100")[1])["data"]
check("relief org sees only its own teams", teams and all((t.get("organization") or {}).get("name") == teams[0]["organization"]["name"] for t in teams), f"{len(teams)} teams")
victim = q(f"select v.id from \"Volunteer\" v join \"User\" u on u.id=v.\"userId\" where u.\"organizationId\" is not null and u.\"organizationId\" <> '{my_org}' limit 1")
before = q(f"select coalesce(\"teamId\", '-') from \"Volunteer\" where id='{victim}'")
status = org.req("POST", "/api/teams", {"name": "security probe", "memberIds": [victim]})[0]
check("relief org cannot take another organization's volunteer", status == 403 and q(f"select coalesce(\"teamId\", '-') from \"Volunteer\" where id='{victim}'") == before, f"HTTP {status}")
check("oversized JSON body is refused", org.req("POST", "/api/teams", raw=b'{"name":"' + b"A" * 300_000 + b'"}', ctype="application/json")[0] == 413)

body, ctype = multipart("x.png", "image/png", b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>")
check("upload with a forged image type is refused", org.req("POST", "/api/upload", raw=body, ctype=ctype)[0] == 400)
body, ctype = multipart("x.svg", "image/svg+xml", b"<svg xmlns='http://www.w3.org/2000/svg'/>")
check("SVG upload is refused", org.req("POST", "/api/upload", raw=body, ctype=ctype)[0] == 400)

vol = Client(); vol.login("volunteer@reliefgrid.demo")
check("volunteer cannot reach admin APIs", vol.req("GET", "/api/users")[0] == 403 and vol.req("GET", "/api/export/resources")[0] == 403)

email = q("select email from \"User\" where role='VOLUNTEER' and active and email like 'volunteer_%@reliefgrid.demo' order by email limit 1")
a, b = Client(), Client(); a.login(email); b.login(email)
changed = b.req("PATCH", "/api/profile", {"currentPassword": PW, "newPassword": "Rotated-Passw0rd"})[0]
check("password change signs out other sessions", changed == 200 and a.req("GET", "/api/auth/me")[0] == 401 and b.req("GET", "/api/auth/me")[0] == 200)
if changed == 200:
    b.req("PATCH", "/api/profile", {"currentPassword": "Rotated-Passw0rd", "newPassword": PW})

admin = Client(); admin.login("admin@reliefgrid.demo")
shelter_id = q("select id from \"User\" where email='shelter@reliefgrid.demo'")
status = admin.req("PATCH", f"/api/users/{shelter_id}", {"active": False})[0]
if status == 200:
    admin.req("PATCH", f"/api/users/{shelter_id}", {"active": True})
    print("SKIP  demo-account protection (server runs without DEMO_MODE=true)")
else:
    check("shared demo accounts cannot be deactivated (DEMO_MODE)", status == 403)
    check("shared demo account passwords cannot be changed (DEMO_MODE)", vol.req("PATCH", "/api/profile", {"currentPassword": PW, "newPassword": "Hijacked-1"})[0] == 403)

print(f"\n{sum(results)}/{len(results)} security checks passed")
sys.exit(0 if all(results) else 1)
