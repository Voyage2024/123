/* ──────────────────────────────────────────────────────────────────────
 * VOYAGE · Сборка PDF карточки резидентки (в браузере, pdf-lib)
 *
 * Данные приходят из server actions (app/actions/resident-dossier.ts):
 * сервер решает, ЧТО можно отдать роли, здесь только вёрстка.
 *  - buildPresentationPdf — тёмный буклет: обложка с фото, имя, бейджи,
 *    параметры, ID; вторая страница — портфолио и «О себе».
 *  - buildDossierPdf — полное досье владельца: контакты, KYC-история,
 *    фото, приложения с файлами паспорта; водяной знак с email владельца
 *    и номером записи audit_logs на каждой странице.
 *
 * Шрифты: public/fonts/voyage-pdf/*.ttf (Cormorant Garamond + Inter,
 * латиница + кириллица, лицензия OFL). Фото перекодируются через canvas
 * в JPEG, поэтому webp/heic из браузера тоже попадают в PDF.
 * ──────────────────────────────────────────────────────────────────── */

import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
  clip,
  degrees,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DossierPdfData, PdfBadge, PresentationPdfData } from "@/lib/resident-pdf/types";

/* ── Ресурсы (браузер по умолчанию, в тестах подменяются) ─────────── */

export type PdfImageBytes = { bytes: Uint8Array; type: "jpg" | "png" };

export type PdfAssets = {
  font: (file: string) => Promise<ArrayBuffer | Uint8Array>;
  image: (url: string) => Promise<PdfImageBytes | null>;
  pdf: (url: string) => Promise<Uint8Array | null>;
};

export const PDF_FONT_BASE = "/fonts/voyage-pdf";
const FONT_FILES = {
  display: "CormorantGaramond-Medium.ttf",
  displayItalic: "CormorantGaramond-MediumItalic.ttf",
  sans: "Inter-Regular.ttf",
  sansBold: "Inter-SemiBold.ttf",
} as const;

const MAX_IMAGE_SIDE = 1800;

async function blobToJpeg(blob: Blob): Promise<PdfImageBytes | null> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#0b0b0c";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!out) return null;
  return { bytes: new Uint8Array(await out.arrayBuffer()), type: "jpg" };
}

export function browserAssets(): PdfAssets {
  return {
    async font(file) {
      const res = await fetch(`${PDF_FONT_BASE}/${file}`, { cache: "force-cache" });
      if (!res.ok) throw new Error(`font_${res.status}`);
      return res.arrayBuffer();
    },
    async image(url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return await blobToJpeg(await res.blob());
      } catch {
        return null;
      }
    },
    async pdf(url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    },
  };
}

/** Отдаёт файл браузеру на сохранение */
export function savePdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/* ── Палитра и геометрия ─────────────────────────────────────────── */

const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  bg: hex("#0b0b0c"),
  panel: hex("#141416"),
  panel2: hex("#1a1a1d"),
  line: hex("#2a2a2e"),
  gold: hex("#c9a961"),
  goldSoft: hex("#e6d3a3"),
  ivory: hex("#f4efe6"),
  text: hex("#d6d3cd"),
  muted: hex("#8a8a90"),
  dim: hex("#5c5c62"),
  rose: hex("#f2a7a7"),
  black: hex("#000000"),
};

const A4 = { w: 595.28, h: 841.89 };

type Fonts = { display: PDFFont; displayItalic: PDFFont; sans: PDFFont; sansBold: PDFFont };

async function loadFonts(doc: PDFDocument, assets: PdfAssets): Promise<Fonts> {
  doc.registerFontkit(fontkit);
  const [display, displayItalic, sans, sansBold] = await Promise.all([
    assets.font(FONT_FILES.display),
    assets.font(FONT_FILES.displayItalic),
    assets.font(FONT_FILES.sans),
    assets.font(FONT_FILES.sansBold),
  ]);
  return {
    display: await doc.embedFont(display),
    displayItalic: await doc.embedFont(displayItalic),
    sans: await doc.embedFont(sans),
    sansBold: await doc.embedFont(sansBold),
  };
}

