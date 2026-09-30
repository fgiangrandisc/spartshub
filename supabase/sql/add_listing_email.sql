-- Campo de email de contacto en cada publicación (equipo, servicio o
-- arriendo) — independiente del email de la cuenta del usuario, ya que
-- el vendedor puede querer que le escriban a un correo distinto.
--
-- Correr esto una vez en Supabase → SQL Editor.

alter table public.listings add column if not exists email text;
