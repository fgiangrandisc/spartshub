-- Sección "Servicios": separa las publicaciones de servicios (mano de obra,
-- mantenimiento, asesorías) de las publicaciones de repuestos/maquinaria,
-- reutilizando la misma tabla `listings` con una columna discriminadora.
--
-- Correr esto una vez en Supabase → SQL Editor.

alter table public.listings add column if not exists kind text not null default 'equipo';
alter table public.listings add column if not exists rate_type text;      -- 'fijo' | 'hora' | 'visita' | 'convenir'
alter table public.listings add column if not exists experience text;     -- años de experiencia / certificaciones (texto libre)
alter table public.listings add column if not exists availability text;   -- disponibilidad / tiempo de respuesta (texto libre)
alter table public.listings add column if not exists website text;
alter table public.listings add column if not exists social_media text;

do $$ begin
  alter table public.listings add constraint listings_kind_check check (kind in ('equipo','servicio'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.listings add constraint listings_rate_type_check check (rate_type is null or rate_type in ('fijo','hora','visita','convenir'));
exception when duplicate_object then null;
end $$;

-- Todas las filas existentes quedan como 'equipo' por el default: nada de lo
-- que ya está publicado cambia de sección.

-- Los servicios no tienen "condición" (nuevo/usado) ni "stock": si estas
-- columnas son NOT NULL, la publicación de un servicio va a fallar al
-- insertar. Esto las deja opcionales sin afectar a las filas existentes
-- (los repuestos ya publicados conservan su valor).
alter table public.listings alter column condition drop not null;
alter table public.listings alter column stock drop not null;