/* ── Текст ───────────────────────────────────────────────────────── */

const charsetCache = new WeakMap<PDFFont, Set<number>>();

/** Убирает символы, которых нет в шрифте (эмодзи и т.п.), чтобы не было «квадратиков» */
function safe(font: PDFFont, text: string): string {
  let set = charsetCache.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    charsetCache.set(font, set);
  }
  let out = "";
  for (const ch of text.replace(/\r\n?/g, "\n").replace(/\t/g, " ")) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || set.has(cp)) out += ch;
    else if (cp === 0x2019 || cp === 0x2018) out += "'";
  }
  // после вырезанных эмодзи не оставляем «слово .» и двойные пробелы
  return out.replace(/[ \u00a0]+([.,!?;:])/g, "$1").replace(/ {2,}/g, " ");
}

function width(font: PDFFont, text: string, size: number) {
  return font.widthOfTextAtSize(text, size);
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(font, text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (let word of words) {
      // слишком длинное «слово» (ссылка, кошелёк) режем по символам
      while (width(font, word, size) > maxWidth) {
        let cut = word.length - 1;
        while (cut > 1 && width(font, word.slice(0, cut), size) > maxWidth) cut -= 1;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const next = line ? `${line} ${word}` : word;
      if (width(font, next, size) <= maxWidth) line = next;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const s = safe(font, text).replace(/\n/g, " ");
  if (width(font, s, size) <= maxWidth) return s;
  let cut = s.length;
  while (cut > 1 && width(font, `${s.slice(0, cut)}…`, size) > maxWidth) cut -= 1;
  return `${s.slice(0, cut)}…`;
}

/** Капитель с разрядкой: «VOYAGE · PRIVATE CLUB» */
function spaced(page: PDFPage, text: string, o: { x: number; y: number; font: PDFFont; size: number; tracking: number; color: RGB; opacity?: number; align?: "left" | "right" | "center" }) {
  const s = safe(o.font, text);
  const total = [...s].reduce((sum, ch) => sum + width(o.font, ch, o.size) + o.tracking, 0) - o.tracking;
  let x = o.align === "right" ? o.x - total : o.align === "center" ? o.x - total / 2 : o.x;
  for (const ch of s) {
    page.drawText(ch, { x, y: o.y, size: o.size, font: o.font, color: o.color, opacity: o.opacity });
    x += width(o.font, ch, o.size) + o.tracking;
  }
  return total;
}

function spacedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  const s = safe(font, text);
  return [...s].reduce((sum, ch) => sum + width(font, ch, size) + tracking, 0) - tracking;
}

/* ── Фигуры ──────────────────────────────────────────────────────── */

function roundRectPath(w: number, h: number, r: number) {
  const k = 0.5523 * r;
  return [
    `M ${r} 0`, `H ${w - r}`, `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `V ${h - r}`, `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `H ${r}`, `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `V ${r}`, `C 0 ${r - k} ${r - k} 0 ${r} 0`, "Z",
  ].join(" ");
}

/** Прямоугольник со скруглением; x,y — левый НИЖНИЙ угол, как в pdf-lib */
function roundRect(page: PDFPage, x: number, y: number, w: number, h: number, r: number, o: { fill?: RGB; border?: RGB; borderWidth?: number; opacity?: number; borderOpacity?: number }) {
  page.drawSvgPath(roundRectPath(w, h, Math.min(r, h / 2, w / 2)), {
    x,
    y: y + h,
    color: o.fill,
    borderColor: o.border,
    borderWidth: o.border ? o.borderWidth ?? 0.6 : undefined,
    opacity: o.opacity,
    borderOpacity: o.borderOpacity,
  });
}

/** Фото «cover» в рамке с обрезкой; лицо обычно в верхней трети — сдвигаем вверх */
function drawCover(page: PDFPage, img: PDFImage, x: number, y: number, w: number, h: number, focusTop = 0.18) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + h - dh + (dh - h) * focusTop;
  page.pushOperators(pushGraphicsState(), rectangle(x, y, w, h), clip(), endPath());
  page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });
  page.pushOperators(popGraphicsState());
}

/**
 * Плавное затемнение без «полосок»: вложенные полупрозрачные прямоугольники
 * от края-якоря. Непрозрачность у якоря = max, к другому краю — 0 (smoothstep).
 */
function fade(page: PDFPage, x: number, y: number, w: number, h: number, color: RGB, anchor: "bottom" | "top", max: number, steps = 64) {
  const cap = Math.min(max, 0.985);
  const alpha = 1 - Math.pow(1 - cap, 1 / steps);
  const smooth = (u: number) => u * u * (3 - 2 * u);
  for (let i = 1; i <= steps; i += 1) {
    const target = 1 - Math.pow(1 - alpha, i);
    // ищем u: max·(1 − smooth(u)) = target
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 24; k += 1) {
      const mid = (lo + hi) / 2;
      if (max * (1 - smooth(mid)) > target) lo = mid;
      else hi = mid;
    }
    const rh = h * lo;
    if (rh <= 0.2) continue;
    page.drawRectangle({ x, y: anchor === "bottom" ? y : y + h - rh, width: w, height: rh, color, opacity: alpha });
  }
}

function pageBg(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: C.bg });
}

function pill(page: PDFPage, f: Fonts, text: string, x: number, y: number, variant: "gold" | "outline" | "muted") {
  const size = 7.2;
  const tracking = 1.4;
  const tw = spacedWidth(f.sansBold, text, size, tracking);
  const w = tw + 20;
  const h = 18;
  if (variant === "gold") roundRect(page, x, y, w, h, 9, { fill: C.gold });
  else roundRect(page, x, y, w, h, 9, { border: variant === "outline" ? C.gold : C.line, borderWidth: 0.7, fill: C.bg, opacity: 0.55 });
  spaced(page, text, { x: x + 10, y: y + 6, font: f.sansBold, size, tracking, color: variant === "gold" ? C.bg : variant === "outline" ? C.goldSoft : C.muted });
  return w;
}

function badgePills(page: PDFPage, f: Fonts, badge: PdfBadge, x: number, y: number) {
  let cx = x;
  cx += pill(page, f, badge.circleTitle.toUpperCase(), cx, y, "outline") + 6;
  if (badge.vip) cx += pill(page, f, "VIP · KYC 3", cx, y, "gold") + 6;
  else if (badge.kycLevel > 0) cx += pill(page, f, `VERIFIED · KYC ${badge.kycLevel}/3`, cx, y, "muted") + 6;
  return cx - x;
}

async function embedPhoto(doc: PDFDocument, assets: PdfAssets, url: string): Promise<PDFImage | null> {
  try {
    const img = await assets.image(url);
    if (!img) return null;
    return img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    return null;
  }
}

function dateLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function dateTimeLabel(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" })} UTC`;
}

/* ════════════════════════════════════════════════════════════════════
 * 1. Презентационный буклет
 * ════════════════════════════════════════════════════════════════════ */

export async function buildPresentationPdf(data: PresentationPdfData, assets: PdfAssets = browserAssets()): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`VOYAGE · ${data.displayName} · №${data.memberNo}`);
  doc.setAuthor("VOYAGE Private Club");
  doc.setSubject("Resident presentation");
  doc.setCreator("VOYAGE");
  doc.setProducer("VOYAGE");
  const f = await loadFonts(doc, assets);

  const photos: PDFImage[] = [];
  for (const url of data.photos) {
    const img = await embedPhoto(doc, assets, url);
    if (img) photos.push(img);
  }

  const shortId = data.profileId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const { w: W, h: H } = A4;

  /* ── Обложка ── */
  const page = doc.addPage([W, H]);
  pageBg(page);
  const photoBottom = H * 0.37;
  const photoH = H - photoBottom;
  if (photos[0]) {
    drawCover(page, photos[0], 0, photoBottom, W, photoH);
  } else {
    page.drawRectangle({ x: 0, y: photoBottom, width: W, height: photoH, color: C.panel });
    const initial = safe(f.display, data.displayName.charAt(0) || "V");
    const size = 220;
    page.drawText(initial, { x: W / 2 - width(f.display, initial, size) / 2, y: photoBottom + photoH / 2 - 70, size, font: f.displayItalic, color: C.gold, opacity: 0.35 });
  }
  // затемнение сверху (под логотип) и плавный переход фото в фон
  fade(page, 0, H - 130, W, 130, C.bg, "top", 0.7);
  page.drawRectangle({ x: 0, y: photoBottom - 1, width: W, height: 2, color: C.bg });
  fade(page, 0, photoBottom, W, 240, C.bg, "bottom", 1);

  // золотая рамка
  page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: C.gold, borderWidth: 0.5, borderOpacity: 0.45 });

  spaced(page, "VOYAGE", { x: 42, y: H - 58, font: f.display, size: 20, tracking: 6, color: C.ivory });
  spaced(page, "PRIVATE CLUB · RESIDENT PORTFOLIO", { x: 43, y: H - 74, font: f.sans, size: 6.6, tracking: 2.2, color: C.goldSoft, opacity: 0.9 });
  spaced(page, `№ ${data.memberNo}`, { x: W - 42, y: H - 58, font: f.display, size: 16, tracking: 2, color: C.ivory, align: "right" });
  spaced(page, `ID ${shortId}`, { x: W - 42, y: H - 74, font: f.sans, size: 6.6, tracking: 2.2, color: C.goldSoft, opacity: 0.9, align: "right" });

  // имя + бейджи
  let y = photoBottom + 30;
  const nameSize = data.displayName.length > 18 ? 38 : 46;
  page.drawText(fit(f.display, data.displayName, nameSize, W - 84), { x: 42, y, size: nameSize, font: f.display, color: C.ivory });
  y -= 30;
  badgePills(page, f, data.badge, 42, y);

  const meta = [data.age ? `${data.age}` : null, data.location, data.citizenship].filter(Boolean).join("   ·   ");
  y -= 24;
  if (meta) page.drawText(fit(f.sans, meta, 9.5, W - 84), { x: 42, y, size: 9.5, font: f.sans, color: C.muted });

  // параметры: 4 × 2
  const params: [string, string, string | null][] = [
    ["РОСТ", "HEIGHT", data.height],
    ["ВЕС", "WEIGHT", data.weight],
    ["ПАРАМЕТРЫ", "MEASUREMENTS", data.measurements],
    ["ВОЗРАСТ", "AGE", data.age ? String(data.age) : null],
    ["ОДЕЖДА", "CLOTHING", data.clothingSize],
    ["ОБУВЬ", "SHOES · EU", data.shoeSize],
    ["ГРАЖДАНСТВО", "CITIZENSHIP", data.citizenship],
    ["БАЗА", "BASED IN", data.location],
  ];
  const gx = 42;
  const gap = 8;
  const cw = (W - 84 - gap * 3) / 4;
  const ch = 58;
  const gridTop = y - 22;
  params.forEach(([ru, en, value], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const cx = gx + col * (cw + gap);
    const cy = gridTop - (row + 1) * ch - row * gap;
    roundRect(page, cx, cy, cw, ch, 8, { fill: C.panel, border: C.line, borderWidth: 0.6 });
    spaced(page, ru, { x: cx + 11, y: cy + ch - 16, font: f.sansBold, size: 6, tracking: 1.3, color: C.gold });
    spaced(page, en, { x: cx + 11, y: cy + ch - 25, font: f.sans, size: 5.4, tracking: 1.1, color: C.dim });
    page.drawText(fit(f.display, value ?? "—", 17, cw - 22), { x: cx + 11, y: cy + 11, size: 17, font: f.display, color: value ? C.ivory : C.dim });
  });

  // футер
  const footY = 34;
  page.drawLine({ start: { x: 42, y: footY + 14 }, end: { x: W - 42, y: footY + 14 }, thickness: 0.4, color: C.gold, opacity: 0.5 });
  spaced(page, "CONFIDENTIAL PRESENTATION · CONTACT VIA VOYAGE ONLY", { x: 42, y: footY, font: f.sans, size: 5.8, tracking: 1.6, color: C.dim });
  spaced(page, dateLabel(data.generatedAt), { x: W - 42, y: footY, font: f.sans, size: 5.8, tracking: 1.6, color: C.dim, align: "right" });

  /* ── Портфолио ── */
  const rest = photos.slice(1);
  if (rest.length || data.about) {
    const p2 = doc.addPage([W, H]);
    pageBg(p2);
    p2.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36, borderColor: C.gold, borderWidth: 0.5, borderOpacity: 0.45 });
    spaced(p2, "VOYAGE", { x: 42, y: H - 58, font: f.display, size: 14, tracking: 5, color: C.ivory });
    spaced(p2, `${safe(f.sans, data.displayName).toUpperCase()} · № ${data.memberNo}`, { x: W - 42, y: H - 56, font: f.sans, size: 6.6, tracking: 2, color: C.goldSoft, align: "right" });
    p2.drawLine({ start: { x: 42, y: H - 72 }, end: { x: W - 42, y: H - 72 }, thickness: 0.4, color: C.gold, opacity: 0.5 });

    let top = H - 100;
    if (data.about) {
      p2.drawText(safe(f.displayItalic, "О себе"), { x: 42, y: top - 6, size: 20, font: f.displayItalic, color: C.ivory });
      spaced(p2, "ABOUT", { x: 42 + width(f.displayItalic, "О себе", 20) + 10, y: top - 4, font: f.sans, size: 6, tracking: 2, color: C.dim });
      top -= 26;
      const lines = wrap(f.sans, data.about, 9.4, W - 84).slice(0, 9);
      for (const line of lines) {
        p2.drawText(line, { x: 42, y: top, size: 9.4, font: f.sans, color: C.text });
        top -= 14.5;
      }
      top -= 14;
    }

    if (rest.length) {
      const shown = rest.slice(0, 6);
      const cols = shown.length === 1 ? 1 : 2;
      const rows = Math.ceil(shown.length / cols);
      const pg = 10;
      const areaBottom = 60;
      const cellW = (W - 84 - pg * (cols - 1)) / cols;
      const cellH = Math.min((top - areaBottom - pg * (rows - 1)) / rows, cellW * 1.45);
      shown.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = 42 + col * (cellW + pg);
        const yy = top - (row + 1) * cellH - row * pg;
        drawCover(p2, img, x, yy, cellW, cellH, 0.12);
        p2.drawRectangle({ x, y: yy, width: cellW, height: cellH, borderColor: C.gold, borderWidth: 0.4, borderOpacity: 0.35 });
      });
    }

    p2.drawLine({ start: { x: 42, y: footY + 14 }, end: { x: W - 42, y: footY + 14 }, thickness: 0.4, color: C.gold, opacity: 0.5 });
    spaced(p2, "CONFIDENTIAL PRESENTATION · CONTACT VIA VOYAGE ONLY", { x: 42, y: footY, font: f.sans, size: 5.8, tracking: 1.6, color: C.dim });
    spaced(p2, `ID ${shortId}`, { x: W - 42, y: footY, font: f.sans, size: 5.8, tracking: 1.6, color: C.dim, align: "right" });
  }

  return doc.save();
}

