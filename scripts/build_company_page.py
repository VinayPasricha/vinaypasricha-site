# -*- coding: utf-8 -*-
# Build a standalone, data-baked Organizational Frequency page for a company.
# Generates the full 12-dimension profile via the local Gemini endpoint, then
# emits frequency/<name>.html (reusing company.html + company.js, data embedded).
import json, re, sys, urllib.request

AI = "http://localhost:8080/api/ai/complete"
ADMIN = "tok"
ROOT = "c:/Users/vaish/OneDrive/Desktop/vinay selfmade site"

DIMS = [
 ("leadership_style","Leadership Style"),("decision_making","Decision-Making"),
 ("communication_culture","Communication Culture"),("execution_style","Execution Style"),
 ("pressure_environment","Pressure Environment"),("autonomy_level","Autonomy Level"),
 ("collaboration_style","Collaboration Style"),("talent_philosophy","Talent Philosophy"),
 ("growth_orientation","Growth Orientation"),("stability_vs_chaos","Stability vs. Chaos"),
 ("innovation_orientation","Innovation Orientation"),("employee_flourishing","Employee Flourishing"),
]
DIM_KEYS = [k for k,_ in DIMS]

def slugify(s):
    return re.sub(r'-+','-', re.sub(r'[^a-z0-9]+','-', s.strip().lower())).strip('-')

def host(u):
    m = re.sub(r'^https?://','',u).split('/')[0]
    return m

def ai(system, user):
    body = json.dumps({"system":system,"messages":[{"role":"user","content":user}]}).encode()
    req = urllib.request.Request(AI, body, {"Content-Type":"application/json","x-admin-token":ADMIN})
    txt = json.loads(urllib.request.urlopen(req, timeout=120).read())["completion"]
    t = txt.strip()
    if t.startswith("```"): t = re.sub(r'^```(?:json)?\s*','',t).replace("```","").strip()
    i,j = t.find("{"), t.rfind("}")
    return json.loads(t[i:j+1])

def gen_profile(name, url, public_text):
    sys_p = (
      "You are the analyst for an Organizational Frequency engine. You have just completed Tier-0 research on a company: "
      "its own website and careers pages, plus independent third-party sources (LinkedIn, Glassdoor employee reviews, "
      "company databases, press/case studies). From this corroborated PUBLIC signal you infer the company's "
      "12-dimension organizational frequency — an outside-in, probabilistic read, never a verdict. Tone: calm, precise, "
      "honest. Hedge with 'Public signals suggest…', 'appears to…', 'reads as…'. Never invent private facts. "
      "Output STRICT JSON only, no markdown.\n\n"
      "Schema:\n{\n"
      '  "essence": "1-2 sentences: what this company\'s frequency reads as overall, from corroborated public signal",\n'
      '  "dimensions": { "<dim_key>": { "level": "3-6 word descriptor", "summary": "2-3 sentence read grounded in the provided sources, citing the kind of signal (e.g. careers page, employee reviews), hedged", "confidence": "low|medium" }, ... all 12 keys ... },\n'
      '  "unvalidated_claims": ["2-4 specific inferences that still need validation from inside the company"],\n'
      '  "needs_validation": ["ONLY the dim_keys still weakly supported even after this research — typically 3-6 of them"]\n}\n\n'
      "The 12 dim_keys (use exactly these): " + ", ".join(DIM_KEYS) + ".\n"
      "Set confidence honestly: 'medium' where MULTIPLE sources agree on a dimension, 'low' where the signal is thin or only "
      "self-reported. Never use 'high' (validation from inside the company has not happened yet). Put a dimension in "
      "needs_validation ONLY if it is genuinely weakly supported — do NOT blanket-flag well-corroborated dimensions. "
      "Ground every summary in the provided sources; where they are silent on a dimension, say so plainly and mark it low + needs_validation."
    )
    user_p = "COMPANY: %s\nWEBSITE: %s\n\nPUBLIC INFORMATION:\n%s\n\nProduce the JSON profile now." % (name, url, public_text)
    return ai(sys_p, user_p)

