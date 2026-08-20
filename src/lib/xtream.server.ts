/**
 * Xtream-compatible delivery layer.
 * Server-only: uses the service-role client to authenticate panel lines and
 * resolve source URLs. Never import from client code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const ONLINE_WINDOW_MS = 3 * 60 * 1000;

async function admin(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface Line {
  id: string;
  playlist_id: string;
  username: string;
  password: string;
  max_connections: number;
  expires_at: string | null;
  is_trial: boolean;
  banned: boolean;
  package_id: string | null;
  created_at: string;
}

export type AuthResult =
  | { ok: true; line: Line; status: "Active" }
  | { ok: false; reason: "invalid" | "expired" | "banned" };

export async function authenticate(username: string, password: string): Promise<AuthResult> {
  if (!username || !password) return { ok: false, reason: "invalid" };
  const sb = await admin();
  const { data } = await sb
    .from("lines")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  const line = data as Line | null;
  if (!line || line.password !== password) return { ok: false, reason: "invalid" };
  if (line.banned) return { ok: false, reason: "banned" };
  if (line.expires_at && new Date(line.expires_at) <= new Date())
    return { ok: false, reason: "expired" };
  return { ok: true, line, status: "Active" };
}

/** Categories the line may see (all categories when it has no package). */
export async function allowedCategoryIds(line: Line): Promise<string[] | null> {
  if (!line.package_id) return null;
  const sb = await admin();
  const { data } = await sb
    .from("package_categories")
    .select("category_id")
    .eq("package_id", line.package_id);
  return (data ?? []).map((r) => r["category_id"] as string);
}

export async function touchSession(
  line: Line,
  request: Request,
  ref: string | null,
  kind: string | null,
): Promise<boolean> {
  const sb = await admin();
  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS).toISOString();
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  const ua = request.headers.get("user-agent");

  await sb
    .from("line_sessions")
    .update({ ended_at: now.toISOString() })
    .is("ended_at", null)
    .lt("last_seen_at", since)
    .eq("line_id", line.id);

  const { data: existing } = await sb
    .from("line_sessions")
    .select("id, ip, stream_ref")
    .eq("line_id", line.id)
    .is("ended_at", null);
  const rows = existing ?? [];
  const mine = rows.find((r) => r["ip"] === ip && r["stream_ref"] === ref);

  if (mine) {
    await sb
      .from("line_sessions")
      .update({ last_seen_at: now.toISOString() })
      .eq("id", mine["id"] as string);
  } else {
    if (rows.length >= line.max_connections) return false;
    await sb.from("line_sessions").insert({
      line_id: line.id,
      stream_ref: ref,
      kind,
      ip,
      user_agent: ua,
    });
  }
  await sb.from("lines").update({ last_seen_at: now.toISOString() }).eq("id", line.id);
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function baseUrl(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return { host, proto, origin: `${proto}://${host}` };
}

function userInfo(line: Line, status: string) {
  const exp = line.expires_at ? Math.floor(new Date(line.expires_at).getTime() / 1000) : null;
  return {
    username: line.username,
    password: line.password,
    message: "",
    auth: 1,
    status,
    exp_date: exp ? String(exp) : null,
    is_trial: line.is_trial ? "1" : "0",
    active_cons: "0",
    created_at: String(Math.floor(new Date(line.created_at).getTime() / 1000)),
    max_connections: String(line.max_connections),
    allowed_output_formats: ["m3u8", "ts"],
  };
}

function serverInfo(request: Request) {
  const { host, proto } = baseUrl(request);
  const [hostname, port] = host.split(":");
  return {
    url: hostname,
    port: port ?? (proto === "https" ? "443" : "80"),
    https_port: "443",
    server_protocol: proto,
    rtmp_port: "0",
    timezone: "America/Sao_Paulo",
    timestamp_now: Math.floor(Date.now() / 1000),
    time_now: new Date().toISOString().replace("T", " ").slice(0, 19),
  };
}

async function categories(line: Line, kind: "live" | "movie" | "series") {
  const sb = await admin();
  const allowed = await allowedCategoryIds(line);
  let q = sb
    .from("categories")
    .select("id, seq, name")
    .eq("playlist_id", line.playlist_id)
    .eq("kind", kind)
    .eq("hidden", false)
    .order("name");
  if (allowed) q = q.in("id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    category_id: String(c["seq"]),
    category_name: c["name"] as string,
    parent_id: 0,
  }));
}

async function seqToId(playlistId: string, seq: string | null) {
  if (!seq) return null;
  const sb = await admin();
  const { data } = await sb
    .from("categories")
    .select("id")
    .eq("playlist_id", playlistId)
    .eq("seq", Number(seq))
    .maybeSingle();
  return (data?.["id"] as string) ?? null;
}

