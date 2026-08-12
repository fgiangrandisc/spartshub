/**
 * Prerender de páginas de categoría.
 *
 * Por qué existe: la aplicación es una SPA y el HTML que sirve Vercel llega
 * prácticamente vacío. Google ejecuta JavaScript, pero lo hace tarde y sin
 * garantías, y otros rastreadores (WhatsApp, LinkedIn, Bing) directamente no
 * lo ejecutan. Este script corre DESPUÉS de `vite build` y escribe un HTML
 * completo por categoría, con su título, su descripción, sus datos
 * estructurados y texto real indexable ya presente en el documento.
 *
 * Cuando el navegador carga esa página, React monta encima y toma el control:
 * el usuario ve la aplicación normal. El HTML estático es solo el punto de
 * partida.
 *
 * Si Supabase está disponible, además incrusta los títulos de las
 * publicaciones más recientes de cada categoría, que es el contenido con más
 * valor de búsqueda que tenemos. Si no lo está, la página se genera igual sin
 * ellos: este script nunca debe hacer fallar el build.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const SITE = "https://www.portalmaquinas.com";
const DIST = path.resolve("dist");

/* Debe mantenerse en sintonía con CAT_SLUGS de src/App.jsx */
const CATEGORIAS = [
  { id:"min",   slug:"mineria",      nombre:"Minería",
    intro:"Repuestos y equipos para faenas mineras: camiones de extracción, palas, perforadoras, chancadores, correas transportadoras y sistemas hidráulicos." },
  { id:"for",   slug:"forestal",     nombre:"Forestal",
    intro:"Repuestos para cosechadoras, skidders, procesadoras, astilladoras y equipos de manejo de madera." },
  { id:"const", slug:"construccion", nombre:"Construcción",
    intro:"Repuestos para excavadoras, retroexcavadoras, cargadores frontales, motoniveladoras, rodillos compactadores y grúas." },
  { id:"ene",   slug:"energia",      nombre:"Energía",
    intro:"Repuestos y equipos para generación y distribución eléctrica: generadores, motores, transformadores, tableros y sistemas de respaldo." },
  { id:"trans", slug:"transporte",   nombre:"Transporte y Logística",
    intro:"Repuestos para camiones, tractocamiones, remolques, grúas horquilla y equipos de movimiento de carga." },
  { id:"fae",   slug:"faenas",       nombre:"Faenas",
    intro:"Equipamiento y repuestos para faenas industriales: instalaciones, apoyo en terreno y mantenimiento de operaciones." },
  { id:"rut",   slug:"rutas",        nombre:"Rutas y Caminos",
    intro:"Maquinaria y repuestos para obras viales: pavimentadoras, fresadoras, distribuidores de asfalto y equipos de señalización." },
  { id:"san",   slug:"sanitarias",   nombre:"Sanitarias",
    intro:"Repuestos y equipos para plantas de tratamiento, redes de agua potable y alcantarillado: bombas, válvulas y sistemas de impulsión." },
  { id:"serv",  slug:"servicios",    nombre:"Servicios",
    intro:"Servicios industriales: mantenimiento, reparación, mecanizado, hidráulica, soldadura especializada y asistencia en terreno." },
  { id:"ali",   slug:"alimentos",    nombre:"Alimentos",
    intro:"Repuestos y equipos para la industria alimentaria y agroindustrial: líneas de proceso, envasado, frío industrial y transporte de producto." },
  { id:"her",   slug:"herramientas", nombre:"Herramientas",
    intro:"Herramientas industriales y de taller: equipos hidráulicos, neumáticos, de medición, torque y herramienta especializada." },
];

const esc = s => String(s ?? "")
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");

/* ── Publicaciones recientes por categoría (opcional) ───────────── */
/* En Vercel las variables del proyecto ya vienen en process.env. En un build
   local no: viven en .env y solo las lee Vite. Las cargamos a mano para que
   el resultado sea el mismo en las dos máquinas. */
