-- Permite publicaciones sin usuario asociado (para que un admin pueda cargar
-- un servicio "sin usuario", con contacto manual: empresa, teléfono, ubicación).
--
-- Correr esto una vez en Supabase → SQL Editor.

alter table public.listings alter column user_id drop not null;

-- Nota sobre RLS: si al probar "Publicar sin usuario" desde el panel de admin
-- da un error de política (RLS), es porque la policy de INSERT en `listings`
-- exige que auth.uid() = user_id salvo para admins, y esa excepción de admin
-- no cubre el caso user_id = null. Revisa la policy de INSERT de `listings`
-- en Database → Policies y confirma que el chequeo para administradores no
-- dependa de que user_id tenga un valor. Como referencia, algo del estilo:
--
--   (auth.uid() = user_id)
--   or
--   (exists (select 1 from profiles where id = auth.uid() and is_admin))
--
-- ya cubre user_id = null sin cambios, porque la segunda condición no mira
-- user_id en absoluto.
