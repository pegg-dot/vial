#!/usr/bin/env python3
"""A2 prod-data audit: every number in ../A2-prod-data.md is computed here from the raw
responses saved alongside this file (fetched by fetch.sh). Re-run: python3 analyze.py

Reads only: catalog-full.body, catalog-lite.body, v1-health.body, health-live.body,
health-ready.body, status-1.body, status-2.body, sitemap.body, stack-detail.body,
product-*.body/.headers, compound-worst-*.body, vendorpage-*.body, compare-post.body,
market-summary-unauth.body/.headers, requests.log
"""
import json, re, html, glob, os, statistics, collections, datetime as dt

RAW = os.path.dirname(os.path.abspath(__file__))
os.chdir(RAW)

def load(name):
    with open(name, encoding="utf-8", errors="replace") as f:
        return f.read()

def jl(name):
    return json.loads(load(name))

def text_lines(html_src):
    t = re.sub(r"<script.*?</script>", "", html_src, flags=re.S)
    t = re.sub(r"<style.*?</style>", "", t, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    return [l.strip() for l in t.split("\n") if l.strip()]

def pct(xs, q):
    xs = sorted(xs)
    if not xs: return None
    k = (len(xs) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)

def median(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None

def is_round50(v):
    return abs(v - round(v)) < 1e-9 and round(v) % 50 == 0 and v > 0

out = []
def P(*a):
    s = " ".join(str(x) for x in a)
    out.append(s); print(s)

# ------------------------------------------------------------------ A. endpoints
P("# A. Endpoints used (from requests.log)")
for line in load("requests.log").splitlines():
    P("  " + line)
cat = jl("catalog-full.body")
lite = jl("catalog-lite.body")
P("\ncatalog-full top keys:", list(cat.keys()), "meta:", cat["meta"])
P("catalog-lite meta:", lite["meta"], "lite product keys:", sorted(lite["data"]["products"][0].keys()))
P("v1-health:", load("v1-health.body").strip())
P("health-live:", load("health-live.body").strip())
P("health-ready:", load("health-ready.body").strip())
P("market-summary (unauth):", load("market-summary-unauth.headers").splitlines()[0], load("market-summary-unauth.body").strip())
cmp = jl("compare-post.body")
P("compare POST: keys", list(cmp.keys()), "entries", len(cmp.get("entries", [])), "entry keys", sorted(cmp["entries"][0].keys()) if cmp.get("entries") else None, "cells", sorted(cmp["entries"][0]["cells"].keys()) if cmp.get("entries") else None)
hdr = load("catalog-full.headers")
P("catalog-full headers of note:", [l for l in hdr.splitlines() if re.match(r"(?i)(cache-control|x-vercel-cache|age|etag|last-modified)", l)])

# ------------------------------------------------------------------ B. catalog totals
C = cat["data"]; PR = C["products"]; VE = C["vendors"]; CO = C["compounds"]
P("\n# B. Catalog totals")
P("generatedAt:", C["generatedAt"])
P("products:", len(PR), "vendors:", len(VE), "compounds:", len(CO))
P("origin products:", dict(collections.Counter(p["origin"] for p in PR)))
P("origin vendors:", dict(collections.Counter(v["origin"] for v in VE)))
P("origin compounds:", dict(collections.Counter(c["origin"] for c in CO)))
LIVE = [p for p in PR if p["origin"] == "live"]
fields = collections.Counter()
for p in PR: fields.update(p.keys())
P("product field presence (of %d):" % len(PR), {k: v for k, v in sorted(fields.items())})
P("currency:", dict(collections.Counter(p["currency"] for p in PR)))
P("availability:", dict(collections.Counter(p["availability"] for p in PR)))
P("price<=0:", sum(1 for p in PR if p["price"] <= 0), "mg parsed:", sum(1 for p in PR if p.get("mg")), "pricePerMg present:", sum(1 for p in PR if p.get("pricePerMg")))
P("priceHistory element types:", dict(collections.Counter(type(x).__name__ for p in PR for x in p["priceHistory"])))
P("trust.priceFlag:", dict(collections.Counter(p["trust"].get("priceFlag") for p in PR)))
P("trust.status:", dict(collections.Counter(p["trust"].get("status") for p in PR)))
P("evidenceLevel:", dict(collections.Counter(p["evidenceLevel"] for p in PR)))
vend_listing = collections.Counter(p["vendorSlug"] for p in PR)
P("vendors with 0 listings in products[]:", sum(1 for v in VE if vend_listing[v["slug"]] == 0), "vendors with productCount==0 field:", sum(1 for v in VE if v["productCount"] == 0))
P("vendors with >=1 listing:", sum(1 for v in VE if vend_listing[v["slug"]] > 0))
P("sum vendor.productCount:", sum(v["productCount"] for v in VE), "sum compound.listings:", sum(c["listings"] for c in CO))
P("sum vendor.coaCount:", sum(v["coaCount"] for v in VE), "sum compound.coaCount:", sum(c["coaCount"] for c in CO))
P("vendor grade letters:", dict(collections.Counter((v.get("grade") or {}).get("letter") for v in VE)))
P("vendor kinds:", dict(collections.Counter(v["kind"] for v in VE)))

# ------------------------------------------------------------------ C. price_history
P("\n# C. price_history characterization (live listings only, n=%d)" % len(LIVE))
lens = collections.Counter(len(p["priceHistory"]) for p in LIVE)
P("exact length distribution:", dict(sorted(lens.items())))
bucket = collections.Counter(("1" if len(p["priceHistory"]) == 1 else "2" if len(p["priceHistory"]) == 2 else "3" if len(p["priceHistory"]) == 3 else "4+") for p in LIVE)
P("bucketed:", dict(bucket))
P("empty history:", sum(1 for p in LIVE if not p["priceHistory"]))
multi = [p for p in LIVE if len(p["priceHistory"]) >= 2]
P("listings with >=2 points:", len(multi))
P("listings with >=2 DISTINCT values:", sum(1 for p in LIVE if len(set(p["priceHistory"])) >= 2))
P("listings with >=3 DISTINCT values:", sum(1 for p in LIVE if len(set(p["priceHistory"])) >= 3))
P("history[0]==price:", sum(1 for p in LIVE if p["priceHistory"] and p["priceHistory"][0] == p["price"]))
P("history[-1]==price:", sum(1 for p in LIVE if p["priceHistory"] and p["priceHistory"][-1] == p["price"]))
P("price not in history at all:", sum(1 for p in LIVE if p["price"] not in p["priceHistory"]))
P("previousPrice present:", sum(1 for p in LIVE if "previousPrice" in p), "(== count of >=2-point histories?", sum(1 for p in LIVE if "previousPrice" in p) == len(multi), ")")
P("previousPrice==price:", sum(1 for p in LIVE if p.get("previousPrice") == p["price"]), "previousPrice!=price:", sum(1 for p in LIVE if "previousPrice" in p and p["previousPrice"] != p["price"]))

# Shape classification of the multi-point histories
def classify(p):
    h = p["priceHistory"]; price = p["price"]; prev = p.get("previousPrice")
    tail = h[1:]
    tail_set = set(tail)
    if len(tail_set) == 1:
        t = tail[0]
        if t in (100, 150, 200) and t != h[0] and t != price:
            return "A_threshold_placeholder_tail"           # [real, 150,150,150,150] — vendor "free shipping over $150" / "orders $100+" banner
        if is_round50(t) and t == price and h[0] != price:
            return "B_placeholder_became_current_price"     # [79.99, 100,100,100,100] with price=100 — the placeholder IS now the price
        if t > 0 and h[0] > 0 and (abs(h[0] / t - 10) < 0.05 or abs(t / h[0] - 10) < 0.05):
            return "C_10x_unit_flip"                        # kit-of-10 vs per-vial
        if prev is not None and h[0] == prev and t == price and prev != price:
            return "D_prev_then_current"                    # [45, 35,35,35,35] — one real step (sale / change) then repeats
        if t == price:
            return "E_flat_repeat_of_current"               # [x, x, x] all equal to current
        return "F_single_other_value_repeated"              # [128, 71,71,71] — a different (variant?) price repeated
    vals = set(h)
    if len(h) == 2 and len(vals) == 2 and not any(is_round50(v) for v in vals):
        return "G_two_point_varied_nonround"                # [111.58, 80.56] — plausibly real
    if len(vals) >= 3 and not any(is_round50(v) for v in vals):
        return "H_multi_varied_nonround"                    # plausibly real multi-point
    return "Z_other"

cls = collections.Counter(classify(p) for p in multi)
P("\nshape classes among >=2-point histories:")
for k, v in sorted(cls.items()):
    vend = collections.Counter(p["vendorSlug"] for p in multi if classify(p) == k)
    P("  %-38s %4d  vendors=%s" % (k, v, dict(vend)))
junk_A = [p for p in multi if classify(p) == "A_threshold_placeholder_tail"]
junk_B = [p for p in multi if classify(p) == "B_placeholder_became_current_price"]
P("\nJUNK pattern (history[0]==current price, remaining = one round placeholder):", len(junk_A))
P("  placeholder values:", dict(collections.Counter(p["priceHistory"][1] for p in junk_A)))
P("  by vendor:", dict(collections.Counter(p["vendorSlug"] for p in junk_A)))
P("PLACEHOLDER-AS-CURRENT-PRICE pattern (history[0]=older real price, tail=round value == current price):", len(junk_B))
P("  by vendor:", dict(collections.Counter(p["vendorSlug"] for p in junk_B)), "current prices:", dict(collections.Counter(p["price"] for p in junk_B)))
all_tail_vals = collections.Counter(v for p in multi for v in p["priceHistory"][1:] if v != p["priceHistory"][0])
P("most common tail values (!= history[0]) across multi-point histories:", all_tail_vals.most_common(8))
P("timestamps in history? ->", "NO: priceHistory is number[] (bare prices, no dates); observedAt is a single scalar per listing")
plausible = [p for p in multi if classify(p) in ("G_two_point_varied_nonround", "H_multi_varied_nonround", "D_prev_then_current")]
P("plausibly REAL price movement (classes D/G/H):", len(plausible), "by vendor:", dict(collections.Counter(p["vendorSlug"] for p in plausible)))
P("strictly-real-looking (G/H only, varied non-round values):", sum(1 for p in plausible if classify(p) != "D_prev_then_current"))

P("\n10 concrete examples (slug | vendor | price | previousPrice | history | class):")
examples = []
for k in ("A_threshold_placeholder_tail", "B_placeholder_became_current_price", "C_10x_unit_flip", "F_single_other_value_repeated", "D_prev_then_current", "G_two_point_varied_nonround", "H_multi_varied_nonround", "Z_other"):
    for p in [x for x in multi if classify(x) == k][:2]:
        examples.append(p)
for p in examples[:12]:
    P("  %s | %s | %s | %s | %s | %s" % (p["slug"], p["vendorSlug"], p["price"], p.get("previousPrice"), p["priceHistory"], classify(p)))

# umbrella-labs: which collect run wrote the $100?
um = [p for p in LIVE if p["vendorSlug"] == "umbrella-labs"]
P("\numbrella-labs (observedAt day, price==100) cross-tab:", sorted(collections.Counter((p["observedAt"][:10], p["price"] == 100) for p in um).items()))
P("umbrella-labs listings observed 2026-08-29 that are NOT $100:", sum(1 for p in um if p["observedAt"][:10] == "2026-08-29" and p["price"] != 100))
# Lost movement: single-point history whose only value != current price -> the collector changed the
# price in place (live-sources.ts only seeds price_history when it is '[]') and appended nothing.
lost = [p for p in LIVE if len(p["priceHistory"]) == 1 and p["priceHistory"][0] != p["price"]]
P("\nLOST MOVEMENT: single-point histories whose only value != current price:", len(lost), "by vendor:", dict(collections.Counter(p["vendorSlug"] for p in lost)))
for p in lost[:8]: P("  %-40s price=%s history=%s observedAt=%s" % (p["slug"], p["price"], p["priceHistory"], p["observedAt"][:10]))
P("single-point histories whose value == current price (no change ever recorded):", sum(1 for p in LIVE if len(p["priceHistory"]) == 1 and p["priceHistory"][0] == p["price"]))

# ------------------------------------------------------------------ D. freshness
P("\n# D. Price freshness")
gen = dt.datetime.fromisoformat(C["generatedAt"].replace("Z", "+00:00"))
def age_days(iso): return (gen - dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))).total_seconds() / 86400
ages = [age_days(p["observedAt"]) for p in LIVE if p.get("observedAt")]
P("observedAt present:", len(ages), "/", len(LIVE), " reference = catalog generatedAt", C["generatedAt"])
P("observedAt age days: p50=%.2f p90=%.2f max=%.2f mean=%.2f" % (pct(ages, .5), pct(ages, .9), max(ages), statistics.mean(ages)))
P("share observed <1d: %.1f%%  <2d: %.1f%%  >=7d: %.1f%%  >=14d: %.1f%%  >=21d: %.1f%%" % tuple(100 * sum(1 for a in ages if cond(a)) / len(ages) for cond in (lambda a: a < 1, lambda a: a < 2, lambda a: a >= 7, lambda a: a >= 14, lambda a: a >= 21)))
P("observedAt by calendar day:", dict(sorted(collections.Counter(p["observedAt"][:10] for p in LIVE).items())))
P("lastChecked rendered strings:", collections.Counter(p["lastChecked"] for p in LIVE).most_common(20))
P("\nby vendor (n, p50d, p90d, maxd, %>=7d) — sorted by max age:")
byv = collections.defaultdict(list)
for p in LIVE: byv[p["vendorSlug"]].append(age_days(p["observedAt"]))
rows = []
for v, a in byv.items():
    rows.append((v, len(a), pct(a, .5), pct(a, .9), max(a), 100 * sum(1 for x in a if x >= 7) / len(a)))