function cargarEnvLocal() {
  try {
    if (!existsSync(".env")) return;
    for (const linea of readFileSync(".env", "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch { /* si no se puede leer, seguimos sin credenciales */ }
}

async function publicacionesPorCategoria() {
  cargarEnvLocal();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY;
  if (!url || !key) {
    console.log("[prerender] Sin credenciales de Supabase: se generan las páginas sin publicaciones.");
    return {};
  }
  const porCat = {};
  for (const c of CATEGORIAS) {
    try {
      const r = await fetch(
        `${url}/rest/v1/listings?select=title,brand,model,location&cat=eq.${c.id}&order=created_at.desc&limit=12`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } }
      );
      if (!r.ok) { console.warn(`[prerender] ${c.slug}: HTTP ${r.status}`); continue; }
      porCat[c.id] = await r.json();
    } catch (e) {
      console.warn(`[prerender] ${c.slug}: ${e.message}`);
    }
  }
  return porCat;
}

/* ── Reemplazos sobre el HTML base ──────────────────────────────── */
function construirPagina(base, cat, publicaciones) {
  const titulo = `Repuestos y maquinaria para ${cat.nombre.toLowerCase()} en Chile | PortalMaquinas`;
  const desc   = `${cat.intro} Publica y busca sin comisiones, con contacto directo entre las partes.`.slice(0, 300);
  const urlCat = `${SITE}/categoria/${cat.slug}`;

  let html = base;

  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`);
  html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`);
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${urlCat}$2`);
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(titulo)}$2`);
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${urlCat}$2`);
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(titulo)}$2`);
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(desc)}$2`);

  /* Datos estructurados propios de la categoría */
  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: titulo,
    description: desc,
    url: urlCat,
    inLanguage: "es-CL",
    isPartOf: { "@id": `${SITE}/#website` },
    about: { "@type": "Thing", name: `Repuestos y maquinaria para ${cat.nombre}` },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type":"ListItem", position:1, name:"Inicio", item:`${SITE}/` },
        { "@type":"ListItem", position:2, name:cat.nombre, item:urlCat },
      ],
    },
  };
  html = html.replace("</head>",
    `  <script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n    </script>\n  </head>`);

  /* Contenido indexable dentro de #root (React lo reemplaza al montar) */
  const items = (publicaciones || []).filter(p => p?.title);
  const listado = items.length
    ? `<h2 style="font-size:19px;margin:28px 0 10px">Publicaciones recientes en ${esc(cat.nombre)}</h2>
        <ul style="font-size:16px;line-height:1.9;color:#98a4b3;padding-left:20px;margin:0 0 20px">
          ${items.map(p => `<li>${esc([p.title, p.brand, p.model].filter(Boolean).join(" · "))}${p.location ? ` — ${esc(p.location)}` : ""}</li>`).join("\n          ")}
        </ul>`
    : "";

  const otras = CATEGORIAS.filter(c => c.slug !== cat.slug)
    .map(c => `<a href="/categoria/${c.slug}" style="color:#FF6A00;text-decoration:none">${esc(c.nombre)}</a>`)
    .join(" · ");

  const cuerpo = `
      <div style="max-width:820px;margin:0 auto;padding:56px 24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e9edf2;background:#0B0F14">
        <a href="/"><img src="/icon-192.png" alt="PortalMaquinas" width="72" height="72" style="border-radius:14px;border:0" /></a>
        <h1 style="font-size:30px;line-height:1.25;margin:20px 0 12px">
          Repuestos y maquinaria para ${esc(cat.nombre.toLowerCase())} en Chile
        </h1>
        <p style="font-size:17px;line-height:1.6;color:#98a4b3;margin:0 0 20px">${esc(cat.intro)}</p>
        <p style="font-size:16px;line-height:1.7;color:#98a4b3;margin:0 0 20px">
          En PortalMaquinas conectas directo con quien tiene el repuesto o el equipo,
          sin intermediarios y sin comisiones. Busca por marca, modelo, número de parte,
          número de serie, número de motor o número de chasis, en las 16 regiones de Chile.
        </p>
        ${listado}
        <h2 style="font-size:19px;margin:28px 0 10px">Otras categorías</h2>
        <p style="font-size:16px;line-height:1.9">${otras}</p>
        <p style="font-size:16px;color:#98a4b3;margin-top:24px">
          Contacto: <a href="mailto:info@portalmaquinas.com" style="color:#FF6A00">info@portalmaquinas.com</a>
        </p>
        <p style="font-size:15px;color:#6e7987;margin-top:32px">
          Cargando la aplicación… Si no carga, activa JavaScript en tu navegador.
        </p>
      </div>`;

  /* Ojo con el ancla: en el HTML compilado Vite mueve el <script> al <head>,
     así que el cierre de #root queda justo antes de </body>. Cortamos entre
     "<div id=root>" y el último </div> anterior a </body>. */
  const antes = html;
  html = html.replace(/<div id="root">[\s\S]*<\/div>(\s*)<\/body>/,
    `<div id="root">${cuerpo}\n    </div>$1</body>`);
  if (html === antes) {
    throw new Error("no se pudo reemplazar el contenido de #root: revisa la estructura de dist/index.html");
  }

  return html;
}

/* ── Main ───────────────────────────────────────────────────────── */
async function main() {
  const baseRuta = path.join(DIST, "index.html");
  if (!existsSync(baseRuta)) {
    console.warn("[prerender] No existe dist/index.html. ¿Corriste vite build antes? Se omite el prerender.");
    return;
  }
  const base = await readFile(baseRuta, "utf8");
  const publicaciones = await publicacionesPorCategoria();

  let generadas = 0;
  for (const cat of CATEGORIAS) {
    const dir = path.join(DIST, "categoria", cat.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), construirPagina(base, cat, publicaciones[cat.id]), "utf8");
    generadas++;
  }

  /* /buscar como página estática propia, para que la ruta no dependa
     únicamente del rewrite de Vercel. */
  const dirBuscar = path.join(DIST, "buscar");
  await mkdir(dirBuscar, { recursive: true });
  await writeFile(path.join(dirBuscar, "index.html"), base, "utf8");

  const conPublicaciones = Object.values(publicaciones).filter(v => v?.length).length;
  console.log(`[prerender] ${generadas} páginas de categoría generadas (${conPublicaciones} con publicaciones reales) + /buscar`);
}

main().catch(e => {
  // Nunca romper el build por el prerender: peor es no desplegar.
  console.warn("[prerender] Falló, se continúa sin páginas prerenderizadas:", e.message);
});
