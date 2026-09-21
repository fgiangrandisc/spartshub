-- Sección "Arriendos": arriendo de maquinaria/equipos, bodegas/espacios o
-- vehículos con conductor, como tercer tipo de publicación en la misma
-- tabla `listings` (junto a 'equipo' y 'servicio').
--
-- Correr esto una vez en Supabase → SQL Editor.

alter table public.listings add column if not exists rental_type text;        -- 'maquinaria' | 'espacio' | 'vehiculo' | 'otro'
alter table public.listings add column if not exists includes_operator boolean; -- arriendo con operador/conductor incluido
alter table public.listings add column if not exists deposit text;            -- depósito de garantía (texto libre, puede incluir moneda)
alter table public.listings add column if not exists min_period text;         -- período mínimo de arriendo (texto libre, ej. "3 días")

-- El check de `kind` se creó en add_service_listings.sql permitiendo solo
-- 'equipo' y 'servicio'. Hay que recrearlo agregando 'arriendo'.
do $$ begin
  alter table public.listings drop constraint listings_kind_check;
exception when undefined_object then null;
end $$;
alter table public.listings add constraint listings_kind_check check (kind in ('equipo','servicio','arriendo'));

-- El check de `rate_type` se creó en add_service_listings.sql permitiendo
-- solo 'fijo'/'hora'/'visita'/'convenir' (modalidades de servicios). Los
-- arriendos usan 'dia'/'semana'/'mes'/'convenir' sobre la misma columna,
-- así que hay que recrearlo con todas las modalidades juntas.
do $$ begin
  alter table public.listings drop constraint listings_rate_type_check;
exception when undefined_object then null;
end $$;
alter table public.listings add constraint listings_rate_type_check check (rate_type is null or rate_type in ('fijo','hora','visita','dia','semana','mes','convenir'));

do $$ begin
  alter table public.listings add constraint listings_rental_type_check check (rental_type is null or rental_type in ('maquinaria','espacio','vehiculo','otro'));
exception when duplicate_object then null;
end $$;

-- Todas las filas existentes no se ven afectadas: rental_type queda NULL,
-- así que no cambian de sección (kind sigue siendo 'equipo' o 'servicio').