rows.sort(key=lambda r: -r[4])
for r in rows: P("  %-28s n=%3d p50=%6.2f p90=%6.2f max=%6.2f stale7d=%5.1f%%" % r)
stale_v = [r for r in rows if r[2] >= 7]
P("vendors whose MEDIAN listing age >= 7d:", len(stale_v), "of", len(rows), "->", [r[0] for r in stale_v])
P("listings >=7d old:", sum(1 for a in ages if a >= 7), "of", len(ages))
P("\nvendor.lastObserved (date) distribution:", dict(sorted(collections.Counter(v["lastObserved"] for v in VE).items())))
P("vendor.latestTestedAt non-null:", sum(1 for v in VE if v.get("latestTestedAt")))
P("product.reportDate non-empty:", sum(1 for p in LIVE if p["reportDate"]), "reportConfirmed:", sum(1 for p in LIVE if p["reportConfirmed"]))
P("\nproduct page rendered freshness (server HTML) + headers:")
for f in sorted(glob.glob("product-*.body")):
    lines = text_lines(load(f))
    i = next((k for k, l in enumerate(lines) if l == "Checked"), None)
    rendered = lines[i + 1] if i is not None and i + 1 < len(lines) else None
    obs_i = next((k for k, l in enumerate(lines) if l == "Observed price"), None)
    price_r = next((l for l in lines[obs_i:obs_i + 6] if re.match(r"^\$\d", l)), None) if obs_i is not None else None
    hd = [l.strip() for l in load(f.replace(".body", ".headers")).splitlines() if re.match(r"(?i)(last-modified|etag|cache-control|x-vercel-cache)", l)]
    slug = re.sub(r"^product-(\d+-|umbrella-)", "", f[:-5])
    api = next((p for p in PR if p["slug"] == slug), None)
    P("  %-45s rendered='Checked %s' price=%s | API observedAt=%s lastChecked=%s price=%s | %s" % (slug, rendered, price_r, api and api["observedAt"], api and api["lastChecked"], api and api["price"], hd))
