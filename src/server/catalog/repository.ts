import type { QueryResultRow } from "pg";
import { unstable_cache } from "next/cache";
import { countCostSignal } from "@/server/observability/cost-signals";
import type { AgentRun, CatalogSnapshot, Compound, DataOrigin, Product, Vendor } from "@/lib/types";
import { parseTotalMg } from "@/lib/format";
import { compoundMedianPerMg } from "@/lib/curation";
import { getDatabase } from "@/server/db/client";
import { computeListingTrustMap } from "@/server/verify/listing-trust";
import { relativeTime } from "@/lib/format";
import { toStoredGrade } from "@/server/verify/grade-store";
import { getListingPriceSeries, parsePriceChangeBasis } from "@/server/ingest/price-history";

function toOrigin(value: unknown): DataOrigin { return value === "live" ? "live" : "demo"; }
type CompoundRow = QueryResultRow & { slug:string; canonical_name:string; shorthand:string; category:string; description:string; aliases:unknown; listing_count:number; median_price:string|number; price_change:string|number; price_change_basis?:unknown; documentation_coverage:number; accent:unknown; research_note:string; origin?:string; };
type VendorRow = QueryResultRow & { slug:string; display_name:string; initials:string; description:string; location:string; founded:string; profile_status:Vendor["profileStatus"]; product_count:number; documentation_current:number; median_ship_days:string|number; support_score:string|number; last_observed:string; accent:unknown; history:unknown; origin?:string; vendor_kind?:string; real_listings?:string|number; real_coas?:string|number; real_purities?:number[]|null; real_passports?:string|number; real_reviews?:string|number; latest_tested?:string|null; grade_letter?:string|null; grade_band?:string|null; grade_headline?:string|null; grade_rationale?:string|null; grade_summary?:string|null; grade_weighed?:number|string|null; grade_verified?:number|string|null; graded_at?:string|Date|null; };
type ProductRow = QueryResultRow & { slug:string; name:string; compound_slug:string; vendor_slug:string; declared_quantity:string; declared_form:string; price:string|number; previous_price:string|number|null; currency:Product["currency"]; availability:Product["availability"]; shipping_claim:string; evidence_level:Product["evidenceLevel"]; evidence_label:string; report_date:string; report_issuer:string; report_confirmed:boolean; advertises_testing?:boolean; batch_code:string; batch_linked:boolean; sample_origin:string; last_checked:string; rating:string|number; review_count:number; featured:boolean; checkout_mode:Product["checkoutMode"]; price_history:unknown; accent:unknown; evidence:unknown; origin?:string; external_url?:string|null; image_url?:string|null; observed_at?:string|Date|null; };
function jsonArray<T>(value: unknown): T[] { if (Array.isArray(value)) return value as T[]; if (typeof value === "string") { try { const p=JSON.parse(value); return Array.isArray(p)?p as T[]:[]; } catch { return []; } } return []; }
function toCompound(r:CompoundRow):Compound { return { slug:r.slug,name:r.canonical_name,shorthand:r.shorthand,category:r.category,description:r.description,aliases:jsonArray<string>(r.aliases),listings:Number((r as CompoundRow & {real_listings?:string|number}).real_listings??r.listing_count),medianPrice:vendorMedian((r as CompoundRow & {real_prices?:number[]|null}).real_prices)??Number(r.median_price),medianPricePerMg:null,priceChange:Number(r.price_change),priceChangeBasis:parsePriceChangeBasis(r.price_change_basis),documentationCoverage:Number(r.documentation_coverage),coaCount:Number((r as CompoundRow & {real_coas?:string|number}).real_coas??0),medianPurity:vendorMedian((r as CompoundRow & {real_purities?:number[]|null}).real_purities),accent:jsonArray<string>(r.accent).slice(0,3) as Compound["accent"],researchNote:r.research_note,origin:toOrigin(r.origin) }; }
function toVendor(r:VendorRow):Vendor { return { slug:r.slug,name:r.display_name,initials:r.initials,description:r.description,location:r.location,founded:r.founded,profileStatus:r.profile_status,documentationCurrent:Number(r.documentation_current),medianShipDays:Number(r.median_ship_days),supportScore:Number(r.support_score),lastObserved:r.last_observed,accent:jsonArray<string>(r.accent).slice(0,2) as Vendor["accent"],history:jsonArray<Vendor["history"][number]>(r.history),origin:toOrigin(r.origin),kind:r.vendor_kind==="manufacturer"?"manufacturer":"storefront",productCount:Number(r.real_listings??r.product_count),coaCount:Number(r.real_coas??0),medianPurity:vendorMedian(r.real_purities),passportCount:Number(r.real_passports??0),reviewCount:Number(r.real_reviews??0),latestTestedAt:r.latest_tested??null,grade:toStoredGrade(r) }; }
function vendorMedian(v:unknown):number|null{const a=(Array.isArray(v)?v:[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function toProduct(r:ProductRow):Product { const price=Number(r.price); const mg=parseTotalMg(r.declared_quantity,r.name); return { slug:r.slug,name:r.name,compoundSlug:r.compound_slug,vendorSlug:r.vendor_slug,quantity:r.declared_quantity,mg,pricePerMg:mg&&mg>0&&price>0?price/mg:undefined,form:r.declared_form,price,previousPrice:r.previous_price===null?undefined:Number(r.previous_price),currency:r.currency,availability:r.availability,shipping:r.shipping_claim,evidenceLevel:r.evidence_level,evidenceLabel:r.evidence_label,reportDate:r.report_date,reportIssuer:r.report_issuer,reportConfirmed:r.report_confirmed,advertisesTesting:Boolean(r.advertises_testing),batchCode:r.batch_code,batchLinked:r.batch_linked,sampleOrigin:r.sample_origin,lastChecked:relativeTime(r.observed_at)??r.last_checked,observedAt:r.observed_at?new Date(r.observed_at).toISOString():undefined,rating:Number(r.rating),reviewCount:Number(r.review_count),featured:r.featured,checkoutMode:r.checkout_mode,priceHistory:[],pricePoints:[],accent:jsonArray<string>(r.accent).slice(0,3) as Product["accent"],evidence:jsonArray<Product["evidence"][number]>(r.evidence),origin:toOrigin(r.origin),externalUrl:r.external_url??undefined,imageUrl:r.image_url??undefined }; }
async function queryCompounds(){ const db=await getDatabase(); return (await db.query<CompoundRow>(`SELECT c.*,
  (SELECT COUNT(*) FROM lab_test_records t WHERE t.compound_slug=c.slug AND t.is_independent) real_coas,
  (SELECT array_agg(t.purity_pct) FROM lab_test_records t WHERE t.compound_slug=c.slug AND t.is_independent AND t.purity_pct IS NOT NULL) real_purities,
  (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id WHERE p.compound_id=c.id AND p.status='active') real_listings,
  (SELECT array_agg(l.price) FROM listings l JOIN products p ON p.id=l.product_id WHERE p.compound_id=c.id AND p.status='active' AND l.price>0 AND l.availability<>'Unavailable') real_prices
  FROM compounds c ORDER BY c.canonical_name`)).rows.map(toCompound); }
// `real_listings` is the number every vendor surface renders (card tile, product page, home rail),
// and it is the same quantity organizations.product_count stores. It alone among the catalog
// subqueries was missing `p.status='active'`, so a retired product stayed counted here while it was
// gone from every other query — and would have disagreed with the stored column and with the
// reputation panel's denominator the moment a listing was retired.
async function queryVendors(){ const db=await getDatabase(); return (await db.query<VendorRow>(`SELECT o.*,
  (SELECT COUNT(*) FROM listings l JOIN products p ON p.id=l.product_id WHERE p.vendor_id=o.id AND p.status='active') real_listings,
  (SELECT COUNT(*) FROM lab_test_records t WHERE t.vendor_slug=o.slug AND t.is_independent) real_coas,
  (SELECT array_agg(t.purity_pct) FROM lab_test_records t WHERE t.vendor_slug=o.slug AND t.purity_pct IS NOT NULL AND t.is_independent) real_purities,
  (SELECT COUNT(*) FROM batch_passports bp WHERE bp.vendor_id=o.id AND bp.status='published') real_passports,
  (SELECT COUNT(*) FROM vendor_reviews v WHERE v.vendor_slug=o.slug) real_reviews,
  (SELECT MAX(t.tested_at) FROM lab_test_records t WHERE t.vendor_slug=o.slug AND t.is_independent) latest_tested
  FROM organizations o WHERE o.organization_type='vendor' ORDER BY o.display_name`)).rows.map(toVendor); }
async function queryProducts(){ const db=await getDatabase(); const products=(await db.query<ProductRow>(`SELECT l.*,p.name,p.declared_quantity,p.declared_form,c.slug AS compound_slug,o.slug AS vendor_slug FROM listings l JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id JOIN organizations o ON o.id=p.vendor_id WHERE p.status='active' ORDER BY l.featured DESC,l.price ASC,p.name ASC`)).rows.map(toProduct); const trust=await computeListingTrustMap(db,products);
  // Dated change points from price_observations, one query for the whole catalogue. The undated
  // price_history array is dead (migration 53); priceHistory stays as the price-only projection.
  const series=await getListingPriceSeries(db,products.map(p=>p.slug));
  for(const product of products){ product.trust=trust.get(product.slug); const points=series.get(product.slug)??[]; product.pricePoints=points.map(({day,price,available})=>({day,price,available})); product.priceHistory=points.filter(p=>p.available&&p.price!==null).map(p=>p.price as number); }
  return products; }
async function computeCatalogSnapshot():Promise<CatalogSnapshot>{ const [compounds,vendors,products]=await Promise.all([queryCompounds(),queryVendors(),queryProducts()]);
  // Live per-compound median $/mg, computed from the SAME parseTotalMg the cards use — not sticker
  // price. compoundMedianPerMg only counts readable sizes and returns null below the peer floor.
  const perMg=new Map<string,number[]>();
  // Current offers only: a delisted listing's last price is history, not a peer a buyer can pick.
  for(const p of products){ if(p.availability!=="Unavailable"&&p.pricePerMg&&p.pricePerMg>0){ const a=perMg.get(p.compoundSlug); if(a) a.push(p.pricePerMg); else perMg.set(p.compoundSlug,[p.pricePerMg]); } }
  for(const c of compounds){ c.medianPricePerMg=compoundMedianPerMg(perMg.get(c.slug)??[]); }
  // Counted because this is the expensive path the cache exists to avoid. A healthy day is single
  // digits; thousands means something is bypassing the cache, which is exactly how the database
  // quota was exhausted. Fire-and-forget so the count never delays the request.
  void countCostSignal("catalog-compute");
  return {compounds,vendors,products,generatedAt:new Date().toISOString()}; }

// The whole catalog — every compound, vendor and listing — read out of the database.
//
// THE ROOT LAYOUT CALLS THIS, so before it was cached every request to every page on the site
// (~830 public pages) pulled ~550 rows, whether the visitor needed them or not. A crawler sweep
// therefore re-read the entire catalog once per page. That, and not user traffic, is what exhausted
// a database transfer quota on a site with no users.
//
// The catalog now changes once a day, when the collect cron runs, so serving it from cache costs
// nothing in freshness. The cron calls revalidateTag(CATALOG_CACHE_TAG) after it writes, so new
// data appears immediately rather than waiting out the window.
//
// Development bypasses the cache entirely: local data changes come from scripts, and a stale
// catalog that ignores them for hours is a debugging trap.
export const CATALOG_CACHE_TAG = "catalog";
const cachedCatalogSnapshot = unstable_cache(computeCatalogSnapshot, ["catalog-snapshot"], {
  tags: [CATALOG_CACHE_TAG],
  revalidate: 21600, // 6h ceiling; the cron tag-invalidates well before this in practice
});
export async function getCatalogSnapshot():Promise<CatalogSnapshot>{
  if (process.env.NODE_ENV !== "production") return computeCatalogSnapshot();
  return cachedCatalogSnapshot();
}
// Single-entity lookups, served from the CACHED snapshot rather than re-reading the table.
//
// These each used to run their full query and then .find() one row out of it in JavaScript, and
// none of them were cached or even per-request deduped. One product page view therefore executed
// roughly three full listings reads (generateMetadata calls getProductBySlug and getVendorBySlug,
// then the page body calls getProductBySlug again plus getProductsByCompoundSlug), two full vendor
// reads and a full compound read — for a single page, uncached, on every hit.
//
// Caching the page panels earlier fixed only half the problem; this was the other half. The
// snapshot they now read is already cached under CATALOG_CACHE_TAG and invalidated by the collect
// cron, so freshness is identical and the reads collapse to one shared cached load.
export async function getCompoundBySlug(slug:string){ return (await getCatalogSnapshot()).compounds.find(x=>x.slug===slug); }
export async function getVendorBySlug(slug:string){ return (await getCatalogSnapshot()).vendors.find(x=>x.slug===slug); }
export async function getProductBySlug(slug:string){ return (await getCatalogSnapshot()).products.find(x=>x.slug===slug); }
export async function getProductsByCompoundSlug(slug:string){ return (await queryProducts()).filter(x=>x.compoundSlug===slug); }
export async function getProductsByVendorSlug(slug:string){ return (await queryProducts()).filter(x=>x.vendorSlug===slug); }
export async function getRecentAgentRuns(limit=20):Promise<AgentRun[]> {
 const db=await getDatabase(); const result=await db.query<QueryResultRow & {id:string;workflow:string;target_type:string;target_id:string|null;status:string;started_at:Date|string;duration_ms:number|null;proposed_changes:number;published_changes:number;blocked_reason:string|null;tools:unknown}>(`SELECT r.*,COALESCE(jsonb_agg(DISTINCT tc.tool_name) FILTER (WHERE tc.tool_name IS NOT NULL),'[]'::jsonb) AS tools FROM agent_runs r LEFT JOIN tool_calls tc ON tc.run_id=r.id GROUP BY r.id ORDER BY r.started_at DESC LIMIT $1`,[limit]);
 return result.rows.map(r=>({id:r.id.replace(/^run:/,"").slice(0,12),workflow:r.workflow,target:r.target_id?`${r.target_type}:${r.target_id.replace(/^[^:]+:/,"")}`:r.target_type,status:r.status==="completed"?"review":r.status==="failed"?"blocked":r.status as AgentRun["status"],startedAt:new Date(r.started_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}),duration:r.duration_ms?`${(r.duration_ms/1000).toFixed(1)}s`:"running",tools:jsonArray<string>(r.tools),proposedChanges:Number(r.proposed_changes),publishedChanges:Number(r.published_changes),reason:r.blocked_reason??undefined}));
}
