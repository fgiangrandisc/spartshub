// Edge Function: match-request
//
// Busca coincidencias en el momento, justo después de que un usuario crea una
// solicitud (o publica un equipo/repuesto), y las guarda en `matches` para
// que aparezcan en "Mis Matches".
//
// Por qué existe: el motor que corría en el navegador (runMatchEngine) tenía
// tres problemas que hacían que casi nunca apareciera un match:
//   1. Comparaba contra solo 50 filas sin ningún orden ni relevancia
//      (`.limit(50)`), así que con catálogos grandes (p.ej. 1.300+ repuestos
//      de carga masiva) la publicación correcta casi nunca entraba en el lote.
//   2. Hacía las llamadas a la IA una por una, desde el navegador; la ventana
//      de "Solicitud enviada" se cierra a los 3 segundos y el resultado nunca
//      se veía.
//   3. Dependía de una API key de Anthropic horneada en el bundle público.
//
// Esta función corre en el servidor: prefiltra por palabras clave (marca,
// modelo, N° de parte, palabras del título), ordena por relevancia, analiza
// con IA solo las mejores candidatas (en paralelo) y guarda el resultado.
//
// Modos (body JSON):
//   { "request_id": 123 }  -> compara esa solicitud contra publicaciones
//   { "listing_id": 456 }  -> compara esa publicación contra solicitudes
//
// Seguridad: exige un usuario logueado (JWT) y que sea dueño del ítem (o admin).
//
// Secrets: ANTHROPIC_API_KEY (ya configurado para daily-match-scan).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PREFILTER_ROWS = 300; // filas que se traen de la base por palabras clave
const MAX_AI_CANDIDATES = 12;   // candidatas que se mandan a la IA
const MIN_TOKEN_LEN = 3;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function buildText(item) {
  return [item.title, item.brand, item.model, item.description, item.cat,
    item.serial_number, item.part_number, item.engine_number, item.chassis_number,
  ].filter(Boolean).join(" | ");
}

const STOPWORDS = new Set([
  "para", "con", "sin", "del", "las", "los", "una", "uno", "por", "que", "como",
  "usado", "nuevo", "buen", "estado", "repuesto", "repuestos", "equipo", "equipos",
  "the", "and",
]);

function tokenize(text) {
  return Array.from(new Set(
    String(text || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= MIN_TOKEN_LEN && !STOPWORDS.has(w)),
  ));
}

// Palabras "fuertes" (marca, modelo, números de parte/serie) pesan más que las
// del título/descripción al ordenar candidatas.
function strongTokens(item) {
  return tokenize([item.brand, item.model, item.part_number, item.serial_number,
    item.engine_number, item.chassis_number].filter(Boolean).join(" "));
}

function score(item, tokens, strong) {
  const hay = tokenize(buildText(item));
  const haySet = new Set(hay);
  let s = 0;
  for (const t of tokens) if (haySet.has(t)) s += 1;
  for (const t of strong) if (haySet.has(t)) s += 3;
  return s;
}

