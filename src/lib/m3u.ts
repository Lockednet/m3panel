export type ItemKind = "live" | "movie" | "series";

export interface ParsedItem {
  kind: ItemKind;
  name: string;
  logo: string | null;
  tvgId: string | null;
  group: string;
  url: string;
  containerExt: string | null;
  seriesName?: string;
  season?: number;
  episode?: number;
}

const ATTR_RE = /([a-zA-Z0-9-]+)="([^"]*)"/g;
const SE_RE = /[Ss](\d{1,2})[\s._-]?[EeXx](\d{1,3})|(\d{1,2})x(\d{1,3})/;
const VOD_EXT = ["mp4", "mkv", "avi", "m4v", "mov"];

function attrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(line))) out[m[1]!.toLowerCase()] = m[2]!;
  return out;
}

function extOf(url: string): string | null {
  const clean = url.split("?")[0] ?? url;
  const dot = clean.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : null;
}

function classify(url: string, group: string, name: string): ItemKind {
  const ext = extOf(url) ?? "";
  const g = group.toLowerCase();
  const isVod = VOD_EXT.includes(ext) || /\/(movie|series)\//i.test(url);
  const looksSeries =
    SE_RE.test(name) || /s[ée]rie/.test(g) || /\/series\//i.test(url) || /temporada/i.test(name);
  if (looksSeries && (isVod || /\/series\//i.test(url))) return "series";
  if (looksSeries && !/\.(ts|m3u8)$/i.test(url)) return "series";
  if (isVod || /filme|movie|vod|cinema/.test(g)) return "movie";
  return "live";
}

function splitSeries(name: string): { series: string; season: number; episode: number; title: string } {
  const m = SE_RE.exec(name);
  if (!m) return { series: name.trim(), season: 1, episode: 1, title: name.trim() };
  const season = Number(m[1] ?? m[3] ?? 1);
  const episode = Number(m[2] ?? m[4] ?? 1);
  const series = name.slice(0, m.index).replace(/[\s._-]+$/, "").trim() || name.trim();
  return { series, season, episode, title: name.trim() };
}

/** Parses an M3U/M3U8 playlist body into typed items. */
export function parseM3U(text: string): ParsedItem[] {
  const lines = text.split(/\r?\n/);
  const items: ParsedItem[] = [];
  let pending: { name: string; a: Record<string, string> } | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const a = attrs(line);
      const comma = line.indexOf(",");
      const name = comma >= 0 ? line.slice(comma + 1).trim() : (a["tvg-name"] ?? "Sem nome");
      pending = { name: name || "Sem nome", a };
      continue;
    }
    if (line.startsWith("#")) continue;
    if (!pending) continue;

    const { name, a } = pending;
    pending = null;
    const group = a["group-title"]?.trim() || "Sem categoria";
    const kind = classify(line, group, name);
    const base: ParsedItem = {
      kind,
      name,
      logo: a["tvg-logo"] || null,
      tvgId: a["tvg-id"] || null,
      group,
      url: line,
      containerExt: extOf(line),
    };
    if (kind === "series") {
      const s = splitSeries(name);
      base.seriesName = s.series;
      base.season = s.season;
      base.episode = s.episode;
      base.name = s.title;
    }
    items.push(base);
  }
  return items;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const kindLabel: Record<ItemKind, string> = {
  live: "Canais",
  movie: "Filmes",
  series: "Séries",
};
