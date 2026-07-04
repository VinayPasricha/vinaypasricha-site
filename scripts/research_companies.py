# -*- coding: utf-8 -*-
import json, sys
from playwright.sync_api import sync_playwright

B = "http://localhost:8080"

COMPANIES = [
 {"name":"ScaleX","url":"https://scalex.club","text":
  "ScaleX is a fully managed performance marketing agency for coaches, consultants and EdTech brands, handling media buying on Meta and Google, content and creative, video production and business strategy. Philosophy: 'No Jargon. Just one KPI - Profits' — measurable ROI over vanity metrics, a speed-led, execution and results focused culture that moves fast to ship campaigns. Meta Business Partner and Zoom partner; claims 65% of clients tripled profits in 6 months, 95% client retention, 40+ entrepreneurs served. Operates from Bangalore with a distributed team managing millions in monthly ad spend; prizes long-term relationships, ownership and accountability for client outcomes."},
 {"name":"Lawyered","url":"https://lawyered.in","text":
  "Lawyered is a legal-tech startup founded by Himanshu Gupta solving recurring legal risks in India's mobility sector via LOTS247 (India's first roadside legal assistance platform) and ChallanPay. Mission: build India's go-to platform for identifying and resolving legal risks in mobility. Traction: 30 lakh+ vehicles protected, 80,000+ lawyers across 98% of pin codes, 99% resolution rate; recently raised Rs 8.5 crore. Fast-paced, high-growth, execution-focused culture that ships and solves tangible problems; built on empathy and expertise, attracting problem-solvers and innovators, with knowledge-sharing, ownership, creativity and compassionate support; ambitious expansion into finance, real estate, healthcare and e-commerce."},
 {"name":"Simulanis","url":"https://simulanis.com","text":
  "Simulanis is an India-based virtual and augmented reality company delivering immersive training, simulation and XR solutions to 400+ enterprise clients globally. Platform Simulanis Uno unifies training, guidance, collaboration, simulation, authoring and monitoring; industry simulators for welding, paint, forklift, fire and scaffold with haptics and analytics. Serves mission-critical industries — automotive, pharma, oil and gas, defense, energy, construction. A mature, process-led, quality-first enterprise player (not a typical startup) with industrial depth, rigorous methodical delivery, 55+ awards ('India's Most Awarded AR/VR company'), offices in Noida and Loughborough UK, backed by strategic investors; innovation grounded in measurable real-world impact and operational safety."},
 {"name":"VivaConnect","url":"https://vivaconnect.co","text":
  "VivaConnect (now Helo.ai) is a cloud communication platform built on 25 years of enterprise messaging expertise, enabling businesses to engage via SMS, WhatsApp, RCS, voice bots, chatbots and email. AI-first messaging products — Broadcast, Conversations, Shortify, Verify, Hub — that help businesses engage customers faster, smarter and at massive scale ('personalised for billions with AI'). Serves enterprises in banking, fintech, insurance, e-commerce, retail and utilities (Bajaj Finance, Kotak Mahindra Bank). Audience-first, inclusive philosophy tailoring engagement to local languages and cultures; long, stable heritage balancing innovation with pragmatic customer needs; established, scaled and reliability-focused."},
]

DRIVE = """
(company) => {
  const r = { name: company.name };
  let res = OF.icp.addCandidateManual({ company_name: company.name, website_url: company.url });
  if (res.error) { r.error = 'addCandidate: ' + res.error; return r; }
  const cid = res.candidate.candidate_id;
  OF.icp.markForResearch(cid);
  const sr = OF.pubintel.startResearch(cid, company.url);
  if (sr.error) { r.error = 'startResearch: ' + sr.error; return r; }
  const rid = sr.research.research_id;
  const imp = OF.pubintel.importSource(rid, { source_type:'company_website', raw_text: company.text, source_url: company.url, source_title: company.name + ' website' });
  r.signals = (imp.signals || []).length;
  const est = OF.pubintel.generateEstimate(rid);
  if (est.error) { r.error = 'generateEstimate: ' + est.error; return r; }
  OF.pubintel.generatePage(rid);
  const store = OF.load();
  const page = (store.pub_pages || []).filter(p => p.research_id === rid)[0];
  const estimate = (store.pub_estimates || []).filter(e => e.research_id === rid)[0];
  r.slug = page ? page.slug : null;
  const dims = estimate ? estimate.dimensions || {} : {};
  r.totalDims = Object.keys(dims).length;
  r.dimsFilled = Object.values(dims).filter(d => d && d.confidence && d.confidence !== 'none').length;
  return r;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    pg.goto(B + "/studio/public-intel", wait_until="networkidle")
    pg.wait_for_function("() => window.OF && window.OF.pubintel && window.OF.icp", timeout=20000)
    # clean slate
    pg.evaluate("() => { try{ if(window.OF.pubintel.resetPublic) OF.pubintel.resetPublic(); }catch(e){} localStorage.removeItem('of.runtime.v1'); }")
    results = []
    for c in COMPANIES[:1]:
        results.append(pg.evaluate(DRIVE, c))
    sys.stdout.buffer.write(b"=== RESEARCH RESULTS ===\n")
    for r in results:
        sys.stdout.buffer.write((json.dumps(r, ensure_ascii=False) + "\n").encode("utf-8"))

    # Now verify the public company page displays them
    sys.stdout.buffer.write(b"\n=== COMPANY PAGE DISPLAY CHECK ===\n")
    for r in results:
        if not r.get("slug"): continue
        cp = b.new_page()
        cp.goto(B + "/frequency/company?company=" + r["slug"], wait_until="networkidle")
        cp.wait_for_timeout(1200)
        info = cp.evaluate("""() => {
          const t = document.body.innerText;
          const opts = [...document.querySelectorAll('select option')].map(o=>o.textContent.trim()).filter(Boolean);
          return { len: t.length, hasName: t.length>0, dimRows: document.querySelectorAll('[class*=dim],[class*=dimension]').length, selectorCount: opts.length, options: opts.slice(0,8) };
        }""")
        sys.stdout.buffer.write((r["name"] + " /frequency/company?company=" + r["slug"] + " -> " + json.dumps(info, ensure_ascii=False) + "\n").encode("utf-8"))
        cp.close()

    # Export the store so it can be loaded into the demo browser
    store = pg.evaluate("() => localStorage.getItem('of.runtime.v1')")
    open("/tmp/of_runtime_export.json", "w", encoding="utf-8").write(store or "")
    sys.stdout.buffer.write(("\nstore export bytes: " + str(len(store or "")) + "\n").encode("utf-8"))
    b.close()
