import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ParsedItem } from "./m3u";

/** Downloads an M3U playlist server-side (avoids browser CORS limits). */
export const fetchM3uText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(data.url, { headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20" } });
    if (!res.ok) throw new Error(`Não foi possível baixar a lista (${res.status})`);
    const text = await res.text();
    if (!text.includes("#EXTINF")) throw new Error("O conteúdo baixado não parece uma lista M3U");
    return { text };
  });

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(120),
        sourceType: z.enum(["url", "file"]),
        sourceUrl: z.string().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("playlists")
      .insert({
        owner_id: context.userId,
        name: data.name,
        source_type: data.sourceType,
        source_url: data.sourceUrl ?? null,
        status: "importing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { data: job, error: jobErr } = await context.supabase
      .from("import_jobs")
      .insert({ playlist_id: row.id, status: "running" })
      .select("id")
      .single();
    if (jobErr) throw new Error(jobErr.message);
    return { playlistId: row.id as string, jobId: job.id as string };
  });

export const resetPlaylistContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ playlistId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase.from("series_episodes").delete().eq("playlist_id", data.playlistId);
    await context.supabase.from("series").delete().eq("playlist_id", data.playlistId);
    await context.supabase.from("streams").delete().eq("playlist_id", data.playlistId);
    await context.supabase.from("categories").delete().eq("playlist_id", data.playlistId);
    return { ok: true };
  });

const itemSchema = z.object({
  kind: z.enum(["live", "movie", "series"]),
  name: z.string().max(500),
  logo: z.string().max(1000).nullable(),
  tvgId: z.string().max(200).nullable(),
  group: z.string().max(300),
  url: z.string().max(3000),
  containerExt: z.string().max(10).nullable(),
  seriesName: z.string().max(400).optional(),
  season: z.number().int().optional(),
  episode: z.number().int().optional(),
});

/** Inserts one batch of parsed playlist items. Called repeatedly by the importer UI. */
export const ingestBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        jobId: z.string().uuid(),
        processed: z.number().int().min(0),
        total: z.number().int().min(0),
        items: z.array(itemSchema).max(3000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const items = data.items as ParsedItem[];

    const catKeys = new Map<string, { name: string; kind: "live" | "movie" | "series" }>();
    for (const it of items) catKeys.set(`${it.kind}|${it.group}`, { name: it.group, kind: it.kind });
    if (catKeys.size) {
      await sb.from("categories").upsert(
        [...catKeys.values()].map((c) => ({
          playlist_id: data.playlistId,
          name: c.name,
          kind: c.kind,
        })),
        { onConflict: "playlist_id,kind,name", ignoreDuplicates: true },
      );
    }
    const { data: cats } = await sb
      .from("categories")
      .select("id, name, kind")
      .eq("playlist_id", data.playlistId);
    const catId = new Map((cats ?? []).map((c) => [`${c.kind}|${c.name}`, c.id as string]));

    const streams = items
      .filter((i) => i.kind !== "series")
      .map((i) => ({
        playlist_id: data.playlistId,
        category_id: catId.get(`${i.kind}|${i.group}`) ?? null,
        kind: i.kind,
        name: i.name,
        logo: i.logo,
        tvg_id: i.tvgId,
        url: i.url,
        container_ext: i.containerExt,
      }));
    if (streams.length) {
      const { error } = await sb.from("streams").insert(streams);
      if (error) throw new Error(error.message);
    }

    const episodes = items.filter((i) => i.kind === "series");
    if (episodes.length) {
      const names = new Map<string, ParsedItem>();
      for (const e of episodes) names.set(e.seriesName ?? e.name, e);
      await sb.from("series").upsert(
        [...names.entries()].map(([name, e]) => ({
          playlist_id: data.playlistId,
          category_id: catId.get(`series|${e.group}`) ?? null,
          name,
          logo: e.logo,
        })),
        { onConflict: "playlist_id,name", ignoreDuplicates: true },
      );
      const { data: seriesRows } = await sb
        .from("series")
        .select("id, name")
        .eq("playlist_id", data.playlistId)
        .in("name", [...names.keys()]);
      const seriesId = new Map((seriesRows ?? []).map((s) => [s.name as string, s.id as number]));
      const rows = episodes
        .map((e) => {
          const sid = seriesId.get(e.seriesName ?? e.name);
          if (!sid) return null;
          return {
            playlist_id: data.playlistId,
            series_id: sid,
            season: e.season ?? 1,
            episode: e.episode ?? 1,
            name: e.name,
            logo: e.logo,
            url: e.url,
            container_ext: e.containerExt,
          };
        })
        .filter(Boolean);
      if (rows.length) {
        const { error } = await sb.from("series_episodes").insert(rows as never);
        if (error) throw new Error(error.message);
      }
    }

    await sb
      .from("import_jobs")
      .update({ processed: data.processed, total: data.total, updated_at: new Date().toISOString() })
      .eq("id", data.jobId);
    return { ok: true };
  });

