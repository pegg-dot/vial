# VialGrade

**Evidence-backed market intelligence for the peptide market.**

[**Explore the live product → vialgrade.com**](https://vialgrade.com)

VialGrade is a production research platform I built to make a fragmented and difficult-to-verify market easier to understand. It brings together peptide listings, vendor signals, laboratory evidence, pricing context, and source history so people can inspect the evidence behind a claim instead of relying on a single number or storefront.

I built the product end to end as an independent engineering project. The public site is the best way to experience it; this repository exists primarily as a portfolio and evaluation artifact.

## What VialGrade does

- **Market intelligence:** follows compounds, vendors, listings, availability, and pricing across a changing market.
- **Evidence-backed research:** connects claims to supporting laboratory and source material when that evidence is available.
- **Verification:** helps distinguish what is supported, what conflicts, and what remains unknown rather than collapsing everything into a binary trust label.
- **Vendor context:** surfaces useful history and signals around the companies behind the listings.
- **Provenance:** keeps source context attached to published information so important claims can be traced back toward where they came from.
- **Operational review:** separates automated collection from higher-impact publication and review decisions.

## Why I built it

The peptide market has a basic information problem. Product pages change, certificates get reposted without enough context, vendors rebrand, prices are hard to compare cleanly, and a polished storefront does not necessarily tell you how strong the underlying evidence is.

I wanted to build something closer to an evidence layer than another directory: a product that treats uncertainty, source quality, and provenance as first-class parts of the interface.

## What the project demonstrates

VialGrade is more than a front-end mockup. The live product includes a real data layer, source-linked research workflows, protected operational tooling, automated verification gates, and a production deployment pipeline.

At a high level, the system combines:

- Next.js, React, and TypeScript
- PostgreSQL-backed production data
- automated collection and review workflows
- evidence and provenance modeling
- authenticated operational surfaces
- automated testing, security checks, and release validation
- Vercel production and isolated preview deployments

The implementation intentionally stays behind the product story here. The goal of the public repository is to show the scope and quality of the work without turning the README into a replication guide.

## Production status

**Current product generation:** V10  
**Production:** [vialgrade.com](https://vialgrade.com)

The production release path is gated by automated verification before new code is allowed to ship. Preview deployments are isolated from the production data environment.

## Security and trust

VialGrade works with authentication, third-party source material, uploaded documents, and production data, so security boundaries are treated as part of the product rather than as an afterthought.

The repository includes automated security and dependency checks, access-control verification, isolated test and preview environments, and production release gates. External content is treated as untrusted, and collected observations are kept distinct from reviewed or published state.

No software is perfectly secure. Responsible disclosure guidance is available in [`SECURITY.md`](SECURITY.md).

## Safety boundary

VialGrade is an informational research product. It does not provide medical advice, guarantee product safety, or independently certify that a physical product is safe for use. Displayed listings, grades, laboratory information, and research context should be interpreted as evidence to inspect, not as medical recommendations.

## Source access

This repository is **source-visible, not open source**.

The code is publicly viewable for portfolio and evaluation purposes. No permission is granted to copy, modify, redistribute, deploy, sublicense, sell, or create derivative works from VialGrade without prior written permission.

See [`LICENSE`](LICENSE) for the source-use terms.

---

**Built by Nate Pegg.** The interface is what visitors see; the harder part was building the data, evidence, verification, review, and release systems underneath it.