P("Last-Modified / ETag on product pages:", "NONE (cache-control private no-store) — freshness is only in the body")

# ------------------------------------------------------------------ E. compounds
P("\n# E. Compounds — price_change (worst 10 by |priceChange|)")
prods_by_c = collections.defaultdict(list)
for p in LIVE: prods_by_c[p["compoundSlug"]].append(p)
P("compounds with priceChange==0:", sum(1 for c in CO if c["priceChange"] == 0), " !=0:", sum(1 for c in CO if c["priceChange"] != 0), " |pc|>=50:", sum(1 for c in CO if abs(c["priceChange"]) >= 50), " |pc|>=100:", sum(1 for c in CO if abs(c["priceChange"]) >= 100))
P("sum compound.listings:", sum(c["listings"] for c in CO), "vs products[]:", len(LIVE), "; compounds where listings != products count:", [(c["slug"], c["listings"], len(prods_by_c[c["slug"]])) for c in CO if c["listings"] != len(prods_by_c[c["slug"]])][:10])
def recompute_pc(slug):
    moves = []
    for p in prods_by_c[slug]:
        h = p["priceHistory"]
        if len(h) >= 2 and h[0] > 0: moves.append((h[-1] - h[0]) / h[0] * 100)
    return round(median(moves), 1) if moves else 0, len(moves)