export const finalizeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        jobId: z.string().uuid(),
        total: z.number().int().min(0),
        error: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const failed = !!data.error;
    await sb
      .from("import_jobs")
      .update({
        status: failed ? "error" : "done",
        message: data.error ?? null,
        processed: data.total,
        total: data.total,
      })
      .eq("id", data.jobId);
    await sb
      .from("playlists")
      .update({
        status: failed ? "error" : "ready",
        total_items: data.total,
        last_import_at: new Date().toISOString(),
      })
      .eq("id", data.playlistId);

    if (!failed) {
      const { data: cats } = await sb
        .from("categories")
        .select("id, kind")
        .eq("playlist_id", data.playlistId);
      for (const c of cats ?? []) {
        const table = c.kind === "series" ? "series" : "streams";
        const { count } = await sb
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("category_id", c.id);
        await sb.from("categories").update({ items_count: count ?? 0 }).eq("id", c.id);
      }
    }
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const nowIso = new Date().toISOString();
    const onlineSince = new Date(Date.now() - 3 * 60 * 1000).toISOString();

    const count = async (table: string, apply?: (q: never) => never) => {
      let q = sb.from(table).select("id", { count: "exact", head: true }) as never;
      if (apply) q = apply(q);
      const { count: c } = (await q) as unknown as { count: number | null };
      return c ?? 0;
    };

    const [playlists, live, movies, series, episodes, categories] = await Promise.all([
      count("playlists"),
      count("streams", (q) => (q as never as { eq: (a: string, b: string) => never }).eq("kind", "live")),
      count("streams", (q) => (q as never as { eq: (a: string, b: string) => never }).eq("kind", "movie")),
      count("series"),
      count("series_episodes"),
      count("categories"),
    ]);

    const { data: lines } = await sb
      .from("lines")
      .select("id, is_trial, banned, expires_at, last_seen_at");
    const list = lines ?? [];
    const active = list.filter(
      (l) => !l.banned && (!l.expires_at || l.expires_at > nowIso),
    ).length;
    const expired = list.filter((l) => l.expires_at && l.expires_at <= nowIso).length;
    const trials = list.filter((l) => l.is_trial && (!l.expires_at || l.expires_at > nowIso)).length;
    const trialsExpired = list.filter((l) => l.is_trial && l.expires_at && l.expires_at <= nowIso)
      .length;
    const banned = list.filter((l) => l.banned).length;

    const { count: online } = await sb
      .from("line_sessions")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .gte("last_seen_at", onlineSince);

    const { data: recentImports } = await sb
      .from("playlists")
      .select("id, name, status, total_items, last_import_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      content: { playlists, live, movies, series, episodes, categories },
      users: { total: list.length, active, expired, trials, trialsExpired, banned },
      online: online ?? 0,
      recentImports: recentImports ?? [],
    };
  });

export const listContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        playlistId: z.string().uuid(),
        kind: z.enum(["live", "movie", "series"]),
        categoryId: z.string().uuid().nullable().optional(),
        search: z.string().max(200).optional(),
        page: z.number().int().min(0).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const size = 40;
    const from = data.page * size;
    const table = data.kind === "series" ? "series" : "streams";
    let q = sb
      .from(table)
      .select(
        data.kind === "series"
          ? "id, name, logo, hidden, category_id"
          : "id, name, logo, hidden, url, category_id, tvg_id",
        { count: "exact" },
      )
      .eq("playlist_id", data.playlistId);
    if (data.kind !== "series") q = q.eq("kind", data.kind);
    if (data.categoryId) q = q.eq("category_id", data.categoryId);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, count, error } = await q.order("name").range(from, from + size - 1);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, size };
  });

