// Renders the brand SVGs to PNG at the sizes anyone actually asks for. Uses the same headless
// Chromium the e2e suite uses, so what ships is what a browser draws — not a converter's guess.
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";

const OUT = process.argv[2] ?? "public/brand";
await mkdir(OUT, { recursive: true });

const JOBS = [
  { svg: "public/brand/vialgrade-icon.svg", name: "vialgrade-icon", sizes: [1024, 512, 256, 128, 64, 32], w: 512, h: 512, bg: null },
  { svg: "public/brand/vialgrade-v-mark.svg", name: "vialgrade-v-mark-white", sizes: [1024, 512], w: 236, h: 242, bg: null, color: "#ffffff" },
  { svg: "public/brand/vialgrade-v-mark.svg", name: "vialgrade-v-mark-black", sizes: [1024, 512], w: 236, h: 242, bg: null, color: "#111214" },
  { svg: "public/brand/vialgrade-wordmark.svg", name: "vialgrade-wordmark", sizes: [2100, 1050], w: 700, h: 200, bg: null },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const job of JOBS) {
    const svg = await readFile(job.svg, "utf8");
    for (const size of job.sizes) {
      const scale = size / job.w;
      const page = await browser.newPage({
        viewport: { width: Math.round(job.w * scale), height: Math.round(job.h * scale) },
        deviceScaleFactor: 1,
      });
      await page.setContent(
        `<html><body style="margin:0;${job.color ? `color:${job.color};` : ""}background:transparent">
           <div style="width:${job.w}px;height:${job.h}px;transform:scale(${scale});transform-origin:0 0">${svg}</div>
         </body></html>`,
        { waitUntil: "load" },
      );
      const file = `${OUT}/${job.name}-${size}.png`;
      await page.screenshot({ path: file, omitBackground: true });
      console.log(`  ${file}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
process.exit(0);
