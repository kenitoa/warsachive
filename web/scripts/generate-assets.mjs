import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { readArchiveContent } from "./read-archive-content.mjs";

const directory = resolve(dirname(fileURLToPath(import.meta.url)), "../public/images");
const fontFile = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/fonts/NotoSansKR.ttf");
const { editorial, publicRecords } = await readArchiveContent();
const original = resolve(directory, "archive-gallery-hero.png");
await sharp(original).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 80 }).toFile(resolve(directory, "hero-large.webp"));
await sharp(original).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 78 }).toFile(resolve(directory, "hero-small.webp"));
await mkdir(resolve(directory, "social"), { recursive: true });
const escape = (value) => String(value).replace(/[<>&"']/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[character]);
function wrap(text, width = 21) {
  const characters = Array.from(text);
  const lines = [];
  for (let index = 0; index < Math.min(characters.length, width * 3); index += width) lines.push(characters.slice(index, index + width).join(""));
  if (characters.length > width * 3) lines[2] = `${lines[2].slice(0, -1)}…`;
  return lines;
}
async function card(name, title, kicker, subtitle) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(name)) throw new Error("Sharing card ID is not a safe file name.");
  const lines = wrap(title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#1d241e"/><path d="M48 48h1104v534H48z" fill="none" stroke="#9d885e"/><path d="M90 110h48v78H90zm58 0h48v78h-48z" fill="#d3c299"/><text x="235" y="144" fill="#d3c299" font-family="sans-serif" font-size="23" letter-spacing="4">WAR HISTORY ARCHIVE</text></svg>`;
  // SVG text uses the host's fontconfig. Render Korean through Sharp's explicit
  // fontfile interface and composite it onto the unchanged card artwork.
  async function textLayer(text, size, color, top, bold = false) {
    const input = await sharp({ text: { text: `<span foreground="${color}">${escape(text)}</span>`, font: `Noto Sans KR ${bold ? "Bold " : ""}${size}`, fontfile: fontFile, rgba: true } }).resize({ width: 1020, height: size + 12, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    return { input, left: 90, top };
  }
  const layers = await Promise.all([
    textLayer(kicker, 24, "#c7ac78", 226),
    ...lines.map((line, index) => textLayer(line, 48, "#f0eadb", 286 + index * 67, true)),
    textLayer(subtitle.slice(0, 55), 23, "#b6b9ac", 526)
  ]);
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(resolve(directory, "social", `${name}.png`));
}
await card("home", "사료를 찾고, 맥락으로 읽습니다.", "OPEN COLLECTION / PUBLIC READING ROOM", "전쟁 역사 아카이브 · 기록의 출처와 맥락을 함께 보존합니다.");
for (const record of publicRecords) await card(`archive-${record.id}`, record.title, `${record.period} / ${record.region}`, `전쟁 역사 아카이브 · ${record.sources.length}개 출처 · 공개 기록`);
for (const collection of editorial.collections) await card(`collection-${collection.id}`, collection.title, "CURATED COLLECTION", `${collection.region} · ${collection.period}`);
for (const story of editorial.stories) await card(`story-${story.id}`, story.title, "ARCHIVE STORIES", "전쟁 역사 아카이브 · 자료와 함께 읽는 이야기");
console.log("Optimized hero images and 1200×630 public sharing cards generated.");