/* ════════════════════════════════════════════════════════════════════
 * 2. Полное досье (owner)
 * ════════════════════════════════════════════════════════════════════ */

class Flow {
  page!: PDFPage;
  y = 0;
  readonly left = 42;
  readonly right = A4.w - 42;
  readonly top = A4.h - 92;
  readonly bottom = 64;

  constructor(private doc: PDFDocument, private onNewPage: (page: PDFPage) => void) {
    this.newPage();
  }

  get width() {
    return this.right - this.left;
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    pageBg(this.page);
    this.onNewPage(this.page);
    this.y = this.top;
  }

  ensure(h: number) {
    if (this.y - h < this.bottom) this.newPage();
  }
}

export type DossierBuildResult = { bytes: Uint8Array; skipped: string[] };

export async function buildDossierPdf(data: DossierPdfData, assets: PdfAssets = browserAssets()): Promise<DossierBuildResult> {
  const doc = await PDFDocument.create();
  doc.setTitle(`VOYAGE · Досье · ${data.fullName} · №${data.memberNo}`);
  doc.setAuthor("VOYAGE Private Club");
  doc.setSubject(`Owner-only dossier · audit #${data.auditId}`);
  doc.setCreator("VOYAGE");
  doc.setProducer("VOYAGE");
  doc.setKeywords(["confidential", `audit-${data.auditId}`]);
  const f = await loadFonts(doc, assets);
  const skipped: string[] = [];

  const header = (page: PDFPage) => {
    spaced(page, "VOYAGE", { x: 42, y: A4.h - 50, font: f.display, size: 14, tracking: 5, color: C.ivory });
    spaced(page, "ПОЛНОЕ ДОСЬЕ · СТРОГО КОНФИДЕНЦИАЛЬНО", { x: 42, y: A4.h - 64, font: f.sansBold, size: 6.2, tracking: 1.8, color: C.rose });
    spaced(page, `№ ${data.memberNo}`, { x: A4.w - 42, y: A4.h - 50, font: f.display, size: 13, tracking: 2, color: C.ivory, align: "right" });
    spaced(page, "ТОЛЬКО ДЛЯ ВЛАДЕЛЬЦА", { x: A4.w - 42, y: A4.h - 64, font: f.sans, size: 6.2, tracking: 1.8, color: C.goldSoft, align: "right" });
    page.drawLine({ start: { x: 42, y: A4.h - 74 }, end: { x: A4.w - 42, y: A4.h - 74 }, thickness: 0.4, color: C.gold, opacity: 0.5 });
  };
  const flow = new Flow(doc, header);

  const section = (title: string, keepWith = 30) => {
    flow.ensure(46 + keepWith);
    flow.y -= 10;
    flow.page.drawText(safe(f.display, title), { x: flow.left, y: flow.y - 14, size: 18, font: f.display, color: C.ivory });
    flow.page.drawLine({ start: { x: flow.left, y: flow.y - 22 }, end: { x: flow.right, y: flow.y - 22 }, thickness: 0.4, color: C.line });
    flow.y -= 36;
  };

  const LABEL_W = 150;
  const row = (label: string, value: string, note?: string) => {
    const size = 9.2;
    const valueW = flow.width - LABEL_W - (note ? 110 : 0);
    const lines = wrap(f.sans, value, size, valueW);
    const h = Math.max(1, lines.length) * 13 + 6;
    flow.ensure(h);
    spaced(flow.page, label.toUpperCase(), { x: flow.left, y: flow.y - 9, font: f.sansBold, size: 6.2, tracking: 1.1, color: C.gold });
    lines.forEach((line, i) => flow.page.drawText(line, { x: flow.left + LABEL_W, y: flow.y - 9 - i * 13, size, font: f.sans, color: C.ivory }));
    if (note) flow.page.drawText(fit(f.sans, note, 7.4, 104), { x: flow.right - 104, y: flow.y - 9, size: 7.4, font: f.sans, color: C.dim });
    flow.y -= h;
    flow.page.drawLine({ start: { x: flow.left, y: flow.y + 2 }, end: { x: flow.right, y: flow.y + 2 }, thickness: 0.3, color: C.line, opacity: 0.6 });
    flow.y -= 3;
  };

  const paragraph = (text: string, color: RGB = C.text) => {
    for (const line of wrap(f.sans, text, 9.2, flow.width)) {
      flow.ensure(14);
      flow.page.drawText(line, { x: flow.left, y: flow.y - 9, size: 9.2, font: f.sans, color });
      flow.y -= 13.5;
    }
  };

  /* ── Титул: фото + имя ── */
  const photoImgs: PDFImage[] = [];
  for (const url of data.photos) {
    const img = await embedPhoto(doc, assets, url);
    if (img) photoImgs.push(img);
    else skipped.push("фото портфолио (не загрузилось)");
  }

  const heroW = 150;
  const heroH = 196;
  const heroY = flow.y - heroH;
  if (photoImgs[0]) {
    drawCover(flow.page, photoImgs[0], flow.left, heroY, heroW, heroH);
  } else {
    flow.page.drawRectangle({ x: flow.left, y: heroY, width: heroW, height: heroH, color: C.panel });
  }
  flow.page.drawRectangle({ x: flow.left, y: heroY, width: heroW, height: heroH, borderColor: C.gold, borderWidth: 0.5, borderOpacity: 0.5 });

  const tx = flow.left + heroW + 22;
  const tw = flow.right - tx;
  const nameLines = wrap(f.display, data.fullName, 30, tw).slice(0, 2);
  let ty = flow.y - 28;
  for (const line of nameLines) {
    flow.page.drawText(line, { x: tx, y: ty, size: 30, font: f.display, color: C.ivory });
    ty -= 32;
  }
  badgePills(flow.page, f, data.badge, tx, ty - 6);
  ty -= 30;
  const facts = [
    `Profile ID: ${data.profileId}`,
    `Сформировано: ${dateTimeLabel(data.generatedAt)}`,
    `Выгрузил: ${data.viewer.email ?? data.viewer.profileId}`,
    `Запись журнала: audit_logs #${data.auditId}`,
  ];
  for (const fact of facts) {
    flow.page.drawText(fit(f.sans, fact, 8, tw), { x: tx, y: ty, size: 8, font: f.sans, color: C.muted });
    ty -= 13;
  }
  flow.y = heroY - 12;

  /* ── Разделы ── */
  section("Контакты");
  if (data.contacts.length) for (const c of data.contacts) row(c.label, c.value, c.source);
  else paragraph("Контактов в базе нет.", C.muted);

  section("Личность");
  for (const r of data.identity) row(r.label, r.value);

  section("Параметры");
  if (data.physical.length) for (const r of data.physical) row(r.label, r.value);
  else paragraph("Параметры не заполнены.", C.muted);

  section("Статус в клубе");
  for (const r of data.club) row(r.label, r.value);

  if (data.about) {
    section("О себе");
    paragraph(data.about);
  }

  section("История KYC");
  if (!data.kycFiles.length && !data.kycRequests.length) paragraph("Документы верификации не загружались.", C.muted);
  data.kycFiles.forEach((file, i) => {
    const what = file.level === 1 ? "Паспорт" : file.level === 2 ? "Видео-верификация" : `Уровень ${file.level}`;
    const size = file.sizeBytes ? ` · ${(file.sizeBytes / 1024 / 1024).toFixed(1)} МБ` : "";
    const review = file.reviewedAt ? ` · проверил(а) ${file.reviewedBy ?? "—"} ${file.reviewedAt}` : "";
    const attach = file.url && (file.kind === "image" || file.kind === "pdf") ? ` · см. приложение K${i + 1}` : file.kind === "video" ? " · видео в PDF не встраивается" : "";
    row(`KYC ${file.level} · ${what}`, `${file.status} · загружен ${file.createdAt}${size}${review}${attach}`, file.fileName);
  });
  for (const req of data.kycRequests) {
    row("KYC 3 · Консьерж", `${req.status} · запрос ${req.createdAt}${req.resolvedAt ? ` · закрыт ${req.resolvedAt}` : ""}${req.feedback ? ` · ${req.feedback}` : ""}`, req.title);
  }

  /* ── Фото ── */
  if (photoImgs.length) {
    const cols = 3;
    const gap = 8;
    const cw = (flow.width - gap * (cols - 1)) / cols;
    const ch = cw * 1.32;
    section("Фото портфолио", ch + gap);
    for (let i = 0; i < photoImgs.length; i += cols) {
      flow.ensure(ch + gap);
      photoImgs.slice(i, i + cols).forEach((img, j) => {
        const x = flow.left + j * (cw + gap);
        drawCover(flow.page, img, x, flow.y - ch, cw, ch, 0.12);
        flow.page.drawRectangle({ x, y: flow.y - ch, width: cw, height: ch, borderColor: C.gold, borderWidth: 0.4, borderOpacity: 0.35 });
      });
      flow.y -= ch + gap;
    }
  }

  /* ── Приложения: файлы паспорта ── */
  const appendixTitle = (page: PDFPage, label: string) => {
    page.drawRectangle({ x: 0, y: A4.h - 40, width: A4.w, height: 40, color: C.bg, opacity: 0.92 });
    spaced(page, label, { x: 24, y: A4.h - 25, font: f.sansBold, size: 7, tracking: 1.4, color: C.goldSoft });
  };

  for (let i = 0; i < data.kycFiles.length; i += 1) {
    const file = data.kycFiles[i];
    if (!file.url || (file.kind !== "image" && file.kind !== "pdf")) continue;
    const label = `ПРИЛОЖЕНИЕ K${i + 1} · KYC ${file.level} · ${file.fileName} · ${file.status}`;
    if (file.kind === "image") {
      const img = await embedPhoto(doc, assets, file.url);
      if (!img) {
        skipped.push(`${file.fileName} (не удалось открыть)`);
        continue;
      }
      const page = doc.addPage([A4.w, A4.h]);
      pageBg(page);
      const box = { x: 36, y: 60, w: A4.w - 72, h: A4.h - 130 };
      const scale = Math.min(box.w / img.width, box.h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      page.drawImage(img, { x: box.x + (box.w - dw) / 2, y: box.y + (box.h - dh) / 2, width: dw, height: dh });
      appendixTitle(page, label);
    } else {
      const bytes = await assets.pdf(file.url);
      if (!bytes) {
        skipped.push(`${file.fileName} (не удалось скачать)`);
        continue;
      }
      try {
        const src = await PDFDocument.load(bytes, { ignoreEncryption: false });
        const pages = await doc.copyPages(src, src.getPageIndices().slice(0, 10));
        for (const p of pages) {
          doc.addPage(p);
          const { height } = p.getSize();
          p.drawRectangle({ x: 0, y: height - 28, width: p.getWidth(), height: 28, color: C.bg, opacity: 0.85 });
          spaced(p, label, { x: 18, y: height - 18, font: f.sansBold, size: 6.5, tracking: 1.2, color: C.goldSoft });
        }
      } catch {
        skipped.push(`${file.fileName} (PDF защищён или повреждён)`);
      }
    }
  }

  /* ── Водяной знак и колонтитул на КАЖДОЙ странице ── */
  const pages = doc.getPages();
  const mark = safe(f.sansBold, `CONFIDENTIAL · ${data.viewer.email ?? "OWNER"} · AUDIT #${data.auditId}`);
  pages.forEach((page, index) => {
    const { width: pw, height: ph } = page.getSize();
    for (let k = -1; k <= 1; k += 1) {
      page.drawText(mark, {
        x: pw * 0.12 + k * 60,
        y: ph * 0.5 + k * ph * 0.3 - 120,
        size: 13,
        font: f.sansBold,
        color: C.gold,
        opacity: 0.07,
        rotate: degrees(35),
      });
    }
    const foot = safe(f.sans, `Выгрузка зафиксирована в журнале audit_logs #${data.auditId} · ${data.viewer.email ?? data.viewer.profileId} · ${dateTimeLabel(data.generatedAt)}`);
    page.drawText(fit(f.sans, foot, 6.4, pw - 120), { x: 24, y: 20, size: 6.4, font: f.sans, color: C.dim });
    const num = `${index + 1} / ${pages.length}`;
    page.drawText(num, { x: pw - 24 - width(f.sans, num, 6.4), y: 20, size: 6.4, font: f.sans, color: C.dim });
  });

  return { bytes: await doc.save(), skipped };
}
