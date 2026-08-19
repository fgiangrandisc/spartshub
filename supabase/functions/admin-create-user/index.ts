// Edge Function: admin-create-user
//
// Crea una cuenta real de Supabase Auth (email + contraseña) más su fila en
// `profiles`, en nombre de un administrador desde el panel de PortalMaquinas.
//
// Por qué esto vive en el servidor y no en el navegador: llamar a
// `supabase.auth.signUp()` desde el navegador del propio admin reemplazaría
// la sesión actual (la del admin) por la del usuario recién creado, y lo
// dejaría deslogueado de su propia cuenta. Crear cuentas ajenas requiere la
// Service Role Key, que nunca debe viajar al navegador — por eso corre acá,
// server-side, en Deno.
//
// Seguridad: antes de crear nada, esta función verifica que quien la está
// llamando es un administrador real (profiles.is_admin = true), usando el
// JWT que supabase-js manda automáticamente en el header Authorization al
// usar `sb.functions.invoke(...)`.
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase automáticamente
// en cada Edge Function — no hace falta configurarlos a mano.

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return json({ error: "Faltan variables de entorno en la función." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!callerToken) return json({ error: "No autenticado." }, 401);

    // Cliente con Service Role: bypassa RLS. Se usa solo del lado del
    // servidor, nunca se expone al navegador.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Identifica quién llama a partir de SU propio token (no del service role).
    const { data: callerData, error: callerErr } = await admin.auth.getUser(callerToken);
    if (callerErr || !callerData?.user) return json({ error: "Sesión inválida." }, 401);

    const { data: callerProfile, error: profErr } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (profErr || !callerProfile?.is_admin) {
      return json({ error: "Solo un administrador puede crear usuarios." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email    = (body.email || "").trim();
    const password = (body.password || "").trim();
    const name     = (body.name || "").trim();
    const biz      = body.biz || null;
    const phone    = body.phone || null;
    const location = body.location || null;

    if (!email || !password || !name) {
      return json({ error: "Email, contraseña y nombre son obligatorios." }, 400);
    }
    if (password.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // se crea ya confirmado: no depende de que la persona revise su correo
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || "No se pudo crear el usuario." }, 400);
    }

    const { data: profile, error: upsertErr } = await admin
      .from("profiles")
      .upsert({ id: created.user.id, name, biz, phone, location })
      .select()
      .single();
    if (upsertErr) {
      // La cuenta de auth ya quedó creada; devolvemos el error para que el
      // admin sepa que el perfil no se completó y pueda editarlo a mano.
      return json({ error: "Usuario creado, pero falló el perfil: " + upsertErr.message }, 500);
    }

    return json({ profile });
  } catch (e) {
    return json({ error: e?.message || "Error inesperado." }, 500);
  }
});