export const updateContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["live", "movie", "series"]),
        id: z.number().int(),
        name: z.string().min(1).max(500).optional(),
        logo: z.string().max(1000).nullable().optional(),
        url: z.string().max(3000).optional(),
        hidden: z.boolean().optional(),
        categoryId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch["name"] = data.name;
    if (data.logo !== undefined) patch["logo"] = data.logo;
    if (data.hidden !== undefined) patch["hidden"] = data.hidden;
    if (data.categoryId !== undefined) patch["category_id"] = data.categoryId;
    if (data.url !== undefined && data.kind !== "series") patch["url"] = data.url;
    const table = data.kind === "series" ? "series" : "streams";
    const { error } = await context.supabase.from(table).update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ kind: z.enum(["live", "movie", "series"]), id: z.number().int() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const table = data.kind === "series" ? "series" : "streams";
    const { error } = await context.supabase.from(table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await sb.from("streams").delete().eq("category_id", data.id);
    await sb.from("series").delete().eq("category_id", data.id);
    const { error } = await sb.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        playlistId: z.string().uuid(),
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
        password: z.string().min(3).max(50),
        maxConnections: z.number().int().min(1).max(20),
        expiresAt: z.string().nullable(),
        isTrial: z.boolean(),
        notes: z.string().max(500).nullable().optional(),
        packageId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      playlist_id: data.playlistId,
      username: data.username.toLowerCase(),
      password: data.password,
      max_connections: data.maxConnections,
      expires_at: data.expiresAt,
      is_trial: data.isTrial,
      notes: data.notes ?? null,
      package_id: data.packageId ?? null,
    };
    const sb = context.supabase;
    const { error } = data.id
      ? await sb.from("lines").update(row).eq("id", data.id)
      : await sb.from("lines").insert(row);
    if (error)
      throw new Error(
        error.code === "23505" ? "Já existe um usuário com esse login" : error.message,
      );
    return { ok: true };
  });

export const listLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().max(100).optional(),
        filter: z.enum(["all", "active", "expired", "trial", "banned", "online"]).default("all"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const nowIso = new Date().toISOString();
    let q = sb.from("lines").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.search) q = q.ilike("username", `%${data.search}%`);
    if (data.filter === "expired") q = q.lte("expires_at", nowIso);
    if (data.filter === "trial") q = q.eq("is_trial", true);
    if (data.filter === "banned") q = q.eq("banned", true);
    if (data.filter === "active") q = q.eq("banned", false).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const onlineSince = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const { data: sessions } = await sb
      .from("line_sessions")
      .select("line_id, ip, user_agent, last_seen_at, stream_ref")
      .is("ended_at", null)
      .gte("last_seen_at", onlineSince);
    const byLine = new Map<string, { ip: string | null; ua: string | null; count: number }>();
    for (const s of sessions ?? []) {
      const prev = byLine.get(s.line_id as string);
      byLine.set(s.line_id as string, {
        ip: prev?.ip ?? (s.ip as string | null),
        ua: prev?.ua ?? (s.user_agent as string | null),
        count: (prev?.count ?? 0) + 1,
      });
    }
    const result = (rows ?? []).map((l) => ({
      ...l,
      online: byLine.get(l.id as string)?.count ?? 0,
      ip: byLine.get(l.id as string)?.ip ?? null,
      player: byLine.get(l.id as string)?.ua ?? null,
    }));
    return {
      rows: data.filter === "online" ? result.filter((r) => r.online > 0) : result,
    };
  });

export const lineAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["ban", "unban", "delete", "renew", "kick"]),
        days: z.number().int().min(1).max(3650).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.action === "delete") {
      const { error } = await sb.from("lines").delete().eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    if (data.action === "kick") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: owned } = await sb.from("lines").select("id").eq("id", data.id).maybeSingle();
      if (!owned) throw new Error("Não encontrado");
      await supabaseAdmin
        .from("line_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("line_id", data.id)
        .is("ended_at", null);
      return { ok: true };
    }
    if (data.action === "renew") {
      const { data: line } = await sb
        .from("lines")
        .select("expires_at")
        .eq("id", data.id)
        .maybeSingle();
      const base =
        line?.expires_at && new Date(line.expires_at as string) > new Date()
          ? new Date(line.expires_at as string)
          : new Date();
      base.setDate(base.getDate() + (data.days ?? 30));
      const { error } = await sb
        .from("lines")
        .update({ expires_at: base.toISOString(), is_trial: false })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await sb
      .from("lines")
      .update({ banned: data.action === "ban" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ lineId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("line_sessions")
      .select("*")
      .eq("line_id", data.lineId)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", context.userId),
    ]);
    return {
      profile,
      roles: (roles ?? []).map((r) => r.role as string),
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const listResellers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente administradores");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, email, display_name, credits, created_at")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: lines } = await supabaseAdmin.from("lines").select("owner_id");
    const counts = new Map<string, number>();
    for (const l of lines ?? [])
      counts.set(l.owner_id as string, (counts.get(l.owner_id as string) ?? 0) + 1);
    return {
      rows: (profiles ?? []).map((p) => ({
        ...p,
        role: (roles ?? []).find((r) => r.user_id === p.id)?.role ?? "reseller",
        lines: counts.get(p.id as string) ?? 0,
      })),
    };
  });

export const setResellerCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), credits: z.number().int().min(0).max(100000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Somente administradores");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ credits: data.credits })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