async function analyzeMatch(apiKey, listingText, requestText) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        messages: [{
          role: "user",
          content: `Analiza si esta PUBLICACIÓN satisface esta SOLICITUD de repuesto/equipo industrial.
Responde SOLO con JSON: {"match": true/false, "score": 0-100, "reason": "breve razón en español"}

PUBLICACIÓN: ${listingText}
SOLICITUD: ${requestText}

Considera: marca, modelo, categoría, números de parte/serie, descripción.
Match = true si el producto publicado es igual o muy similar a lo solicitado (score >= 70).`,
        }],
      }),
    });
    if (!response.ok) return { match: false, score: 0, reason: "Error HTTP " + response.status };
    const data = await response.json();
    if (data.error) return { match: false, score: 0, reason: data.error.message || "Error API" };
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```(?:json)?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { match: false, score: 0, reason: "Respuesta inválida" };
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return { match: false, score: 0, reason: "Error de análisis: " + (e?.message || e) };
  }
}

// Trae filas candidatas del lado opuesto usando ilike por palabra clave.
async function prefilter(admin, table, tokens, extra) {
  const cols = ["title", "brand", "model", "description", "part_number", "serial_number"];
  const top = tokens.slice(0, 8);
  if (!top.length) return [];
  const orFilter = top.flatMap(t => cols.map(c => `${c}.ilike.%${t.replace(/[%,()]/g, "")}%`)).join(",");
  let q = admin.from(table).select("*").or(orFilter).limit(MAX_PREFILTER_ROWS);
  if (extra) q = extra(q);
  const { data, error } = await q;
  if (error) throw new Error("Error en prefiltro: " + error.message);
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
      return json({ error: "Faltan variables de entorno/secrets en la función." }, 500);
    }

    const callerToken = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!callerToken) return json({ error: "No autenticado." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return json({ error: "Sesión inválida." }, 401);
    const callerId = callerData.user.id;

    const { data: callerProfile } = await admin.from("profiles").select("is_admin").eq("id", callerId).maybeSingle();
    const callerIsAdmin = !!callerProfile?.is_admin;

    const body = await req.json().catch(() => ({}));
    const isRequestMode = body.request_id != null;
    const isListingMode = body.listing_id != null;
    if (!isRequestMode && !isListingMode) return json({ error: "Falta request_id o listing_id." }, 400);

    // ── Carga el ítem nuevo y verifica que sea del que llama (o admin) ──
    const srcTable = isRequestMode ? "requests" : "listings";
    const srcId = isRequestMode ? body.request_id : body.listing_id;
    const { data: item, error: itemErr } = await admin.from(srcTable).select("*").eq("id", srcId).maybeSingle();
    if (itemErr || !item) return json({ error: "No se encontró el ítem." }, 404);
    if (item.user_id !== callerId && !callerIsAdmin) return json({ error: "No autorizado." }, 403);
    if (!isRequestMode && item.kind && item.kind !== "equipo") {
      return json({ matches: [], note: "Solo publicaciones de equipos/repuestos hacen match." });
    }

    // ── Prefiltro por palabras clave sobre el lado opuesto ──
    const oppTable = isRequestMode ? "listings" : "requests";
    const tokens = tokenize(buildText(item));
    const strong = strongTokens(item);
    const rows = await prefilter(admin, oppTable, tokens,
      isRequestMode ? (q => q.or("kind.eq.equipo,kind.is.null")) : null);

    const ranked = rows
      .filter(r => !(r.user_id && item.user_id && r.user_id === item.user_id)) // no consigo mismo
      .map(r => ({ row: r, s: score(r, tokens, strong) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_AI_CANDIDATES);

    if (!ranked.length) return json({ matches: [], checked: 0 });

    // ── Salta pares ya evaluados ──
    const reqIdOf = r => (isRequestMode ? item.id : r.id);
    const lisIdOf = r => (isRequestMode ? r.id : item.id);
    const { data: already } = await admin.from("match_checks").select("request_id, listing_id")
      .in(isRequestMode ? "listing_id" : "request_id", ranked.map(x => x.row.id))
      .eq(isRequestMode ? "request_id" : "listing_id", item.id);
    const doneSet = new Set((already || []).map(c => `${c.request_id}::${c.listing_id}`));
    const toCheck = ranked.filter(x => !doneSet.has(`${reqIdOf(x.row)}::${lisIdOf(x.row)}`));

    // ── IA en paralelo ──
    const itemText = buildText(item);
    const results = await Promise.all(toCheck.map(async ({ row }) => {
      const listingText = isRequestMode ? buildText(row) : itemText;
      const requestText = isRequestMode ? itemText : buildText(row);
      const r = await analyzeMatch(ANTHROPIC_API_KEY, listingText, requestText);
      return { row, r };
    }));

    const found = [];
    const checks = [];
    for (const { row, r } of results) {
      checks.push({ request_id: reqIdOf(row), listing_id: lisIdOf(row), score: r.score || 0 });
      if (!(r.match && r.score >= 70)) continue;

      const listing = isRequestMode ? row : item;
      const request = isRequestMode ? item : row;

      // Evita duplicar un match que ya existe para el mismo par.
      const { data: existing } = await admin.from("matches").select("id")
        .eq("listing_id", listing.id).eq("request_id", request.id).limit(1);
      if (existing?.length) continue;

      const { error: mErr } = await admin.from("matches").insert({
        listing_id: listing.id,
        request_id: request.id,
        listing_user_id: listing.user_id,
        request_user_id: request.user_id,
        score: r.score,
        reason: r.reason,
        notified_at: new Date().toISOString(),
      });
      if (mErr) { console.error("Error insertando match:", mErr.message); continue; }

      if (listing.user_id && request.user_id) {
        await admin.from("messages").insert({
          from_id: listing.user_id,
          to_id: request.user_id,
          body: `🤝 ¡Match automático! Tu solicitud "${request.title}" coincide con la publicación "${listing.title}". Score: ${r.score}/100. ${r.reason || ""}`.trim(),
          listing_id: listing.id,
          read: false,
        }).then(() => {}, () => {});
      }
      found.push({ listing_id: listing.id, request_id: request.id, score: r.score, reason: r.reason });
    }

    if (checks.length) {
      await admin.from("match_checks").upsert(checks, { onConflict: "request_id,listing_id" }).then(() => {}, () => {});
    }

    return json({ matches: found, checked: toCheck.length, candidates: ranked.length });
  } catch (e) {
    return json({ error: e?.message || "Error inesperado." }, 500);
  }
});
