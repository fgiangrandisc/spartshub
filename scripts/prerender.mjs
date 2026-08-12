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
    titulo:"Repuestos para minería en Chile",
    meta:"Repuestos y equipos para faenas mineras: palas, perforadoras, chancadores, correas e hidráulica. Contacto directo, sin comisiones.",
    intro:"Repuestos y equipos para faenas mineras: camiones de extracción, palas, perforadoras, chancadores, correas transportadoras y sistemas hidráulicos." },
  { id:"for",   slug:"forestal",     nombre:"Forestal",
    titulo:"Repuestos para maquinaria forestal en Chile",
    meta:"Repuestos para cosechadoras, skidders, procesadoras y astilladoras. Publica y busca sin comisiones, con contacto directo entre las partes.",
    intro:"Repuestos para cosechadoras, skidders, procesadoras, astilladoras y equipos de manejo de madera." },
  { id:"const", slug:"construccion", nombre:"Construcción",
    titulo:"Repuestos para construcción en Chile",
    meta:"Repuestos para excavadoras, retroexcavadoras, cargadores frontales, motoniveladoras, rodillos y grúas. Sin intermediarios ni comisiones.",
    intro:"Repuestos para excavadoras, retroexcavadoras, cargadores frontales, motoniveladoras, rodillos compactadores y grúas." },
  { id:"ene",   slug:"energia",      nombre:"Energía",
    titulo:"Repuestos y equipos de energía en Chile",
    meta:"Generadores, motores, transformadores, tableros y sistemas de respaldo. Conecta directo con quien lo tiene, sin comisiones.",
    intro:"Repuestos y equipos para generación y distribución eléctrica: generadores, motores, transformadores, tableros y sistemas de respaldo." },
  { id:"trans", slug:"transporte",   nombre:"Transporte y Logística",
    titulo:"Repuestos para camiones en Chile",
    meta:"Repuestos para camiones, tractocamiones, remolques, grúas horquilla y equipos de carga. Contacto directo con el vendedor.",
    intro:"Repuestos para camiones, tractocamiones, remolques, grúas horquilla y equipos de movimiento de carga." },
  { id:"fae",   slug:"faenas",       nombre:"Faenas",
    titulo:"Equipos y repuestos para faenas en Chile",
    meta:"Equipamiento y repuestos para faenas industriales: instalaciones, apoyo en terreno y mantenimiento de operaciones. Sin comisiones.",
    intro:"Equipamiento y repuestos para faenas industriales: instalaciones, apoyo en terreno y mantenimiento de operaciones." },
  { id:"rut",   slug:"rutas",        nombre:"Rutas y Caminos",
    titulo:"Maquinaria vial y repuestos en Chile",
    meta:"Pavimentadoras, fresadoras, distribuidores de asfalto y equipos de señalización vial. Publica y busca sin comisiones.",
    intro:"Maquinaria y repuestos para obras viales: pavimentadoras, fresadoras, distribuidores de asfalto y equipos de señalización." },
  { id:"san",   slug:"sanitarias",   nombre:"Sanitarias",
    titulo:"Bombas y equipos sanitarios en Chile",
    meta:"Bombas, válvulas y sistemas de impulsión para plantas de tratamiento, agua potable y alcantarillado. Contacto directo.",
    intro:"Repuestos y equipos para plantas de tratamiento, redes de agua potable y alcantarillado: bombas, válvulas y sistemas de impulsión." },
  { id:"serv",  slug:"servicios",    nombre:"Servicios",
    titulo:"Servicios industriales en Chile",
    meta:"Mantenimiento, reparación, mecanizado, hidráulica, soldadura especializada y asistencia en terreno. Conecta directo con el proveedor.",
    intro:"Servicios industriales: mantenimiento, reparación, mecanizado, hidráulica, soldadura especializada y asistencia en terreno." },
  { id:"ali",   slug:"alimentos",    nombre:"Alimentos",
    titulo:"Equipos para la industria alimentaria",
    meta:"Líneas de proceso, envasado, frío industrial y transporte de producto para la industria alimentaria y agroindustrial en Chile.",
    intro:"Repuestos y equipos para la industria alimentaria y agroindustrial: líneas de proceso, envasado, frío industrial y transporte de producto." },
  { id:"her",   slug:"herramientas", nombre:"Herramientas",
    titulo:"Herramientas industriales en Chile",
    meta:"Herramientas hidráulicas, neumáticas, de medición y torque, y herramienta especializada de taller. Sin intermediarios.",
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
  const titulo = `${cat.titulo} | PortalMaquinas`;   // ≤60 caracteres: Google trunca más allá
  const desc   = cat.meta;                            // ≤155 caracteres
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
          ${esc(cat.titulo)}
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

  /* /buscar: página propia. Si fuera una copia literal de la portada
     tendría el mismo título y el mismo canonical, y Google la trataría
     como contenido duplicado. Le damos identidad y canonical propio. */
  const tBuscar = "Buscar repuestos y maquinaria industrial | PortalMaquinas";
  const dBuscar = "Busca repuestos, maquinaria y equipos industriales por marca, modelo, número de parte, serie o motor en las 16 regiones de Chile.";
  let buscar = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(tBuscar)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(dBuscar)}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}/buscar$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(tBuscar)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(dBuscar)}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}/buscar$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(tBuscar)}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(dBuscar)}$2`);
  const dirBuscar = path.join(DIST, "buscar");
  await mkdir(dirBuscar, { recursive: true });
  await writeFile(path.join(dirBuscar, "index.html"), buscar, "utf8");

  /* Sitemap generado acá y no a mano: así nunca se desincroniza de las
     categorías reales, y lleva lastmod con la fecha del despliegue. */
  const hoy = new Date().toISOString().slice(0, 10);
  const url = (loc, cf, pr) =>
    `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${hoy}</lastmod>\n    <changefreq>${cf}</changefreq>\n    <priority>${pr}</priority>\n  </url>`;
  const urls = [
    url(`${SITE}/`, "daily", "1.0"),
    url(`${SITE}/buscar`, "daily", "0.9"),
    ...CATEGORIAS.map(c => url(`${SITE}/categoria/${c.slug}`, "daily", "0.8")),
  ];
  await writeFile(path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
    "utf8");

  const conPublicaciones = Object.values(publicaciones).filter(v => v?.length).length;
  console.log(`[prerender] ${generadas} categorías (${conPublicaciones} con publicaciones reales) + /buscar + sitemap con ${generadas + 2} URLs`);
}

main().catch(e => {
  // Nunca romper el build por el prerender: peor es no desplegar.
  console.warn("[prerender] Falló, se continúa sin páginas prerenderizadas:", e.message);
});