worst = sorted(CO, key=lambda c: -abs(c["priceChange"]))[:10]
P("slug | priceChange | listings | medianPrice | min | max | medianPricePerMg | recomputed_from_histories(median of (h[-1]-h[0])/h[0]) | n_multi")
mismatch = 0
for c in worst:
    ps = prods_by_c[c["slug"]]
    prices = [p["price"] for p in ps if p["price"] > 0]
    rc, n = recompute_pc(c["slug"])
    P("  %-22s %7.1f%% %3d  med=%8.2f min=%8.2f max=%8.2f $/mg=%s  recomputed=%7.1f%% (n=%d)" % (c["slug"], c["priceChange"], c["listings"], c["medianPrice"], min(prices) if prices else 0, max(prices) if prices else 0, c["medianPricePerMg"], rc, n))
    for p in ps:
        if len(p["priceHistory"]) >= 2:
            P("      %-45s %-18s price=%8.2f hist=%s move=%+.0f%% class=%s" % (p["slug"], p["vendorSlug"], p["price"], p["priceHistory"], (p["priceHistory"][-1] - p["priceHistory"][0]) / p["priceHistory"][0] * 100, classify(p)))
allmatch = []
for c in CO:
    rc, n = recompute_pc(c["slug"])
    allmatch.append((c["slug"], c["priceChange"], rc, n))
