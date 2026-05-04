import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:4179/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });
const errors = [];

page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".project-card", { timeout: 8000 });

const result = await page.evaluate(() => {
  const text = document.body.innerText;
  const cards = document.querySelectorAll(".project-card").length;
  const kpis = [...document.querySelectorAll(".kpi strong")].map((node) => node.textContent.trim());
  const detailTitle = document.querySelector(".detail-hero h2")?.textContent.trim();

  document.querySelector('[data-view="timeline"]').click();
  const timelineRows = document.querySelectorAll(".timeline-row").length;

  document.querySelector('[data-view="risks"]').click();
  const riskRows = document.querySelectorAll(".risk-card").length;

  document.querySelector('[data-view="overview"]').click();
  document.querySelector("#searchInput").value = "transplacement";
  document.querySelector("#searchInput").dispatchEvent(new Event("input", { bubbles: true }));
  const filteredCards = document.querySelectorAll(".project-card").length;

  const externalLinks = [...document.querySelectorAll(".link-button")].map((link) => link.href);

  return {
    hasContent: text.includes("Project Command Center"),
    cards,
    kpis,
    detailTitle,
    timelineRows,
    riskRows,
    filteredCards,
    externalLinks,
  };
});

await browser.close();

if (errors.length) {
  throw new Error(`Browser console errors: ${errors.join(" | ")}`);
}

if (!result.hasContent || result.cards < 1 || result.timelineRows < 1 || result.riskRows < 1 || result.filteredCards !== 1) {
  throw new Error(`Dashboard verification failed: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result, null, 2));
