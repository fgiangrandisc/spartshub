// Edge Function: admin-delete-user
//
// Borra por completo a un usuario desde el panel de administración: su fila
// en `profiles` Y su cuenta real de Supabase Auth (login, email, contraseña).
//
// Por qué esto vive en el servidor y no en el navegador: borrar una cuenta
// de Supabase Auth (auth.admin.deleteUser) requiere la Service Role Key,
// que nunca debe viajar al navegador -- por eso corre acá, server-side, en
// Deno, igual que `admin-create-user`.
//
// Antes de este cambio, borrar un usuario desde el panel admin solo
// eliminaba su fila en `profiles`, pero la cuenta de Auth quedaba viva --
// por eso después no se podía volver a crear un usuario con ese mismo
// email ("A user with this email address has already been registered").
//
// Seguridad: igual que admin-create-user, verifica que quien llama es un
// administrador real (profiles.is_admin = true) usando el JWT que
// supabase-js manda automáticamente en el header Authorization.
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase
// automáticamente en cada Edge Function -- no hace falta configurarlos a mano.

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
      return json({ error: "Solo un administrador puede borrar usuarios." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetId = (body.id || "").trim();
    if (!targetId) return json({ error: "Falta el id del usuario a borrar." }, 400);

    if (targetId === callerData.user.id) {
      return json({ error: "No puedes borrar tu propia cuenta de administrador." }, 400);
    }

    // Borra primero la fila de `profiles` (si existe una referencia con
    // on delete cascade desde profiles.id -> auth.users.id, esto además se
    // haría solo al borrar el usuario de Auth más abajo -- pero lo hacemos
    // explícito acá para no depender de esa configuración).
    const { error: profileDelErr } = await admin.from("profiles").delete().eq("id", targetId);
    if (profileDelErr) {
      return json({ error: "No se pudo borrar el perfil: " + profileDelErr.message }, 500);
    }

    // Borra la cuenta real de Supabase Auth -- esto es lo que faltaba antes.
    const { error: authDelErr } = await admin.auth.admin.deleteUser(targetId);
    if (authDelErr) {
      // El perfil ya se borró; devolvemos el error para que el admin sepa
      // que la cuenta de Auth puede haber quedado huérfana.
      return json({ error: "Perfil borrado, pero falló borrar la cuenta de acceso: " + authDelErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e?.message || "Error inesperado." }, 500);
  }
});