P("\nrecomputed priceChange == stored for", sum(1 for s, a, b, n in allmatch if abs(a - b) < 0.15), "of", len(CO), "compounds; mismatches:", [(s, a, b, n) for s, a, b, n in allmatch if abs(a - b) >= 0.15])
# is the worst compound's number rendered on its public page?
for f in glob.glob("compound-worst-*.body"):
    slug = f[len("compound-worst-"):-5]
    c = next(x for x in CO if x["slug"] == slug)
    body = load(f).replace("<!-- -->", "")
    tok = ("%+.1f%%" % c["priceChange"]).replace("+", "")
    P("compound page /compounds/%s renders '%s'? ->" % (slug, tok), tok in html.unescape(body), "| contexts:", [html.unescape(m) for m in re.findall(r"[^<>]{0,50}%s[^<>]{0,40}" % re.escape(tok), body)][:3])

# ------------------------------------------------------------------ F. /status
P("\n# F. /status (server-rendered, fetched twice)")
def status_extract(f):
    lines = text_lines(load(f))
    i = lines.index("System status") if "System status" in lines else 0
    # banner is the line right before the h1 "System status" (the first occurrence after the nav)
    idx = [k for k, l in enumerate(lines) if l == "System status"]
    banner = lines[idx[0] - 1] if idx else None
    def card(title):
        k = lines.index(title); return lines[k + 1], lines[k + 2]
    checked = lines[lines.index("Checked") + 1]
    lat = lines[lines.index("· readiness probe answered in") + 1]
    return {"banner": banner, "checked": checked, "latencyMs": lat, "catalog": card("Catalog"), "refresh": card("Refresh engine"), "collectors": card("Collectors"), "alerts": card("Alerts going out"), "intel": card("Intelligence graph")}