async function streamList(
  line: Line,
  kind: "live" | "movie",
  categorySeq: string | null,
  request: Request,
) {
  const sb = await admin();
  const allowed = await allowedCategoryIds(line);
  let q = sb
    .from("streams")
    .select("id, name, logo, tvg_id, container_ext, category_id, categories(seq)")
    .eq("playlist_id", line.playlist_id)
    .eq("kind", kind)
    .eq("hidden", false)
    .order("name")
    .limit(20000);
  if (allowed) q = q.in("category_id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  const catId = await seqToId(line.playlist_id, categorySeq);
  if (catId) q = q.eq("category_id", catId);
  const { data } = await q;
  const { origin } = baseUrl(request);
  return (data ?? []).map((s, i) => {
    const seq = (s["categories"] as unknown as { seq: number } | null)?.seq;
    const common = {
      num: i + 1,
      name: s["name"] as string,
      stream_id: Number(s["id"]),
      stream_icon: (s["logo"] as string) ?? "",
      category_id: seq ? String(seq) : "0",
      added: String(Math.floor(Date.now() / 1000)),
      custom_sid: "",
      direct_source: "",
    };
    if (kind === "live") {
      return {
        ...common,
        stream_type: "live",
        epg_channel_id: (s["tvg_id"] as string) ?? null,
        tv_archive: 0,
        tv_archive_duration: 0,
        thumbnail: "",
      };
    }
    return {
      ...common,
      stream_type: "movie",
      container_extension: (s["container_ext"] as string) ?? "mp4",
      rating: "",
      rating_5based: 0,
      stream_url: `${origin}/movie/${line.username}/${line.password}/${s["id"]}.${s["container_ext"] ?? "mp4"}`,
    };
  });
}

async function seriesList(line: Line, categorySeq: string | null) {
  const sb = await admin();
  const allowed = await allowedCategoryIds(line);
  let q = sb
    .from("series")
    .select("id, name, logo, category_id, categories(seq)")
    .eq("playlist_id", line.playlist_id)
    .eq("hidden", false)
    .order("name")
    .limit(20000);
  if (allowed) q = q.in("category_id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  const catId = await seqToId(line.playlist_id, categorySeq);
  if (catId) q = q.eq("category_id", catId);
  const { data } = await q;
  return (data ?? []).map((s, i) => ({
    num: i + 1,
    name: s["name"] as string,
    series_id: Number(s["id"]),
    cover: (s["logo"] as string) ?? "",
    plot: "",
    cast: "",
    director: "",
    genre: "",
    releaseDate: "",
    last_modified: String(Math.floor(Date.now() / 1000)),
    rating: "0",
    rating_5based: 0,
    backdrop_path: [],
    youtube_trailer: "",
    episode_run_time: "0",
    category_id: (s["categories"] as unknown as { seq: number } | null)?.seq
      ? String((s["categories"] as unknown as { seq: number }).seq)
      : "0",
  }));
}

async function seriesInfo(line: Line, seriesId: string) {
  const sb = await admin();
  const { data: serie } = await sb
    .from("series")
    .select("id, name, logo, category_id, categories(seq)")
    .eq("id", Number(seriesId))
    .eq("playlist_id", line.playlist_id)
    .maybeSingle();
  if (!serie) return { info: {}, episodes: {} };
  const { data: eps } = await sb
    .from("series_episodes")
    .select("id, season, episode, name, container_ext, logo")
    .eq("series_id", Number(seriesId))
    .order("season")
    .order("episode")
    .limit(5000);
  const episodes: Record<string, unknown[]> = {};
  for (const e of eps ?? []) {
    const season = String(e["season"]);
    episodes[season] ??= [];
    episodes[season].push({
      id: String(e["id"]),
      episode_num: e["episode"],
      title: e["name"],
      container_extension: (e["container_ext"] as string) ?? "mp4",
      info: { movie_image: (e["logo"] as string) ?? "", duration: "" },
      added: String(Math.floor(Date.now() / 1000)),
      season: e["season"],
    });
  }
  return {
    seasons: Object.keys(episodes).map((s) => ({ season_number: Number(s), name: `Temporada ${s}` })),
    info: {
      name: serie["name"],
      cover: (serie["logo"] as string) ?? "",
      plot: "",
      genre: "",
      category_id: (serie["categories"] as unknown as { seq: number } | null)?.seq
        ? String((serie["categories"] as unknown as { seq: number }).seq)
        : "0",
    },
    episodes,
  };
}

/** GET/POST handler for player_api.php */
export async function handlePlayerApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let params = url.searchParams;
  if (request.method === "POST") {
    const body = await request.text();
    if (body) params = new URLSearchParams(body);
  }
  const username = params.get("username") ?? "";
  const password = params.get("password") ?? "";
  const auth = await authenticate(username, password);

  if (!auth.ok) {
    return json({ user_info: { auth: 0, status: auth.reason === "expired" ? "Expired" : "Disabled" } });
  }
  await touchSession(auth.line, request, null, "api");
  const action = params.get("action");
  const catSeq = params.get("category_id");

  switch (action) {
    case null:
    case "":
      return json({ user_info: userInfo(auth.line, "Active"), server_info: serverInfo(request) });
    case "get_live_categories":
      return json(await categories(auth.line, "live"));
    case "get_vod_categories":
      return json(await categories(auth.line, "movie"));
    case "get_series_categories":
      return json(await categories(auth.line, "series"));
    case "get_live_streams":
      return json(await streamList(auth.line, "live", catSeq, request));
    case "get_vod_streams":
      return json(await streamList(auth.line, "movie", catSeq, request));
    case "get_series":
      return json(await seriesList(auth.line, catSeq));
    case "get_series_info":
      return json(await seriesInfo(auth.line, params.get("series_id") ?? "0"));
    case "get_vod_info": {
      const sb = await admin();
      const { data } = await sb
        .from("streams")
        .select("id, name, logo, container_ext")
        .eq("id", Number(params.get("vod_id") ?? 0))
        .eq("playlist_id", auth.line.playlist_id)
        .maybeSingle();
      return json({
        info: { movie_image: data?.["logo"] ?? "", name: data?.["name"] ?? "", plot: "" },
        movie_data: {
          stream_id: Number(data?.["id"] ?? 0),
          name: data?.["name"] ?? "",
          container_extension: data?.["container_ext"] ?? "mp4",
        },
      });
    }
    default:
      return json([]);
  }
}

/** GET handler for get.php (personalised M3U). */
export async function handleGetPhp(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const auth = await authenticate(
    url.searchParams.get("username") ?? "",
    url.searchParams.get("password") ?? "",
  );
  if (!auth.ok) return new Response("Acesso negado", { status: 401 });
  const line = auth.line;
  const { origin } = baseUrl(request);
  const sb = await admin();
  const allowed = await allowedCategoryIds(line);

  let sq = sb
    .from("streams")
    .select("id, name, logo, tvg_id, kind, container_ext, categories(name)")
    .eq("playlist_id", line.playlist_id)
    .eq("hidden", false)
    .order("name")
    .limit(30000);
  if (allowed)
    sq = sq.in("category_id", allowed.length ? allowed : ["00000000-0000-0000-0000-000000000000"]);
  const { data: streams } = await sq;

  const lines = ["#EXTM3U"];
  for (const s of streams ?? []) {
    const group = (s["categories"] as unknown as { name: string } | null)?.name ?? "Sem categoria";
    const kind = s["kind"] === "live" ? "live" : "movie";
    const ext = kind === "live" ? "ts" : ((s["container_ext"] as string) ?? "mp4");
    lines.push(
      `#EXTINF:-1 tvg-id="${s["tvg_id"] ?? ""}" tvg-logo="${s["logo"] ?? ""}" group-title="${group}",${s["name"]}`,
    );
    lines.push(`${origin}/${kind}/${line.username}/${line.password}/${s["id"]}.${ext}`);
  }

  const eq = sb
    .from("series_episodes")
    .select("id, name, logo, container_ext, series(name, category_id, categories(name))")
    .eq("playlist_id", line.playlist_id)
    .limit(30000);
  const { data: eps } = await eq;
  for (const e of eps ?? []) {
    const serie = e["series"] as unknown as { name: string; categories: { name: string } | null } | null;
    const group = serie?.categories?.name ?? "Séries";
    lines.push(
      `#EXTINF:-1 tvg-logo="${e["logo"] ?? ""}" group-title="${group}",${serie?.name ?? ""} - ${e["name"]}`,
    );
    lines.push(
      `${origin}/series/${line.username}/${line.password}/${e["id"]}.${e["container_ext"] ?? "mp4"}`,
    );
  }

  await touchSession(line, request, null, "m3u");
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "audio/x-mpegurl; charset=utf-8",
      "content-disposition": `attachment; filename="${line.username}.m3u"`,
    },
  });
}

