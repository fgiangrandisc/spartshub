// Chequeo de humo: levanta el build de producción y lo abre en un navegador
// headless (mobile y desktop) para detectar errores de JavaScript que
// revientan el montaje de React (p.ej. ReferenceError por variables no
// declaradas/pasadas como prop). No depende de que Supabase responda: solo
// verifica que la app arranque sin crashear.
//
// Se ejecuta en CI después de `vite build`, contra `vite preview`.

import { chromium } from "playwright";
import { spawn } from "node:child_process";

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function esperarServidor(url, intentosMax = 30) {
  for (let i = 0; i < intentosMax; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* todavía no está arriba */
    }
    await esperar(500);
  }
  throw new Error(`El servidor de preview no respondió en ${url}`);
}

async function main() {
  const preview = spawn(
    "npx",
    ["vite", "preview", "--port", String(PORT), "--strictPort"],
    { stdio: "pipe" }
  );

  let previewLog = "";
  preview.stdout.on("data", (d) => (previewLog += d.toString()));
  preview.stderr.on("data", (d) => (previewLog += d.toString()));

  try {
    await esperarServidor(URL);

    const browser = await chromium.launch();
    const erroresPorViewport = {};

    for (const [nombre, viewport] of Object.entries({
      mobile: { width: 390, height: 844 },
      desktop: { width: 1440, height: 900 },
    })) {
      const page = await browser.newPage({ viewport });
      const errores = [];

      page.on("pageerror", (err) => errores.push(err.message));
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const texto = msg.text();
          // Los intentos de red hacia Supabase/fonts fallan en el sandbox de
          // CI sin credenciales o sin salida a internet real: eso es
          // esperable y no es un bug de la app, así que se ignora.
          if (/ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/i.test(texto)) return;
          errores.push(`[console] ${texto}`);
        }
      });

      await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 20000 });
      await esperar(1500);

      // El fallback prerenderizado tiene esta frase; si sigue presente,
      // React nunca reemplazó el contenido (indicio de crash silencioso).
      const rootText = await page.$eval("#root", (el) => el.textContent || "");
      if (rootText.includes("Cargando la aplicación")) {
        errores.push("React nunca reemplazó el contenido de #root (posible crash al montar)");
      }

      // Intenta interactuar con el buscador, que es donde se detectó el
      // bug original (searchCat sin declarar).
      try {
        await page.click("text=Buscar", { timeout: 3000 });
        await esperar(800);
      } catch {
        /* el botón puede no estar visible según el estado inicial; no es fatal */
      }

      await page.close();
      if (errores.length) erroresPorViewport[nombre] = errores;
    }

    await browser.close();

    if (Object.keys(erroresPorViewport).length) {
      console.error("❌ Smoke test falló:\n");
      for (const [vp, errs] of Object.entries(erroresPorViewport)) {
        console.error(`--- ${vp} ---`);
        errs.forEach((e) => console.error(e));
      }
      process.exitCode = 1;
    } else {
      console.log("✅ Smoke test OK: la app monta sin errores de JS en mobile y desktop.");
    }
  } finally {
    preview.kill();
  }
}

main().catch((err) => {
  console.error("Error ejecutando el smoke test:", err);
  process.exitCode = 1;
});