s1, s2 = status_extract("status-1.body"), status_extract("status-2.body")
for k in s1: P("  %-11s 1: %s" % (k, s1[k])); P("  %-11s 2: %s" % ("", s2[k]))
P("  values identical apart from Checked/latency? ->", all(s1[k] == s2[k] for k in s1 if k not in ("checked", "latencyMs")))
P("  collector NAMES rendered? ->", "NO — /status renders only counts (enabled/waiting/failing); names of failing/late collectors are not on the public page")
P("  i18n/placeholder check: 'Not reporting' present?", "Not reporting" in load("status-1.body"), "| 'All systems operational' present?", "All systems operational" in load("status-1.body"))

# ------------------------------------------------------------------ G. sitemap
P("\n# G. Sitemap")
sm = load("sitemap.body")
locs = re.findall(r"<loc>([^<]+)</loc>", sm)
kinds = collections.Counter(("products" if "/products/" in u else "compounds" if "/compounds/" in u else "vendors" if "/vendors/" in u else "stacks" if "/stacks" in u else "passports" if "/passports/" in u else "labs" if "/labs/" in u else "static") for u in locs)
P("total <loc>:", len(locs), dict(kinds))
P("/stacks index present:", "https://vialgrade.com/stacks" in locs, "| /stacks/<slug> count:", sum(1 for u in locs if "/stacks/" in u), [u.rsplit("/", 1)[1] for u in locs if "/stacks/" in u])
P("sitemap headers:", [l.strip() for l in load("sitemap.headers").splitlines() if re.match(r"(?i)(cache-control|x-vercel-cache|content-type)", l)])
P("stack detail fetch:", [l for l in load("requests.log").splitlines() if "stack-detail" in l])
sd = text_lines(load("stack-detail.body"))
P("stack page h1-ish lines:", [l for l in sd if l in ("Wolverine",) or l.startswith("Discussed for")][:3])
P("sitemap products == catalog products?", kinds["products"] == len(PR), "| vendors ==", kinds["vendors"] == len(VE), "| compounds ==", kinds["compounds"] == len(CO))

# ------------------------------------------------------------------ vendor-page validation
P("\n# Vendor-page validation (2 external fetches)")
u = load("vendorpage-umbrella.body")
P("umbrella-labs 5-amino-1mq page: banner =", re.findall(r"ORDERS \$100[^<]{0,40}", u)[:1], "| JSON-LD offer price =", re.findall(r'"price":"([\d.]+)"', u)[:2], "| woocommerce price text =", re.findall(r'</span>(\d+\.\d\d)</bdi>', u)[:2], "| VialGrade API price =", next(p["price"] for p in PR if p["slug"] == "umbrella-labs-5-amino-1mq-30ml"))
n = load("vendorpage-nootropic.body")
P("nootropic-source ghrp-2 page: shipping banner =", [html.unescape(x) for x in re.findall(r"free shipping on orders over \$\d+[^<]{0,20}", n, flags=re.I)][:1], "| meta price =", re.findall(r'"price":"([\d.]+)"', n)[:1], "| VialGrade API price =", next(p["price"] for p in PR if p["slug"] == "nootropic-source-ghrp-2"), "history =", next(p["priceHistory"] for p in PR if p["slug"] == "nootropic-source-ghrp-2"))

with open("analyze-output.txt", "w") as f:
    f.write("\n".join(out) + "\n")
print("\n[written analyze-output.txt]")