/** Resolves a stream request and redirects the player to the source URL. */
export async function handleStream(
  request: Request,
  kind: "live" | "movie" | "series",
  username: string,
  password: string,
  rawId: string,
): Promise<Response> {
  const auth = await authenticate(username, password);
  if (!auth.ok) return new Response("Acesso negado", { status: 403 });
  const id = Number((rawId.split(".")[0] ?? "").trim());
  if (!Number.isFinite(id) || id <= 0) return new Response("Stream inválido", { status: 404 });

  const allowedOk = await touchSession(auth.line, request, `${kind}:${id}`, kind);
  if (!allowedOk) return new Response("Limite de conexões atingido", { status: 429 });

  const sb = await admin();
  let source: string | null = null;
  if (kind === "series") {
    const { data } = await sb
      .from("series_episodes")
      .select("url")
      .eq("id", id)
      .eq("playlist_id", auth.line.playlist_id)
      .maybeSingle();
    source = (data?.["url"] as string) ?? null;
  } else {
    const { data } = await sb
      .from("streams")
      .select("url, hidden, category_id")
      .eq("id", id)
      .eq("playlist_id", auth.line.playlist_id)
      .maybeSingle();
    if (data && !data["hidden"]) {
      const allowed = await allowedCategoryIds(auth.line);
      if (!allowed || (data["category_id"] && allowed.includes(data["category_id"] as string)))
        source = data["url"] as string;
    }
  }
  if (!source) return new Response("Conteúdo indisponível", { status: 404 });
  return new Response(null, { status: 302, headers: { location: source } });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}