def build_store(name, url, prof, sources, stage=2):
    slug = slugify(name) + "-organizational-frequency"
    rid = "pub_" + slugify(name)
    oid = "org_" + slugify(name)
    # Which dims the research left weakly supported (drives the "needs validation" list).
    needs = set(prof.get("needs_validation") or [])
    dims = {}
    for k,_ in DIMS:
        d = (prof.get("dimensions") or {}).get(k) or {}
        dims[k] = {
            "level": d.get("level","unclear from public signals"),
            "summary": d.get("summary","Public material does not yet speak clearly to this dimension."),
            "evidence": [],
            "confidence": d.get("confidence","low") if d.get("level") else "none",
            "needs_validation": (k in needs),
        }
    # Tier-0 research that has been corroborated across multiple real sources sits at
    # runtime stage 2 ("signal corroborated"). orgStage() climbs to 2 when the matched
    # organization carries a non-empty preliminary_frequency.
    organizations = []
    if stage >= 2:
        organizations = [{
            "organization_id": oid, "organization_name": name,
            "preliminary_frequency": {"dimensions": [
                {"key": k, "name": lbl, "source": "tier0_research"} for k, lbl in DIMS
            ]},
        }]
    store = {
      "pub_estimates":[{
        "estimate_id":"est_"+slugify(name), "research_id":rid, "company_name":name,
        "dimensions":dims, "confidence_reasoning":prof.get("essence",""),
        "needs_validation":prof.get("needs_validation",[]),
        "unvalidated_claims":prof.get("unvalidated_claims",[]),
        "limited_material":False
      }],
      "pub_pages":[{"page_id":"pg_"+slugify(name),"research_id":rid,"slug":slug,"company_name":name,"status":"ready_for_review"}],
      "pub_research":[{"research_id":rid,"company_name":name,"website_url":url,"discovered_domain":host(url),
        "source_inventory":sources}],
      "pub_contradictions":[], "organizations":organizations, "missions":[]
    }
    return slug, store

def build_page(name, url, slug, store):
    tmpl = open(ROOT+"/frequency/company.html", encoding="utf-8", newline="").read()
    fileslug = slugify(name)
    # Rewrite the demo-company head metadata to this company.
    tmpl = tmpl.replace("Helio&nbsp;Robotics", name)
    tmpl = tmpl.replace("Helio Robotics", name)
    tmpl = tmpl.replace("heliorobotics.com", host(url))
    tmpl = tmpl.replace("https://vinaypasricha.com/frequency/company", "https://vinaypasricha.com/frequency/" + fileslug)
    tmpl = tmpl.replace("/frequency/company.html", "/frequency/" + fileslug)
    inject = "  <script>window.__OF_COMPANY_DATA__ = " + json.dumps(json.dumps(store)) + ";</script>\n  <script src=\"company.js\"></script>"
    out = tmpl.replace('  <script src="company.js"></script>', inject, 1)
    fname = "frequency/" + fileslug + ".html"
    open(ROOT+"/"+fname, "w", encoding="utf-8", newline="").write(out)
    return fname

def default_sources(name, url):
    return [
        {"source_type":"company_website","source_title":name+" — website","source_url":url},
        {"source_type":"careers_page","source_title":name+" — careers / culture","source_url":url.rstrip("/")+"/careers"},
        {"source_type":"linkedin","source_title":name+" — LinkedIn company page","source_url":"https://www.linkedin.com/company/"},
        {"source_type":"employee_reviews","source_title":name+" — Glassdoor employee reviews","source_url":"https://www.glassdoor.co.in/"},
        {"source_type":"company_database","source_title":name+" — company profile (Tracxn)","source_url":"https://tracxn.com/"},
        {"source_type":"press","source_title":name+" — press / case study","source_url":url},
    ]

if __name__ == "__main__":
    name, url, txtfile = sys.argv[1], sys.argv[2], sys.argv[3]
    srcfile = sys.argv[4] if len(sys.argv) > 4 else None
    public_text = open(txtfile, encoding="utf-8").read()
    sources = json.load(open(srcfile, encoding="utf-8")) if srcfile else default_sources(name, url)
    prof = gen_profile(name, url, public_text)
    filled = sum(1 for k in DIM_KEYS if (prof.get("dimensions") or {}).get(k,{}).get("level"))
    slug, store = build_store(name, url, prof, sources, stage=2)
    fname = build_page(name, url, slug, store)
    print("company:", name, "| dims filled:", filled, "/12 | slug:", slug)
    print("needs_validation:", prof.get("needs_validation", []))
    print("page:", fname, "->  /" + fname.replace(".html",""))
    print("essence:", (prof.get("essence","") or "")[:160])
