// Браузерная проверка общего списка «Консьержа»: у «[Данные KYC]» нет кнопок закрытия, у обычных заявок — как раньше.
// usage: node concierge_list_ui.cjs <out/app.js> [screenshot-dir]
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const js = fs.readFileSync(process.argv[2], "utf8");
const css = fs.readFileSync(path.join(path.dirname(process.argv[2]), "tw.css"), "utf8");
const shots = process.argv[3];
let pass = 0, fail = 0;
const check = (n, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : `  (ожидалось: ${JSON.stringify(want)}, получено: ${JSON.stringify(got)})`}`); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: shots ? 2 : 1 });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) => {
    const u = r.request().url();
    if (u.includes("/app.js")) return r.fulfill({ body: js, contentType: "text/javascript" });
    if (u.includes("/tw.css")) return r.fulfill({ body: css, contentType: "text/css" });
    if (!u.startsWith("http://stand.test/")) return r.abort();
    return r.fulfill({ body: '<!doctype html><html class="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/tw.css"></head><body style="background:#09090b;color:#d4d4d8;font-family:system-ui"><div id="root"></div><script type="module" src="/app.js"></script></body></html>', contentType: "text/html" });
  });
  await page.goto("http://stand.test/admin/concierge");
  await page.getByText("Трансфер из аэропорта").waitFor({ timeout: 15000 });
  const kyc = page.locator("article", { hasText: "[Данные KYC]" });
  const plain = page.locator("article", { hasText: "Трансфер из аэропорта" });
  check("KYC-запрос: нет «Отметить выполненным», «Невозможно выполнить» и выбора статуса", [await kyc.getByRole("button", { name: "Отметить выполненным" }).count(), await kyc.getByRole("button", { name: "Невозможно выполнить" }).count(), await kyc.locator("select").count()], [0, 0, 0]);
  check("KYC-запрос: есть «Ответить» и ссылка на карточку резидентки", [await kyc.getByRole("button", { name: "Ответить" }).count(), await kyc.getByRole("link", { name: "Открыть карточку" }).getAttribute("href")], [1, "/admin/database/10000000-0000-4000-8000-000000000011#identity-title"]);
  check("KYC-запрос: пояснение про блок Identity & KYC", (await kyc.getByTestId("kyc-only").innerText()).includes("только в карточке резидентки"), true);
  check("обычная заявка: все прежние кнопки и выбор статуса", [await plain.getByRole("button", { name: "Отметить выполненным" }).count(), await plain.getByRole("button", { name: "Невозможно выполнить" }).count(), await plain.locator("select").count(), await plain.getByRole("button", { name: "Ответить" }).count()], [1, 1, 1, 1]);
  await kyc.locator("textarea").fill("Проверяем документы");
  await kyc.getByRole("button", { name: "Ответить" }).click();
  await page.waitForTimeout(200);
  check("ответ по KYC-запросу: статус open → in_progress, без закрытия", (await page.evaluate(() => window.__calls)).at(-1), { fn: "reply", input: { id: "aaaaaaaa-1f7b-4555-932f-a4295b27f94f", status: "in_progress", message: "Проверяем документы" } });
  await plain.locator("textarea").fill("Трансфер заказан");
  await plain.getByRole("button", { name: "Отметить выполненным" }).click();
  await page.waitForTimeout(200);
  check("обычная заявка закрывается как раньше", (await page.evaluate(() => window.__calls)).at(-1), { fn: "reply", input: { id: "bbbbbbbb-1f7b-4555-932f-a4295b27f94f", status: "done", message: "Трансфер заказан" } });
  if (shots) await kyc.screenshot({ path: `${shots}/4-concierge-kyc-request.png` });
  check("ошибок JS нет", errors, []);
  await browser.close();
  console.log(`ИТОГО (UI): PASS ${pass} · FAIL ${fail}`);
  process.exit(fail ? 1 : 0);
})();
