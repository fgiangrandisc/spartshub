import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";

import { sb } from "./supabase.js";
import { T, CSS_BASE } from "./theme.js";
import { LangCtx, useLang, REGIONS, makeT } from "./i18n.js";

const { RED, RED2, GOLD, BLUE, GREEN, DANGER, PUR, BG, BG2, BG3, CARD, SURF, BORDER: BORDER_RAW, BORDER2: BORDER2_RAW, TEXT, SUB: SUB_RAW, MUTED: MUTED_RAW } = T;

/* ── Contrast overrides (UX/accessibility) ───────────────────────
   Los textos secundarios y bordes del theme original tenían bajo
   contraste sobre el fondo oscuro (usuarios reportaron dificultad
   para leer). Subimos SUB y MUTED a tonos más claros y los bordes
   a algo más visible, sin tocar la identidad de marca (naranja/fondos).
   Objetivo: cumplir WCAG AA (≥4.5:1 para texto normal).
──────────────────────────────────────────────────────────────── */
const SUB     = "#C7CDD4";   // texto secundario — antes muy tenue
const MUTED   = "#9AA3AD";   // texto terciario / metadatos — legible
const BORDER  = "rgba(255,255,255,.12)";   // bordes más visibles
const BORDER2 = "rgba(255,255,255,.18)";

const CSS_OVERRIDE = `
  .inp { font-size: 16px !important; padding: 12px 16px !important; }
  .btn-red, .btn-ol { font-size: 15px !important; }
  .tag { font-size: 12px !important; }
  .sidebar-btn { font-size: 15px !important; gap: 10px !important; }
  select { font-size: 16px !important; }
  textarea { font-size: 16px !important; }

  /* ── Accessibility & readability ── */
  * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  /* Prevent horizontal overflow on mobile (no sideways scroll) */
  html, body { max-width: 100%; overflow-x: hidden; }
  *, *::before, *::after { box-sizing: border-box; }
  /* Visible focus ring for keyboard navigation (was invisible) */
  button:focus-visible, a:focus-visible, input:focus-visible,
  select:focus-visible, textarea:focus-visible {
    outline: 2px solid ${RED};
    outline-offset: 2px;
  }
  /* Inputs get a clear focus border too */
  .inp:focus, input:focus, select:focus, textarea:focus {
    border-color: ${RED} !important;
  }
  /* Slightly more readable body line-height & letter spacing */
  body { letter-spacing: 0.1px; }
  /* Tags: ensure the dim variant is still legible */
  .tag.t-dim { color: #B8C0C8 !important; }
  /* Links and clickable rows show pointer affordance */
  .photo-card { transition: transform .12s ease, box-shadow .12s ease; }
  .photo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.35); }
  /* Toast entrance animation */
  @keyframes toastIn { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
  .toast-in { animation: toastIn .22s ease-out; }
  /* Skeleton loading shimmer */
  @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
  .skel { background: linear-gradient(90deg, rgba(255,255,255,.04) 25%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 75%); background-size: 800px 100%; animation: shimmer 1.4s infinite linear; }
`;

/* ── Mobile detection hook ──────────────────────────────────── */
function useIsMobile() {
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(()=>{
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  },[]);
  return mobile;
}

/* ── Botón "atrás" del navegador para overlays ──────────────────
   Cuando un overlay (detalle, sheet, chat) está abierto, empuja una
   entrada al historial. Si el usuario toca "atrás" en el navegador,
   en vez de salir del sitio se cierra el overlay.
   `isOpen`: si el overlay está abierto. `onClose`: cómo cerrarlo.
──────────────────────────────────────────────────────────────── */
function useBackButton(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const poppedRef = useRef(false);
  useEffect(()=>{
    if (!isOpen) return;
    poppedRef.current = false;
    window.history.pushState({ shOverlay: true }, "");
    const handlePop = () => {
      poppedRef.current = true;   // el usuario usó "atrás"; ya se consumió la entrada
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", handlePop);
    return () => {
      window.removeEventListener("popstate", handlePop);
      // Si se cerró con un botón (no con "atrás"), consumimos la entrada extra
      if (!poppedRef.current) {
        window.history.back();
      }
    };
  }, [isOpen]);
}

/* ── Swipe-to-close hook for bottom sheets ──────────────────────
   Returns drag handlers + live translateY. Dragging the handle down
   past a threshold (or with enough velocity) triggers onClose.
──────────────────────────────────────────────────────────────── */
function useSwipeToClose(onClose) {
  const [dragY, setDragY] = useState(0);
  const start  = useRef(null);
  const startT = useRef(0);

  const onTouchStart = e => {
    start.current  = e.touches[0].clientY;
    startT.current = Date.now();
  };
  const onTouchMove = e => {
    if (start.current == null) return;
    const dy = e.touches[0].clientY - start.current;
    if (dy > 0) setDragY(dy); // only allow dragging down
  };
  const onTouchEnd = () => {
    if (start.current == null) return;
    const dt = Date.now() - startT.current;
    const velocity = dragY / Math.max(dt, 1); // px per ms
    if (dragY > 110 || velocity > 0.55) {
      setDragY(window.innerHeight); // slide out
      setTimeout(() => { onClose(); setDragY(0); }, 180);
    } else {
      setDragY(0); // snap back
    }
    start.current = null;
  };

  const handleProps = { onTouchStart, onTouchMove, onTouchEnd };
  const sheetStyle = {
    transform: `translateY(${dragY}px)`,
    transition: start.current == null ? "transform .22s cubic-bezier(.2,.8,.2,1)" : "none",
  };
  return { handleProps, sheetStyle, dragY };
}

/* ══════════════════════════════════════════════════════════════
   MATCH ENGINE — IA analiza similitud entre publicación y solicitud
══════════════════════════════════════════════════════════════ */
async function analyzeImage(base64Data, mediaType) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data }
            },
            {
              type: "text",
              text: `Eres un experto en repuestos y equipos industriales. Analiza esta imagen e identifica el componente.
Responde SOLO con JSON válido (sin markdown):
{
  "title": "nombre descriptivo del repuesto o equipo",
  "brand": "marca si es visible, sino null",
  "model": "modelo o referencia si es visible, sino null",
  "part_number": "número de parte si es visible, sino null",
  "cat": "una de: min(minería) for(forestal) const(construcción) ene(energía) trans(transporte) fae(faenas) rut(rutas) san(sanitarias) serv(servicios)",
  "condition": "una de: Nuevo | Usado – Bueno | Usado – Regular | Reacondicionado",
  "description": "descripción técnica breve en español, máx 120 caracteres",
  "emoji": "un emoji que represente el componente",
  "confidence": "alta | media | baja"
}`
            }
          ]
        }]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data.content?.[0]?.text || "";
    if (!text) return null;
    // Strip markdown fences and extract the first JSON object
    const cleaned = text.replace(/```(?:json)?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    return null;
  }
}

async function analyzeMatch(listingText, requestText) {
  try {
    const apiKey = import.meta.env.VITE_ANTHROPIC_KEY || import.meta.env.VITE_ANTHROPIC_API_KEY;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
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
Match = true si el producto publicado es igual o muy similar a lo solicitado (score >= 70).`
        }]
      })
    });
    if (!response.ok) return { match: false, score: 0, reason: "Error HTTP" };
    const data = await response.json();
    if (data.error) return { match: false, score: 0, reason: data.error.message || "Error API" };
    const text = data.content?.[0]?.text || "";
    const cleaned = text.replace(/```(?:json)?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { match: false, score: 0, reason: "Respuesta inválida" };
    return JSON.parse(jsonMatch[0]);
  } catch(e) {
    console.error("[MatchEngine] Excepción en analyzeMatch:", e);
    return { match: false, score: 0, reason: "Error de análisis" };
  }
}

function buildText(item) {
  return [item.title, item.brand, item.model, item.description, item.cat,
    item.serial_number, item.part_number, item.engine_number, item.chassis_number
  ].filter(Boolean).join(" | ");
}

async function runMatchEngine(newItem, type, user, profile) {
  // type = "listing" (nueva publicación) o "request" (nueva solicitud)
  console.log("[MatchEngine] Iniciando runMatchEngine. type:", type, "item:", newItem?.id);
  const newText = buildText(newItem);

  // Buscar el lado opuesto
  const table = type === "listing" ? "requests" : "listings";
  const { data: candidates, error: candErr } = await sb.from(table).select("*").limit(50);
  if (candErr) console.error("[MatchEngine] Error cargando candidatos:", candErr);
  console.log(`[MatchEngine] Candidatos en '${table}':`, candidates?.length || 0);
  if (!candidates?.length) return [];

  const matches = [];
  for (const candidate of candidates) {
    if (candidate.user_id === user.id) continue; // no matchear con uno mismo
    const candText = buildText(candidate);
    const listingT = type === "listing" ? newText : candText;
    const requestT = type === "listing" ? candText : newText;
    const result = await analyzeMatch(listingT, requestT);
    if (result.match && result.score >= 70) {
      matches.push({ candidate, score: result.score, reason: result.reason });
    }
  }
  console.log("[MatchEngine] Matches encontrados:", matches.length);
  return matches;
}

async function notifyMatch(match, newItem, type, user, profile) {
  const { candidate, score, reason } = match;
  const isListing = type === "listing";

  // Guardar match en DB
  await sb.from("matches").insert({
    listing_id:     isListing ? newItem.id : candidate.id,
    request_id:     isListing ? candidate.id : newItem.id,
    listing_user_id: isListing ? user.id : candidate.user_id,
    request_user_id: isListing ? candidate.user_id : user.id,
    score,
    reason,
    notified_at: new Date().toISOString(),
  }).then(()=>{}, ()=>{}); // graceful if table doesn't exist yet

  // Crear mensaje automático en chat
  const otherUserId = candidate.user_id;
  const myId = user.id;
  const autoMsg = isListing
    ? `🤝 ¡Match automático! Publicaste "${newItem.title}" y coincide con una solicitud activa de este usuario. Score: ${score}/100. ${reason}`
    : `🤝 ¡Match automático! Dejaste una solicitud para "${newItem.title}" y hay una publicación que coincide. Score: ${score}/100. ${reason}`;

  await sb.from("messages").insert({
    from_id: myId,
    to_id: otherUserId,
    body: autoMsg,
    listing_id: isListing ? newItem.id : candidate.id,
    read: false,
  }).then(()=>{}, ()=>{});

  return { otherUserId, autoMsg, candidate };
}


/* ── Icon system ────────────────────────────────────────────── */
const Ic = ({ n, s=22, c="currentColor", sw=1.8, fill="none", style:extStyle, className }) => {
  const p = {
    home:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    msg:      <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    chevR:    <polyline points="9 18 15 12 9 6"/>,
    chevL:    <polyline points="15 18 9 12 15 6"/>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    map:      <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    camera:   <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    star:     <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={fill} stroke={c}/>,
    send:     <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    bell:     <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    verify:   <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    box:      <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></>,
    img:      <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    grid:     <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    phone:    <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>,
    menu:     <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    wa:       null,
  };
  if (n === "wa") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
    </svg>
  );
  return <svg aria-hidden="true" width={s} height={s} fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={extStyle} className={className}>{p[n]}</svg>;
};

/* ── Logo ───────────────────────────────────────────────────── */
/* logo.png es raster horizontal con fondo NEGRO sólido (sin alpha). Se muestra
   sobre headers oscuros, así que aplicamos mix-blend-mode:screen: el negro se
   funde con el fondo oscuro y desaparece, dejando visibles el engranaje naranja
   y el texto. El isotipo es SVG transparente -> no necesita blend.
   width:auto (raster fiable) + objectFit:contain + maxWidth:none + flexShrink:0. */
function SpartsLogo({ size=36, onClick, icon=false }) {
  const src   = icon ? "/isotipo.svg" : "/logo.png";
  const width = icon ? size*(718/729) : "auto";
  return (
    <img
      src={src}
      alt="PortalMaquinas"
      onClick={onClick}
      style={{ height:size, width, maxWidth:"none", objectFit:"contain", display:"block", flexShrink:0, mixBlendMode: icon ? undefined : "screen", cursor:onClick?"pointer":"default" }}
    />
  );
}
function Logo({ size=16 }) { return <SpartsLogo size={size===16?36:size+20}/>; }

/* ── Spinner ────────────────────────────────────────────────── */
function Spin({ size=22 }) {
  return <div className="spinner" style={{ width:size, height:size }}/>;
}

/* ── Toast system (feedback de éxito/error) ─────────────────────
   Reemplaza los alert() del navegador con notificaciones suaves
   que aparecen abajo y desaparecen solas.
──────────────────────────────────────────────────────────────── */
const ToastCtx = createContext(()=>{});
function useToast() { return useContext(ToastCtx); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type="success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, message, type }]);
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position:"fixed", bottom:"calc(100px + env(safe-area-inset-bottom))", left:0, right:0, zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", gap:8, pointerEvents:"none", padding:"0 16px" }}>
        {toasts.map(t => {
          const color = t.type==="error" ? DANGER : t.type==="info" ? BLUE : GREEN;
          const icon  = t.type==="error" ? "✕" : t.type==="info" ? "ℹ" : "✓";
          return (
            <div key={t.id} className="toast-in"
              style={{ background:CARD, border:`1px solid ${color}`, borderLeft:`4px solid ${color}`, borderRadius:10, padding:"12px 18px", maxWidth:420, width:"fit-content", boxShadow:"0 8px 30px rgba(0,0,0,.4)", display:"flex", alignItems:"center", gap:10, pointerEvents:"auto" }}>
              <span style={{ color, fontWeight:700, fontSize:16, flexShrink:0 }}>{icon}</span>
              <span style={{ color:TEXT, fontSize:15, fontWeight:500, lineHeight:1.4 }}>{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, size=40 }) {
  const initials = (name||"U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div title={name} style={{ width:size, height:size, borderRadius:"50%", background:`rgba(255,106,0,.15)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <span style={{ color:RED, fontWeight:700, fontSize:size*0.38, fontFamily:"Barlow Condensed,sans-serif" }}>{initials}</span>
    </div>
  );
}

/* ── Image compression utility ──────────────────────────────── */
const compressImage = (file, maxW = 1200, quality = 0.78) =>
  new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxW / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob || file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

/* ── Constants ──────────────────────────────────────────────── */
const CATS = [
  { id:"all",   label:"Todas",               emoji:"◈" },
  { id:"min",   label:"Minería",              emoji:"⚙️" },
  { id:"for",   label:"Forestal",             emoji:"🌲" },
  { id:"const", label:"Construcción",         emoji:"🏗️" },
  { id:"ene",   label:"Energía",              emoji:"⚡" },
  { id:"trans", label:"Transporte y Logística",emoji:"🚛" },
  { id:"fae",   label:"Faenas",               emoji:"⛏️" },
  { id:"rut",   label:"Rutas y Caminos",      emoji:"🛣️" },
  { id:"san",   label:"Sanitarias",           emoji:"💧" },
  { id:"serv",  label:"Servicios",            emoji:"🔧" },
  { id:"ali",   label:"Alimentos",            emoji:"🌾" },
  { id:"her",   label:"Herramientas",         emoji:"🪛" },
];
const CONDITIONS  = ["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"];
const OPERATIONS  = ["Venta","Arriendo","Trade"];
const CURRENCIES  = ["CLP","USD","EUR","COP","PEN","MXN"];

const fmtTs = ts => {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d)) return "—";
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60)     return "Ahora";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} mes`;
  return `${Math.floor(diff / 31536000)} año`;
};
const fmtPrice = (p, cur) => {
  if (cur === "NEG") return "A convenir";
  const n = Number(p);
  if (!cur || isNaN(n)) return "—";
  return `${cur} ${n.toLocaleString("es-CL")}`;
};

/* ── Búsqueda tolerante: sin acentos, minúsculas, sin signos ──────
   normaliza("Camión") === normaliza("camion") === "camion"
──────────────────────────────────────────────────────────────── */
const normalizar = (s) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // quita acentos/diacríticos
    .replace(/[^a-z0-9\s]/g, " ")      // signos → espacio
    .replace(/\s+/g, " ")
    .trim();

/* Distancia de Levenshtein (para tolerar faltas de ortografía leves) */
const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let cur = [i + 1];
    for (let j = 0; j < b.length; j++) {
      cur[j + 1] = a[i] === b[j]
        ? prev[j]
        : 1 + Math.min(prev[j], prev[j + 1], cur[j]);
    }
    prev = cur;
  }
  return prev[b.length];
};

/* ¿El texto del item coincide con la consulta? Tolerante a acentos y typos.
   - Coincidencia directa de substring (rápida)
   - Por cada palabra de la consulta, busca una palabra parecida en el texto
     (Levenshtein ≤ 1 para palabras cortas, ≤ 2 para largas) */
const coincideBusqueda = (texto, consulta) => {
  const t = normalizar(texto);
  const c = normalizar(consulta);
  if (!c) return true;
  if (t.includes(c)) return true;
  const palabrasTexto = t.split(" ").filter(Boolean);
  const palabrasConsulta = c.split(" ").filter(Boolean);
  return palabrasConsulta.every(pc => {
    if (t.includes(pc)) return true;
    const tol = pc.length <= 4 ? 1 : 2;
    return palabrasTexto.some(pt =>
      pt.includes(pc) || pc.includes(pt) || levenshtein(pt, pc) <= tol
    );
  });
};

/* ── Shared hook: unread message count ──────────────────────── */
function useUnreadCount(userId) {
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const r = await sb.from("messages").select("*", { count:"exact", head:true }).eq("to_id", userId).eq("read", false);
        setUnreadCount(r.count || 0);
      } catch(_) {}
    };
    load();
    const ch = sb.channel("unread-" + userId)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages", filter:`to_id=eq.${userId}` },
        () => setUnreadCount(c => c + 1))
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [userId]);
  return unreadCount;
}
function PhotoPlaceholder({ emoji="📦", h=160, url }) {
  if (url) return (
    <div style={{ width:"100%", height:h, background:BG2, overflow:"hidden" }}>
      <img src={url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
    </div>
  );
  return (
    <div style={{ width:"100%", height:h, background:BG2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44 }}>
      {emoji}
    </div>
  );
}

/* ── Demo listings ──────────────────────────────────────────── */


/* ══════════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════════ */
function LandingPage({ onLogin, onRegister, onSearch, onEnter, onGateRegister }) {
  const { t, lang, setLang } = useLang();
  const isMobile = useIsMobile();
  const [searchQ, setSearchQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const go = fn => { setMenuOpen(false); fn?.(); };

  const centerBtn = { background:"transparent", color:RED, border:`1.5px solid ${RED}`, borderRadius:7, padding:"8px 13px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase", transition:"all .15s", whiteSpace:"nowrap" };
  const CENTER_NAV = [
    { key:"nav_sell",     action:onGateRegister },
    { key:"nav_buy",      action:onEnter },
    { key:"nav_requests", action:onGateRegister },
    { key:"nav_services", action:onEnter },
    { key:"nav_rentals",  action:onEnter },
  ];

  const handleSearch = () => {
    if (searchQ.trim()) onSearch?.(searchQ.trim());
    else onEnter?.();
  };

  const FEATURES = [
    { icon:"box",   title:"Miles de repuestos", desc:"en un solo lugar" },
    { icon:"users", title:"Contacto directo",   desc:"sin intermediarios" },
    { icon:"shield",title:"Sin comisiones",     desc:"ni costos ocultos" },
  ];

  return (
    <div style={{ minHeight:"100dvh", background:BG, color:TEXT, fontFamily:"'Barlow', sans-serif" }}>
      <style>{CSS_BASE}</style><style>{CSS_OVERRIDE}</style>

      <header style={{ background:BG3, borderBottom:`1px solid ${BORDER}`, padding:"0 clamp(14px,4vw,32px)", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", minHeight:68, gap:12 }}>
          {/* Left: logo → inicio (Explorar). En móvil solo el isotipo para no apretar el header. */}
          <SpartsLogo size={isMobile?40:48} icon={isMobile} onClick={onEnter}/>

          {/* Center: 5 nav buttons (desktop only) */}
          {!isMobile && (
            <nav style={{ display:"flex", gap:8, flex:1, justifyContent:"center" }}>
              {CENTER_NAV.map(b=>(
                <button key={b.key} onClick={b.action} style={centerBtn}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,106,0,.12)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
                  {t(b.key)}
                </button>
              ))}
            </nav>
          )}

          {/* Right: (desktop) Ingresar/Registrarse or (mobile) hamburger */}
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {!isMobile && (
              <>
                <button onClick={onLogin}
                  style={{ background:"transparent", border:`1.5px solid ${BORDER2}`, borderRadius:8, padding:"8px 14px", fontSize:"clamp(12px,3.2vw,14px)", fontWeight:700, color:TEXT, cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>
                  {t("nav_signin")}
                </button>
                <button onClick={onRegister}
                  style={{ background:RED, border:"none", borderRadius:8, padding:"8px 16px", fontSize:"clamp(12px,3.2vw,14px)", fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>
                  {t("nav_signup")}
                </button>
              </>
            )}
            {isMobile && (
              <button onClick={()=>setMenuOpen(o=>!o)} aria-label="Menú"
                style={{ width:44, height:44, display:"flex", alignItems:"center", justifyContent:"center", background:"transparent", border:`1px solid ${BORDER2}`, borderRadius:8, cursor:"pointer", flexShrink:0 }}>
                <Ic n={menuOpen?"x":"menu"} s={22} c={TEXT}/>
              </button>
            )}
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobile && menuOpen && (
          <div style={{ maxWidth:1200, margin:"0 auto", padding:"8px 0 12px", display:"flex", flexDirection:"column", gap:8, borderTop:`1px solid ${BORDER}` }}>
            {CENTER_NAV.map(b=>(
              <button key={b.key} onClick={()=>go(b.action)}
                style={{ ...centerBtn, width:"100%", minHeight:46, textAlign:"center" }}>
                {t(b.key)}
              </button>
            ))}
            <div style={{ height:1, background:BORDER, margin:"2px 0" }}/>
            <button onClick={()=>go(onLogin)}
              style={{ background:"transparent", border:`1.5px solid ${BORDER2}`, borderRadius:8, width:"100%", minHeight:46, fontSize:15, fontWeight:700, color:TEXT, cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.4, textTransform:"uppercase" }}>
              {t("nav_signin")}
            </button>
            <button onClick={()=>go(onRegister)}
              style={{ background:RED, border:"none", borderRadius:8, width:"100%", minHeight:46, fontSize:15, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.4, textTransform:"uppercase" }}>
              {t("nav_signup")}
            </button>
          </div>
        )}
      </header>

      <section style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:"url(/hero.jpg)", backgroundSize:"cover", backgroundPosition: isMobile ? "center 30%" : "right center", zIndex:0 }}/>
        <div style={{ position:"absolute", inset:0, zIndex:1, background: isMobile ? "linear-gradient(to bottom, rgba(10,10,10,.96) 0%, rgba(10,10,10,.75) 45%, rgba(10,10,10,.35) 100%)" : "linear-gradient(to right, rgba(10,10,10,.97) 30%, rgba(10,10,10,.6) 55%, rgba(10,10,10,.15) 100%)" }}/>

        <div style={{ position:"relative", zIndex:2, maxWidth:1200, margin:"0 auto", padding: isMobile ? "40px 20px 28px" : "72px 32px 56px", minHeight: isMobile ? "auto" : 520 }}>
          <div style={{ maxWidth: isMobile ? "100%" : 640 }}>
            <p style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:"clamp(15px,4vw,22px)", color:RED, letterSpacing:1, textTransform:"uppercase", fontWeight:700, lineHeight:1.15, marginBottom:16 }}>
              No vendemos repuestos.<br/>Conectamos personas.
            </p>
            <h1 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:"clamp(38px,10vw,80px)", lineHeight:.98, color:TEXT, marginBottom:24, overflowWrap:"break-word" }}>
              Todo lo que necesitas <span style={{ color:RED }}>para tu operación o faena.</span>
            </h1>

            <div style={{ display:"flex", gap:0, marginBottom:28, flexWrap:"wrap" }}>
              {FEATURES.map((f,i)=>(
                <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:10, paddingRight:20, marginRight:20, borderRight: i<FEATURES.length-1 ? `1px solid ${BORDER2}` : "none", marginBottom:8 }}>
                  <Ic n={f.icon} s={22} c={RED}/>
                  <div>
                    <p style={{ fontSize:15, fontWeight:700, color:TEXT, lineHeight:1.2 }}>{f.title}</p>
                    <p style={{ fontSize:14, color:MUTED }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", flexWrap:"wrap", gap:8, background:BG3, border:`1px solid ${BORDER2}`, borderRadius:12, padding:8, maxWidth:720 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, flex:"1 1 200px", minWidth:0, padding:"0 10px" }}>
                <Ic n="search" s={18} c={MUTED}/>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSearch()}
                  placeholder="¿Qué necesitas?"
                  style={{ flex:1, minWidth:0, padding:"12px 0", background:"transparent", border:"none", outline:"none", fontSize:16, color:TEXT, fontFamily:"Barlow, sans-serif" }}/>
              </div>
              <button onClick={handleSearch}
                style={{ background:RED, border:"none", borderRadius:8, padding:"12px 28px", fontSize:16, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.5, textTransform:"uppercase", flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
                Buscar
              </button>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding:"clamp(24px,5vw,36px) clamp(16px,5vw,32px)", maxWidth:900, margin:"0 auto" }}>
        <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:"clamp(22px,5vw,30px)", color:TEXT, marginBottom:16 }}>¿Qué quieres hacer?</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:12 }}>
          {[
            { icon:"search", label:"Explorar", desc:"Ver publicaciones", action:onEnter },
            { icon:"plus",   label:"Publicar", desc:"Vende tu producto", action:onRegister },
            { icon:"box",    label:"Solicitar", desc:"Pide lo que buscas", action:onRegister },
          ].map((a,i)=>(
            <div key={i} onClick={a.action}
              style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:14, padding:"20px 16px", cursor:"pointer", textAlign:"center" }}>
              <div style={{ width:48, height:48, borderRadius:12, background:"rgba(255,106,0,.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                <Ic n={a.icon} s={22} c={RED}/>
              </div>
              <p style={{ fontSize:16, fontWeight:700, color:TEXT, marginBottom:3, fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.3, textTransform:"uppercase" }}>{a.label}</p>
              <p style={{ fontSize:14, color:SUB }}>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding:"clamp(32px,6vw,52px) clamp(16px,5vw,32px)", textAlign:"center", background:BG2, borderTop:`1px solid ${BORDER}` }}>
        <div style={{ maxWidth:480, margin:"0 auto" }}>
          <h2 style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:"clamp(26px,6vw,40px)", color:TEXT, lineHeight:1.1, marginBottom:16 }}>
            Empieza hoy. <span style={{ color:RED }}>Es gratis.</span>
          </h2>
          <button onClick={onRegister}
            style={{ background:RED, border:"none", borderRadius:10, padding:"15px 36px", fontSize:16, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:.6, textTransform:"uppercase", whiteSpace:"nowrap" }}>
            Crear cuenta gratis →
          </button>
        </div>
      </section>

      <footer style={{ background:BG3, borderTop:`1px solid ${BORDER}`, padding:"28px 20px", textAlign:"center" }}>
        <div style={{ maxWidth:880, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:14 }}><SpartsLogo size={24}/></div>
          <div style={{ display:"flex", gap:"16px 24px", justifyContent:"center", flexWrap:"wrap", marginBottom:16 }}>
            {["Términos y condiciones","Política de privacidad","Contacto"].map((link,i)=>(
              <span key={i} style={{ fontSize:14, color:MUTED, cursor:"pointer" }}>{link}</span>
            ))}
          </div>
          <p style={{ fontSize:14, color:MUTED, lineHeight:1.6 }}>© 2026 PortalMaquinas™ · info@portalmaquinas.com</p>
        </div>
      </footer>
    </div>
  );
}
function AuthScreen({ initialMode="login", notice=null, onAuth, onBack }) {
  const { t, lang } = useLang();
  const [mode, setMode]     = useState(initialMode);
  const [f, setF]           = useState({ email:"", pass:"", name:"", biz:"", phone:"", location:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    setErr("");
    const email = f.email.trim();
    const pass  = f.pass;
    if (!email || !pass) { setErr("Email y contraseña requeridos."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Ingresa un email válido."); return; }
    setLoading(true);
    if (mode === "login") {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      onAuth(data.user);
    } else {
      const name = f.name.trim();
      if (!name) { setErr("Ingresa tu nombre."); setLoading(false); return; }
      const { data, error } = await sb.auth.signUp({ email, password: pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (data.user) {
        await sb.from("profiles").upsert({ id:data.user.id, name, biz:f.biz.trim()||null, phone:f.phone.trim(), location:f.location.trim() });
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
        setMode("login");
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100dvh", background:BG, display:"flex", flexDirection:"column" }}>
      <style>{CSS_BASE}</style><style>{CSS_OVERRIDE}</style>
      <div style={{ padding:"56px 20px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button className="btn-ghost" onClick={onBack}><Ic n="chevL" s={22} c={TEXT}/></button>
        <SpartsLogo size={36}/>
      </div>

      <div style={{ flex:1, padding:"0 24px 40px", display:"flex", flexDirection:"column", gap:14 }}>
        <h2 className="bebas" style={{ fontSize:34, color:TEXT, marginBottom:4 }}>
          {mode==="login" ? "Bienvenido de vuelta" : "Crear cuenta"}
        </h2>
        <p style={{ fontSize:16, color:SUB, marginBottom:8 }}>
          {mode==="login" ? "Ingresa para continuar" : "Únete a la red industrial"}
        </p>

        {notice && <div style={{ background:"rgba(255,106,0,.1)", border:`1px solid rgba(255,106,0,.35)`, borderRadius:8, padding:"12px 16px", fontSize:15, color:TEXT, marginBottom:4 }}>
          {t(notice)}
        </div>}

        <div className="seg" style={{ marginBottom:4 }}>
          {[["login",t("auth_login")],["register",t("auth_register")]].map(([m,l])=>(
            <div key={m} className={`seg-btn${mode===m?" active":""}`} onClick={()=>{ setMode(m); setErr(""); }}>{l}</div>
          ))}
        </div>

        {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.3)",borderRadius:8,padding:"12px 16px",fontSize:16,color:DANGER }}>
          {err === "Invalid login credentials" ? (lang==="en"?"Invalid email or password.":"Email o contraseña incorrectos.") : err}
        </div>}

        {mode === "register" && (
          <>
            <input className="inp" placeholder={t("auth_name")} maxLength={100} value={f.name} onChange={e=>upd("name",e.target.value)}/>
            <input className="inp" placeholder={`${t("auth_company")} (opcional)`} maxLength={150} value={f.biz} onChange={e=>upd("biz",e.target.value)}/>
            <input className="inp" placeholder={t("auth_whatsapp")} maxLength={25} value={f.phone} onChange={e=>upd("phone",e.target.value)}/>
            <input className="inp" placeholder={t("pub_location_ph")} maxLength={100} value={f.location} onChange={e=>upd("location",e.target.value)}/>
          </>
        )}

        <input className="inp" type="email" placeholder={t("auth_email")} value={f.email} onChange={e=>upd("email",e.target.value)}/>
        <div style={{ position:"relative" }}>
          <input className="inp" type={showPass?"text":"password"} placeholder={t("auth_password")} value={f.pass} onChange={e=>upd("pass",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ paddingRight:44 }}/>
          <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:16,padding:0 }}>
            {showPass?"🙈":"👁️"}
          </button>
        </div>

        <button className="btn-red" onClick={submit} disabled={loading} style={{ marginTop:4, opacity:loading?.6:1, padding:"15px" }}>
          {loading ? <Spin/> : mode==="login" ? t("auth_enter") : t("auth_create")}
        </button>

        <p style={{ textAlign:"center", fontSize:16, color:MUTED, marginTop:4 }}>
          {t("auth_tagline")}
        </p>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   SEARCH PAGE
══════════════════════════════════════════════════════════════ */
function SearchPage({ user, onSelect, region, initQ="" }) {
  const { t, lang } = useLang();
  const [q,          setQ]          = useState(initQ);
  const [cat,        setCat]        = useState("all");
  const [condition,  setCondition]  = useState("");
  const [marca,      setMarca]      = useState("");
  const [modelo,     setModelo]     = useState("");
  const [nSerie,     setNSerie]     = useState("");
  const [nParte,     setNParte]     = useState("");
  const [nMotor,     setNMotor]     = useState("");
  const [horasMin,   setHorasMin]   = useState("");
  const [horasMax,   setHorasMax]   = useState("");
  const [ubicacion,  setUbicacion]  = useState("all");   // region dropdown
  const [tipo,       setTipo]       = useState("");       // "" | "repuesto" | "servicio"
  const [priceMin,   setPriceMin]   = useState("");
  const [priceMax,   setPriceMax]   = useState("");
  const [priceCur,   setPriceCur]   = useState("CLP");
  const [sortBy,     setSortBy]     = useState("newest");
  const [verified,   setVerified]   = useState(false);
  const [listings,   setListings]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [viewMode,   setViewMode]   = useState("grid");
  const [showFilters,setShowFilters]= useState(false);

  const MARCAS = ["","Caterpillar","Komatsu","Rexroth","Parker","WEG","ABB","Siemens","SKF","Cummins","Fleetguard","Gates","SEW","Atlas Copco","Bosch","NSK","FAG","Timken"];

  const getSortParams = () => {
    if (sortBy === "price_asc")  return { col:"price",      asc:true  };
    if (sortBy === "price_desc") return { col:"price",      asc:false };
    if (sortBy === "a_z")        return { col:"title",      asc:true  };
    if (sortBy === "z_a")        return { col:"title",      asc:false };
    return                              { col:"created_at", asc:false };
  };

  const debounceRef = useRef(null);
  const load = useCallback(async () => {
    setLoading(true);
    const { col, asc } = getSortParams();
    let query = sb.from("listings").select("*").order(col, {ascending: asc});

    if (cat !== "all")         query = query.eq("cat", cat);
    // NOTA: el texto libre (q) ya NO se filtra en Supabase con ilike
    // (no maneja acentos ni typos). Se filtra en cliente más abajo.
    if (condition)             query = query.eq("condition", condition);
    if (marca)                 query = query.ilike("brand", `%${marca}%`);
    if (modelo)                query = query.ilike("model", `%${modelo}%`);
    if (nSerie)                query = query.ilike("serial_number", `%${nSerie}%`);
    if (nParte)                query = query.ilike("part_number", `%${nParte}%`);
    if (nMotor)                query = query.ilike("engine_number", `%${nMotor}%`);
    if (horasMin)              query = query.gte("hours", Number(horasMin));
    if (horasMax)              query = query.lte("hours", Number(horasMax));
    if (tipo === "servicio")   query = query.eq("operation", "Servicio");
    if (tipo === "repuesto")   query = query.neq("operation", "Servicio");

    // Location: sidebar dropdown > global header selector
    if (ubicacion && ubicacion !== "all") {
      const rObj = REGIONS.find(r => r.id === ubicacion);
      if (rObj?.q) query = query.ilike("location", `%${rObj.q}%`);
    } else if (region && region !== "all" && region !== "intl") {
      const rObj = REGIONS.find(r => r.id === region);
      if (rObj?.q) query = query.ilike("location", `%${rObj.q}%`);
    }

    if (priceMin)              query = query.gte("price", Number(priceMin));
    if (priceMax)              query = query.lte("price", Number(priceMax));
    if (priceMin || priceMax)  query = query.eq("currency", priceCur);
    if (verified)              query = query.eq("verified", true);

    const { data } = await query;
    let resultados = data || [];
    // Filtro de texto libre tolerante a acentos y faltas de ortografía
    if (q && q.trim()) {
      resultados = resultados.filter(l =>
        coincideBusqueda(
          [l.title, l.brand, l.model, l.description].filter(Boolean).join(" "),
          q
        )
      );
    }
    setListings(resultados);
    setLoading(false);
  }, [cat, q, condition, marca, modelo, nSerie, nParte, nMotor, horasMin, horasMax,
      ubicacion, tipo, priceMin, priceMax, priceCur, sortBy, verified, region]);

  useEffect(()=>{
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), 300);
    return () => clearTimeout(debounceRef.current);
  }, [load]);

  const activeFilters = [
    cat !== "all" ? cat : "",
    condition, marca, modelo, nSerie, nParte, nMotor,
    horasMin, horasMax,
    ubicacion !== "all" ? ubicacion : "",
    tipo,
    priceMin, priceMax,
    verified ? "v" : "",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setCat("all"); setCondition(""); setMarca(""); setModelo("");
    setNSerie(""); setNParte(""); setNMotor("");
    setHorasMin(""); setHorasMax("");
    setUbicacion("all"); setTipo("");
    setPriceMin(""); setPriceMax(""); setPriceCur("CLP");
    setVerified(false); setSortBy("newest");
  };

  const LABEL = { fontSize:16, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" };
  const SEL   = (active) => ({ background:SURF, border:`1px solid ${active?RED:BORDER}`, borderRadius:8, padding:"9px 12px", fontSize:16, color:active?RED:TEXT, width:"100%", outline:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:active?700:400, transition:"border-color .2s" });
  const INP   = { background:SURF, border:`1px solid ${BORDER}`, borderRadius:8, padding:"9px 12px", fontSize:16, color:TEXT, width:"100%", outline:"none", fontFamily:"inherit", transition:"border-color .2s" };
  const isMobile = useIsMobile();

  return (
    <div>
      {/* ══ SEARCH BAR (always on top) — orden fijo por más recientes, vista grilla fija ══ */}
      <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
        <div className="search-bar" style={{ flex:1, minWidth:0 }}>
          <Ic n="search" s={16} c={MUTED}/>
          <input placeholder={t("search_placeholder")} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()}/>
          {q && <button className="btn-ghost" style={{ padding:"2px 4px" }} onClick={()=>setQ("")}><Ic n="x" s={16} c={MUTED}/></button>}
        </div>
      </div>

      {/* ══ FILTERS TOGGLE BUTTON ══ */}
      <button onClick={()=>setShowFilters(s=>!s)}
        style={{ display:"flex", alignItems:"center", gap:8, padding:"10px 16px", borderRadius:8, border:`1px solid ${activeFilters>0?RED:BORDER}`, background:activeFilters>0?"rgba(255,106,0,.08)":SURF, color:activeFilters>0?RED:TEXT, fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase", marginBottom:14, transition:"all .15s" }}>
        <Ic n="settings" s={16} c={activeFilters>0?RED:TEXT}/>
        {t("search_filters")}
        {activeFilters > 0 && <span style={{ background:RED, color:"#fff", fontSize:14, fontWeight:700, borderRadius:10, padding:"1px 8px", fontFamily:"Barlow Condensed,sans-serif" }}>{activeFilters}</span>}
        <span style={{ marginLeft:4, transform:showFilters?"rotate(180deg)":"none", transition:"transform .2s", display:"inline-flex" }}><Ic n="chevR" s={14} c={activeFilters>0?RED:MUTED} style={{ transform:"rotate(90deg)" }}/></span>
      </button>

      {/* ══ COLLAPSIBLE FILTER PANEL ══ */}
      {showFilters && (
      <div style={{ background:BG3, borderRadius:12, border:`1px solid ${BORDER}`, padding:"18px 16px", marginBottom:18, display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fit, minmax(220px, 1fr))", gap:"4px 20px", alignItems:"start" }}>

        {/* Global region badge */}
        {region && region !== "all" && ubicacion === "all" && (
          <div style={{ gridColumn:"1/-1", marginBottom:4, padding:"5px 9px", background:"rgba(255,106,0,.08)", borderRadius:7, border:"1px solid rgba(255,106,0,.2)", display:"flex", alignItems:"center", gap:6 }}>
            <Ic n="map" s={11} c={RED}/>
            <span style={{ fontSize:16, color:RED, fontWeight:700, fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5 }}>
              {lang==="en" ? REGIONS.find(r=>r.id===region)?.label_en : REGIONS.find(r=>r.id===region)?.label_es}
            </span>
          </div>
        )}

        {/* 1. TIPO */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Tipo</p>
          <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:`1px solid ${BORDER}` }}>
            {[["","Todos"],["repuesto","Repuestos"],["servicio","Servicios"]].map(([val,lbl])=>(
              <button key={val} onClick={()=>setTipo(val)}
                style={{ flex:1, padding:"8px 4px", border:"none", cursor:"pointer", fontSize:16, fontWeight:700, fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.3, transition:"all .15s",
                  background: tipo===val ? RED : "transparent",
                  color: tipo===val ? "#fff" : MUTED }}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* 2. INDUSTRIA */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Industria</p>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={SEL(cat !== "all")}>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
          </select>
        </div>

        {/* 3. ESTADO */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Estado</p>
          <select value={condition} onChange={e=>setCondition(e.target.value)} style={SEL(!!condition)}>
            <option value="">Todos</option>
            {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* 4. UBICACIÓN */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Ubicación</p>
          <select value={ubicacion} onChange={e=>setUbicacion(e.target.value)} style={SEL(ubicacion !== "all")}>
            {REGIONS.map(r=><option key={r.id} value={r.id} style={{ background:BG3 }}>
              {lang === "en" ? r.label_en : r.label_es}
            </option>)}
          </select>
        </div>

        {/* 5. RANGO DE PRECIO */}
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <p style={{ ...LABEL, marginBottom:0 }}>Precio</p>
            <div style={{ display:"flex", background:BG2, borderRadius:5, overflow:"hidden", border:`1px solid ${BORDER}` }}>
              {["CLP","USD","EUR"].map(c=>(
                <button key={c} onClick={()=>setPriceCur(c)}
                  style={{ padding:"2px 7px", fontSize:16, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", transition:"all .12s",
                    background: priceCur===c ? RED : "transparent",
                    color: priceCur===c ? "#fff" : MUTED }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <input value={priceMin} onChange={e=>setPriceMin(e.target.value)} placeholder="Mín" type="number" min="0" style={{ ...INP, width:"50%" }}/>
            <span style={{ color:MUTED, fontSize:16 }}>–</span>
            <input value={priceMax} onChange={e=>setPriceMax(e.target.value)} placeholder="Máx" type="number" min="0" style={{ ...INP, width:"50%" }}/>
          </div>
        </div>

        {/* 6. MARCA */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>{t("search_brand")}</p>
          <select value={marca} onChange={e=>setMarca(e.target.value)} style={SEL(!!marca)}>
            {MARCAS.map(m=><option key={m} value={m}>{m || "Todas las marcas"}</option>)}
          </select>
        </div>

        {/* 7. MODELO */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>{t("search_model")}</p>
          <input value={modelo} onChange={e=>setModelo(e.target.value)} placeholder="Ej: 3406E, A10V…"
            style={{ ...INP, border:`1px solid ${modelo?RED:BORDER}`, color:modelo?RED:TEXT, fontWeight:modelo?700:400 }}/>
        </div>

        {/* 8. N° TÉCNICOS */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Números técnicos</p>
          <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
            <input value={nSerie} onChange={e=>setNSerie(e.target.value)} placeholder="N° Serie" style={{ ...INP, fontSize:16 }}/>
            <input value={nParte} onChange={e=>setNParte(e.target.value)} placeholder="N° Parte" style={{ ...INP, fontSize:16 }}/>
            <input value={nMotor} onChange={e=>setNMotor(e.target.value)} placeholder="N° Motor" style={{ ...INP, fontSize:16 }}/>
          </div>
        </div>

        {/* 9. HORAS DE USO */}
        <div style={{ marginBottom:14 }}>
          <p style={LABEL}>Horas de uso</p>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <input value={horasMin} onChange={e=>setHorasMin(e.target.value)} placeholder="Mín" type="number" min="0" style={{ ...INP, width:"50%" }}/>
            <span style={{ color:MUTED, fontSize:16 }}>–</span>
            <input value={horasMax} onChange={e=>setHorasMax(e.target.value)} placeholder="Máx" type="number" min="0" style={{ ...INP, width:"50%" }}/>
          </div>
        </div>

        {/* 10. VERIFICADOS */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, cursor:"pointer" }} onClick={()=>setVerified(v=>!v)}>
          <p style={{ fontSize:16, color:verified?TEXT:SUB, fontWeight:verified?700:400 }}>Solo verificados ✓</p>
          <div className="toggle" style={{ background:verified?RED:"rgba(255,255,255,.1)" }}>
            <div className="toggle-knob" style={{ left:verified?20:2 }}/>
          </div>
        </div>

        {/* CLEAR ALL FILTERS */}
        <button onClick={resetFilters}
          style={{ gridColumn:"1/-1", padding:"10px", borderRadius:8, border:`1px solid ${activeFilters>0?RED:BORDER}`, background:activeFilters>0?"rgba(255,106,0,.08)":"transparent", color:activeFilters>0?RED:MUTED, fontSize:16, fontWeight:700, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, transition:"all .15s" }}>
          {activeFilters > 0 ? `✕ Limpiar filtros (${activeFilters})` : "Sin filtros activos"}
        </button>
      </div>
      )}

      {/* ── Resultados ── */}
      <div style={{ minWidth:0 }}>
        {/* Active filter chips */}
        {activeFilters > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {cat !== "all"          && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setCat("all")}>{CATS.find(c=>c.id===cat)?.label} ✕</span>}
            {tipo                   && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setTipo("")}>{tipo==="servicio"?"Servicios":"Repuestos"} ✕</span>}
            {condition              && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setCondition("")}>{condition} ✕</span>}
            {ubicacion !== "all"    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setUbicacion("all")}>{REGIONS.find(r=>r.id===ubicacion)?.label_es} ✕</span>}
            {marca                  && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setMarca("")}>{marca} ✕</span>}
            {modelo                 && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setModelo("")}>Modelo: {modelo} ✕</span>}
            {nSerie                 && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNSerie("")}>Serie: {nSerie} ✕</span>}
            {nParte                 && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNParte("")}>Parte: {nParte} ✕</span>}
            {nMotor                 && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNMotor("")}>Motor: {nMotor} ✕</span>}
            {horasMin               && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setHorasMin("")}>Hrs ≥ {horasMin} ✕</span>}
            {horasMax               && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setHorasMax("")}>Hrs ≤ {horasMax} ✕</span>}
            {priceMin               && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setPriceMin("")}>Desde {priceMin} {priceCur} ✕</span>}
            {priceMax               && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setPriceMax("")}>Hasta {priceMax} {priceCur} ✕</span>}
            {verified               && <span className="tag t-green" style={{ cursor:"pointer" }} onClick={()=>setVerified(false)}>Verificados ✕</span>}
          </div>
        )}

        {/* Count */}
        <p style={{ fontSize:16, color:MUTED, marginBottom:14 }}>
          {loading ? t("search_searching")
            : q.trim()
              ? `${listings.length} ${listings.length===1?"resultado":"resultados"} para "${q.trim()}"`
              : `${listings.length} ${t("search_found")}`}
        </p>

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fill, minmax(${isMobile?150:230}px, 1fr))`, gap:isMobile?12:16 }}>
            {[0,1,2,3,4,5].map(i=>(
              <div key={i} style={{ background:CARD, borderRadius:10, overflow:"hidden", border:`1px solid ${BORDER}` }}>
                <div className="skel" style={{ height:130 }}/>
                <div style={{ padding:"10px 12px 14px" }}>
                  <div className="skel" style={{ height:12, width:"40%", borderRadius:4, marginBottom:8 }}/>
                  <div className="skel" style={{ height:14, width:"85%", borderRadius:4, marginBottom:8 }}/>
                  <div className="skel" style={{ height:12, width:"60%", borderRadius:4, marginBottom:8 }}/>
                  <div className="skel" style={{ height:16, width:"50%", borderRadius:4 }}/>
                </div>
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div style={{ padding:"60px 0", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
            <p className="bebas" style={{ fontSize:24, color:TEXT, marginBottom:8 }}>Sin resultados</p>
            <p style={{ color:MUTED, fontSize:16, marginBottom:16 }}>Intentá con otro término o ajustá los filtros</p>
            <button className="btn-ol" onClick={resetFilters} style={{ fontSize:16 }}>Limpiar filtros</button>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display:"grid", gridTemplateColumns:`repeat(auto-fill, minmax(${isMobile?150:230}px, 1fr))`, gap:isMobile?12:16 }}>
            {listings.map(l=>(
              <div key={l.id} className="photo-card card" onClick={()=>onSelect(l)}>
                <PhotoPlaceholder emoji={l.emoji||"📦"} url={l.photos?.[0]} h={130}/>
                <div style={{ padding:"10px 12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span className="tag t-dim" style={{ fontSize:16 }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                    {l.verified && <span className="tag t-green" style={{ fontSize:16 }}>✓</span>}
                  </div>
                  <p style={{ fontSize:17, fontWeight:700, lineHeight:1.3, marginBottom:4, color:TEXT }}>{l.title}</p>
                  <p style={{ fontSize:15, color:SUB, marginBottom:2 }}>{l.biz}</p>
                  {l.location && <p style={{ fontSize:15, color:MUTED, marginBottom:5 }}>📍 {l.location}</p>}
                  {l.brand && <p style={{ fontSize:15, color:MUTED, marginBottom:5 }}>🏷️ {l.brand}</p>}
                  <p className="bebas" style={{ fontSize:20, color:RED, marginTop:2 }}>{fmtPrice(l.price, l.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {listings.map(l=><MiniCard key={l.id} l={l} onClick={()=>onSelect(l)}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LISTING DETAIL
══════════════════════════════════════════════════════════════ */
function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const touchX = useRef(null);

  const prev = () => setIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx(i => (i + 1) % photos.length);
  // Swipe táctil entre fotos (móvil)
  const onTouchStart = e => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (touchX.current == null || photos.length <= 1) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchX.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    if (!lightbox || photos.length <= 1) return;
    const onKey = e => {
      if (e.key === "ArrowLeft")  setIdx(i => (i - 1 + photos.length) % photos.length);
      if (e.key === "ArrowRight") setIdx(i => (i + 1) % photos.length);
      if (e.key === "Escape")     setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, photos.length]);

  return (
    <>
      <div style={{ width:"100%", background:"#0a0a0a" }}>
        {/* Main photo — click to open lightbox */}
        <div style={{ position:"relative", width:"100%", height:280, overflow:"hidden", cursor:"zoom-in" }}
          onClick={e=>{ e.stopPropagation(); setLightbox(true); }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <img src={photos[idx]} alt=""
            style={{ width:"100%", height:"100%", objectFit:"contain", display:"block", background:"#0a0a0a" }}
          />
          {/* Counter */}
          {photos.length > 1 && (
            <div style={{ position:"absolute", top:10, right:10, background:"rgba(0,0,0,.6)", backdropFilter:"blur(4px)", borderRadius:20, padding:"3px 10px", fontSize:16, fontWeight:700, color:"#fff", fontFamily:"Barlow Condensed,sans-serif" }}>
              {idx+1} / {photos.length}
            </div>
          )}
          {/* Zoom hint */}
          <div style={{ position:"absolute", bottom:10, right:10, background:"rgba(0,0,0,.5)", borderRadius:6, padding:"3px 7px", fontSize:16, color:"rgba(255,255,255,.6)", fontFamily:"Barlow Condensed,sans-serif", display:"flex", alignItems:"center", gap:3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
            AMPLIAR
          </div>
          {/* Arrows */}
          {photos.length > 1 && (
            <>
              <button aria-label="Anterior" onClick={e=>{ e.stopPropagation(); prev(); }}
                style={{ position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,.55)",border:"none",borderRadius:"50%",width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Ic n="chevL" s={18} c="#fff"/>
              </button>
              <button aria-label="Siguiente" onClick={e=>{ e.stopPropagation(); next(); }}
                style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,.55)",border:"none",borderRadius:"50%",width:40,height:40,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <Ic n="chevR" s={18} c="#fff"/>
              </button>
            </>
          )}
        </div>
        {/* Thumbnails — click to select + open lightbox */}
        {photos.length > 1 && (
          <div style={{ display:"flex", gap:5, padding:"8px 10px", overflowX:"auto" }}>
            {photos.map((url,i)=>(
              <img key={i} src={url} alt=""
                onClick={e=>{ e.stopPropagation(); setIdx(i); setLightbox(true); }}
                style={{ width:56, height:56, borderRadius:8, objectFit:"cover", flexShrink:0, cursor:"zoom-in",
                  border: i===idx ? "2px solid #FF6A00" : "2px solid rgba(255,255,255,.1)",
                  opacity: i===idx ? 1 : 0.5, transition:"all .15s" }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={()=>setLightbox(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.96)", zIndex:200, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <button onClick={()=>setLightbox(false)}
            style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,.1)", border:"none", borderRadius:"50%", width:40, height:40, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Ic n="x" s={20} c="#fff"/>
          </button>
          <div style={{ position:"absolute", top:20, left:"50%", transform:"translateX(-50%)", background:"rgba(255,255,255,.1)", borderRadius:20, padding:"4px 14px", fontSize:16, fontWeight:700, color:"#fff", fontFamily:"Barlow Condensed,sans-serif" }}>
            {idx+1} / {photos.length}
          </div>
          <img src={photos[idx]} alt=""
            onClick={e=>e.stopPropagation()}
            onTouchStart={onTouchStart} onTouchEnd={e=>{ e.stopPropagation(); onTouchEnd(e); }}
            style={{ maxWidth:"92vw", maxHeight:"78vh", objectFit:"contain", borderRadius:10, boxShadow:"0 24px 80px rgba(0,0,0,.8)" }}
          />
          {photos.length > 1 && (
            <div style={{ display:"flex", gap:8, marginTop:16 }} onClick={e=>e.stopPropagation()}>
              {photos.map((url,i)=>(
                <img key={i} src={url} alt="" onClick={e=>{ e.stopPropagation(); setIdx(i); }}
                  style={{ width:54, height:54, borderRadius:8, objectFit:"cover", cursor:"pointer",
                    border: i===idx ? "2px solid #FF6A00" : "2px solid rgba(255,255,255,.12)",
                    opacity: i===idx ? 1 : 0.45, transition:"all .15s" }}
                />
              ))}
            </div>
          )}
          {photos.length > 1 && (
            <>
              <button onClick={e=>{ e.stopPropagation(); setIdx(i=>(i-1+photos.length)%photos.length); }}
                style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.1)", border:"none", borderRadius:"50%", width:44, height:44, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="chevL" s={20} c="#fff"/>
              </button>
              <button onClick={e=>{ e.stopPropagation(); setIdx(i=>(i+1)%photos.length); }}
                style={{ position:"absolute", right:16, top:"50%", transform:"translateY(-50%)", background:"rgba(255,255,255,.1)", border:"none", borderRadius:"50%", width:44, height:44, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Ic n="chevR" s={20} c="#fff"/>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
function ListingDetail({ l, onClose, onChat, user, onDeleted, onEdited, onRequireAuth }) {
  const toast = useToast();
  const [showEdit,    setShowEdit]    = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const isOwner = user && l.user_id === user.id;

  const deleteListing = async () => {
    setDeleting(true);
    const { error } = await sb.from("listings").delete().eq("id", l.id);
    setDeleting(false);
    if (error) { toast("No se pudo eliminar: " + error.message, "error"); return; }
    toast("Publicación eliminada");
    if (onDeleted) onDeleted(l.id);
    onClose();
  };

  const wa = () => {
    const msg = encodeURIComponent(`Hola! Vi tu publicación en PortalMaquinas: *${l.title}*. Me interesa, ¿puedes darme más detalles?`);
    window.open(`https://wa.me/${(l.phone||"").replace(/\D/g,"")}?text=${msg}`, "_blank");
  };
  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"92dvh",overflow:"hidden",display:"flex",flexDirection:"column",...sheetStyle }} onClick={e=>e.stopPropagation()}>
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",cursor:"grab",touchAction:"none" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span className="tag t-dim">{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>
        <div style={{ overflowY:"auto",flex:1,paddingBottom:40 }}>
          {/* Photo gallery */}
          {l.photos?.length > 0 ? (
            <PhotoCarousel photos={l.photos}/>
          ) : (
            <div style={{ height:240,background:BG2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80 }}>
              {l.emoji||"📦"}
            </div>
          )}
          <div style={{ padding:"20px 20px 0" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8 }}>
              <h2 style={{ fontSize:22,fontWeight:700,lineHeight:1.2,color:TEXT,flex:1 }}>{l.title}</h2>
              {l.verified&&<span className="tag t-green"><Ic n="verify" s={10} c={GREEN}/>Verificado</span>}
            </div>
            <p className="bebas" style={{ fontSize:30,color:RED,marginBottom:16 }}>{fmtPrice(l.price, l.currency)}</p>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20 }}>
              {[
                l.operation&&["Tipo",l.operation],
                ["Condición",l.condition],
                ["Marca",l.brand||"—"],
                ["Modelo",l.model||"—"],
                ["Stock",`${l.stock||1} u.`],
                l.hours&&["Horas de uso",`${l.hours} hrs`],
                l.serial_number&&["N° Serie",l.serial_number],
                l.part_number&&["N° Parte",l.part_number],
                l.engine_number&&["N° Motor",l.engine_number],
                l.chassis_number&&["N° Chasis",l.chassis_number]
              ].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{ background:BG2,borderRadius:10,padding:"12px 14px",border:`1px solid ${BORDER}` }}>
                  <p style={{ fontSize:16,color:MUTED,marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{k}</p>
                  <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>{v}</p>
                </div>
              ))}
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"12px 14px",background:BG2,borderRadius:10,border:`1px solid ${BORDER}` }}>
              <Ic n="map" s={16} c={RED}/>
              <span style={{ fontSize:16,fontWeight:500,color:TEXT }}>{l.location}</span>
            </div>

            {(l.phone || l.biz) && (
              <div style={{ display:"flex",flexDirection:"column",gap:10,marginBottom:16,padding:"12px 14px",background:BG2,borderRadius:10,border:`1px solid ${BORDER}` }}>
                {l.biz && (
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <Ic n="box" s={16} c={RED}/>
                    <span style={{ fontSize:16,fontWeight:500,color:TEXT }}>{l.biz}</span>
                  </div>
                )}
                {l.phone && (
                  <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                    <Ic n="msg" s={16} c={RED}/>
                    <a href={`tel:${l.phone}`} style={{ fontSize:16,fontWeight:500,color:TEXT,textDecoration:"none" }}>{l.phone}</a>
                  </div>
                )}
              </div>
            )}

            {l.description && (
              <div style={{ marginBottom:20 }}>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>DESCRIPCIÓN</p>
                <p style={{ fontSize:16,color:SUB,lineHeight:1.7 }}>{l.description}</p>
              </div>
            )}

            <div style={{ height:"0.5px",background:BORDER,marginBottom:20 }}/>

            {/* Seller */}
            <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:24 }}>
              <Avatar name={l.biz||"U"} size={46}/>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>{l.biz}</p>
                <div style={{ display:"flex",gap:8,alignItems:"center",marginTop:2,flexWrap:"wrap" }}>
                  <span style={{ fontSize:16,color:MUTED }}>{l.location}</span>
                  {l.user_id && <UserRatingSummary userId={l.user_id} size={14}/>}
                </div>
              </div>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:12,padding:"0 0 20px" }}>
              {isOwner ? (
                <>
                  <button onClick={()=>setShowEdit(true)}
                    style={{ background:BG2,color:TEXT,borderRadius:10,padding:"14px",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,border:`1px solid ${BORDER}`,cursor:"pointer" }}>
                    <Ic n="settings" s={18} c={TEXT}/>Editar publicación
                  </button>
                  {confirmDel ? (
                    <div style={{ display:"flex",gap:10 }}>
                      <button onClick={()=>setConfirmDel(false)}
                        style={{ flex:1,padding:"14px",borderRadius:10,border:`1px solid ${BORDER}`,background:"transparent",color:MUTED,fontSize:16,cursor:"pointer",fontWeight:600 }}>
                        Cancelar
                      </button>
                      <button onClick={deleteListing} disabled={deleting}
                        style={{ flex:1,padding:"14px",borderRadius:10,border:"none",background:DANGER,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>
                        {deleting?<Spin/>:"Sí, eliminar"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>setConfirmDel(true)}
                      style={{ background:"rgba(220,38,38,.08)",color:DANGER,borderRadius:10,padding:"14px",fontSize:16,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,border:`1px solid rgba(220,38,38,.25)`,cursor:"pointer" }}>
                      <Ic n="trash" s={18} c={DANGER}/>Eliminar publicación
                    </button>
                  )}
                </>
              ) : !user ? (
                <>
                  <div style={{ background:BG2, border:`1px solid ${BORDER}`, borderRadius:10, padding:"14px 16px", textAlign:"center" }}>
                    <p style={{ fontSize:15, color:SUB, lineHeight:1.5, marginBottom:12 }}>Crea una cuenta gratis para contactar al vendedor por WhatsApp o mensaje interno.</p>
                    <button onClick={()=>{ onClose(); onRequireAuth?.(); }} className="btn-red" style={{ width:"100%", padding:"13px" }}>
                      Crear cuenta para contactar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button onClick={l.phone ? wa : undefined}
                    style={{ background: l.phone ? "#25D366" : BG2, color: l.phone ? "#fff" : MUTED, borderRadius:10, padding:"15px", fontSize:16, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:10, border: l.phone ? "none" : `1px solid ${BORDER}`, cursor: l.phone ? "pointer" : "not-allowed", opacity: l.phone ? 1 : .6 }}
                    title={l.phone ? undefined : "Este vendedor no publicó su WhatsApp. Usa el chat interno."}>
                    <Ic n="wa" s={20} c={l.phone?"#fff":MUTED}/>{l.phone?"Contactar por WhatsApp":"WhatsApp no disponible"}
                  </button>
                  <button className="btn-ol" style={{ padding:14 }} onClick={()=>{ onClose(); onChat(l); }}>
                    <Ic n="msg" s={18} c={RED}/><span style={{ color:RED,fontWeight:700 }}>Mensaje en PortalMaquinas</span>
                  </button>
                </>
              )}
              <button className="btn-ghost" style={{ justifyContent:"center",padding:12 }} onClick={()=>{
                const url = window.location.href;
                if (navigator.share) { navigator.share({ title:l.title, text:`${l.title} — ${l.currency} ${Number(l.price).toLocaleString()}`, url }); }
                else { navigator.clipboard.writeText(url).then(()=>toast("Link copiado al portapapeles")); }
              }}>
                Compartir publicación 🔗
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEdit && (
        <EditListingSheet
          user={user}
          listing={l}
          onClose={()=>setShowEdit(false)}
          onSaved={updated=>{ setShowEdit(false); if (onEdited) onEdited(updated); }}
          onDeleted={id=>{ setShowEdit(false); if (onDeleted) onDeleted(id); onClose(); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PUBLISH SHEET
══════════════════════════════════════════════════════════════ */
function PublishSheet({ user, profile, onClose, onDone, onBulkUpload }) {
  const { t } = useLang();
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [step,          setStep]          = useState(0);
  const [type,          setType]          = useState("producto");
  const [loading,       setLoading]       = useState(false);
  const [err,           setErr]           = useState("");
  const [matchCount,    setMatchCount]    = useState(0);
  const [showMatchAlert,setShowMatchAlert]= useState(false);
  const [aiFile,        setAiFile]        = useState(null);
  const [aiPreview,     setAiPreview]     = useState(null);
  const [aiLoading,     setAiLoading]     = useState(false);
  const [aiError,       setAiError]       = useState("");
  const [aiResult,      setAiResult]      = useState(null);
  const [photos,        setPhotos]        = useState([]);    // File[]
  const [previews,      setPreviews]      = useState([]);    // object URL strings
  const photoInputRef = useRef();
  const [f, setF] = useState({
    title:"", brand:"", model:"", serial_number:"", part_number:"",
    engine_number:"", hours:"", cat:"all",
    condition:"Nuevo", price:"", currency:"CLP", stock:"1",
    location:profile?.location||"", phone:profile?.phone||"",
    biz:profile?.biz||"", description:"", emoji:"📦"
  });
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const handlePhotoChange = e => {
    const files = Array.from(e.target.files || []);
    const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];
    const valid = files.filter(file => {
      if (!ALLOWED.includes(file.type)) { setErr(t("ai_only_images")); return false; }
      if (file.size > 10 * 1024 * 1024) { setErr("Cada foto debe pesar menos de 10 MB."); return false; }
      return true;
    });
    if (!valid.length) return;
    setErr("");
    const combined = [...photos, ...valid].slice(0, 4);
    setPhotos(combined);
    // Revoke old previews before creating new ones
    previews.forEach(u => URL.revokeObjectURL(u));
    setPreviews(combined.map(f => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const removePhoto = idx => {
    URL.revokeObjectURL(previews[idx]);
    const nextPhotos = photos.filter((_,i) => i !== idx);
    const nextPreviews = previews.filter((_,i) => i !== idx);
    setPhotos(nextPhotos);
    setPreviews(nextPreviews);
  };

  // Cleanup object URLs on unmount
  useEffect(() => () => previews.forEach(u => URL.revokeObjectURL(u)), []);

  const uploadPhotos = async listingId => {
    const uploadOne = async file => {
      const compressed = await compressImage(file);
      const path = `${user.id}/${listingId}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await sb.storage.from("listing-photos").upload(path, compressed, {
        contentType: "image/jpeg", cacheControl: "31536000", upsert: false,
      });
      if (upErr) return null;
      const { data } = sb.storage.from("listing-photos").getPublicUrl(path);
      return data.publicUrl;
    };
    const results = await Promise.all(photos.map(uploadOne));
    return results.filter(Boolean);
  };

  const submit = async () => {
    if (!f.title || (!f.price && f.currency !== "NEG")) { setErr(t("pub_error_required")); return; }
    setLoading(true); setErr("");
    const { data:inserted, error } = await sb.from("listings").insert({
      user_id:user.id, title:f.title, brand:f.brand||null, model:f.model||null,
      serial_number:f.serial_number||null, part_number:f.part_number||null,
      engine_number:f.engine_number||null,
      hours:f.hours?Number(f.hours):null,
      cat:f.cat, condition:f.condition, operation:type==="servicio"?"Servicio":"Venta",
      price:Number(f.price), currency:f.currency,
      stock:Number(f.stock)||1, location:f.location,
      phone:f.phone||profile?.phone, biz:f.biz||profile?.biz,
      description:f.description, emoji:f.emoji||"📦", verified:false,
    }).select().single();
    if (error) { setErr(error.message); setLoading(false); return; }
    if (inserted && photos.length > 0) {
      const photoUrls = await uploadPhotos(inserted.id);
      if (photoUrls.length > 0) {
        await sb.from("listings").update({ photos: photoUrls }).eq("id", inserted.id);
        inserted.photos = photoUrls;
      }
    }
    setLoading(false);
    if (inserted) {
      runMatchEngine(inserted, "listing", user, profile).then(async matches => {
        for (const match of matches) await notifyMatch(match, inserted, "listing", user, profile);
        if (matches.length > 0) { setMatchCount(matches.length); setShowMatchAlert(true); }
      });
    }
    onDone();
  };

  const TYPES = [
    { id:"producto", icon:"box",     titleKey:"pub_product",  subKey:"pub_product_sub" },
    { id:"servicio", icon:"settings",titleKey:"pub_service",  subKey:"pub_service_sub" },
    { id:"excel",    icon:"grid",    titleKey:"pub_excel",    subKey:"pub_excel_sub" },
    { id:"ai",       icon:"camera",  titleKey:"pub_ai",       subKey:"pub_ai_sub", highlight:true },
  ];

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"94dvh",overflow:"hidden",display:"flex",flexDirection:"column",...sheetStyle }} onClick={e=>e.stopPropagation()}>
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",cursor:"grab",touchAction:"none" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            {step===1&&<button className="btn-ghost" style={{ padding:"6px 8px" }} onClick={()=>setStep(0)}><Ic n="chevL" s={20} c={TEXT}/></button>}
            <h3 className="bebas" style={{ fontSize:22,color:TEXT }}>{step===0?"Nueva publicación":type==="producto"?"Publicar producto":"Publicar"}</h3>
          </div>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>

        <div style={{ overflowY:"auto",flex:1,padding:"0 20px 40px" }}>
          {step===0 && (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <p style={{ fontSize:16,color:MUTED,marginBottom:4 }}>{t("pub_what")}</p>
              {TYPES.map(tp=>(
                <div key={tp.id} onClick={()=>{ setType(tp.id); setStep(1); }}
                  style={{ display:"flex",alignItems:"center",gap:16,padding:"16px",borderRadius:12,border:`1.5px solid ${tp.highlight?RED:BORDER}`,background:tp.highlight?"rgba(255,106,0,.08)":CARD,cursor:"pointer",transition:"all .15s" }}>
                  <div style={{ width:44,height:44,background:tp.highlight?RED:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Ic n={tp.icon} s={20} c={tp.highlight?"#fff":SUB}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:16,fontWeight:700,marginBottom:2,color:TEXT }}>{t(tp.titleKey)}</p>
                    <p style={{ fontSize:16,color:MUTED }}>{t(tp.subKey)}</p>
                  </div>
                  <Ic n="chevR" s={18} c={MUTED}/>
                </div>
              ))}

              {onBulkUpload && (
                <>
                  <div style={{ display:"flex",alignItems:"center",gap:10,margin:"6px 0" }}>
                    <div style={{ flex:1,height:1,background:BORDER }}/>
                    <span style={{ fontSize:13,color:MUTED,fontWeight:600 }}>o</span>
                    <div style={{ flex:1,height:1,background:BORDER }}/>
                  </div>
                  <div onClick={()=>{ onClose(); onBulkUpload(); }}
                    style={{ display:"flex",alignItems:"center",gap:16,padding:"16px",borderRadius:12,border:`1.5px solid ${BORDER}`,background:CARD,cursor:"pointer",transition:"all .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>
                    <div style={{ width:44,height:44,background:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22 }}>📂</div>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:16,fontWeight:700,marginBottom:2,color:TEXT }}>Carga masiva</p>
                      <p style={{ fontSize:16,color:MUTED }}>Sube un Excel o PDF y publica varios productos a la vez</p>
                    </div>
                    <Ic n="chevR" s={18} c={MUTED}/>
                  </div>
                </>
              )}
            </div>
          )}

          {step===1&&type==="producto"&&(
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              {/* Photo upload area */}
              <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handlePhotoChange}/>

              {previews.length === 0 ? (
                /* Empty state — big tap target */
                <div onClick={()=>photoInputRef.current?.click()}
                  style={{ border:`2px dashed ${RED}`, borderRadius:14, padding:"32px 20px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", background:"rgba(255,106,0,.04)", transition:"background .15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,106,0,.09)"}
                  onMouseLeave={e=>e.currentTarget.style.background="rgba(255,106,0,.04)"}>
                  <Ic n="camera" s={36} c={RED}/>
                  <p style={{ fontSize:17, fontWeight:700, color:RED, fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase", margin:0 }}>Agregar fotos</p>
                  <p style={{ fontSize:14, color:MUTED, margin:0, textAlign:"center" }}>Toca para seleccionar · Hasta 4 fotos · Puedes elegir varias a la vez</p>
                </div>
              ) : (
                /* Filled — thumbnail row + add more */
                <div>
                  <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:6 }}>
                    {previews.map((url,i)=>(
                      <div key={i} style={{ position:"relative", flexShrink:0 }}>
                        <img src={url} alt="" style={{ width:88, height:88, borderRadius:10, objectFit:"cover", display:"block", border:`1.5px solid ${BORDER}` }}/>
                        <button onClick={()=>removePhoto(i)}
                          style={{ position:"absolute", top:-7, right:-7, width:22, height:22, borderRadius:"50%", background:"#111", border:`1px solid ${BORDER}`, color:"#fff", fontSize:14, cursor:"pointer", padding:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Ic n="x" s={11} c="#fff"/>
                        </button>
                      </div>
                    ))}
                    {previews.length < 4 && (
                      <div onClick={()=>photoInputRef.current?.click()}
                        style={{ width:88, height:88, background:BG2, borderRadius:10, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, flexShrink:0, border:`2px dashed ${BORDER}`, cursor:"pointer", transition:"border-color .15s" }}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>
                        <Ic n="camera" s={20} c={MUTED}/>
                        <span style={{ fontSize:13, color:MUTED, fontWeight:700, fontFamily:"Barlow Condensed,sans-serif" }}>+ FOTO</span>
                      </div>
                    )}
                  </div>
                  <p style={{ fontSize:13, color:MUTED, marginTop:4 }}>{previews.length}/4 fotos · {4-previews.length>0?`Puedes agregar ${4-previews.length} más`:"Máximo alcanzado"}</p>
                </div>
              )}

              {err&&<div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:16,color:DANGER }}>{err}</div>}

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_title")}</p>
                <input className="inp" placeholder={t("pub_title_ph")} value={f.title} maxLength={200} onChange={e=>upd("title",e.target.value)}/>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_industry")}</p>
                  <select className="inp" value={f.cat} onChange={e=>upd("cat",e.target.value)}>
                    {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_brand")}</p>
                  <input className="inp" placeholder={t("pub_brand_ph")} value={f.brand} maxLength={100} onChange={e=>upd("brand",e.target.value)}/>
                </div>
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_model")} <span style={{ fontWeight:400,textTransform:"none" }}>{t("optional")}</span></p>
                <input className="inp" placeholder={t("pub_model_ph")} value={f.model} maxLength={100} onChange={e=>upd("model",e.target.value)}/>
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_serial")} <span style={{ fontWeight:400,textTransform:"none" }}>{t("optional")}</span></p>
                <input className="inp" placeholder={t("pub_serial_ph")} value={f.serial_number} maxLength={100} onChange={e=>upd("serial_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_part")} <span style={{ fontWeight:400,textTransform:"none" }}>{t("optional")}</span></p>
                <input className="inp" placeholder={t("pub_part_ph")} value={f.part_number} maxLength={100} onChange={e=>upd("part_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_engine")} <span style={{ fontWeight:400,textTransform:"none" }}>{t("optional")}</span></p>
                <input className="inp" placeholder={t("pub_engine_ph")} value={f.engine_number} maxLength={100} onChange={e=>upd("engine_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_hours")} <span style={{ fontWeight:400,textTransform:"none" }}>{t("optional")}</span></p>
                <input className="inp" type="number" placeholder={t("pub_hours_ph")} value={f.hours} onChange={e=>upd("hours",e.target.value)}/>
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_condition")}</p>
                <div style={{ display:"flex",gap:8 }}>
                  {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=>(
                    <button key={c} onClick={()=>upd("condition",c)}
                      style={{ flex:1,padding:"9px 4px",borderRadius:8,border:`1.5px solid ${f.condition===c?RED:BORDER}`,background:f.condition===c?"rgba(255,106,0,.1)":CARD,fontWeight:700,fontSize:16,color:f.condition===c?RED:SUB,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_price")}</p>
                {/* A convenir toggle */}
                <button onClick={()=>upd("currency", f.currency==="NEG"?"CLP":"NEG")}
                  style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0 }}>
                  <div style={{ width:38,height:22,borderRadius:11,background:f.currency==="NEG"?RED:BG3,border:`1.5px solid ${f.currency==="NEG"?RED:BORDER}`,position:"relative",transition:"all .2s",flexShrink:0 }}>
                    <div style={{ width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:f.currency==="NEG"?18:2,transition:"left .2s" }}/>
                  </div>
                  <span style={{ fontSize:15,color:f.currency==="NEG"?RED:MUTED,fontWeight:600 }}>Precio a convenir</span>
                </button>
                {f.currency !== "NEG" && (
                  <div style={{ display:"flex",gap:8 }}>
                    <div style={{ position:"relative",flex:1 }}>
                      <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:MUTED }}>$</span>
                      <input className="inp" type="number" placeholder="0" value={f.price} onChange={e=>upd("price",e.target.value)} style={{ paddingLeft:30 }}/>
                    </div>
                    <select className="inp" value={f.currency} onChange={e=>upd("currency",e.target.value)} style={{ width:88 }}>
                      {["CLP","USD","EUR","COP","PEN","MXN"].map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_description")}</p>
                <textarea className="inp" rows={3} placeholder={t("pub_desc_ph")} value={f.description} maxLength={1000} onChange={e=>upd("description",e.target.value)} style={{ resize:"none" }}/>
              </div>

              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_location")}</p>
                <input className="inp" placeholder={t("pub_location_ph")} value={f.location} maxLength={100} onChange={e=>upd("location",e.target.value)}/>
              </div>

              <button className="btn-red" onClick={submit} disabled={loading||!f.title||(!f.price&&f.currency!=="NEG")}
                style={{ marginTop:8,opacity:(!f.title||(!f.price&&f.currency!=="NEG")||loading)?.5:1,padding:"15px",fontSize:16 }}>
                {loading?<Spin/>:t("pub_submit")}
              </button>
            </div>
          )}

          {step===1&&type==="ai"&&(
            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>
              {!aiFile ? (
                <label htmlFor="ai-photo-input" style={{ display:"block",cursor:"pointer" }}>
                  <input id="ai-photo-input" type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                    onChange={e=>{
                      const file = e.target.files[0];
                      if (!file) return;
                      const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];
                      if (!ALLOWED.includes(file.type)) { setAiError(t("ai_only_images")); e.target.value=""; return; }
                      if (file.size > 5 * 1024 * 1024) { setAiError(t("ai_max_size")); e.target.value=""; return; }
                      setAiFile(file);
                      setAiResult(null);
                      setAiError("");
                      if (aiPreview) URL.revokeObjectURL(aiPreview);
                      setAiPreview(URL.createObjectURL(file));
                    }}/>
                  <div style={{ border:`2px dashed rgba(255,106,0,.4)`,borderRadius:16,padding:"48px 24px",textAlign:"center",background:"rgba(255,106,0,.04)",transition:"all .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,106,0,.4)"}>
                    <div style={{ width:72,height:72,background:"rgba(255,106,0,.12)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                      <Ic n="camera" s={32} c={RED}/>
                    </div>
                    <p style={{ fontSize:17,fontWeight:700,color:TEXT,marginBottom:6 }}>{t("ai_take_photo")}</p>
                    <p style={{ fontSize:16,color:MUTED,lineHeight:1.6 }}>{t("ai_desc")}</p>
                    <div style={{ display:"flex",gap:8,justifyContent:"center",marginTop:16,flexWrap:"wrap" }}>
                      {["Rodamientos","Bombas","Motores","Filtros","Válvulas"].map(tag=>(
                        <span key={tag} className="tag t-dim" style={{ fontSize:16 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </label>
              ) : (
                <div>
                  <div style={{ position:"relative",borderRadius:16,overflow:"hidden",marginBottom:16,maxHeight:280,display:"flex",alignItems:"center",justifyContent:"center",background:BG2 }}>
                    <img src={aiPreview} alt="preview" style={{ maxWidth:"100%",maxHeight:280,objectFit:"contain",display:"block" }}/>
                    {!aiLoading&&!aiResult&&(
                      <button onClick={()=>{ setAiFile(null); setAiPreview(null); setAiError(""); }}
                        style={{ position:"absolute",top:10,right:10,background:"rgba(0,0,0,.6)",border:"none",borderRadius:"50%",width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <Ic n="x" s={16} c="#fff"/>
                      </button>
                    )}
                  </div>

                  {aiLoading&&(
                    <div style={{ textAlign:"center",padding:"24px 0" }}>
                      <Spin size={32}/>
                      <p style={{ fontSize:16,color:SUB,marginTop:14,fontWeight:600 }}>{t("ai_analyzing")}</p>
                      <p style={{ fontSize:16,color:MUTED,marginTop:4 }}>Identificando marca, modelo y número de parte</p>
                    </div>
                  )}

                  {aiError&&!aiLoading&&(
                    <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:10,padding:"14px 16px",marginBottom:12 }}>
                      <p style={{ fontSize:16,color:DANGER,fontWeight:600,marginBottom:4 }}>No se pudo identificar el componente</p>
                      <p style={{ fontSize:16,color:MUTED }}>{aiError}</p>
                    </div>
                  )}

                  {aiResult&&!aiLoading&&(
                    <div>
                      <div style={{ background:"rgba(34,197,94,.06)",border:"1px solid rgba(34,197,94,.25)",borderRadius:12,padding:20,marginBottom:16 }}>
                        <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:14 }}>
                          <div style={{ width:40,height:40,background:"rgba(34,197,94,.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>
                            {aiResult.emoji||"📦"}
                          </div>
                          <div>
                            <p style={{ fontSize:16,fontWeight:700,color:TEXT,lineHeight:1.2 }}>{aiResult.title}</p>
                            <p style={{ fontSize:16,color:GREEN,fontWeight:600,marginTop:3 }}>
                              ✓ Identificado · Confianza {aiResult.confidence||"media"}
                            </p>
                          </div>
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                          {[["Marca",aiResult.brand],["Modelo",aiResult.model],["N° Parte",aiResult.part_number],["Condición",aiResult.condition]].map(([k,v])=>v&&(
                            <div key={k} style={{ background:BG2,borderRadius:8,padding:"10px 12px",border:`1px solid ${BORDER}` }}>
                              <p style={{ fontSize:16,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3 }}>{k}</p>
                              <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>{v}</p>
                            </div>
                          ))}
                        </div>
                        {aiResult.description&&(
                          <p style={{ fontSize:16,color:SUB,marginTop:12,lineHeight:1.6 }}>{aiResult.description}</p>
                        )}
                      </div>
                      <button className="btn-red" style={{ width:"100%",padding:"14px",fontSize:16 }}
                        onClick={()=>{
                          upd("title",      aiResult.title||"");
                          upd("brand",      aiResult.brand||"");
                          upd("model",      aiResult.model||"");
                          upd("part_number",aiResult.part_number||"");
                          upd("description",aiResult.description||"");
                          upd("condition",  aiResult.condition||"Nuevo");
                          upd("cat",        aiResult.cat||"serv");
                          upd("emoji",      aiResult.emoji||"📦");
                          setType("producto");
                        }}>
                        Usar estos datos y completar publicación →
                      </button>
                      <button className="btn-ghost" style={{ width:"100%",marginTop:8,justifyContent:"center",fontSize:16 }}
                        onClick={()=>{ setAiFile(null); setAiPreview(null); setAiResult(null); setAiError(""); }}>
                        {t("ai_try_other")}
                      </button>
                    </div>
                  )}

                  {!aiLoading&&!aiResult&&(
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      <button className="btn-red" style={{ width:"100%",padding:"14px",fontSize:16 }}
                        onClick={async()=>{
                          setAiLoading(true); setAiError(""); setAiResult(null);
                          try {
                            const reader = new FileReader();
                            reader.onload = async e => {
                              const dataUrl = e.target.result;
                              const base64 = dataUrl.split(",")[1];
                              const mediaType = aiFile.type || "image/jpeg";
                              const result = await analyzeImage(base64, mediaType);
                              if (!result || !result.title) {
                                setAiError("No se pudo identificar el componente. Intenta con una imagen más clara o con mejor iluminación.");
                              } else {
                                setAiResult(result);
                              }
                              setAiLoading(false);
                            };
                            reader.readAsDataURL(aiFile);
                          } catch {
                            setAiError("Error al procesar la imagen. Intenta de nuevo.");
                            setAiLoading(false);
                          }
                        }}>
                        {t("ai_identify")}
                      </button>
                      <button className="btn-ghost" style={{ justifyContent:"center",fontSize:16 }}
                        onClick={()=>{ setAiFile(null); setAiPreview(null); }}>
                        {t("ai_change")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step===1&&type!=="producto"&&type!=="ai"&&(
            <div style={{ paddingTop:40,textAlign:"center" }}>
              <div style={{ fontSize:64,marginBottom:16 }}>🚧</div>
              <p className="bebas" style={{ fontSize:28,marginBottom:8 }}>Próximamente</p>
              <p style={{ fontSize:16,color:MUTED }}>Esta función estará disponible pronto.</p>
              <button className="btn-red" style={{ marginTop:24 }} onClick={()=>setStep(0)}>Volver</button>
            </div>
          )}
        </div>
      </div>

      {showMatchAlert&&(
        <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }} onClick={()=>setShowMatchAlert(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:BG3,borderRadius:20,padding:36,maxWidth:420,textAlign:"center",border:`1px solid rgba(255,106,0,.3)`,boxShadow:"0 24px 80px rgba(0,0,0,.6)",animation:"slideUp .3s ease" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>🤝</div>
            <p className="bebas" style={{ fontSize:32,color:RED,marginBottom:8 }}>¡{matchCount} MATCH{matchCount>1?"ES":""} ENCONTRADO{matchCount>1?"S":""}!</p>
            <p style={{ fontSize:16,color:TEXT,lineHeight:1.7,marginBottom:20 }}>
              Tu publicación coincide con {matchCount} solicitud{matchCount>1?"es":""} activa{matchCount>1?"s":""}. Ya enviamos un mensaje automático a los interesados.
            </p>
            <button className="btn-red" style={{ width:"100%",padding:"13px" }} onClick={()=>setShowMatchAlert(false)}>Ver mis mensajes →</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CARGA MASIVA — plantilla Excel fija (hoja "Publicaciones")
══════════════════════════════════════════════════════════════ */

/* Carga SheetJS desde CDN solo cuando se necesita (lazy) */
let _xlsxPromise = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (_xlsxPromise) return _xlsxPromise;
  _xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error("No se pudo cargar el lector de Excel"));
    document.head.appendChild(s);
  });
  return _xlsxPromise;
}

/* Normaliza texto: minúsculas, sin acentos ni espacios extra (para mapear categorías/monedas) */
const _norm = (s) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/* Mapa etiqueta-de-categoría (normalizada) → id, derivado de CATS */
const CAT_BY_LABEL = CATS.reduce((m, c) => { if (c.id !== "all") m[_norm(c.label)] = c.id; return m; }, {});
const VALID_CAT_IDS = new Set(CATS.map(c => c.id));

function BulkUploadSheet({ user, profile, onClose, onDone }) {
  const isMobile = useIsMobile();
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [stage,   setStage]   = useState("upload");   // upload | processing | review | saving | done
  const [error,   setError]   = useState("");
  const [rows,    setRows]     = useState([]);          // publicaciones detectadas (editables)
  const [savedCount, setSavedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef();

  const validCats = CATS.map(c => c.id);

  const normalizeRow = (r) => ({
    title:        (r.title || "").toString().slice(0, 120),
    brand:        r.brand || "",
    model:        r.model || "",
    part_number:  r.part_number || "",
    serial_number:r.serial_number || "",
    cat:          validCats.includes(r.cat) ? r.cat : "serv",
    condition:    CONDITIONS.includes(r.condition) ? r.condition : "Usado – Bueno",
    price:        (r.price === null || r.price === undefined || r.price === "") ? "" : String(r.price).replace(/\D/g, ""),
    currency:     CURRENCIES.includes(r.currency) ? r.currency : "CLP",
    stock:        r.stock ? String(r.stock).replace(/\D/g, "") || "1" : "1",
    location:     r.location || profile?.location || "",
    description:  r.description || "",
    emoji:        r.emoji || "📦",
    _include:     true,
  });

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) {
      setError("Formato no soportado. Sube la plantilla en Excel (.xlsx).");
      e.target.value = "";
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("El archivo debe pesar menos de 15 MB.");
      e.target.value = "";
      return;
    }

    setStage("processing");
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets["Publicaciones"] || wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('No se encontró la hoja "Publicaciones". Usa la plantilla oficial.');

      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const headers = (aoa[0] || []).map(h => _norm(h));
      const idxOf = (...names) => { for (const n of names) { const i = headers.indexOf(_norm(n)); if (i >= 0) return i; } return -1; };
      const iTitulo = idxOf("titulo"), iCat = idxOf("categoria"), iMarca = idxOf("marca"),
            iModelo = idxOf("modelo"), iPrecio = idxOf("precio"), iMoneda = idxOf("moneda"),
            iUbic = idxOf("ubicacion"), iDesc = idxOf("descripcion");
      if (iTitulo < 0) throw new Error('La plantilla no tiene la columna "Titulo". Descárgala de nuevo.');

      // Filas de datos: desde la fila 3 (índice 2). Ignora encabezado (0) y ayuda (1).
      // Se incluyen TODAS las filas con Título no vacío (incluidos los ejemplos).
      const parsed = [];
      for (const row of aoa.slice(2)) {
        const cell = i => (i >= 0 ? String(row[i] ?? "").trim() : "");
        const title = cell(iTitulo);
        if (!title) continue;
        const catRaw = _norm(cell(iCat));
        const cat = CAT_BY_LABEL[catRaw] || (VALID_CAT_IDS.has(catRaw) ? catRaw : "serv");
        const priceDigits = cell(iPrecio).replace(/[^\d]/g, "");
        const hasPrice = priceDigits !== "" && Number(priceDigits) > 0;
        const monRaw = cell(iMoneda).toUpperCase().replace(/[^A-Z]/g, "");
        parsed.push({
          title,
          brand:       cell(iMarca),
          model:       cell(iModelo),
          cat,
          price:       hasPrice ? priceDigits : "",             // vacío → saveAll pone price=0 y currency=NEG
          currency:    CURRENCIES.includes(monRaw) ? monRaw : "CLP",
          location:    cell(iUbic),
          description: cell(iDesc),
        });
      }
      if (parsed.length === 0) throw new Error('No se encontraron publicaciones. Llena la columna "Titulo" desde la fila 3.');
      setRows(parsed.slice(0, 200).map(normalizeRow));
      setStage("review");
    } catch (err) {
      setError(err.message || "Error leyendo el archivo.");
      setStage("upload");
    }
    e.target.value = "";
  };

  const updateRow = (idx, key, val) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, [key]: val } : r));
  };
  const toggleRow = (idx) => {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, _include: !r._include } : r));
  };
  const removeRow = (idx) => {
    setRows(rs => rs.filter((_, i) => i !== idx));
  };

  const includedRows = rows.filter(r => r._include && r.title.trim());

  const saveAll = async () => {
    if (includedRows.length === 0) { setError("No hay publicaciones válidas para guardar."); return; }
    setStage("saving");
    setError("");
    let ok = 0;
    try {
      const payload = includedRows.map(r => ({
        user_id: user.id,
        title: r.title,
        brand: r.brand || null,
        model: r.model || null,
        part_number: r.part_number || null,
        serial_number: r.serial_number || null,
        cat: r.cat,
        condition: r.condition,
        operation: "Venta",
        price: r.price ? Number(r.price) : 0,
        currency: r.price ? r.currency : "NEG",
        stock: Number(r.stock) || 1,
        location: r.location || null,
        phone: profile?.phone || null,
        biz: profile?.biz || null,
        description: r.description || null,
        emoji: r.emoji || "📦",
        verified: false,
      }));
      // Inserta en lotes de 20
      const CHUNK = 20;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const slice = payload.slice(i, i + CHUNK);
        const { data, error: insErr } = await sb.from("listings").insert(slice).select();
        if (insErr) throw new Error(insErr.message);
        ok += (data?.length || slice.length);
      }
      setSavedCount(ok);
      setStage("done");
    } catch (err) {
      setError("Error al guardar: " + (err.message || "intenta de nuevo."));
      setStage("review");
    }
  };

  const TH = { fontSize:13, color:MUTED, fontWeight:700, textTransform:"uppercase", letterSpacing:.5, marginBottom:4 };

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"94dvh",overflow:"hidden",display:"flex",flexDirection:"column",...sheetStyle }} onClick={e=>e.stopPropagation()}>
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",cursor:"grab",touchAction:"none" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${BORDER}` }}>
          <div>
            <h2 style={{ fontSize:20,fontWeight:700,color:TEXT }}>Carga masiva</h2>
            <p style={{ fontSize:14,color:MUTED }}>Sube la plantilla Excel llena con tus publicaciones</p>
          </div>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>

        <div style={{ overflowY:"auto",flex:1,padding:"20px" }}>
          {error && (
            <div style={{ background:"rgba(220,38,38,.08)",border:`1px solid rgba(220,38,38,.25)`,borderRadius:10,padding:"12px 14px",marginBottom:16,color:DANGER,fontSize:15 }}>
              {error}
            </div>
          )}

          {/* ── UPLOAD ── */}
          {stage === "upload" && (
            <div>
              {/* Nota destacada */}
              <div style={{ background:"rgba(255,106,0,.08)",border:`1px solid rgba(255,106,0,.3)`,borderRadius:10,padding:"12px 14px",marginBottom:16,fontSize:14,color:TEXT,lineHeight:1.5 }}>
                Sube la plantilla Excel llena. Las fotos se agregan después editando cada publicación.
              </div>

              {/* Paso 1: descargar plantilla */}
              <a href="/plantilla_carga_masiva.xlsx" download
                style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,textDecoration:"none",background:BG2,border:`1.5px solid ${BORDER2}`,borderRadius:12,padding:"14px 16px",marginBottom:14,cursor:"pointer" }}>
                <Ic n="box" s={18} c={RED}/>
                <span style={{ fontSize:15,fontWeight:700,color:TEXT }}>Descargar plantilla</span>
                <span style={{ fontSize:13,color:MUTED }}>.xlsx</span>
              </a>

              {/* Paso 2: subir plantilla llena */}
              <div
                onClick={()=>fileRef.current?.click()}
                style={{ border:`2px dashed ${BORDER2}`,borderRadius:14,padding:"36px 20px",textAlign:"center",cursor:"pointer",background:BG2,transition:"all .15s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER2}>
                <div style={{ fontSize:44,marginBottom:12 }}>📄</div>
                <p style={{ fontSize:17,fontWeight:700,color:TEXT,marginBottom:6 }}>Subir plantilla llena</p>
                <p style={{ fontSize:14,color:MUTED }}>Excel (.xlsx) · máx 15 MB</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={handleFile}/>

              <div style={{ marginTop:24,background:BG2,borderRadius:12,padding:"16px 18px",border:`1px solid ${BORDER}` }}>
                <p style={{ fontSize:15,fontWeight:700,color:TEXT,marginBottom:10 }}>💡 Cómo funciona</p>
                {[
                  "Descarga la plantilla y llénala (hoja \"Publicaciones\").",
                  "Columnas: Título, Categoría, Marca, Modelo, Precio, Moneda, Ubicación, Descripción.",
                  "Borra las filas de ejemplo si no las quieres publicar.",
                  "Sube la plantilla, revisa y edita, y publica todo de una vez.",
                ].map((tx,i)=>(
                  <div key={i} style={{ display:"flex",gap:10,marginBottom:8,alignItems:"flex-start" }}>
                    <span style={{ color:RED,fontWeight:700,fontSize:15 }}>{i+1}.</span>
                    <span style={{ fontSize:15,color:SUB,lineHeight:1.5 }}>{tx}</span>
                  </div>
                ))}
                <p style={{ fontSize:13,color:MUTED,marginTop:10,lineHeight:1.5 }}>
                  Sin precio → se publica como "A convenir". La categoría se reconoce por su nombre (ej: Minería, Forestal, Construcción…).
                </p>
              </div>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {stage === "processing" && (
            <div style={{ padding:"60px 20px",textAlign:"center" }}>
              <Spin/>
              <p style={{ fontSize:17,fontWeight:700,color:TEXT,marginTop:20,marginBottom:6 }}>Leyendo la plantilla…</p>
              <p style={{ fontSize:14,color:MUTED }}>{fileName}</p>
            </div>
          )}

          {/* ── REVIEW ── */}
          {stage === "review" && (
            <div>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>
                  {includedRows.length} de {rows.length} publicaciones
                </p>
                <button onClick={()=>{ setStage("upload"); setRows([]); }}
                  style={{ background:"none",border:`1px solid ${BORDER2}`,borderRadius:7,padding:"6px 12px",color:SUB,fontSize:14,cursor:"pointer",fontWeight:600 }}>
                  Cambiar archivo
                </button>
              </div>

              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                {rows.map((r, idx) => (
                  <div key={idx} style={{ background:BG2,borderRadius:12,padding:"14px",border:`1px solid ${r._include?BORDER:"transparent"}`,opacity:r._include?1:.5,transition:"all .15s" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
                      <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
                        <input type="checkbox" checked={r._include} onChange={()=>toggleRow(idx)} style={{ width:18,height:18,accentColor:RED,cursor:"pointer" }}/>
                        <span style={{ fontSize:14,color:MUTED,fontWeight:600 }}>#{idx+1}</span>
                      </label>
                      <button onClick={()=>removeRow(idx)} style={{ background:"none",border:"none",cursor:"pointer",color:DANGER,fontSize:13,fontWeight:600 }}>Quitar</button>
                    </div>

                    <div style={{ marginBottom:10 }}>
                      <p style={TH}>Título</p>
                      <input className="inp" value={r.title} onChange={e=>updateRow(idx,"title",e.target.value)} placeholder="Título del producto"/>
                    </div>

                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                      <div>
                        <p style={TH}>Marca</p>
                        <input className="inp" value={r.brand} onChange={e=>updateRow(idx,"brand",e.target.value)} placeholder="—"/>
                      </div>
                      <div>
                        <p style={TH}>Modelo</p>
                        <input className="inp" value={r.model} onChange={e=>updateRow(idx,"model",e.target.value)} placeholder="—"/>
                      </div>
                    </div>

                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10 }}>
                      <div>
                        <p style={TH}>Categoría</p>
                        <select className="inp" value={r.cat} onChange={e=>updateRow(idx,"cat",e.target.value)}>
                          {CATS.filter(c=>c.id!=="all").map(c=>(
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p style={TH}>Condición</p>
                        <select className="inp" value={r.condition} onChange={e=>updateRow(idx,"condition",e.target.value)}>
                          {CONDITIONS.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={{ display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"2fr 1fr 1fr",gap:8,marginBottom:10 }}>
                      <div style={{ gridColumn:isMobile?"1 / -1":"auto" }}>
                        <p style={TH}>Precio</p>
                        <input className="inp" inputMode="numeric" value={r.price} onChange={e=>updateRow(idx,"price",e.target.value.replace(/\D/g,""))} placeholder="A convenir"/>
                      </div>
                      <div>
                        <p style={TH}>Moneda</p>
                        <select className="inp" value={r.currency} onChange={e=>updateRow(idx,"currency",e.target.value)}>
                          {CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <p style={TH}>Stock</p>
                        <input className="inp" inputMode="numeric" value={r.stock} onChange={e=>updateRow(idx,"stock",e.target.value.replace(/\D/g,"")||"1")}/>
                      </div>
                    </div>

                    <div>
                      <p style={TH}>Ubicación</p>
                      <input className="inp" value={r.location} onChange={e=>updateRow(idx,"location",e.target.value)} placeholder="Ciudad"/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SAVING ── */}
          {stage === "saving" && (
            <div style={{ padding:"60px 20px",textAlign:"center" }}>
              <Spin/>
              <p style={{ fontSize:17,fontWeight:700,color:TEXT,marginTop:20 }}>Publicando {includedRows.length} productos…</p>
            </div>
          )}

          {/* ── DONE ── */}
          {stage === "done" && (
            <div style={{ padding:"50px 20px",textAlign:"center" }}>
              <div style={{ fontSize:56,marginBottom:16 }}>✅</div>
              <p style={{ fontSize:20,fontWeight:700,color:TEXT,marginBottom:8 }}>¡{savedCount} publicaciones creadas!</p>
              <p style={{ fontSize:15,color:SUB,marginBottom:24 }}>Ya están visibles en PortalMaquinas.</p>
              <button onClick={()=>{ onDone?.(); onClose(); }} className="btn-red" style={{ padding:"14px 28px" }}>
                Listo
              </button>
            </div>
          )}
        </div>

        {/* Footer action */}
        {stage === "review" && (
          <div style={{ padding:"14px 20px",borderTop:`1px solid ${BORDER}`,background:BG3 }}>
            <button onClick={saveAll} disabled={includedRows.length===0} className="btn-red"
              style={{ width:"100%",padding:"15px",opacity:includedRows.length===0?.5:1 }}>
              Publicar {includedRows.length} {includedRows.length===1?"producto":"productos"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MESSAGES PAGE
══════════════════════════════════════════════════════════════ */
function MessagesPage({ user, initListing, onClear }) {
  const isMobile = useIsMobile();
  const [contacts, setContacts] = useState([]);
  const [active,   setActive]   = useState(null);
  const [filter,   setFilter]   = useState("Todas");
  const [convSearch, setConvSearch] = useState("");
  const [viewListing, setViewListing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const FILTERS = ["Todas","Interesado","Negociación","Vendido"];

  const deleteConversation = async (contactId, e) => {
    e?.stopPropagation();
    setDeleting(true);
    // Delete all messages in both directions with this contact
    const { error } = await sb.from("messages").delete()
      .or(`and(from_id.eq.${user.id},to_id.eq.${contactId}),and(from_id.eq.${contactId},to_id.eq.${user.id})`);
    if (error) {
      console.error("Error al borrar conversación:", error);
      alert("No se pudo borrar la conversación: " + error.message);
      setDeleting(false);
      setConfirmDel(null);
      return;
    }
    setContacts(prev => prev.filter(c => c.id !== contactId));
    setConfirmDel(null);
    setDeleting(false);
  };

  const openListing = async (listingId) => {
    if (!listingId) return;
    const { data } = await sb.from("listings").select("*").eq("id", listingId).single();
    if (data) setViewListing(data);
  };

  useEffect(()=>{
    if (initListing) {
      sb.from("profiles").select("*").eq("id",initListing.user_id).single().then(({ data })=>{
        if (data) setActive({ profile:data,listing:initListing });
        onClear();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[initListing?.id]);

  const [contactMeta, setContactMeta] = useState({}); // { [contactId]: { lastMsg, listing, unread } }

  useEffect(()=>{
    const load = async () => {
      const [{ data:s },{ data:r }] = await Promise.all([
        sb.from("messages").select("to_id").eq("from_id",user.id),
        sb.from("messages").select("from_id").eq("to_id",user.id),
      ]);
      const ids = new Set([...(s||[]).map(m=>m.to_id),...(r||[]).map(m=>m.from_id)]);
      if (!ids.size) return;
      const { data: profiles } = await sb.from("profiles").select("*").in("id",[...ids]);
      setContacts(profiles||[]);

      // For each contact, fetch last message + listing info + unread count
      const meta = {};
      await Promise.all([...ids].map(async cid => {
        const { data: msgs } = await sb.from("messages").select("*")
          .or(`and(from_id.eq.${user.id},to_id.eq.${cid}),and(from_id.eq.${cid},to_id.eq.${user.id})`)
          .order("created_at",{ascending:false}).limit(1);
        const lastMsg = msgs?.[0];
        const unread = (await sb.from("messages").select("*",{count:"exact",head:true})
          .eq("from_id",cid).eq("to_id",user.id).eq("read",false)).count || 0;
        let listing = null;
        if (lastMsg?.listing_id) {
          const { data: l } = await sb.from("listings").select("id,title,photos").eq("id",lastMsg.listing_id).single();
          listing = l;
        }
        meta[cid] = { lastMsg, listing, unread };
      }));
      setContactMeta(meta);
    };
    load();
  },[user.id]);

  if (active) {
    const chat = (
      <>
        <ChatView user={user} other={active.profile} listing={active.listing} onBack={()=>setActive(null)} onViewListing={openListing}/>
        {viewListing && <ListingDetail l={viewListing} onClose={()=>setViewListing(null)} user={user}/>}
      </>
    );
    // En móvil el chat va full-screen (por encima del header y la tab bar fijos).
    return isMobile
      ? <div style={{ position:"fixed", inset:0, zIndex:100, background:BG }}>{chat}</div>
      : chat;
  }

  const cq = convSearch.trim().toLowerCase();
  const visibleContacts = cq
    ? contacts.filter(c =>
        (c.name||"").toLowerCase().includes(cq) ||
        (c.biz||"").toLowerCase().includes(cq) ||
        (contactMeta[c.id]?.listing?.title||"").toLowerCase().includes(cq))
    : contacts;

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding: isMobile ? "8px 20px 16px" : "0 20px 16px" }}>
        <h1 className="bebas" style={{ fontSize:34,color:TEXT,marginBottom:16 }}>Chat</h1>
        <div className="search-bar">
          <Ic n="search" s={16} c={MUTED}/>
          <input placeholder="Buscar conversaciones…" value={convSearch} onChange={e=>setConvSearch(e.target.value)}/>
          {convSearch && <button className="btn-ghost" style={{ padding:"2px 4px" }} onClick={()=>setConvSearch("")}><Ic n="x" s={16} c={MUTED}/></button>}
        </div>
      </div>
      <div style={{ padding:"0 20px 16px",display:"flex",gap:8,overflowX:"auto" }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ flexShrink:0,minHeight:40,padding:"8px 16px",borderRadius:20,fontSize:16,fontWeight:700,border:`1px solid ${filter===f?RED:BORDER}`,cursor:"pointer",background:filter===f?RED:CARD,color:filter===f?"#fff":SUB,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ padding:"0" }}>
        {visibleContacts.length===0 ? (
          <div style={{ paddingTop:60,textAlign:"center" }}>
            <div style={{ fontSize:56,marginBottom:16 }}>💬</div>
            <p className="bebas" style={{ fontSize:28,marginBottom:8 }}>{cq ? "Sin resultados" : "Sin conversaciones"}</p>
            <p style={{ fontSize:16,color:MUTED }}>{cq ? "Prueba con otro nombre o empresa" : "Contacta a un vendedor desde cualquier publicación"}</p>
          </div>
        ) : visibleContacts.map(c=>{
          const meta = contactMeta[c.id] || {};
          const { lastMsg, listing, unread } = meta;
          return (
          <div key={c.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:`0.5px solid ${BORDER}`,cursor:"pointer",transition:"background .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background=BG2}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            onClick={()=>setActive({ profile:c, listing:listing||null })}>
            <div style={{ position:"relative", flexShrink:0 }}>
              <Avatar name={c.biz||c.name||"U"} size={48}/>
              {unread>0 && <div style={{ position:"absolute",top:-2,right:-2,width:18,height:18,borderRadius:"50%",background:RED,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:700,color:"#fff",border:`2px solid ${BG}` }}>{unread}</div>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>{c.biz||c.name||c.id?.slice(0,8)}</p>
                {lastMsg && <p style={{ fontSize:16,color:MUTED,flexShrink:0 }}>{fmtTs(lastMsg.created_at)}</p>}
              </div>
              {listing && (
                <p style={{ fontSize:16,fontWeight:700,color:RED,marginBottom:2,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                  📦 {listing.title}
                </p>
              )}
              {lastMsg && (
                <p style={{ fontSize:16,color:unread>0?SUB:MUTED,fontWeight:unread>0?600:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                  {lastMsg.from_id===user.id?"Tú: ":""}{lastMsg.body}
                </p>
              )}
              {!lastMsg && <p style={{ fontSize:16,color:MUTED }}>{c.location||"—"}</p>}
            </div>
            {confirmDel===c.id ? (
              <div style={{ display:"flex",gap:6,flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                <button onClick={()=>setConfirmDel(null)}
                  style={{ padding:"7px 11px",borderRadius:7,border:`1px solid ${BORDER}`,background:"transparent",color:MUTED,fontSize:14,cursor:"pointer",fontWeight:600 }}>
                  Cancelar
                </button>
                <button onClick={(e)=>deleteConversation(c.id,e)} disabled={deleting}
                  style={{ padding:"7px 11px",borderRadius:7,border:"none",background:DANGER,color:"#fff",fontSize:14,cursor:"pointer",fontWeight:700 }}>
                  {deleting?"…":"Eliminar"}
                </button>
              </div>
            ) : (
              <button onClick={(e)=>{ e.stopPropagation(); setConfirmDel(c.id); }} title="Eliminar conversación"
                style={{ flexShrink:0,padding:"7px",borderRadius:7,border:"none",background:"transparent",color:MUTED,cursor:"pointer",display:"flex",alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.color=DANGER}
                onMouseLeave={e=>e.currentTarget.style.color=MUTED}>
                <Ic n="trash" s={16} c="currentColor"/>
              </button>
            )}
          </div>
        )})}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SISTEMA DE VALORACIONES
══════════════════════════════════════════════════════════════ */

// Estrellas — interactivas (onRate) o solo lectura
function StarRating({ value=0, onRate, size=22, readOnly=false }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display:"inline-flex", gap:2 }}>
      {[1,2,3,4,5].map(n=>{
        const filled = (hover || value) >= n;
        return (
          <span key={n}
            onClick={readOnly ? undefined : ()=>onRate?.(n)}
            onMouseEnter={readOnly ? undefined : ()=>setHover(n)}
            onMouseLeave={readOnly ? undefined : ()=>setHover(0)}
            style={{ cursor:readOnly?"default":"pointer", fontSize:size, lineHeight:1, color:filled?GOLD:MUTED, transition:"color .1s", userSelect:"none" }}>
            ★
          </span>
        );
      })}
    </div>
  );
}

// Resumen de rating de un usuario (promedio + cantidad)
function UserRatingSummary({ userId, size=16, showCount=true }) {
  const [stats, setStats] = useState(null);
  useEffect(()=>{
    if (!userId) return;
    sb.from("ratings").select("stars").eq("rated_id", userId).then(({ data })=>{
      if (!data || data.length===0) { setStats({ avg:0, count:0 }); return; }
      const avg = data.reduce((s,r)=>s+r.stars,0) / data.length;
      setStats({ avg, count:data.length });
    }, ()=>setStats({ avg:0, count:0 }));
  }, [userId]);

  if (!stats) return null;
  if (stats.count === 0) return <span style={{ fontSize:size, color:MUTED }}>Sin valoraciones</span>;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
      <span style={{ color:GOLD, fontSize:size }}>★</span>
      <span style={{ fontSize:size, fontWeight:700, color:TEXT }}>{stats.avg.toFixed(1)}</span>
      {showCount && <span style={{ fontSize:size, color:MUTED }}>({stats.count})</span>}
    </span>
  );
}

// Modal para valorar a un usuario
function RatingModal({ user, ratedUser, onClose, onSaved }) {
  const [stars, setStars]     = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState("");
  const [existing, setExisting] = useState(undefined); // undefined=loading, null=none, obj=existing

  useEffect(()=>{
    // Check if a rating already exists from this user toward ratedUser
    sb.from("ratings").select("*").eq("rater_id", user.id).eq("rated_id", ratedUser.id).maybeSingle()
      .then(({ data })=>{
        setExisting(data || null);
        if (data) { setStars(data.stars); setComment(data.comment || ""); }
      }, ()=>setExisting(null));
  }, [user.id, ratedUser.id]);

  const submit = async ()=>{
    if (stars < 1) { setErr("Selecciona al menos una estrella."); return; }
    setLoading(true); setErr("");
    const payload = {
      rater_id: user.id,
      rated_id: ratedUser.id,
      stars,
      comment: comment.trim() || null,
    };
    let error;
    if (existing) {
      ({ error } = await sb.from("ratings").update({ stars, comment: comment.trim()||null }).eq("id", existing.id));
    } else {
      ({ error } = await sb.from("ratings").insert(payload));
    }
    setLoading(false);
    if (error) { setErr("No se pudo guardar: " + error.message); return; }
    onSaved?.();
    onClose();
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:BG, borderRadius:16, maxWidth:440, width:"100%", border:`1px solid ${BORDER2}`, overflow:"hidden" }}>
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h3 className="bebas" style={{ fontSize:22, color:TEXT }}>Valorar a {ratedUser.name||ratedUser.biz||"usuario"}</h3>
          <button className="btn-ghost" onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>
        <div style={{ padding:"24px 20px", display:"flex", flexDirection:"column", gap:16 }}>
          {err && <div style={{ background:"rgba(220,38,38,.08)", border:"1px solid rgba(220,38,38,.25)", borderRadius:8, padding:"10px 14px", fontSize:15, color:DANGER }}>{err}</div>}
          {existing && <p style={{ fontSize:14, color:GOLD }}>Ya valoraste a este usuario. Puedes actualizar tu valoración.</p>}
          <div style={{ textAlign:"center" }}>
            <p style={{ fontSize:15, color:MUTED, marginBottom:10 }}>¿Cómo fue tu experiencia?</p>
            <StarRating value={stars} onRate={setStars} size={40}/>
          </div>
          <div>
            <p style={{ fontSize:15, fontWeight:700, color:MUTED, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>Comentario (opcional)</p>
            <textarea value={comment} maxLength={500} onChange={e=>setComment(e.target.value)} rows={3}
              placeholder="Cuéntale a otros cómo fue la transacción…"
              className="inp" style={{ resize:"none" }}/>
          </div>
          <button className="btn-red" onClick={submit} disabled={loading||stars<1}
            style={{ padding:"14px", fontSize:16, opacity:(loading||stars<1)?.5:1 }}>
            {loading ? "Guardando…" : existing ? "Actualizar valoración" : "Enviar valoración"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Lista de reviews recibidas por un usuario
function UserReviews({ userId }) {
  const [reviews, setReviews] = useState(null);
  useEffect(()=>{
    if (!userId) return;
    sb.from("ratings").select("*").eq("rated_id", userId).order("created_at",{ascending:false}).limit(50)
      .then(async ({ data })=>{
        if (!data || data.length===0) { setReviews([]); return; }
        // Hydrate rater names
        const raterIds = [...new Set(data.map(r=>r.rater_id))];
        const { data: profiles } = await sb.from("profiles").select("id,name,biz").in("id", raterIds);
        const pmap = {}; (profiles||[]).forEach(p=>pmap[p.id]=p);
        setReviews(data.map(r=>({ ...r, rater:pmap[r.rater_id] })));
      }, ()=>setReviews([]));
  }, [userId]);

  if (reviews === null) return <div style={{ display:"flex",justifyContent:"center",padding:20 }}><Spin size={20}/></div>;
  if (reviews.length === 0) return <p style={{ fontSize:15, color:MUTED, padding:"12px 0" }}>Este usuario todavía no tiene valoraciones.</p>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {reviews.map(r=>(
        <div key={r.id} style={{ background:CARD, borderRadius:10, padding:"12px 14px", border:`1px solid ${BORDER}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <span style={{ fontSize:15, fontWeight:700, color:TEXT }}>{r.rater?.name || r.rater?.biz || "Usuario"}</span>
            <span style={{ fontSize:14, color:MUTED }}>{fmtTs(r.created_at)}</span>
          </div>
          <StarRating value={r.stars} readOnly size={16}/>
          {r.comment && <p style={{ fontSize:15, color:SUB, marginTop:6, lineHeight:1.5 }}>{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}

function ChatView({ user, other, listing, onBack, onViewListing }) {
  const { t } = useLang();
  const [msgs,    setMsgs]    = useState([]);
  const [inp,     setInp]     = useState("");
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const endRef = useRef();

  const load = useCallback(async ()=>{
    const { data } = await sb.from("messages").select("*")
      .or(`and(from_id.eq.${user.id},to_id.eq.${other.id}),and(from_id.eq.${other.id},to_id.eq.${user.id})`)
      .order("created_at",{ascending:true});
    // Hide auto-generated match notification messages from the chat thread
    const visible = (data||[]).filter(m => !(m.body||"").startsWith("🤝 ¡Match automático!"));
    setMsgs(visible); setLoading(false);
  },[user.id,other.id]);

  useEffect(()=>{
    // Mark messages from other user as read when chat opens
    sb.from("messages").update({ read:true })
      .eq("from_id", other.id).eq("to_id", user.id).eq("read", false)
      .then(()=>{}, ()=>{});
  }, [other.id, user.id]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  useEffect(()=>{
    const ch = sb.channel(`chat-${[user.id,other.id].sort().join("-")}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},load).subscribe();
    return ()=>sb.removeChannel(ch);
  },[user.id,other.id,load]);

  const send = async ()=>{
    const body = inp.trim(); if(!body || body.length > 2000) return;
    setInp("");
    await sb.from("messages").insert({ from_id:user.id,to_id:other.id,body,listing_id:listing?.id||null });
    load();
  };

  const waLink = other.phone ? `https://wa.me/${other.phone.replace(/[^0-9]/g,"")}` : null;

  return (
    <div style={{ height:"100dvh",display:"flex",flexDirection:"column",background:BG }}>
      {/* Header — full contact info */}
      <div style={{ padding:"calc(20px + env(safe-area-inset-top)) 16px 14px",borderBottom:`0.5px solid ${BORDER}`,display:"flex",gap:12,alignItems:"flex-start",flexShrink:0,background:BG3 }}>
        <button className="btn-ghost" style={{ padding:"6px 8px",marginTop:2 }} onClick={onBack}><Ic n="chevL" s={22} c={TEXT}/></button>
        <Avatar name={other.biz||other.name||"U"} size={44}/>
        <div style={{ flex:1,minWidth:0 }}>
          <p style={{ fontSize:17,fontWeight:700,color:TEXT,lineHeight:1.2 }}>{other.name||other.biz||"Usuario"}</p>
          {other.biz && other.name && (
            <p style={{ fontSize:15,color:SUB,fontWeight:600 }}>{other.biz}</p>
          )}
          {other.location && (
            <p style={{ fontSize:14,color:MUTED,marginTop:2 }}>📍 {other.location}</p>
          )}
          {/* Contact buttons */}
          <div style={{ display:"flex",gap:8,marginTop:10,flexWrap:"wrap" }}>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display:"flex",alignItems:"center",gap:6,background:"#25D366",color:"#fff",borderRadius:8,padding:"7px 14px",fontSize:14,fontWeight:700,textDecoration:"none",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.3 }}>
                <Ic n="wa" s={15} c="#fff"/> WhatsApp
              </a>
            ) : (
              <span style={{ display:"flex",alignItems:"center",gap:6,background:BG2,color:MUTED,borderRadius:8,padding:"7px 14px",fontSize:14,fontWeight:600,border:`1px solid ${BORDER}` }}>
                <Ic n="wa" s={15} c={MUTED}/> Sin WhatsApp
              </span>
            )}
            {other.phone && (
              <a href={`tel:${other.phone}`}
                style={{ display:"flex",alignItems:"center",gap:6,background:BG2,color:TEXT,borderRadius:8,padding:"7px 14px",fontSize:14,fontWeight:600,textDecoration:"none",border:`1px solid ${BORDER}`,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.3 }}>
                <Ic n="phone" s={14} c={TEXT}/> {other.phone}
              </a>
            )}
            <button onClick={()=>setShowRating(true)}
              style={{ display:"flex",alignItems:"center",gap:6,background:"transparent",color:GOLD,borderRadius:8,padding:"7px 14px",fontSize:14,fontWeight:700,border:`1px solid ${GOLD}`,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.3 }}>
              <span style={{ fontSize:15 }}>★</span> Valorar
            </button>
          </div>
          <div style={{ marginTop:8 }}><UserRatingSummary userId={other.id} size={14}/></div>
        </div>
      </div>

      {/* Listing card — the publication that matched */}
      {listing&&(
        <button onClick={()=>onViewListing?.(listing.id)}
          style={{ padding:"12px 16px",background:BG2,borderBottom:`0.5px solid ${BORDER}`,display:"flex",gap:12,alignItems:"center",width:"100%",border:"none",cursor:"pointer",textAlign:"left" }}>
          {listing.photos?.[0] ? (
            <img src={listing.photos[0]} alt="" style={{ width:48,height:48,borderRadius:8,objectFit:"cover",flexShrink:0 }}/>
          ) : (
            <div style={{ width:48,height:48,borderRadius:8,background:BG3,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:22 }}>{listing.emoji||"📦"}</div>
          )}
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:13,color:MUTED,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Barlow Condensed,sans-serif" }}>Publicación</p>
            <p style={{ fontSize:16,fontWeight:700,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{listing.title}</p>
            <p className="bebas" style={{ fontSize:16,color:RED }}>{fmtPrice(listing.price,listing.currency)}</p>
          </div>
          <Ic n="chevR" s={18} c={MUTED}/>
        </button>
      )}
      <div style={{ flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8 }}>
        {loading ? <div style={{ display:"flex",justifyContent:"center",paddingTop:40 }}><Spin/></div>
          : msgs.length===0 ? (
            <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12 }}>
              <div style={{ fontSize:48 }}>👋</div>
              <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>Inicia la conversación</p>
              <p style={{ fontSize:16,color:MUTED }}>Los mensajes son directos y privados</p>
            </div>
          ) : msgs.map((m,i)=>{
            const mine = m.from_id===user.id;
            return (
              <div key={m.id||i} style={{ display:"flex",justifyContent:mine?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"76%",background:mine?RED:CARD,color:"#fff",borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"11px 15px",fontSize:16,lineHeight:1.5,border:mine?"none":`1px solid ${BORDER}` }}>
                  <p style={{ color:mine?"#fff":TEXT }}>{m.body}</p>
                  {m.listing_id && (
                    <button onClick={()=>onViewListing?.(m.listing_id)}
                      style={{ marginTop:8,background:mine?"rgba(255,255,255,.18)":"rgba(255,106,0,.12)",border:`1px solid ${mine?"rgba(255,255,255,.3)":"rgba(255,106,0,.3)"}`,borderRadius:8,padding:"6px 12px",fontSize:16,fontWeight:700,color:mine?"#fff":RED,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif" }}>
                      <Ic n="chevR" s={12} c={mine?"#fff":RED}/> Ver publicación
                    </button>
                  )}
                  <p style={{ fontSize:16,opacity:.6,marginTop:4,textAlign:mine?"right":"left",color:mine?"rgba(255,255,255,.7)":MUTED }}>{fmtTs(m.created_at)}</p>
                </div>
              </div>
            );
          })
        }
        <div ref={endRef}/>
      </div>
      <div style={{ padding:"12px 16px calc(16px + env(safe-area-inset-bottom))",borderTop:`0.5px solid ${BORDER}`,display:"flex",gap:10,flexShrink:0,background:BG3 }}>
        <input className="inp" value={inp} maxLength={2000} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()} placeholder={t("chat_write")} style={{ flex:1,borderRadius:24,padding:"12px 18px" }}/>
        <button onClick={send} disabled={!inp.trim()} style={{ width:44,height:44,background:inp.trim()?RED:`${RED}66`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:inp.trim()?"pointer":"default",flexShrink:0,transition:"background .15s" }}>
          <Ic n="send" s={18} c="#fff"/>
        </button>
      </div>
      {showRating && <RatingModal user={user} ratedUser={other} onClose={()=>setShowRating(false)} onSaved={()=>{}}/>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MATCHES PAGE — Dashboard de coincidencias del MatchEngine
══════════════════════════════════════════════════════════════ */
function MatchesPage({ user, onSelect, onChat }) {
  const [matches,  setMatches]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all"); // all | selling | buying
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  const deleteMatch = async (id) => {
    setDeleting(true);
    const { error } = await sb.from("matches").delete().eq("id", id);
    if (error) {
      console.error("Error al borrar match:", error);
      alert("No se pudo borrar el match: " + error.message);
      setDeleting(false);
      setConfirmDel(null);
      return;
    }
    setMatches(prev => prev.filter(m => m.id !== id));
    setConfirmDel(null);
    setDeleting(false);
  };

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      // Matches where the user is on either side
      const { data, error } = await sb.from("matches")
        .select("*")
        .or(`listing_user_id.eq.${user.id},request_user_id.eq.${user.id}`)
        .order("notified_at", { ascending:false })
        .limit(100);
      if (error) { setMatches([]); setLoading(false); return; }

      // Hydrate each match with its listing + request + the other user's profile
      const enriched = await Promise.all((data||[]).map(async m => {
        const iAmSeller = m.listing_user_id === user.id;
        const otherUserId = iAmSeller ? m.request_user_id : m.listing_user_id;
        const [lRes, rRes, pRes] = await Promise.all([
          m.listing_id ? sb.from("listings").select("*").eq("id", m.listing_id).maybeSingle() : Promise.resolve({ data:null }),
          m.request_id ? sb.from("requests").select("*").eq("id", m.request_id).maybeSingle() : Promise.resolve({ data:null }),
          otherUserId ? sb.from("profiles").select("*").eq("id", otherUserId).maybeSingle() : Promise.resolve({ data:null }),
        ]);
        return { ...m, iAmSeller, otherUserId, listing:lRes.data, request:rRes.data, otherProfile:pRes.data };
      }));
      setMatches(enriched);
    } catch(_) { setMatches([]); }
    setLoading(false);
  }, [user.id]);

  useEffect(()=>{
    loadMatches();
    // Realtime: refresh when a new match involving this user is inserted
    const ch = sb.channel("matches-"+user.id)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"matches" }, payload => {
        const m = payload.new;
        if (m.listing_user_id === user.id || m.request_user_id === user.id) loadMatches();
      })
      .subscribe();
    return ()=>sb.removeChannel(ch);
  }, [loadMatches, user.id]);

  const filtered = matches.filter(m => {
    if (filter === "selling") return m.iAmSeller;
    if (filter === "buying")  return !m.iAmSeller;
    return true;
  });

  return (
    <div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:10 }}>
        <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mis Matches</h2>
        <button onClick={loadMatches} style={{ background:"none",border:`1px solid ${BORDER}`,borderRadius:7,minHeight:40,padding:"8px 14px",color:SUB,fontSize:15,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:6 }}>
          <Ic n="search" s={14} c={SUB}/> Actualizar
        </button>
      </div>
      <p style={{ color:MUTED,fontSize:16,marginBottom:20 }}>Coincidencias que la IA encontró entre publicaciones y solicitudes.</p>

      {/* Filters */}
      <div style={{ display:"flex",gap:8,marginBottom:20,flexWrap:"wrap" }}>
        {[["all","Todos"],["selling","Vendo (mis publicaciones)"],["buying","Busco (mis solicitudes)"]].map(([val,lbl])=>(
          <button key={val} onClick={()=>setFilter(val)}
            style={{ minHeight:40,padding:"8px 16px",borderRadius:20,border:`1.5px solid ${filter===val?RED:BORDER}`,background:filter===val?"rgba(255,106,0,.1)":CARD,color:filter===val?RED:SUB,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.3 }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex",justifyContent:"center",paddingTop:40 }}><Spin size={26}/></div>
      ) : filtered.length === 0 ? (
        <div style={{ background:CARD,borderRadius:12,padding:60,textAlign:"center",border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:56,marginBottom:16 }}>🤝</div>
          <p className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Aún no hay matches</p>
          <p style={{ color:MUTED,fontSize:16 }}>Cuando publiques o solicites algo, la IA buscará coincidencias automáticamente y aparecerán aquí.</p>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {filtered.map(m => {
            const item = m.iAmSeller ? m.request : m.listing;   // what the other side has/wants
            const mine = m.iAmSeller ? m.listing : m.request;   // my side
            const itemTitle = item?.title || mine?.title || "Publicación";
            return (
              <div key={m.id} className="card" style={{ padding:"16px 18px",borderLeft:`3px solid ${m.iAmSeller?BLUE:GOLD}` }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap" }}>
                      <span className="tag" style={{ fontSize:13,color:m.iAmSeller?BLUE:GOLD,border:`1px solid ${m.iAmSeller?BLUE:GOLD}`,background:"transparent" }}>
                        {m.iAmSeller ? "Alguien busca lo que vendes" : "Encontramos lo que buscas"}
                      </span>
                      <span style={{ fontSize:14,color:MUTED }}>{fmtTs(m.notified_at)}</span>
                    </div>
                    <p style={{ fontWeight:700,fontSize:17,color:TEXT,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{itemTitle}</p>
                    {m.otherProfile && (
                      <p style={{ fontSize:15,color:SUB }}>{m.otherProfile.biz || m.otherProfile.name || "Usuario"}{m.otherProfile.location?` · ${m.otherProfile.location}`:""}</p>
                    )}
                  </div>
                </div>
                {m.reason && (
                  <p style={{ fontSize:15,color:MUTED,marginBottom:12,lineHeight:1.5,fontStyle:"italic" }}>"{m.reason}"</p>
                )}
                <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
                  {(m.iAmSeller ? m.listing : m.listing) && onSelect && m.listing && (
                    <button onClick={()=>onSelect(m.listing)}
                      style={{ padding:"8px 14px",borderRadius:8,border:`1px solid ${BORDER}`,background:BG2,color:TEXT,fontSize:15,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                      <Ic n="box" s={14} c={TEXT}/> Ver publicación
                    </button>
                  )}
                  {m.otherProfile && onChat && m.listing && (
                    <button onClick={()=>onChat(m.listing, m.otherProfile)}
                      style={{ padding:"8px 14px",borderRadius:8,border:"none",background:RED,color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>
                      <Ic n="msg" s={14} c="#fff"/> Contactar
                    </button>
                  )}
                  {confirmDel===m.id ? (
                    <div style={{ display:"flex",gap:6,marginLeft:"auto" }}>
                      <button onClick={()=>setConfirmDel(null)}
                        style={{ padding:"8px 12px",borderRadius:8,border:`1px solid ${BORDER}`,background:"transparent",color:MUTED,fontSize:15,cursor:"pointer",fontWeight:600 }}>
                        Cancelar
                      </button>
                      <button onClick={()=>deleteMatch(m.id)} disabled={deleting}
                        style={{ padding:"8px 12px",borderRadius:8,border:"none",background:DANGER,color:"#fff",fontSize:15,cursor:"pointer",fontWeight:700 }}>
                        {deleting?"…":"Confirmar"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>setConfirmDel(m.id)} title="Eliminar match"
                      style={{ marginLeft:"auto",padding:"8px 12px",borderRadius:8,border:`1px solid rgba(220,38,38,.35)`,background:"rgba(220,38,38,.06)",color:DANGER,fontSize:15,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5 }}>
                      <Ic n="trash" s={13} c={DANGER}/>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════════════════════════ */
function ProfilePage({ user, profile, onLogout }) {
  const { t } = useLang();
  const [section,          setSection]         = useState("perfil");
  const [listings,         setListings]         = useState([]);
  const [editMode,         setEditMode]         = useState(false);
  const [editData,         setEditData]         = useState({ name:"",rut:"",biz:"",phone:"",address:"",location:"" });
  const [showDeleteConfirm,setShowDeleteConfirm]= useState(false);
  const [supportMsg,       setSupportMsg]       = useState("");
  const [supportSent,      setSupportSent]      = useState(false);
  const [bulkFile,         setBulkFile]         = useState(null);
  const [bulkRows,         setBulkRows]         = useState([]);
  const [bulkUploading,    setBulkUploading]    = useState(false);
  const [bulkDone,         setBulkDone]         = useState(false);
  const [inbox,            setInbox]            = useState([]);
  const [inboxLoading,     setInboxLoading]     = useState(true);
  const [notifViewListing, setNotifViewListing] = useState(null);
  const fileRef = useRef();

  useEffect(()=>{
    sb.from("listings").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).then(({data})=>setListings(data||[]));
  },[user.id]);
  useEffect(()=>{
    if (profile) setEditData({ name:profile.name||"",rut:profile.rut||"",biz:profile.biz||"",phone:profile.phone||"",address:profile.address||"",location:profile.location||"" });
  },[profile]);
  useEffect(()=>{
    if (section !== "notif") return;
    setInboxLoading(true);
    sb.from("messages").select("*").eq("to_id",user.id).order("created_at",{ascending:false}).limit(50)
      .then(({ data })=>{ setInbox(data||[]); setInboxLoading(false); });
  },[section, user.id]);

  const markInboxRead = async () => {
    const unreadIds = inbox.filter(m=>!m.read).map(m=>m.id);
    if (!unreadIds.length) return;
    await sb.from("messages").update({ read:true }).in("id", unreadIds);
    setInbox(prev => prev.map(m => ({ ...m, read:true })));
  };

  const openNotifListing = async (listingId) => {
    if (!listingId) return;
    const { data } = await sb.from("listings").select("*").eq("id", listingId).single();
    if (data) setNotifViewListing(data);
  };

  const saveProfile = async () => {
    const { error } = await sb.from("profiles").update(editData).eq("id", user.id);
    if (!error) setEditMode(false);
  };
  const sendSupport = ()=>{
    if(!supportMsg.trim()) return;
    const subject = encodeURIComponent("Soporte PortalMaquinas");
    const body    = encodeURIComponent(supportMsg.trim());
    window.location.href = `mailto:info@portalmaquinas.com?subject=${subject}&body=${body}`;
    setSupportSent(true); setSupportMsg(""); setTimeout(()=>setSupportSent(false),4000);
  };
  const [deletingAccount, setDeletingAccount] = useState(false);
  const deleteAccount = async ()=>{
    setDeletingAccount(true);
    // Borra el contenido del usuario (RLS permite eliminar filas propias) y cierra sesión.
    await sb.from("listings").delete().eq("user_id", user.id);
    await sb.from("requests").delete().eq("user_id", user.id);
    await sb.from("profiles").delete().eq("id", user.id);
    await sb.auth.signOut();
    window.location.reload();
  };

  const handleBulkFile = file => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv","xlsx","xls"].includes(ext) && !file.type.includes("csv") && !file.type.includes("spreadsheet")) {
      alert("Solo se permiten archivos CSV o Excel (.csv, .xlsx, .xls).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) { alert("El archivo no puede superar 2 MB."); return; }
    setBulkFile(file);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/"/g,""));
      const VALID_CATS = ["min","for","const","ene","trans","fae","rut","san","serv","ali","her"];
      const VALID_CONDS = ["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"];
      const rows = lines.slice(1, 501).map(line => {
        const vals = line.split(",").map(v=>v.trim().replace(/"/g,"").replace(/^[=+\-@]/, ""));
        const obj = {};
        headers.forEach((h,i) => obj[h] = vals[i]||"");
        const title = (obj.titulo||obj.title||"").slice(0, 200);
        const cat = VALID_CATS.includes(obj.categoria||obj.cat) ? (obj.categoria||obj.cat) : "min";
        const condition = VALID_CONDS.includes(obj.condicion||obj.condition) ? (obj.condicion||obj.condition) : "Nuevo";
        const price = Math.max(0, Number(obj.precio||obj.price)||0);
        const currency = ["CLP","USD","EUR","COP","PEN","MXN"].includes(obj.moneda||obj.currency) ? (obj.moneda||obj.currency) : "CLP";
        return { title, cat, condition, price: String(price), currency };
      }).filter(r=>r.title);
      setBulkRows(rows);
    };
    reader.readAsText(file);
  };

  const uploadBulk = async () => {
    setBulkUploading(true);
    // Batch inserts in chunks of 20 for better performance
    const CHUNK = 20;
    const rows = bulkRows.map(row => ({
      user_id: user.id, title: row.title, cat: row.cat,
      condition: row.condition, price: Number(row.price),
      currency: row.currency, biz: profile?.biz||"",
      location: profile?.location||"", emoji: "📦", verified: false,
    }));
    for (let i = 0; i < rows.length; i += CHUNK) {
      await sb.from("listings").insert(rows.slice(i, i + CHUNK));
    }
    setBulkUploading(false); setBulkDone(true); setBulkRows([]); setBulkFile(null);
  };

  const initials = ((profile?.name||"U ").split(" ").map(w=>w[0]).join("")).slice(0,2).toUpperCase();

  const SECTIONS = [
    { id:"perfil",   labelKey:"profile_title",   icn:"user" },
    { id:"notif",    labelKey:"notif_title",      icn:"bell",  label:"Notificaciones" },
    { id:"bulk",     labelKey:"bulk_upload",      icn:"box",   label:"Carga masiva" },
    { id:"soporte",  labelKey:"support_title",    icn:"msg" },
    { id:"settings", labelKey:"settings_title",   icn:"settings" },
  ];

  /* Toggle component */
  const Toggle = ({ on }) => (
    <div className="toggle" style={{ background:on?RED:"rgba(255,255,255,.15)" }}>
      <div className="toggle-knob" style={{ left:on?20:2 }}/>
    </div>
  );

  const isMobile = useIsMobile();
  return (
    <div style={{ display:"flex", height:"100%", background:BG, flexDirection:isMobile?"column":"row" }}>
      {/* Sidebar */}
      <div style={{ width:isMobile?"100%":200,background:BG3,borderRight:isMobile?"none":`1px solid ${BORDER}`,borderBottom:isMobile?`1px solid ${BORDER}`:'none',padding:"12px 0",flexShrink:0,display:"flex",flexDirection:isMobile?"row":"column",flexWrap:isMobile?"wrap":"nowrap",overflowX:isMobile?"auto":"visible" }}>
        <div style={{ padding:"0 16px 20px",borderBottom:`1px solid ${BORDER}`,marginBottom:8 }}>
          <Avatar name={profile?.name||"U"} size={48}/>
          <p style={{ fontSize:16,fontWeight:700,color:TEXT,marginTop:10 }}>{profile?.name||"Usuario"}</p>
          <p style={{ fontSize:16,color:MUTED }}>{profile?.biz||"—"}</p>
        </div>
        {SECTIONS.map(s=>(
          <button key={s.id} className={`sidebar-btn${section===s.id?" active":""}`} onClick={()=>setSection(s.id)}>
            <Ic n={s.icn} s={16} c={section===s.id?RED:MUTED}/>{s.label||t(s.labelKey)}
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <button onClick={onLogout} className="sidebar-btn" style={{ color:RED }}>
          <Ic n="logout" s={16} c={RED}/>{t("nav_logout")}
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex:1,overflowY:"auto",padding:32 }}>

        {/* ── PERFIL ── */}
        {section==="perfil"&&(
          <div style={{ maxWidth:"100%" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
              <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mi Perfil</h2>
              <button className="btn-ol" style={{ padding:"8px 16px",fontSize:16 }} onClick={()=>setEditMode(e=>!e)}>
                {editMode?t("profile_cancel"):t("profile_edit")}
              </button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:12,marginBottom:24 }}>
              {[["Publicaciones",listings.length]].map(([k,v])=>(
                <div key={k} style={{ background:CARD,borderRadius:10,padding:"16px",border:`1px solid ${BORDER}`,textAlign:"center" }}>
                  <p className="bebas" style={{ fontSize:26,color:RED }}>{v}</p>
                  <p style={{ fontSize:16,color:MUTED,marginTop:4,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Barlow Condensed,sans-serif" }}>{k}</p>
                </div>
              ))}
            </div>
            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",gap:14 }}>
              {[["Nombre completo","name","Ej: Carlos García"],["RUT","rut","RUT / ID fiscal"],["Empresa / Negocio","biz","Ej: Mining Corp S.A."],["WhatsApp / Teléfono","phone","+1 555 1234 / +56 9 1234"],["Dirección","address","Ej: Av. Principal 1234"],["Ciudad y País","location","Ciudad, País"]].map(([label,key,ph])=>(
                <div key={key}>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>{label}</p>
                  {editMode
                    ? <input className="inp" value={editData[key]} maxLength={key==="name"?100:key==="rut"?30:key==="biz"?150:key==="phone"?25:key==="address"?200:100} onChange={e=>setEditData(d=>({...d,[key]:e.target.value}))} placeholder={ph}/>
                    : <p style={{ fontSize:16,color:editData[key]?TEXT:MUTED,padding:"10px 0",borderBottom:`1px solid ${BORDER}` }}>{editData[key]||"—"}</p>
                  }
                </div>
              ))}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Email</p>
                <p style={{ fontSize:16,color:MUTED,padding:"10px 0" }}>{user.email}</p>
              </div>
              {editMode&&<button className="btn-red" onClick={saveProfile} style={{ padding:"13px" }}>{t("profile_save")}</button>}
            </div>

            <h3 className="bebas" style={{ fontSize:22,color:TEXT,marginTop:28,marginBottom:16 }}>Mis publicaciones</h3>
            {listings.length===0 ? (
              <div style={{ background:CARD,borderRadius:12,padding:32,textAlign:"center",border:`1px solid ${BORDER}` }}>
                <p style={{ color:MUTED }}>No tienes publicaciones aún</p>
              </div>
            ) : listings.map(l=>(
              <div key={l.id} style={{ background:CARD,borderRadius:10,padding:16,marginBottom:10,border:`1px solid ${BORDER}`,display:"flex",gap:12,alignItems:"center" }}>
                <div style={{ width:48,height:48,background:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{l.emoji||"📦"}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600,fontSize:16,color:TEXT }}>{l.title}</p>
                  <p className="bebas" style={{ fontSize:16,color:RED }}>{fmtPrice(l.price,l.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── NOTIFICACIONES ── */}
        {section==="notif"&&(
          <div style={{ maxWidth:"100%" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Notificaciones</h2>
              {inbox.some(m=>!m.read) && (
                <button onClick={markInboxRead}
                  style={{ background:"none",border:`1px solid ${BORDER}`,borderRadius:7,padding:"6px 12px",color:SUB,fontSize:16,cursor:"pointer",fontWeight:600 }}>
                  Marcar todo como leído
                </button>
              )}
            </div>
            <p style={{ color:MUTED,fontSize:16,marginBottom:24 }}>Mensajes y avisos de matches recibidos.</p>

            {inboxLoading ? (
              <div style={{ display:"flex",justifyContent:"center",paddingTop:40 }}><Spin size={26}/></div>
            ) : inbox.length===0 ? (
              <div style={{ background:CARD,borderRadius:12,padding:60,textAlign:"center",border:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:56,marginBottom:16 }}>🔔</div>
                <p className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>No tienes notificaciones</p>
                <p style={{ color:MUTED,fontSize:16 }}>Cuando recibas mensajes o matches aparecerán aquí</p>
              </div>
            ) : (
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {inbox.map(m=>(
                  <div key={m.id} style={{ background:m.read?CARD:"rgba(255,106,0,.06)",borderRadius:10,padding:"14px 16px",border:`1px solid ${m.read?BORDER:"rgba(255,106,0,.25)"}`,display:"flex",gap:12,alignItems:"flex-start" }}>
                    {!m.read && <div style={{ width:8,height:8,borderRadius:"50%",background:RED,marginTop:5,flexShrink:0 }}/>}
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:16,color:TEXT,lineHeight:1.5,fontWeight:m.read?400:600 }}>{m.body}</p>
                      {m.listing_id && (
                        <button onClick={()=>openNotifListing(m.listing_id)}
                          style={{ marginTop:8,background:"rgba(255,106,0,.12)",border:"1px solid rgba(255,106,0,.3)",borderRadius:8,padding:"6px 12px",fontSize:16,fontWeight:700,color:RED,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif" }}>
                          <Ic n="chevR" s={12} c={RED}/> Ver publicación
                        </button>
                      )}
                      <p style={{ fontSize:16,color:MUTED,marginTop:4 }}>{fmtTs(m.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {notifViewListing && (
          <ListingDetail l={notifViewListing} onClose={()=>setNotifViewListing(null)} user={user}/>
        )}

        {/* ── CARGA MASIVA ── */}
        {section==="bulk"&&(
          <div style={{ maxWidth:"100%" }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Carga Masiva de Publicaciones</h2>
            <p style={{ color:MUTED,fontSize:16,marginBottom:24 }}>Sube hasta 500 publicaciones de una sola vez usando un archivo Excel o CSV.</p>
            <div style={{ background:"rgba(255,106,0,.06)",border:"1px solid rgba(255,106,0,.2)",borderRadius:12,padding:20,marginBottom:24,display:"flex",gap:16,alignItems:"center" }}>
              <div style={{ width:44,height:44,background:RED,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Ic n="box" s={20} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700,fontSize:16,color:TEXT }}>Descargar plantilla Excel</p>
                <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>Usa esta plantilla con las columnas correctas.</p>
              </div>
              <button className="btn-ol" style={{ padding:"9px 18px",fontSize:16,flexShrink:0 }} onClick={()=>window.open("/plantilla_carga_masiva.xlsx","_blank")}>Descargar →</button>
            </div>
            {!bulkFile ? (
              <div onClick={()=>fileRef.current.click()}
                style={{ border:`2px dashed ${BORDER2}`,borderRadius:12,padding:48,textAlign:"center",cursor:"pointer",transition:"all .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER2}>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }} onChange={e=>handleBulkFile(e.target.files[0])}/>
                <div style={{ width:56,height:56,background:BG2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                  <Ic n="box" s={28} c={MUTED}/>
                </div>
                <p style={{ fontWeight:700,fontSize:16,marginBottom:6,color:TEXT }}>Arrastra tu archivo aquí</p>
                <p style={{ color:MUTED,fontSize:16 }}>o haz click para seleccionar</p>
                <p style={{ color:MUTED,fontSize:16,marginTop:8 }}>Excel (.xlsx) o CSV — máximo 500 filas</p>
              </div>
            ) : (
              <div>
                <div style={{ background:CARD,borderRadius:10,padding:16,border:`1px solid ${BORDER}`,marginBottom:16,display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:40,height:40,background:"rgba(34,197,94,.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <Ic n="check" s={18} c={GREEN}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600,color:TEXT }}>{bulkFile.name}</p>
                    <p style={{ fontSize:16,color:GREEN }}>{bulkRows.length} publicaciones encontradas</p>
                  </div>
                  <button onClick={()=>{setBulkFile(null);setBulkRows([]);}} style={{ color:MUTED,fontSize:16,background:"none",border:"none",cursor:"pointer" }}>Cambiar</button>
                </div>
                {bulkRows.length > 0 && (
                <div style={{ background:CARD,borderRadius:10,border:`1px solid ${BORDER}`,overflowX:"auto",marginBottom:16 }}>
                  <div style={{ background:BG2,padding:"10px 16px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,minWidth:440 }}>
                    {["Título","Categoría","Condición","Precio"].map(h=><span key={h} style={{ fontSize:16,fontWeight:700,color:MUTED,fontFamily:"Barlow Condensed,sans-serif",textTransform:"uppercase" }}>{h}</span>)}
                  </div>
                  {bulkRows.map((r,i)=>(
                    <div key={i} style={{ padding:"12px 16px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,minWidth:440,borderTop:`1px solid ${BORDER}` }}>
                      <span style={{ fontSize:16,color:TEXT }}>{r.title}</span>
                      <span style={{ fontSize:16,color:MUTED }}>{CATS.find(c=>c.id===r.cat)?.label||r.cat}</span>
                      <span style={{ fontSize:16,color:MUTED }}>{r.condition}</span>
                      <span className="bebas" style={{ fontSize:16,color:RED }}>{Number(r.price).toLocaleString()} {r.currency}</span>
                    </div>
                  ))}
                </div>
                )}
                {bulkDone
                  ? <p style={{ color:GREEN,fontSize:16,fontWeight:700,textAlign:"center" }}>✓ ¡Carga completada!</p>
                  : <button className="btn-red" onClick={uploadBulk} disabled={bulkUploading} style={{ width:"100%",padding:"13px" }}>
                      {bulkUploading?"Subiendo…":`Publicar ${bulkRows.length} productos`}
                    </button>
                }
              </div>
            )}
          </div>
        )}

        {/* ── SOPORTE ── */}
        {section==="soporte"&&(
          <div style={{ maxWidth:"100%" }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Soporte</h2>
            <p style={{ color:MUTED,fontSize:16,marginBottom:28 }}>Estamos aquí para ayudarte. Elige cómo quieres contactarnos.</p>

            <div style={{ background:"rgba(255,106,0,.06)",border:"1px solid rgba(255,106,0,.2)",borderRadius:12,padding:24,marginBottom:16 }}>
              <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:16 }}>
                <div style={{ width:44,height:44,background:RED,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <span style={{ color:"#fff",fontSize:20 }}>⚡</span>
                </div>
                <div>
                  <p style={{ fontWeight:700,fontSize:16,color:TEXT }}>Soporte con IA</p>
                  <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>Respuesta inmediata las 24 horas.</p>
                </div>
              </div>
              <div style={{ background:BG2,borderRadius:8,padding:14,marginBottom:12,minHeight:60,fontSize:16,color:MUTED,border:`1px solid ${BORDER}` }}>
                Escribe tu consulta y te responderemos a la brevedad.
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <input className="inp" placeholder="Escribe tu pregunta…" style={{ flex:1,borderRadius:8,padding:"10px 14px",fontSize:16 }}/>
                <button className="btn-red" style={{ padding:"10px 14px" }}><Ic n="send" s={15} c="#fff"/></button>
              </div>
            </div>

            <div style={{ background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:24,marginBottom:16 }}>
              <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:16 }}>
                <div style={{ width:44,height:44,background:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${BORDER}` }}>
                  <Ic n="user" s={20} c={SUB}/>
                </div>
                <div>
                  <p style={{ fontWeight:700,fontSize:16,color:TEXT }}>Soporte humano</p>
                  <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>Respuesta en menos de 24 horas hábiles.</p>
                </div>
              </div>
              <textarea className="inp" rows={4} placeholder="Describe tu problema o consulta…" value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} style={{ resize:"none",marginBottom:12 }}/>
              {supportSent
                ? <p style={{ color:GREEN,fontSize:16,fontWeight:700 }}>✓ Mensaje enviado — te responderemos en menos de 24hrs</p>
                : <button className="btn-red" onClick={sendSupport} style={{ padding:"13px" }}>Enviar mensaje</button>
              }
            </div>

            <div style={{ background:"rgba(37,211,102,.06)",border:"1px solid rgba(37,211,102,.25)",borderRadius:12,padding:20,display:"flex",gap:14,alignItems:"center" }}>
              <div style={{ width:44,height:44,background:"#25D366",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Ic n="wa" s={20} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700,fontSize:16,color:TEXT }}>WhatsApp directo</p>
                <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>Lun–Vie 9:00–18:00</p>
              </div>
              <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20PortalMaquinas","_blank")}
                style={{ background:"#25D366",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:16,fontWeight:700,cursor:"pointer",flexShrink:0 }}>
                Chatear
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIGURACIÓN ── */}
        {section==="settings"&&(
          <div style={{ maxWidth:"100%" }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:24 }}>Configuración</h2>

            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:16 }}>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Notificaciones</p>
              {[["Nuevos mensajes","Recibir email cuando alguien te contacta",true],["Alertas de búsqueda","Notificar cuando aparezcan productos que buscas",true],["Novedades de PortalMaquinas","Actualizaciones y mejoras de la plataforma",false]].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>{label}</p>
                    <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>{desc}</p>
                  </div>
                  <div className="toggle" style={{ background:def?RED:"rgba(255,255,255,.15)" }}>
                    <div className="toggle-knob" style={{ left:def?20:2 }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:16 }}>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Privacidad</p>
              {[["Mostrar WhatsApp en publicaciones","Tu número aparece en el botón de contacto directo",true],["Perfil visible en búsquedas","Otros usuarios pueden ver tu perfil público",true]].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>{label}</p>
                    <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>{desc}</p>
                  </div>
                  <div className="toggle" style={{ background:def?RED:"rgba(255,255,255,.15)" }}>
                    <div className="toggle-knob" style={{ left:def?20:2 }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:16 }}>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Seguridad</p>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                <div>
                  <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>Cambiar contraseña</p>
                  <p style={{ fontSize:16,color:MUTED }}>Recibirás un email con instrucciones</p>
                </div>
                <button className="btn-ol" style={{ padding:"8px 14px",fontSize:16 }}
                  onClick={async()=>{ await sb.auth.resetPasswordForEmail(user.email,{redirectTo:"https://portalmaquinas.com"}); alert("Email enviado — revisa tu correo"); }}>
                  Enviar email
                </button>
              </div>
              <div style={{ padding:"12px 0" }}>
                <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>Email de la cuenta</p>
                <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>{user.email}</p>
              </div>
            </div>

            <div style={{ background:"rgba(255,106,0,.06)",border:"1px solid rgba(255,106,0,.2)",borderRadius:12,padding:24 }}>
              <p style={{ fontSize:16,fontWeight:700,color:RED,letterSpacing:1,textTransform:"uppercase",marginBottom:12,fontFamily:"Barlow Condensed,sans-serif" }}>Zona de peligro</p>
              {!showDeleteConfirm ? (
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <p style={{ fontSize:16,fontWeight:600,color:TEXT }}>Cerrar mi cuenta</p>
                    <p style={{ fontSize:16,color:MUTED,marginTop:2 }}>Esta acción es irreversible.</p>
                  </div>
                  <button onClick={()=>setShowDeleteConfirm(true)} className="btn-ol" style={{ borderColor:RED,color:RED,padding:"8px 16px",fontSize:16 }}>
                    Cerrar cuenta
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize:16,color:RED,fontWeight:700,marginBottom:12 }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
                  <div style={{ display:"flex",gap:10 }}>
                    <button className="btn-ol" onClick={()=>setShowDeleteConfirm(false)} style={{ flex:1,padding:"11px" }}>Cancelar</button>
                    <button onClick={deleteAccount} disabled={deletingAccount}
                      style={{ flex:1,background:RED,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:16,fontWeight:700,cursor:deletingAccount?"default":"pointer",opacity:deletingAccount?.6:1 }}>
                      {deletingAccount ? "Eliminando…" : "Sí, cerrar mi cuenta"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SUPPORT PANEL (floating)
══════════════════════════════════════════════════════════════ */
function SupportPanel({ onClose }) {
  const [msg,      setMsg]      = useState("");
  const [sent,     setSent]     = useState(false);

  const sendMail = () => {
    if (!msg.trim()) return;
    const subject = encodeURIComponent("Soporte PortalMaquinas");
    const body    = encodeURIComponent(msg.trim());
    window.location.href = `mailto:info@portalmaquinas.com?subject=${subject}&body=${body}`;
    setSent(true);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:16 }} onClick={onClose}>
      <div style={{ background:CARD,borderRadius:16,width:"100%",maxWidth:400,maxHeight:"80vh",display:"flex",flexDirection:"column",border:`1px solid ${BORDER2}`,boxShadow:"0 20px 60px rgba(0,0,0,.5)",overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:RED,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}><img src="/isotipo.svg" alt="" style={{ height:22, width:"auto", display:"block" }}/><p className="bebas" style={{ fontSize:18,color:"#fff",letterSpacing:.5 }}>SOPORTE</p></div>
            <p style={{ fontSize:16,color:"rgba(255,255,255,.7)",marginTop:2 }}>Contáctanos directamente</p>
          </div>
          <button onClick={onClose} style={{ color:"rgba(255,255,255,.8)",background:"none",border:"none",cursor:"pointer",fontSize:20 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto",flex:1,padding:20,display:"flex",flexDirection:"column",gap:16 }}>
          <div style={{ background:BG2,borderRadius:10,padding:16,border:`1px solid ${BORDER}` }}>
            <p style={{ fontWeight:700,fontSize:16,color:TEXT,marginBottom:8 }}>Soporte humano</p>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Describe tu problema…" rows={3} className="inp" style={{ resize:"none",marginBottom:8 }}/>
            {sent?<p style={{ color:GREEN,fontSize:16,fontWeight:700 }}>✓ Abrimos tu correo — envíanos el mensaje y responderemos en menos de 24hrs</p>
              :<button onClick={sendMail} className="btn-red" style={{ width:"100%",minHeight:46,padding:"11px",fontSize:16 }}>Enviar mensaje</button>
            }
          </div>
          <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20PortalMaquinas","_blank")}
            style={{ background:"#25D366",color:"#fff",border:"none",borderRadius:10,minHeight:46,padding:"13px",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            <Ic n="wa" s={18} c="#fff"/>Escríbenos por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   MIS PUBLICACIONES PAGE
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   EDIT LISTING SHEET
══════════════════════════════════════════════════════════════ */
function EditListingSheet({ user, listing, onClose, onSaved, onDeleted }) {
  const { t } = useLang();
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [loading, setLoading]   = useState(false);
  const [err,     setErr]       = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const photoInputRef           = useRef();

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await sb.from("listings").delete().eq("id", listing.id);
    if (error) {
      console.error("Error al borrar publicación:", error);
      alert("No se pudo borrar la publicación: " + error.message);
      setDeleting(false);
      return;
    }
    onDeleted?.(listing.id);
  };

  // Existing remote photos (URLs already saved)
  const [existingPhotos, setExistingPhotos] = useState(listing.photos || []);
  // New local files to upload
  const [newFiles,  setNewFiles]  = useState([]);
  const [newPreviews, setNewPreviews] = useState([]);

  const [f, setF] = useState({
    title:         listing.title        || "",
    brand:         listing.brand        || "",
    model:         listing.model        || "",
    serial_number: listing.serial_number|| "",
    part_number:   listing.part_number  || "",
    engine_number: listing.engine_number|| "",
    hours:         listing.hours != null ? String(listing.hours) : "",
    cat:           listing.cat          || "min",
    condition:     listing.condition    || "Nuevo",
    price:         listing.price != null ? String(listing.price) : "",
    currency:      listing.currency     || "CLP",
    stock:         listing.stock != null ? String(listing.stock) : "1",
    location:      listing.location     || "",
    phone:         listing.phone        || "",
    biz:           listing.biz          || "",
    description:   listing.description  || "",
    emoji:         listing.emoji        || "📦",
  });
  const upd = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleNewPhotos = e => {
    const files = Array.from(e.target.files || []);
    const ALLOWED = ["image/jpeg","image/png","image/webp","image/gif"];
    const valid = files.filter(file => {
      if (!ALLOWED.includes(file.type)) { setErr(t("ai_only_images")); return false; }
      if (file.size > 10 * 1024 * 1024) { setErr("Cada foto debe pesar menos de 10 MB."); return false; }
      return true;
    });
    if (!valid.length) return;
    setErr("");
    const combined = [...newFiles, ...valid].slice(0, Math.max(0, 4 - existingPhotos.length));
    setNewFiles(combined);
    newPreviews.forEach(u => URL.revokeObjectURL(u));
    setNewPreviews(combined.map(f => URL.createObjectURL(f)));
    e.target.value = "";
  };

  const removeExisting = idx => setExistingPhotos(p => p.filter((_,i) => i !== idx));
  const removeNew      = idx => {
    URL.revokeObjectURL(newPreviews[idx]);
    const nf = newFiles.filter((_,i) => i !== idx);
    const np = newPreviews.filter((_,i) => i !== idx);
    setNewFiles(nf);
    setNewPreviews(np);
  };

  const uploadNewPhotos = async () => {
    const uploadOne = async file => {
      const compressed = await compressImage(file);
      const path = `${user.id}/${listing.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const { error: upErr } = await sb.storage.from("listing-photos").upload(path, compressed, {
        contentType: "image/jpeg", cacheControl: "31536000", upsert: false,
      });
      if (upErr) return null;
      const { data } = sb.storage.from("listing-photos").getPublicUrl(path);
      return data.publicUrl;
    };
    const results = await Promise.all(newFiles.map(uploadOne));
    return results.filter(Boolean);
  };

  const save = async () => {
    if (!f.title || (!f.price && f.currency !== "NEG")) { setErr(t("pub_error_required")); return; }
    setLoading(true); setErr("");
    const uploadedUrls = await uploadNewPhotos();
    const allPhotos = [...existingPhotos, ...uploadedUrls];
    const { error } = await sb.from("listings").update({
      title:          f.title,
      brand:          f.brand   || null,
      model:          f.model   || null,
      serial_number:  f.serial_number || null,
      part_number:    f.part_number   || null,
      engine_number:  f.engine_number || null,
      hours:          f.hours   ? Number(f.hours)  : null,
      cat:            f.cat,
      condition:      f.condition,
      price:          f.currency==="NEG" ? 0 : Number(f.price),
      currency:       f.currency,
      stock:          Number(f.stock) || 1,
      location:       f.location,
      phone:          f.phone   || null,
      biz:            f.biz     || null,
      description:    f.description || null,
      emoji:          f.emoji   || "📦",
      photos:         Array.isArray(allPhotos) ? allPhotos : [],
    }).eq("id", listing.id).eq("user_id", user.id);
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onSaved({ ...listing, ...f, photos: allPhotos });
  };

  const totalSlots = existingPhotos.length + newPreviews.length;

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:90,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"94dvh",overflow:"hidden",display:"flex",flexDirection:"column",...sheetStyle }} onClick={e=>e.stopPropagation()}>
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",cursor:"grab",touchAction:"none" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <h3 className="bebas" style={{ fontSize:22,color:TEXT }}>Editar publicación</h3>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>

        <div style={{ overflowY:"auto",flex:1,padding:"0 20px 40px",display:"flex",flexDirection:"column",gap:14 }}>
          {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:16,color:DANGER }}>{err}</div>}

          {/* Photos */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>Fotos</p>
            <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleNewPhotos}/>

            {totalSlots === 0 ? (
              <div onClick={()=>photoInputRef.current?.click()}
                style={{ border:`2px dashed ${RED}`, borderRadius:14, padding:"28px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:10, cursor:"pointer", background:"rgba(255,106,0,.04)" }}>
                <Ic n="camera" s={32} c={RED}/>
                <p style={{ fontSize:16, fontWeight:700, color:RED, fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase", margin:0 }}>Agregar fotos</p>
                <p style={{ fontSize:13, color:MUTED, margin:0, textAlign:"center" }}>Toca para seleccionar · Hasta 4 fotos · Puedes elegir varias a la vez</p>
              </div>
            ) : (
              <div>
                <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:6 }}>
                  {existingPhotos.map((url,i)=>(
                    <div key={"ex"+i} style={{ position:"relative",flexShrink:0 }}>
                      <img src={url} alt="" style={{ width:88,height:88,borderRadius:10,objectFit:"cover",display:"block",border:`1.5px solid ${BORDER}` }}/>
                      <button onClick={()=>removeExisting(i)} style={{ position:"absolute",top:-7,right:-7,width:22,height:22,borderRadius:"50%",background:"#111",border:`1px solid ${BORDER}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
                        <Ic n="x" s={11} c="#fff"/>
                      </button>
                    </div>
                  ))}
                  {newPreviews.map((url,i)=>(
                    <div key={"nw"+i} style={{ position:"relative",flexShrink:0 }}>
                      <img src={url} alt="" style={{ width:88,height:88,borderRadius:10,objectFit:"cover",display:"block",border:`2px solid ${RED}`,opacity:.9 }}/>
                      <button onClick={()=>removeNew(i)} style={{ position:"absolute",top:-7,right:-7,width:22,height:22,borderRadius:"50%",background:"#111",border:`1px solid ${BORDER}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0 }}>
                        <Ic n="x" s={11} c="#fff"/>
                      </button>
                    </div>
                  ))}
                  {totalSlots < 4 && (
                    <div onClick={()=>photoInputRef.current?.click()}
                      style={{ width:88,height:88,background:BG2,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,flexShrink:0,border:`2px dashed ${BORDER}`,cursor:"pointer",transition:"border-color .15s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=BORDER}>
                      <Ic n="camera" s={20} c={MUTED}/>
                      <span style={{ fontSize:13,color:MUTED,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif" }}>+ FOTO</span>
                    </div>
                  )}
                </div>
                <p style={{ fontSize:13,color:MUTED,marginTop:4 }}>{totalSlots}/4 fotos · {totalSlots<4?`Puedes agregar ${4-totalSlots} más`:"Máximo alcanzado"}</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_title")}</p>
            <input className="inp" value={f.title} maxLength={200} onChange={e=>upd("title",e.target.value)} placeholder={t("pub_title_ph")}/>
          </div>

          {/* Industry + Brand */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_industry")}</p>
              <select className="inp" value={f.cat} onChange={e=>upd("cat",e.target.value)}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_brand")}</p>
              <input className="inp" value={f.brand} maxLength={100} onChange={e=>upd("brand",e.target.value)} placeholder={t("pub_brand_ph")}/>
            </div>
          </div>

          {/* Model */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_model")}</p>
            <input className="inp" value={f.model} maxLength={100} onChange={e=>upd("model",e.target.value)} placeholder={t("pub_model_ph")}/>
          </div>

          {/* Technical numbers: Serial + Part */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Serie</p>
              <input className="inp" value={f.serial_number} maxLength={100} onChange={e=>upd("serial_number",e.target.value)} placeholder="N° serie del equipo"/>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Parte</p>
              <input className="inp" value={f.part_number} maxLength={100} onChange={e=>upd("part_number",e.target.value)} placeholder="Part number"/>
            </div>
          </div>

          {/* Engine number + Hours */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Motor</p>
              <input className="inp" value={f.engine_number} maxLength={100} onChange={e=>upd("engine_number",e.target.value)} placeholder="N° motor"/>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Horas de Uso</p>
              <input className="inp" type="number" min="0" value={f.hours} onChange={e=>upd("hours",e.target.value)} placeholder="Ej: 4500"/>
            </div>
          </div>

          {/* Condition */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_condition")}</p>
            <div style={{ display:"flex",gap:8 }}>
              {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=>(
                <button key={c} onClick={()=>upd("condition",c)}
                  style={{ flex:1,padding:"9px 4px",borderRadius:8,border:`1.5px solid ${f.condition===c?RED:BORDER}`,background:f.condition===c?"rgba(255,106,0,.1)":CARD,fontWeight:700,fontSize:16,color:f.condition===c?RED:SUB,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_price")}</p>
            <button onClick={()=>upd("currency", f.currency==="NEG"?"CLP":"NEG")}
              style={{ display:"flex",alignItems:"center",gap:8,marginBottom:8,background:"none",border:"none",cursor:"pointer",padding:0 }}>
              <div style={{ width:38,height:22,borderRadius:11,background:f.currency==="NEG"?RED:BG3,border:`1.5px solid ${f.currency==="NEG"?RED:BORDER}`,position:"relative",transition:"all .2s",flexShrink:0 }}>
                <div style={{ width:16,height:16,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:f.currency==="NEG"?18:2,transition:"left .2s" }}/>
              </div>
              <span style={{ fontSize:15,color:f.currency==="NEG"?RED:MUTED,fontWeight:600 }}>Precio a convenir</span>
            </button>
            {f.currency !== "NEG" && (
              <div style={{ display:"flex",gap:8 }}>
                <div style={{ position:"relative",flex:1 }}>
                  <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:MUTED }}>$</span>
                  <input className="inp" type="number" value={f.price} onChange={e=>upd("price",e.target.value)} style={{ paddingLeft:30 }} placeholder="0"/>
                </div>
                <select className="inp" value={f.currency} onChange={e=>upd("currency",e.target.value)} style={{ width:88 }}>
                  {["CLP","USD","EUR","COP","PEN","MXN"].map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_description")}</p>
            <textarea className="inp" rows={3} value={f.description} maxLength={1000} onChange={e=>upd("description",e.target.value)} placeholder={t("pub_desc_ph")} style={{ resize:"none" }}/>
          </div>

          {/* Location */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>{t("pub_location")}</p>
            <input className="inp" value={f.location} maxLength={100} onChange={e=>upd("location",e.target.value)} placeholder={t("pub_location_ph")}/>
          </div>

          {/* Stock */}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Stock disponible</p>
            <input className="inp" type="number" min="1" value={f.stock} onChange={e=>upd("stock",e.target.value)} placeholder="1"/>
          </div>

          {/* Contact: Phone + Company */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Teléfono</p>
              <input className="inp" value={f.phone} maxLength={30} onChange={e=>upd("phone",e.target.value)} placeholder="+56 9 ..."/>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Empresa</p>
              <input className="inp" value={f.biz} maxLength={100} onChange={e=>upd("biz",e.target.value)} placeholder="Nombre de tu empresa"/>
            </div>
          </div>

          <button className="btn-red" onClick={save} disabled={loading||!f.title||(!f.price&&f.currency!=="NEG")}
            style={{ marginTop:4,opacity:(!f.title||(!f.price&&f.currency!=="NEG")||loading)?.5:1,padding:"15px",fontSize:16 }}>
            {loading?<Spin/>:"Guardar cambios"}
          </button>

          {/* Delete section */}
          {confirmDel ? (
            <div style={{ marginTop:4,padding:"14px",borderRadius:10,border:`1px solid rgba(220,38,38,.35)`,background:"rgba(220,38,38,.06)" }}>
              <p style={{ fontSize:16,color:TEXT,marginBottom:10,textAlign:"center" }}>¿Seguro que quieres eliminar esta publicación?</p>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>setConfirmDel(false)} disabled={deleting}
                  style={{ flex:1,padding:"12px",borderRadius:8,border:`1px solid ${BORDER}`,background:"transparent",color:MUTED,fontSize:16,cursor:"pointer",fontWeight:600 }}>
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ flex:1,padding:"12px",borderRadius:8,border:"none",background:DANGER,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>
                  {deleting?"Eliminando…":"Sí, eliminar"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setConfirmDel(true)}
              style={{ marginTop:4,padding:"13px",borderRadius:8,border:`1px solid rgba(220,38,38,.35)`,background:"transparent",color:DANGER,fontSize:16,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%" }}>
              <Ic n="trash" s={15} c={DANGER}/>Eliminar publicación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MIS PUBLICACIONES
══════════════════════════════════════════════════════════════ */
function MisPublicaciones({ user, onSelect, initSubTab="pubs" }) {
  const [subTab,      setSubTab]      = useState(initSubTab); // "pubs" | "solicitudes"
  const [listings,    setListings]    = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [editListing, setEditListing] = useState(null);   // listing being edited
  const [confirmDel,  setConfirmDel]  = useState(null);   // id being confirmed for delete
  const [confirmDelReq, setConfirmDelReq] = useState(null);
  const [editingRequest, setEditingRequest] = useState(null);
  const [deleting,    setDeleting]    = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      sb.from("listings").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
      sb.from("requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false}),
    ]).then(([lRes,rRes])=>{
      setListings(lRes.data||[]);
      setRequests(rRes.data||[]);
      setLoading(false);
    });
  }, [user.id]);

  useEffect(()=>{ reload(); },[user.id]);

  const deleteListing = async id => {
    setDeleting(true);
    const { error } = await sb.from("listings").delete().eq("id", id);
    if (error) {
      console.error("Error al borrar publicación:", error);
      alert("No se pudo borrar la publicación: " + error.message);
      setDeleting(false);
      setConfirmDel(null);
      return;
    }
    setListings(prev => prev.filter(l => l.id !== id));
    setConfirmDel(null);
    setDeleting(false);
  };

  const deleteRequest = async id => {
    setDeleting(true);
    const { error } = await sb.from("requests").delete().eq("id", id);
    if (error) {
      console.error("Error al borrar solicitud:", error);
      alert("No se pudo borrar la solicitud: " + error.message);
      setDeleting(false);
      setConfirmDelReq(null);
      return;
    }
    setRequests(prev => prev.filter(r => r.id !== id));
    setConfirmDelReq(null);
    setDeleting(false);
  };

  if (loading) return <div style={{ display:"flex",justifyContent:"center",paddingTop:60 }}><Spin size={30}/></div>;

  const URGENCY_C = { normal:BLUE, urgente:GOLD, critico:RED };
  const URGENCY_L = { normal:"Normal", urgente:"Urgente", critico:"Crítico" };

  return (
    <div style={{ maxWidth:"100%" }}>
      <div style={{ display:"flex",gap:8,marginBottom:20 }}>
        <button onClick={()=>setSubTab("pubs")}
          style={{ padding:"8px 18px",borderRadius:8,border:`1.5px solid ${subTab==="pubs"?RED:BORDER}`,background:subTab==="pubs"?"rgba(255,106,0,.1)":"transparent",color:subTab==="pubs"?RED:SUB,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
          Mis Publicaciones
        </button>
        <button onClick={()=>setSubTab("solicitudes")}
          style={{ padding:"8px 18px",borderRadius:8,border:`1.5px solid ${subTab==="solicitudes"?RED:BORDER}`,background:subTab==="solicitudes"?"rgba(255,106,0,.1)":"transparent",color:subTab==="solicitudes"?RED:SUB,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
          Mis Solicitudes
        </button>
      </div>

      {subTab==="pubs" ? (
        <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mis Publicaciones</h2>
            <span className="tag t-dim">{listings.length} publicaciones</span>
          </div>

          {listings.length===0 ? (
            <div style={{ background:CARD,borderRadius:12,padding:60,textAlign:"center",border:`1px solid ${BORDER}` }}>
              <div style={{ fontSize:56,marginBottom:16 }}>📦</div>
              <p className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Todavía no publicaste nada</p>
              <p style={{ color:MUTED,fontSize:16,marginBottom:24 }}>Publicá tu primer producto o repuesto gratis</p>
            </div>
          ) : (
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:12 }}>
              {listings.map(l=>(
                <div key={l.id} className="photo-card card" style={{ cursor:"default" }}>
                  {/* Photo — clickable to open detail */}
                  <div onClick={()=>onSelect(l)}>
                    <PhotoPlaceholder emoji={l.emoji||"📦"} url={l.photos?.[0]} h={120}/>
                  </div>
                  <div style={{ padding:"12px 14px 14px" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                      <span className="tag t-dim" style={{ fontSize:16 }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                    </div>
                    <p style={{ fontWeight:700,fontSize:16,color:TEXT,marginBottom:3,lineHeight:1.3 }}>{l.title}</p>
                    <p style={{ fontSize:16,color:MUTED,marginBottom:8 }}>{l.location} · {fmtTs(l.created_at)}</p>
                    <p className="bebas" style={{ fontSize:18,color:RED,marginBottom:10 }}>{fmtPrice(l.price,l.currency)}</p>

                    {/* Edit button (delete is inside the edit sheet) */}
                    <button onClick={()=>setEditListing(l)}
                      style={{ padding:"7px 16px",borderRadius:7,border:`1px solid ${BORDER}`,background:"transparent",color:TEXT,fontSize:16,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
                      <Ic n="settings" s={13} c={MUTED}/>Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editListing && (
            <EditListingSheet
              user={user}
              listing={editListing}
              onClose={()=>setEditListing(null)}
              onSaved={updated=>{
                setListings(prev => prev.map(l => l.id===updated.id ? updated : l));
                setEditListing(null);
              }}
              onDeleted={id=>{
                setListings(prev => prev.filter(l => l.id !== id));
                setEditListing(null);
              }}
            />
          )}
        </>
      ) : (
        <>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mis Solicitudes</h2>
            <span className="tag t-dim">{requests.length} solicitudes</span>
          </div>

          {requests.length===0 ? (
            <div style={{ background:CARD,borderRadius:12,padding:60,textAlign:"center",border:`1px solid ${BORDER}` }}>
              <div style={{ fontSize:56,marginBottom:16 }}>🔍</div>
              <p className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>No tienes solicitudes activas</p>
              <p style={{ color:MUTED,fontSize:16,marginBottom:24 }}>Pedí lo que necesitas y te avisamos cuando aparezca</p>
            </div>
          ) : (
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              {requests.map(r=>(
                <div key={r.id} className="card" style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:6 }}>
                    <div style={{ flex:1 }}>
                      <p style={{ fontWeight:700,fontSize:16,color:TEXT,marginBottom:3 }}>{r.title}</p>
                      <p style={{ fontSize:16,color:MUTED }}>{CATS.find(c=>c.id===r.cat)?.label||"—"} · {r.location||"—"} · {fmtTs(r.created_at)}</p>
                    </div>
                    <span className="tag" style={{ fontSize:16, color:URGENCY_C[r.urgency]||MUTED, border:`1px solid ${URGENCY_C[r.urgency]||BORDER}`, background:"transparent" }}>
                      {URGENCY_L[r.urgency]||"Normal"}
                    </span>
                  </div>
                  {(r.brand||r.model) && (
                    <p style={{ fontSize:16,color:SUB,marginBottom:6 }}>
                      {[r.brand,r.model].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {r.description && (
                    <p style={{ fontSize:16,color:MUTED,marginBottom:8,lineHeight:1.5 }}>{r.description}</p>
                  )}
                  <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    {r.budget ? (
                      <p className="bebas" style={{ fontSize:16,color:RED }}>{r.currency} {Number(r.budget).toLocaleString()}</p>
                    ) : <span/>}
                    <button onClick={()=>setEditingRequest(r)}
                      style={{ padding:"6px 14px",borderRadius:7,border:`1px solid ${BORDER}`,background:BG2,color:TEXT,fontSize:16,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:5 }}>
                      <Ic n="edit" s={12} c={TEXT}/>Editar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingRequest && (
        <EditSolicitudSheet
          request={editingRequest}
          user={user}
          profile={profile}
          onClose={()=>setEditingRequest(null)}
          onSaved={updated=>{ setRequests(prev=>prev.map(r=>r.id===updated.id?updated:r)); setEditingRequest(null); }}
          onDeleted={id=>{ setRequests(prev=>prev.filter(r=>r.id!==id)); setEditingRequest(null); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   EDIT SOLICITUD SHEET
══════════════════════════════════════════════════════════════ */
function EditSolicitudSheet({ request:req, user, profile, onClose, onSaved, onDeleted }) {
  const { t } = useLang();
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const URGENCY = [["normal","Normal"],["urgente","Urgente"],["critico","Crítico"]];
  const URGENCY_C = { normal:BLUE, urgente:GOLD, critico:RED };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await sb.from("requests").delete().eq("id", req.id);
    if (error) {
      console.error("Error al borrar solicitud:", error);
      alert("No se pudo borrar la solicitud: " + error.message);
      setDeleting(false);
      return;
    }
    onDeleted?.(req.id);
  };

  const [f, setF] = useState({
    title:          req.title          || "",
    brand:          req.brand          || "",
    model:          req.model          || "",
    cat:            req.cat            || "min",
    serial_number:  req.serial_number  || "",
    part_number:    req.part_number    || "",
    engine_number:  req.engine_number  || "",
    chassis_number: req.chassis_number || "",
    hours:          req.hours          || "",
    condition:      req.condition      || "",
    description:    req.description    || "",
    location:       req.location       || profile?.location || "",
    phone:          req.phone          || profile?.phone    || "",
    budget:         req.budget         || "",
    currency:       req.currency       || "CLP",
    urgency:        req.urgency        || "normal",
  });
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const save = async () => {
    if (!f.title) { setErr("El título es obligatorio."); return; }
    setLoading(true); setErr("");
    const { data, error } = await sb.from("requests").update({
      title: f.title, brand: f.brand, model: f.model, cat: f.cat,
      serial_number: f.serial_number, part_number: f.part_number,
      engine_number: f.engine_number, chassis_number: f.chassis_number,
      hours: f.hours, condition: f.condition, description: f.description,
      location: f.location, phone: f.phone,
      budget: f.budget ? Number(f.budget) : null,
      currency: f.currency, urgency: f.urgency,
    }).eq("id", req.id).select().single();
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onSaved(data);
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-end",background:"rgba(0,0,0,.6)" }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ width:"100%",maxWidth:620,margin:"0 auto",background:BG,borderRadius:"18px 18px 0 0",maxHeight:"90dvh",display:"flex",flexDirection:"column",overflow:"hidden",...sheetStyle }}>
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px",cursor:"grab",touchAction:"none" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <h3 className="bebas" style={{ fontSize:22,color:TEXT }}>Editar solicitud</h3>
          <button className="btn-ghost" onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>
        <div style={{ overflowY:"auto",flex:1,padding:"0 20px 40px",display:"flex",flexDirection:"column",gap:14 }}>
          {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:16,color:DANGER }}>{err}</div>}
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Qué necesitas *</p>
            <input className="inp" placeholder="Ej: Bomba hidráulica Rexroth A10V..." value={f.title} maxLength={200} onChange={e=>upd("title",e.target.value)}/>
          </div>
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Industria / Categoría</p>
            <select className="inp" value={f.cat} onChange={e=>upd("cat",e.target.value)}>
              {CATS.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Marca</p>
              <input className="inp" placeholder="Ej: Caterpillar" value={f.brand} maxLength={100} onChange={e=>upd("brand",e.target.value)}/>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Modelo</p>
              <input className="inp" placeholder="Ej: 320D" value={f.model} maxLength={100} onChange={e=>upd("model",e.target.value)}/>
            </div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° Parte</p>
              <input className="inp" placeholder="Ej: 3306-A" value={f.part_number} maxLength={100} onChange={e=>upd("part_number",e.target.value)}/>
            </div>
            <div>
              <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° Serie</p>
              <input className="inp" placeholder="Ej: SN-00123" value={f.serial_number} maxLength={100} onChange={e=>upd("serial_number",e.target.value)}/>
            </div>
          </div>
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Descripción adicional</p>
            <textarea className="inp" rows={3} placeholder="Detalles relevantes..." value={f.description} maxLength={1000} onChange={e=>upd("description",e.target.value)} style={{ resize:"none" }}/>
          </div>
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Urgencia</p>
            <div style={{ display:"flex",gap:8 }}>
              {URGENCY.map(([val,lbl])=>(
                <button key={val} onClick={()=>upd("urgency",val)}
                  style={{ flex:1,padding:"9px 4px",borderRadius:8,border:`1.5px solid ${f.urgency===val?URGENCY_C[val]:BORDER}`,background:f.urgency===val?`${URGENCY_C[val]}18`:CARD,fontWeight:700,fontSize:16,color:f.urgency===val?URGENCY_C[val]:SUB,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif" }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Presupuesto máximo (opcional)</p>
            <div style={{ display:"flex",gap:8 }}>
              <div style={{ position:"relative",flex:1 }}>
                <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:MUTED }}>$</span>
                <input className="inp" type="number" placeholder="0" value={f.budget} onChange={e=>upd("budget",e.target.value)} style={{ paddingLeft:30 }}/>
              </div>
              <select className="inp" value={f.currency} onChange={e=>upd("currency",e.target.value)} style={{ width:88 }}>
                {["CLP","USD","EUR","COP","PEN","MXN"].map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Ubicación</p>
            <input className="inp" placeholder="Ej: Antofagasta, Chile" value={f.location} maxLength={100} onChange={e=>upd("location",e.target.value)}/>
          </div>
          <button className="btn-red" onClick={save} disabled={loading||!f.title}
            style={{ marginTop:8,opacity:(!f.title||loading)?.5:1,padding:"15px",fontSize:16 }}>
            {loading ? "Guardando…" : "Guardar cambios"}
          </button>

          {/* Delete section */}
          {confirmDel ? (
            <div style={{ marginTop:4,padding:"14px",borderRadius:10,border:`1px solid rgba(220,38,38,.35)`,background:"rgba(220,38,38,.06)" }}>
              <p style={{ fontSize:16,color:TEXT,marginBottom:10,textAlign:"center" }}>¿Seguro que quieres eliminar esta solicitud?</p>
              <div style={{ display:"flex",gap:8 }}>
                <button onClick={()=>setConfirmDel(false)} disabled={deleting}
                  style={{ flex:1,padding:"12px",borderRadius:8,border:`1px solid ${BORDER}`,background:"transparent",color:MUTED,fontSize:16,cursor:"pointer",fontWeight:600 }}>
                  Cancelar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  style={{ flex:1,padding:"12px",borderRadius:8,border:"none",background:DANGER,color:"#fff",fontSize:16,cursor:"pointer",fontWeight:700 }}>
                  {deleting?"Eliminando…":"Sí, eliminar"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setConfirmDel(true)}
              style={{ marginTop:4,padding:"13px",borderRadius:8,border:`1px solid rgba(220,38,38,.35)`,background:"transparent",color:DANGER,fontSize:16,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,width:"100%" }}>
              <Ic n="trash" s={15} c={DANGER}/>Eliminar solicitud
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SolicitudSheet({ user, profile, onClose, onDone }) {
  const { t } = useLang();
  const { handleProps, sheetStyle } = useSwipeToClose(onClose);
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [err,          setErr]          = useState("");
  const [matchCount,   setMatchCount]   = useState(0);
  const [showMatchAlert,setShowMatchAlert] = useState(false);
  const [done,    setDone]    = useState(false);
  const [solicitudMatches, setSolicitudMatches] = useState(0);
  const [instantResults, setInstantResults] = useState([]);
  const [viewListing, setViewListing] = useState(null);
  const [notif,   setNotif]   = useState({ email:true, whatsapp:false, inapp:true });
  const [f, setF] = useState({
    title:"", brand:"", model:"", cat:"all",
    serial_number:"", part_number:"", engine_number:"", chassis_number:"",
    hours:"", condition:"", description:"",
    location: profile?.location||"",
    phone:    profile?.phone||"",
    email:    user?.email||"",
    budget:"", currency:"CLP",
    urgency:"normal",
  });
  const upd = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleNotif = k => setNotif(p=>({...p,[k]:!p[k]}));

  const URGENCY = [["normal",t("sol_urgent_normal")],["urgente",t("sol_urgent_urgent")],["critico",t("sol_urgent_critical")]];
  const URGENCY_C = { normal:BLUE, urgente:GOLD, critico:RED };

  const submit = async () => {
    if (!f.title) { setErr(t("sol_no_title")); return; }
    setLoading(true); setErr("");

    // 1. Búsqueda instantánea por texto entre publicaciones existentes
    try {
      const terms = [f.title, f.brand, f.model, f.part_number, f.serial_number, f.engine_number]
        .filter(Boolean).map(s=>s.toLowerCase().trim()).filter(s=>s.length>1);

      let query = sb.from("listings").select("*").neq("user_id", user.id);
      if (f.cat !== "all") query = query.eq("cat", f.cat);
      const { data: candidates } = await query.limit(100);

      if (candidates?.length && terms.length) {
        const scored = candidates.map(l => {
          const text = [l.title, l.brand, l.model, l.part_number, l.serial_number, l.engine_number, l.description]
            .filter(Boolean).join(" ").toLowerCase();
          const hits = terms.filter(term => text.includes(term)).length;
          return { listing: l, hits };
        }).filter(x => x.hits > 0)
          .sort((a,b)=>b.hits-a.hits)
          .slice(0,6)
          .map(x=>x.listing);
        setInstantResults(scored);
      }
    } catch(_) {}

    const { data:inserted, error: insertErr } = await sb.from("requests").insert({
      user_id:     user.id,
      title:       f.title,
      brand:       f.brand||null,
      model:       f.model||null,
      cat:         f.cat,
      serial_number:  f.serial_number||null,
      part_number:    f.part_number||null,
      engine_number:  f.engine_number||null,
      chassis_number: f.chassis_number||null,
      hours:       f.hours ? Number(f.hours) : null,
      condition:   f.condition||null,
      description: f.description||null,
      location:    f.location||null,
      phone:       f.phone||null,
      email:       f.email||null,
      budget:      f.budget ? Number(f.budget) : null,
      currency:    f.currency,
      urgency:     f.urgency,
      notif_email:     notif.email,
      notif_whatsapp:  notif.whatsapp,
      notif_inapp:     notif.inapp,
      biz:         profile?.biz||null,
    }).select().single();
    setLoading(false);

    if (insertErr) {
      console.error("Error al crear solicitud:", insertErr);
      setErr(`Error al enviar solicitud: ${insertErr.message}`);
      return;
    }

    // Run match engine in background
    if (inserted) {
      runMatchEngine(inserted, "request", user, profile).then(async matches => {
        for (const match of matches) {
          await notifyMatch(match, inserted, "request", user, profile);
        }
        if (matches.length > 0) {
          setSolicitudMatches(matches.length);
        }
      });
    }
    setDone(true);
    setTimeout(()=>{ onDone(); }, 3000);
  };

  const INP = { background:"rgba(255,255,255,.07)", border:"1.5px solid rgba(255,255,255,.15)", borderRadius:8, padding:"11px 14px", fontSize:16, color:TEXT, width:"100%", outline:"none", fontFamily:"inherit", transition:"border-color .2s" };

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:80,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:0 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#171D24",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:580,maxHeight:"92dvh",display:"flex",flexDirection:"column",border:`1px solid rgba(255,106,0,.4)`,boxShadow:"0 24px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(255,106,0,.15)",overflow:"hidden",...sheetStyle }}>

        {/* Drag handle */}
        <div {...handleProps} style={{ display:"flex",justifyContent:"center",padding:"10px 0 2px",cursor:"grab",touchAction:"none",background:"#171D24" }}>
          <div style={{ width:36,height:4,background:"rgba(255,255,255,.3)",borderRadius:2 }}/>
        </div>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${RED},#C26800)`,padding:"18px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <div>
            <p className="bebas" style={{ fontSize:24,color:"#fff",letterSpacing:.5 }}>{t("sol_title")}</p>
            <p style={{ fontSize:16,color:"rgba(255,255,255,.75)",marginTop:2 }}>{t("sol_subtitle")}</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",color:"#fff",fontSize:18,lineHeight:1,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {done ? (
          <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:"48px 24px",textAlign:"center" }}>
            <div style={{ width:72,height:72,background:"rgba(34,197,94,.15)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${GREEN}` }}>
              <Ic n="check" s={32} c={GREEN}/>
            </div>
            <p className="bebas" style={{ fontSize:28,color:TEXT }}>¡Solicitud enviada!</p>

            {instantResults.length > 0 && (
              <div style={{ width:"100%", maxWidth:480, textAlign:"left" }}>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT,marginBottom:10,textAlign:"center" }}>
                  📦 Encontramos {instantResults.length} publicación{instantResults.length>1?"es":""} que podría{instantResults.length>1?"n":""} interesarte:
                </p>
                <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                  {instantResults.map(l=>(
                    <div key={l.id} onClick={()=>setViewListing(l)}
                      style={{ display:"flex",alignItems:"center",gap:12,background:BG2,borderRadius:10,padding:"10px 12px",border:`1px solid ${BORDER}`,cursor:"pointer",transition:"border-color .15s" }}>
                      {l.photos?.length>0 ? (
                        <img src={l.photos[0]} alt="" style={{ width:48,height:48,borderRadius:8,objectFit:"cover",flexShrink:0 }}/>
                      ) : (
                        <div style={{ width:48,height:48,borderRadius:8,background:BG3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{l.emoji||"📦"}</div>
                      )}
                      <div style={{ flex:1,minWidth:0 }}>
                        <p style={{ fontSize:16,fontWeight:700,color:TEXT,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{l.title}</p>
                        <p style={{ fontSize:16,color:RED,fontWeight:700 }}>{l.currency} {Number(l.price).toLocaleString()}</p>
                      </div>
                      <Ic n="chevR" s={16} c={MUTED}/>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {solicitudMatches > 0 ? (
              <div style={{ background:"rgba(255,106,0,.1)",border:"1px solid rgba(255,106,0,.3)",borderRadius:12,padding:"16px 20px",maxWidth:320 }}>
                <p className="bebas" style={{ fontSize:22,color:RED,marginBottom:6 }}>🤝 {solicitudMatches} MATCH{solicitudMatches>1?"ES":""} ENCONTRADO{solicitudMatches>1?"S":""}</p>
                <p style={{ fontSize:16,color:TEXT,lineHeight:1.6 }}>¡Hay publicaciones que coinciden con tu búsqueda! Revisá tus mensajes para ver los contactos automáticos.</p>
              </div>
            ) : (
              <p style={{ fontSize:16,color:MUTED,lineHeight:1.7 }}>
                Analizando el catálogo con IA… Te notificaremos por {[notif.email&&"email",notif.whatsapp&&"WhatsApp",notif.inapp&&"la app"].filter(Boolean).join(", ")} cuando haya un match.
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowY:"auto",flex:1,padding:"24px" }}>
            {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:16,color:DANGER,marginBottom:16 }}>{err}</div>}

            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

              {/* Título */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>¿Qué estás buscando? *</p>
                <input style={{ ...INP,borderColor:f.title?"rgba(255,106,0,.4)":BORDER }} placeholder="Ej: Motor CAT 3406E, Bomba Rexroth A10V…" value={f.title} maxLength={200} onChange={e=>upd("title",e.target.value)}/>
              </div>

              {/* Industria + Marca */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Industria</p>
                  <select style={{ ...INP }} value={f.cat} onChange={e=>upd("cat",e.target.value)}>
                    {CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Marca <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                  <input style={{ ...INP }} placeholder="Caterpillar, SKF, WEG…" value={f.brand} maxLength={100} onChange={e=>upd("brand",e.target.value)}/>
                </div>
              </div>

              {/* Modelo */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Modelo <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input style={{ ...INP }} placeholder="Ej: 3406E, A10V, 6205-2RS…" value={f.model} maxLength={100} onChange={e=>upd("model",e.target.value)}/>
              </div>

              {/* Números técnicos */}
              <div style={{ background:BG2,borderRadius:10,padding:"14px 16px",border:`1px solid ${BORDER}` }}>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:12,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Números de identificación <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0 }}>(opcionales)</span></p>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {[["serial_number","N° de Serie","Nº serie del equipo"],["part_number","N° de Parte","Part number"],["engine_number","N° de Motor","Nº motor"],["chassis_number","N° de Chasis","Nº chasis"]].map(([key,label,ph])=>(
                    <div key={key} style={{ display:"grid",gridTemplateColumns:"120px 1fr",alignItems:"center",gap:10 }}>
                      <p style={{ fontSize:16,color:MUTED }}>{label}</p>
                      <input style={{ ...INP,padding:"8px 12px" }} placeholder={ph} value={f[key]} maxLength={100} onChange={e=>upd(key,e.target.value)}/>
                    </div>
                  ))}
                  <div style={{ display:"grid",gridTemplateColumns:"120px 1fr",alignItems:"center",gap:10 }}>
                    <p style={{ fontSize:16,color:MUTED }}>Horas de uso</p>
                    <input style={{ ...INP,padding:"8px 12px" }} type="number" placeholder="Máx aceptable" value={f.hours} onChange={e=>upd("hours",e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Condición */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Condición aceptada <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <select style={{ ...INP }} value={f.condition} onChange={e=>upd("condition",e.target.value)}>
                  <option value="">Cualquier condición</option>
                  {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Descripción adicional <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <textarea style={{ ...INP,resize:"none" }} rows={3} placeholder="Compatibilidad, aplicación, urgencia, detalles técnicos…" value={f.description} maxLength={1000} onChange={e=>upd("description",e.target.value)}/>
              </div>

              {/* Presupuesto */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Presupuesto máximo <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <div style={{ display:"flex",gap:8 }}>
                  <div style={{ position:"relative",flex:1 }}>
                    <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:MUTED }}>$</span>
                    <input style={{ ...INP,paddingLeft:28 }} type="number" placeholder="0" value={f.budget} onChange={e=>upd("budget",e.target.value)}/>
                  </div>
                  <select style={{ ...INP,width:88 }} value={f.currency} onChange={e=>upd("currency",e.target.value)}>
                    {["CLP","USD","EUR"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Urgencia */}
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Urgencia</p>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {URGENCY.map(([val,label])=>(
                    <div key={val} onClick={()=>upd("urgency",val)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${f.urgency===val?URGENCY_C[val]:BORDER}`,background:f.urgency===val?`rgba(${val==="critico"?"255,106,0":val==="urgente"?"245,158,11":"59,130,246"},.15)`:"rgba(255,255,255,.04)",cursor:"pointer",transition:"all .15s" }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:URGENCY_C[val],flexShrink:0 }}/>
                      <p style={{ fontSize:16,fontWeight:f.urgency===val?700:400,color:f.urgency===val?TEXT:SUB }}>{label}</p>
                      {f.urgency===val&&<span style={{ marginLeft:"auto",fontSize:16,color:URGENCY_C[val] }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ubicación + contacto */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Ciudad / Región</p>
                  <input style={{ ...INP }} placeholder="Santiago, Antofagasta…" value={f.location} onChange={e=>upd("location",e.target.value)}/>
                </div>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>WhatsApp</p>
                  <input style={{ ...INP }} placeholder="+1 555 1234 / +56 9 1234" value={f.phone} onChange={e=>upd("phone",e.target.value)}/>
                </div>
              </div>

              {/* Notificaciones */}
              <div style={{ background:BG2,borderRadius:10,padding:"16px",border:`1px solid ${BORDER}` }}>
                <p style={{ fontSize:16,fontWeight:700,color:MUTED,marginBottom:12,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>¿Cómo querés recibir el aviso?</p>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {[["email","📧","Email",user?.email||""],["whatsapp","💬","WhatsApp",f.phone||"Agrega tu número arriba"],["inapp","🔔","Notificación en la app","Cuando estés conectado"]].map(([key,icon,label,sub])=>(
                    <div key={key} onClick={()=>toggleNotif(key)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${notif[key]?RED:BORDER}`,background:notif[key]?"rgba(255,106,0,.2)":"rgba(255,255,255,.04)",cursor:"pointer",transition:"all .15s" }}>
                      <span style={{ fontSize:18,flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:16,fontWeight:notif[key]?700:400,color:notif[key]?TEXT:SUB }}>{label}</p>
                        <p style={{ fontSize:16,color:MUTED }}>{sub}</p>
                      </div>
                      <div style={{ width:20,height:20,borderRadius:4,border:`2px solid ${notif[key]?RED:BORDER}`,background:notif[key]?RED:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {notif[key]&&<Ic n="check" s={12} c="#fff"/>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button className="btn-red" onClick={submit} disabled={loading||!f.title} style={{ padding:"15px",fontSize:16,opacity:(!f.title||loading)?.5:1,marginTop:4 }}>
                {loading ? <Spin/> : t("sol_submit")}
              </button>
              <p style={{ textAlign:"center",fontSize:16,color:MUTED,marginTop:-8 }}>Te avisamos en cuanto alguien publique lo que buscás</p>
            </div>
          </div>
        )}
      </div>
      {viewListing && (
        <ListingDetail l={viewListing} onClose={()=>setViewListing(null)} user={user}/>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   MOBILE TAB BAR
══════════════════════════════════════════════════════════════ */
function MobileTabBar({ tab, setTab, onPublish, session, onGuestAction }) {
  const { t } = useLang();
  const TABS = [
    { id:"search",  icon:"home",  key:"nav_explore", label:"Explorar" },
    { id:"publish", icon:"plus",  key:"nav_publish", accent:true, needsAuth:true },
    { id:"matches", icon:"check", key:"nav_matches", label:"Matches", needsAuth:true },
    { id:"messages",icon:"msg",   key:"nav_messages", needsAuth:true },
    { id:"profile", icon:"user",  key:"nav_my_profile", needsAuth:true },
  ];
  return (
    <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:"rgba(20,22,24,.97)",backdropFilter:"blur(20px)",borderTop:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"6px 0 calc(12px + env(safe-area-inset-bottom))" }}>
      {TABS.map(tb=>(
        <button key={tb.id} onClick={()=>{
            if(tb.needsAuth && !session){ onGuestAction?.(); return; }
            if(tb.id==="publish"){onPublish();return;}
            setTab(tb.id);
          }}
          style={{ flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 2px",background:"none",border:"none",cursor:"pointer",opacity:(tb.needsAuth&&!session)?.45:1 }}>
          <div style={{ width:34,height:34,borderRadius:tb.accent?12:10,background:tb.accent?RED:tab===tb.id?"rgba(255,106,0,.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0 }}>
            <Ic n={tb.icon} s={19} c={tb.accent?"#fff":tab===tb.id?RED:MUTED}/>
          </div>
          <span style={{ fontSize:11,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.2,color:tb.accent?RED:tab===tb.id?RED:MUTED,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%" }}>{tb.label||t(tb.key)}</span>
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ADMIN PANEL — solo visible para is_admin
══════════════════════════════════════════════════════════════ */
function AdminPanel({ user }) {
  const [section, setSection] = useState("users"); // users | listings | requests | matches | messages
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [editing, setEditing] = useState(null);

  const TABLES = {
    users:    { table:"profiles",  label:"Usuarios",      titleField:"name" },
    listings: { table:"listings",  label:"Publicaciones", titleField:"title" },
    requests: { table:"requests",  label:"Solicitudes",   titleField:"title" },
    matches:  { table:"matches",   label:"Matches",       titleField:"reason" },
    messages: { table:"messages",  label:"Mensajes",      titleField:"body" },
  };

  const load = useCallback(async ()=>{
    setLoading(true);
    const cfg = TABLES[section];
    const orderCol = section==="users" ? "name" : "created_at";
    const { data: rows, error } = await sb.from(cfg.table).select("*").order(orderCol, { ascending:false }).limit(200);
    if (error) { console.error(error); setData([]); }
    else setData(rows||[]);
    setLoading(false);
  }, [section]);

  useEffect(()=>{ load(); }, [load]);

  const handleDelete = async (id) => {
    const cfg = TABLES[section];
    const { error } = await sb.from(cfg.table).delete().eq("id", id);
    if (error) { alert("No se pudo borrar: " + error.message); return; }
    setData(prev => prev.filter(r => r.id !== id));
    setConfirmDel(null);
  };

  const cfg = TABLES[section];
  const filtered = data.filter(row => {
    if (!search) return true;
    const hay = JSON.stringify(row).toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
        <h2 className="bebas" style={{ fontSize:28, color:RED }}>⚙ Panel de Administración</h2>
      </div>
      <p style={{ color:MUTED, fontSize:16, marginBottom:20 }}>Gestión de contenido y usuarios de PortalMaquinas. Usa con cuidado — los cambios son permanentes.</p>

      {/* Section tabs */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {Object.entries(TABLES).map(([key,c])=>(
          <button key={key} onClick={()=>{ setSection(key); setSearch(""); setConfirmDel(null); }}
            style={{ padding:"8px 16px", borderRadius:8, border:`1.5px solid ${section===key?RED:BORDER}`, background:section===key?"rgba(255,106,0,.1)":CARD, color:section===key?RED:SUB, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase" }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-bar" style={{ marginBottom:16 }}>
        <Ic n="search" s={16} c={MUTED}/>
        <input placeholder={`Buscar en ${cfg.label.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}/>
        {search && <button className="btn-ghost" style={{ padding:"2px 4px" }} onClick={()=>setSearch("")}><Ic n="x" s={16} c={MUTED}/></button>}
      </div>

      <p style={{ fontSize:15, color:MUTED, marginBottom:12 }}>{filtered.length} {cfg.label.toLowerCase()}</p>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", paddingTop:40 }}><Spin size={28}/></div>
      ) : filtered.length === 0 ? (
        <div style={{ background:CARD, borderRadius:12, padding:40, textAlign:"center", border:`1px solid ${BORDER}` }}>
          <p style={{ color:MUTED, fontSize:16 }}>Sin resultados</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(row=>(
            <div key={row.id} style={{ background:CARD, borderRadius:10, padding:"12px 14px", border:`1px solid ${BORDER}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  {/* Primary line */}
                  <p style={{ fontSize:16, fontWeight:700, color:TEXT, marginBottom:3 }}>
                    {section==="users"   && (row.name || row.biz || "(sin nombre)")}
                    {section==="listings"&& row.title}
                    {section==="requests"&& row.title}
                    {section==="matches" && `Match (score ${row.score||"—"})`}
                    {section==="messages"&& (row.body?.slice(0,80) || "(vacío)")}
                  </p>
                  {/* Secondary line */}
                  <p style={{ fontSize:14, color:MUTED, wordBreak:"break-all" }}>
                    {section==="users"   && `${row.biz||"—"} · ${row.location||"—"} · ${row.phone||"sin tel"}`}
                    {section==="listings"&& `${row.biz||"—"} · ${fmtPrice(row.price,row.currency)} · ${row.location||"—"}`}
                    {section==="requests"&& `${row.brand||"—"} ${row.model||""} · ${row.location||"—"}`}
                    {section==="matches" && `${row.reason||"—"}`}
                    {section==="messages"&& `${fmtTs(row.created_at)}`}
                  </p>
                  <p style={{ fontSize:12, color:MUTED, marginTop:3, fontFamily:"monospace" }}>id: {row.id}</p>
                </div>
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  {/* Edit only for content tables */}
                  {(section==="listings"||section==="requests"||section==="users") && (
                    <button onClick={()=>setEditing(row)}
                      style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${BORDER}`, background:BG2, color:TEXT, fontSize:14, cursor:"pointer", fontWeight:600 }}>
                      Editar
                    </button>
                  )}
                  {confirmDel===row.id ? (
                    <>
                      <button onClick={()=>setConfirmDel(null)}
                        style={{ padding:"6px 10px", borderRadius:7, border:`1px solid ${BORDER}`, background:"transparent", color:MUTED, fontSize:14, cursor:"pointer", fontWeight:600 }}>
                        No
                      </button>
                      <button onClick={()=>handleDelete(row.id)}
                        style={{ padding:"6px 10px", borderRadius:7, border:"none", background:DANGER, color:"#fff", fontSize:14, cursor:"pointer", fontWeight:700 }}>
                        Confirmar
                      </button>
                    </>
                  ) : (
                    <button onClick={()=>setConfirmDel(row.id)}
                      style={{ padding:"6px 12px", borderRadius:7, border:`1px solid rgba(220,38,38,.35)`, background:"rgba(220,38,38,.06)", color:DANGER, fontSize:14, cursor:"pointer", fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
                      <Ic n="trash" s={13} c={DANGER}/>Borrar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <AdminEditModal
          row={editing}
          table={cfg.table}
          onClose={()=>setEditing(null)}
          onSaved={updated=>{ setData(prev=>prev.map(r=>r.id===updated.id?updated:r)); setEditing(null); }}
        />
      )}
    </div>
  );
}

// Modal genérico para editar campos de cualquier tabla (admin)
function AdminEditModal({ row, table, onClose, onSaved }) {
  // Editable fields per table (avoid editing ids, timestamps, foreign keys)
  const FIELDS = {
    profiles: ["name","biz","phone","location"],
    listings: ["title","brand","model","price","currency","condition","location","description"],
    requests: ["title","brand","model","location","description","budget","currency"],
  };
  const fields = FIELDS[table] || [];
  const [f, setF] = useState(()=>{ const o={}; fields.forEach(k=>o[k]=row[k]??""); return o; });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const upd = (k,v)=>setF(p=>({...p,[k]:v}));

  const save = async ()=>{
    setLoading(true); setErr("");
    const payload = {};
    fields.forEach(k=>{ payload[k] = f[k]===""?null:f[k]; });
    if (payload.price)  payload.price  = Number(payload.price);
    if (payload.budget) payload.budget = Number(payload.budget);
    const { data, error } = await sb.from(table).update(payload).eq("id", row.id).select().single();
    setLoading(false);
    if (error) { setErr("No se pudo guardar: " + error.message); return; }
    onSaved(data);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{ background:BG, borderRadius:16, maxWidth:520, width:"100%", maxHeight:"88vh", overflowY:"auto", border:`1px solid ${BORDER2}` }}>
        <div style={{ padding:"18px 20px", borderBottom:`1px solid ${BORDER}`, display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, background:BG }}>
          <h3 className="bebas" style={{ fontSize:22, color:TEXT }}>Editar (admin)</h3>
          <button className="btn-ghost" onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>
        <div style={{ padding:"20px", display:"flex", flexDirection:"column", gap:14 }}>
          {err && <div style={{ background:"rgba(220,38,38,.08)", border:"1px solid rgba(220,38,38,.25)", borderRadius:8, padding:"10px 14px", fontSize:15, color:DANGER }}>{err}</div>}
          {fields.map(k=>(
            <div key={k}>
              <p style={{ fontSize:14, fontWeight:700, color:MUTED, marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>{k}</p>
              {k==="description" ? (
                <textarea className="inp" rows={3} value={f[k]} onChange={e=>upd(k,e.target.value)} style={{ resize:"none" }}/>
              ) : (
                <input className="inp" value={f[k]} onChange={e=>upd(k,e.target.value)}/>
              )}
            </div>
          ))}
          <button className="btn-red" onClick={save} disabled={loading} style={{ padding:"14px", fontSize:16, opacity:loading?.5:1 }}>
            {loading ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE LAYOUT
══════════════════════════════════════════════════════════════ */
function MobileLayout({ tab, setTab, session, profile, selected, setSelected, chatListing, setChatListing, openChat, logout, region, setRegion, guestMode, guestSearch, onGuestLogin, onGuestRegister }) {
  const { t, lang, setLang } = useLang();
  const [showPublish,   setShowPublish]   = useState(false);
  const [showBulkUpload,setShowBulkUpload]= useState(false);
  const [showSupport,   setShowSupport]   = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const unreadCount = useUnreadCount(session?.user?.id);

  // El botón "atrás" del navegador cierra los paneles abiertos
  useBackButton(showPublish,   ()=>setShowPublish(false));
  useBackButton(showBulkUpload,()=>setShowBulkUpload(false));
  useBackButton(showSolicitud, ()=>setShowSolicitud(false));
  useBackButton(showSupport,   ()=>setShowSupport(false));
  useBackButton(menuOpen,      ()=>setMenuOpen(false));

  // Menú hamburguesa: navegación y acciones
  const goHome    = ()=>{ setMenuOpen(false); setSelected(null); setChatListing(null); setTab("search"); };
  const goExplore = ()=>{ setSelected(null); setChatListing(null); setTab("search"); };
  const onSell    = ()=> session ? setShowPublish(true)   : onGuestRegister();
  const onRequest = ()=> session ? setShowSolicitud(true) : onGuestRegister();
  const MENU_NAV = [
    { key:"nav_sell",     action:onSell },
    { key:"nav_buy",      action:goExplore },
    { key:"nav_requests", action:onRequest },
    { key:"nav_services", action:goExplore },
    { key:"nav_rentals",  action:goExplore },
  ];
  const closeAnd = fn => { setMenuOpen(false); fn?.(); };

  useEffect(()=>{
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (menuOpen)      { setMenuOpen(false);      return; }
      if (showPublish)   { setShowPublish(false);   return; }
      if (showSolicitud) { setShowSolicitud(false); return; }
      if (showSupport)   { setShowSupport(false);   return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, showPublish, showSolicitud, showSupport]);

  return (
    <div style={{ background:BG, minHeight:"100dvh", color:TEXT }}>
      <style>{CSS_BASE}</style><style>{CSS_OVERRIDE}</style>

      {/* Mobile header: izquierda isotipo · centro wordmark · derecha hamburguesa */}
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:50,background:"rgba(20,22,24,.97)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${BORDER}`,padding:"calc(8px + env(safe-area-inset-top)) 12px 8px" }}>
        <div style={{ display:"flex",alignItems:"center",gap:8,minHeight:44 }}>
          <SpartsLogo size={32} icon onClick={goHome}/>
          <div onClick={goHome} style={{ flex:1,textAlign:"center",fontFamily:"Barlow,sans-serif",fontWeight:800,fontSize:19,letterSpacing:-0.3,lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",cursor:"pointer" }}>
            <span style={{ color:TEXT }}>Portal</span><span style={{ color:RED }}>Maquinas</span>
          </div>
          <button onClick={()=>setMenuOpen(o=>!o)} aria-label="Menú"
            style={{ width:44,height:44,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${BORDER2}`,borderRadius:8,cursor:"pointer" }}>
            <Ic n={menuOpen?"x":"menu"} s={22} c={TEXT}/>
          </button>
        </div>
      </div>

      {/* Menú hamburguesa (dropdown) */}
      {menuOpen && (
        <>
          <div onClick={()=>setMenuOpen(false)} style={{ position:"fixed",inset:0,zIndex:60,background:"rgba(0,0,0,.55)" }}/>
          <div style={{ position:"fixed",top:"calc(60px + env(safe-area-inset-top))",left:0,right:0,zIndex:61,background:BG3,borderBottom:`1px solid ${BORDER}`,boxShadow:"0 16px 40px rgba(0,0,0,.55)",padding:"10px 14px calc(16px + env(safe-area-inset-bottom))",display:"flex",flexDirection:"column",gap:6,maxHeight:"calc(100dvh - 60px)",overflowY:"auto" }}>
            {MENU_NAV.map(b=>(
              <button key={b.key} onClick={()=>closeAnd(b.action)}
                style={{ width:"100%",minHeight:48,padding:"0 16px",textAlign:"left",background:BG2,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:10,fontSize:16,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center" }}>
                {t(b.key)}
              </button>
            ))}
            <div style={{ height:1,background:BORDER,margin:"4px 0" }}/>
            {!session && (
              <>
                <button onClick={()=>closeAnd(onGuestLogin)}
                  style={{ width:"100%",minHeight:48,background:"transparent",border:`1.5px solid ${BORDER2}`,borderRadius:10,fontSize:15,fontWeight:700,color:TEXT,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
                  {t("nav_signin")}
                </button>
                <button onClick={()=>closeAnd(onGuestRegister)}
                  style={{ width:"100%",minHeight:48,background:RED,border:"none",borderRadius:10,fontSize:15,fontWeight:700,color:"#fff",cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
                  {t("nav_signup")}
                </button>
              </>
            )}
            {/* Selector de idioma */}
            <div style={{ display:"flex",alignItems:"center",padding:"6px 4px" }}>
              <span style={{ fontSize:14,color:MUTED,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>Idioma</span>
              <div style={{ display:"flex",marginLeft:"auto",border:`1px solid ${BORDER2}`,borderRadius:8,overflow:"hidden" }}>
                {["es","en"].map(l=>(
                  <button key={l} onClick={()=>setLang(l)}
                    style={{ minHeight:44,padding:"0 18px",background:lang===l?RED:"transparent",color:lang===l?"#fff":TEXT,border:"none",cursor:"pointer",fontSize:15,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5 }}>
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            {profile?.is_admin && (
              <button onClick={()=>closeAnd(()=>setTab("admin"))}
                style={{ width:"100%",minHeight:48,padding:"0 16px",textAlign:"left",background:BG2,color:TEXT,border:`1px solid ${BORDER}`,borderRadius:10,fontSize:16,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:8 }}>
                ⚙ Admin
              </button>
            )}
            {session && (
              <button onClick={()=>closeAnd(logout)}
                style={{ width:"100%",minHeight:48,background:"transparent",border:`1px solid ${RED}`,borderRadius:10,fontSize:15,fontWeight:700,color:RED,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                <Ic n="logout" s={16} c={RED}/>{t("nav_logout")}
              </button>
            )}
          </div>
        </>
      )}

      {/* Page content */}
      <div style={{ paddingTop: `calc(64px + env(safe-area-inset-top))`, paddingBottom:90, ...((tab==="messages"||tab==="profile") ? {} : { paddingLeft:14, paddingRight:14 }) }}>
        {tab==="search"  &&<SearchPage  user={session?.user||null} onSelect={setSelected} region={region} initQ={guestSearch}/>}
        {tab==="matches" &&session&&<MatchesPage user={session.user} onSelect={setSelected} onChat={openChat}/>}
        {tab==="messages"&&session&&<MessagesPage user={session.user} initListing={chatListing} onClear={()=>setChatListing(null)}/>}
        {tab==="profile" &&session&&<ProfilePage  user={session.user} profile={profile} onLogout={logout}/>}
        {tab==="mispubs" &&session&&<MisPublicaciones user={session.user} onSelect={setSelected}/>}
        {tab==="missolicitudes" &&session&&<MisPublicaciones key="msols" user={session.user} onSelect={setSelected} initSubTab="solicitudes"/>}
        {tab==="admin" &&session&&profile?.is_admin&&<AdminPanel user={session.user}/>}
      </div>

      {/* Bottom tab bar */}
      <MobileTabBar tab={tab} setTab={setTab} onPublish={()=>setShowPublish(true)} session={session} onGuestAction={onGuestRegister}/>

      {selected&&<ListingDetail l={selected} user={session?.user||null} onClose={()=>setSelected(null)} onChat={openChat} onDeleted={()=>setSelected(null)} onEdited={updated=>setSelected(updated)} onRequireAuth={onGuestRegister}/>}
      {showPublish&&session&&<PublishSheet user={session.user} profile={profile} onClose={()=>setShowPublish(false)} onDone={()=>setShowPublish(false)} onBulkUpload={()=>setShowBulkUpload(true)}/>}
      {showBulkUpload&&session&&<BulkUploadSheet user={session.user} profile={profile} onClose={()=>setShowBulkUpload(false)} onDone={()=>setShowBulkUpload(false)}/>}
      {showSupport&&<SupportPanel onClose={()=>setShowSupport(false)}/>}
      {showSolicitud&&session&&<SolicitudSheet user={session.user} profile={profile} onClose={()=>setShowSolicitud(false)} onDone={()=>setShowSolicitud(false)}/>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════
   DESKTOP LAYOUT
══════════════════════════════════════════════════════════════ */
function DesktopLayout({ tab, setTab, session, profile, selected, setSelected, chatListing, setChatListing, openChat, logout, region, setRegion, guestMode, guestSearch, onGuestLogin, onGuestRegister }) {
  const { t, lang, setLang } = useLang();
  const [showPublish,   setShowPublish]   = useState(false);
  const [showBulkUpload,setShowBulkUpload]= useState(false);
  const [showSupport,   setShowSupport]   = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);
  const unreadCount = useUnreadCount(session?.user?.id);

  // El botón "atrás" del navegador cierra los paneles abiertos
  useBackButton(showPublish,   ()=>setShowPublish(false));
  useBackButton(showBulkUpload,()=>setShowBulkUpload(false));
  useBackButton(showSolicitud, ()=>setShowSolicitud(false));
  useBackButton(showSupport,   ()=>setShowSupport(false));

  useEffect(()=>{
    const onKey = e => {
      if (e.key !== "Escape") return;
      if (showPublish)   { setShowPublish(false);   return; }
      if (showSolicitud) { setShowSolicitud(false); return; }
      if (showSupport)   { setShowSupport(false);   return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPublish, showSolicitud, showSupport]);

  const SIDEBAR = [
    { id:"search",      icon:"home",    key:"nav_explore" },
    { id:"matches",     icon:"check",   key:"nav_matches", label:"Matches" },
    { id:"messages",    icon:"msg",     key:"nav_messages", badge:true },
    { id:"mispubs",     icon:"box",     key:"nav_my_listings" },
    { id:"missolicitudes", icon:"search", key:"nav_my_requests", label:"Mis Solicitudes" },
    { id:"profile",     icon:"user",    key:"nav_my_profile" },
    { id:"soporte",     icon:"msg",     key:"nav_support" },
    ...(profile?.is_admin ? [{ id:"admin", icon:"settings", key:"nav_admin", label:"⚙ Admin" }] : []),
  ];

  const goExplore = ()=>{ setSelected(null); setChatListing(null); setTab("search"); };
  const onSell    = ()=> session ? setShowPublish(true)   : onGuestRegister();
  const onRequest = ()=> session ? setShowSolicitud(true) : onGuestRegister();
  const centerBtn = { background:"transparent", color:RED, border:`1.5px solid ${RED}`, borderRadius:7, padding:"8px 13px", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, textTransform:"uppercase", transition:"all .15s", whiteSpace:"nowrap" };
  const CENTER_NAV = [
    { key:"nav_sell",     action:onSell },
    { key:"nav_buy",      action:goExplore },
    { key:"nav_requests", action:onRequest },
    { key:"nav_services", action:goExplore },
    { key:"nav_rentals",  action:goExplore },
  ];

  return (
    <div style={{ minHeight:"100dvh", background:BG, display:"flex", flexDirection:"column" }}>
      <style>{CSS_BASE}</style><style>{CSS_OVERRIDE}</style>

      {/* GLOBAL HEADER */}
      <header style={{ background:BG3, borderBottom:`1px solid ${BORDER}`, position:"sticky", top:0, zIndex:50, padding:"0 28px" }}>
        <div style={{ display:"flex", alignItems:"center", minHeight:64, padding:"8px 0", gap:20 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:2,flexShrink:0 }}>
            <SpartsLogo size={48} onClick={()=>{ setSelected(null); setChatListing(null); setTab("search"); }}/>
            <span style={{ fontSize:13,fontWeight:700,color:RED,letterSpacing:1,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif",paddingLeft:2,whiteSpace:"nowrap" }}>{t("nav_tagline")}</span>
          </div>
          <div style={{ width:1, height:32, background:BORDER }}/>
          {/* Center: 5 nav buttons */}
          <nav style={{ display:"flex", gap:8, flex:1, minWidth:0, alignItems:"center", justifyContent:"center", overflowX:"auto" }}>
            {CENTER_NAV.map(b=>(
              <button key={b.key} onClick={b.action} style={centerBtn}
                onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,106,0,.12)"; }}
                onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
                {t(b.key)}
              </button>
            ))}
          </nav>

          {/* ── Right side: Ingresar/Registrarse (guest) · Language · Log Out (session) ── */}
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {!session && <button onClick={onGuestLogin}
              style={{ background:"transparent", border:`1.5px solid ${BORDER2}`, borderRadius:7, padding:"8px 14px", fontSize:15, fontWeight:700, color:TEXT, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>
              {t("nav_signin")}
            </button>}

            {!session && <button onClick={onGuestRegister}
              style={{ background:RED, border:"none", borderRadius:7, padding:"8px 16px", fontSize:15, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.4, textTransform:"uppercase", whiteSpace:"nowrap" }}>
              {t("nav_signup")}
            </button>}

            {session && <button onClick={logout}
              style={{ background:"none",color:RED,border:`1px solid ${RED}`,borderRadius:7,padding:"8px 12px",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",transition:"all .15s",whiteSpace:"nowrap" }}
              onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,106,0,.12)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="none"; }}>
              <Ic n="logout" s={14} c={RED}/>{t("nav_logout")}
            </button>}
          </div>
        </div>
      </header>

      {/* Guest banner — ancho completo, debajo del header (no dentro de la fila flex) */}
      {guestMode && !session && (
        <div style={{ background:"rgba(255,106,0,.1)", borderBottom:`1px solid rgba(255,106,0,.3)`, padding:"10px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <p style={{ fontSize:16, color:TEXT }}>Estás navegando como <strong style={{ color:RED }}>invitado</strong> — para publicar, contactar vendedores o guardar búsquedas necesitas una cuenta.</p>
          <div style={{ display:"flex", gap:8, flexShrink:0 }}>
            <button onClick={onGuestLogin} style={{ background:"transparent", border:`1.5px solid ${BORDER2}`, borderRadius:7, padding:"7px 16px", fontSize:15, fontWeight:700, color:TEXT, cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.4, textTransform:"uppercase" }}>Iniciar sesión</button>
            <button onClick={onGuestRegister} style={{ background:RED, border:"none", borderRadius:7, padding:"7px 16px", fontSize:15, fontWeight:700, color:"#fff", cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.4, textTransform:"uppercase" }}>Crear cuenta gratis →</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", flex:1, minHeight:0 }}>
        {/* Sidebar */}
        <div style={{ width:180,background:BG3,borderRight:`1px solid ${BORDER}`,position:"sticky",top:84,height:"calc(100vh - 84px)",display:"flex",flexDirection:"column",padding:"12px 0",flexShrink:0,overflowY:"auto" }}>
          <nav style={{ padding:"0 10px",display:"flex",flexDirection:"column",gap:2,flex:1 }}>
            {SIDEBAR.map((n,i)=>(
              <button key={n.id+i}
                className={(n.accent||n.solicitud) ? "" : `sidebar-btn${tab===n.id?" active":""}`}
                onClick={()=>{
                  if (n.id==="publish")   { setShowPublish(true); return; }
                  if (n.id==="soporte")   { setShowSupport(true); return; }
                  if (n.id==="solicitud") { setShowSolicitud(true); return; }
                  setTab(n.id);
                  if (n.id!=="messages") setChatListing(null);
                }}
                style={(n.accent||n.solicitud) ? { display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:16,width:"100%",textAlign:"left",marginTop:6,background:`linear-gradient(135deg,${RED},#C26800)`,color:"#fff",fontWeight:700,fontFamily:"inherit",transition:"all .15s",boxShadow:"0 4px 16px rgba(255,106,0,.35)" } : undefined}>
                <Ic n={n.icon} s={16} c={(n.accent||n.solicitud)?"#fff":tab===n.id?RED:MUTED}/>{n.label||t(n.key)}
                {n.badge&&unreadCount>0&&<span style={{ marginLeft:"auto",background:RED,color:"#fff",fontSize:16,fontWeight:700,borderRadius:10,padding:"2px 7px",fontFamily:"Barlow Condensed,sans-serif" }}>{unreadCount}</span>}
              </button>
            ))}
          </nav>
          {profile&&(
            <div style={{ padding:"14px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:10,alignItems:"center" }}>
              <Avatar name={profile.name||"U"} size={34}/>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{profile.biz||profile.name||"Usuario"}</p>
                <p style={{ fontSize:16,color:MUTED,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{session.user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ flex:1,minWidth:0,overflowY:"auto",padding:"24px 32px 60px" }}>
          {tab==="search"  &&<SearchPage  user={session?.user||null} onSelect={setSelected} region={region} initQ={guestSearch}/>}
          {tab==="matches" &&session&&<MatchesPage user={session.user} onSelect={setSelected} onChat={openChat}/>}
          {tab==="messages"&&session&&<MessagesPage user={session.user} initListing={chatListing} onClear={()=>setChatListing(null)}/>}
          {tab==="profile" &&session&&<ProfilePage  user={session.user} profile={profile} onLogout={logout}/>}
          {tab==="mispubs" &&session&&<MisPublicaciones key="pubs" user={session.user} onSelect={setSelected}/>}
          {tab==="missolicitudes" &&session&&<MisPublicaciones key="sols" user={session.user} onSelect={setSelected} initSubTab="solicitudes"/>}
          {tab==="admin" &&session&&profile?.is_admin&&<AdminPanel user={session.user}/>}
        </div>
      </div>

      {selected&&<ListingDetail l={selected} user={session?.user||null} onClose={()=>setSelected(null)} onChat={openChat} onDeleted={()=>setSelected(null)} onEdited={updated=>setSelected(updated)} onRequireAuth={onGuestRegister}/>}
      {showPublish&&session&&<PublishSheet user={session.user} profile={profile} onClose={()=>setShowPublish(false)} onDone={()=>setShowPublish(false)} onBulkUpload={()=>setShowBulkUpload(true)}/>}
      {showBulkUpload&&session&&<BulkUploadSheet user={session.user} profile={profile} onClose={()=>setShowBulkUpload(false)} onDone={()=>setShowBulkUpload(false)}/>}
      {showSupport&&<SupportPanel onClose={()=>setShowSupport(false)}/>}
      {showSolicitud&&session&&<SolicitudSheet user={session.user} profile={profile} onClose={()=>setShowSolicitud(false)} onDone={()=>setShowSolicitud(false)}/>}


    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════ */
export default function SpartsHub() {
  const isMobile = useIsMobile();
  const [session,      setSession]      = useState(null);
  const [showAuthMode, setShowAuthMode] = useState("landing");
  const [authNotice,   setAuthNotice]   = useState(null);
  const [guestMode,    setGuestMode]    = useState(false);
  const [guestSearch,  setGuestSearch]  = useState("");
  const [profile,      setProfile]      = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [tab,          setTab]          = useState("search");
  const [selected,     setSelected]     = useState(null);
  const [chatListing,  setChatListing]  = useState(null);
  // Idioma: por defecto español; el selector del menú móvil permite cambiarlo y persiste.
  const [lang,         setLangState]    = useState(()=>localStorage.getItem("sh_lang")||"es");
  const [region,       setRegionState]  = useState(()=>localStorage.getItem("sh_region")||"all");

  const setLang = v => { setLangState(v); localStorage.setItem("sh_lang", v); };
  const setRegion = v => { setRegionState(v); localStorage.setItem("sh_region", v); };
  const t = makeT(lang);

  useEffect(()=>{
    sb.auth.getSession().then(({ data })=>{ setSession(data.session); setAuthReady(true); });
    const { data:{ subscription } } = sb.auth.onAuthStateChange((_,s)=>setSession(s));
    return ()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if (!session?.user) { setProfile(null); return; }
    sb.from("profiles").select("*").eq("id",session.user.id).single().then(({ data })=>setProfile(data));
  },[session]);

  const logout   = async ()=>{ await sb.auth.signOut(); setSession(null); };

  /* ── Navegación con historial del navegador ──────────────────────
     Modelo: la navegación de la app es una pila de "vistas". Cada
     avance (cambiar de sección, abrir un detalle o un chat) empuja una
     entrada al historial del navegador. Las flechas atrás/adelante del
     navegador disparan `popstate`, y ahí restauramos exactamente el
     estado que se guardó en esa entrada. Así las flechas recorren los
     pasos dentro de la app en lugar de salir del sitio.

     Guardamos el objeto completo (no solo el id) dentro de history.state,
     para poder re-hidratar el detalle/chat al ir hacia adelante.
  ──────────────────────────────────────────────────────────────── */
  const isPopRef = useRef(false);   // true mientras aplicamos un popstate (no re-empujar)
  const initedRef = useRef(false);

  const openChat = l=>{ if(l.user_id===session?.user?.id) return; setChatListing(l); setTab("messages"); setSelected(null); };

  // Empuja/reemplaza la entrada de historial cuando cambia la navegación
  useEffect(()=>{
    const snap = { sh: true, tab, selected, chatListing };
    if (isPopRef.current) {           // el cambio vino de atrás/adelante: no re-empujar
      isPopRef.current = false;
      return;
    }
    if (!initedRef.current) {         // primer render: reemplaza la entrada inicial
      initedRef.current = true;
      window.history.replaceState(snap, "");
      return;
    }
    window.history.pushState(snap, "");
  }, [tab, selected, chatListing]);

  // Atrás/adelante del navegador → restaura el estado de esa entrada
  useEffect(()=>{
    const onPop = (e) => {
      const snap = e.state;
      if (snap && snap.shOverlay) return;   // entrada de un panel modal: la maneja useBackButton
      isPopRef.current = true;
      if (snap && snap.sh) {
        setTab(snap.tab ?? "search");
        setSelected(snap.selected ?? null);
        setChatListing(snap.chatListing ?? null);
      } else {
        // Entrada inicial sin nuestro estado: volvemos a la vista base
        setSelected(null);
        setChatListing(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return ()=>window.removeEventListener("popstate", onPop);
  }, []);

  if (!authReady) return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
      <div style={{ minHeight:"100dvh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
        <style>{CSS_BASE}</style><style>{CSS_OVERRIDE}</style>
        <SpartsLogo size={36}/><div className="spinner" style={{ width:28,height:28,marginTop:8 }}/>
      </div>
    </LangCtx.Provider>
  );

  if (!session && !guestMode) {
    if (showAuthMode === "landing") return (
      <LangCtx.Provider value={{ lang, setLang, t }}>
        <LandingPage
          onLogin={()=>{ setAuthNotice(null); setShowAuthMode("login"); }}
          onRegister={()=>{ setAuthNotice(null); setShowAuthMode("register"); }}
          onGateRegister={()=>{ setAuthNotice("auth_gate_msg"); setShowAuthMode("register"); }}
          onSearch={q=>{ setGuestSearch(q); setGuestMode(true); setTab("search"); }}
          onEnter={()=>{ setGuestMode(true); setTab("search"); }}
        />
      </LangCtx.Provider>
    );
    return (
      <LangCtx.Provider value={{ lang, setLang, t }}>
        <AuthScreen initialMode={showAuthMode==="register"?"register":"login"} notice={authNotice} onAuth={()=>sb.auth.getSession().then(({ data })=>setSession(data.session))} onBack={()=>{ setAuthNotice(null); setShowAuthMode("landing"); }}/>
      </LangCtx.Provider>
    );
  }

  if (isMobile) return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
    <ToastProvider>
    <MobileLayout
      tab={tab} setTab={setTab} session={session} profile={profile}
      selected={selected} setSelected={setSelected}
      chatListing={chatListing} setChatListing={setChatListing}
      openChat={openChat} logout={logout}
      region={region} setRegion={setRegion}
      guestMode={guestMode} guestSearch={guestSearch}
      onGuestLogin={()=>{ setGuestMode(false); setShowAuthMode("login"); }}
      onGuestRegister={()=>{ setGuestMode(false); setShowAuthMode("register"); }}
    />
    </ToastProvider>
    </LangCtx.Provider>
  );

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
    <ToastProvider>
    <DesktopLayout
      tab={tab} setTab={setTab} session={session} profile={profile}
      selected={selected} setSelected={setSelected}
      chatListing={chatListing} setChatListing={setChatListing}
      openChat={openChat} logout={logout}
      region={region} setRegion={setRegion}
      guestMode={guestMode} guestSearch={guestSearch}
      onGuestLogin={()=>{ setGuestMode(false); setShowAuthMode("login"); }}
      onGuestRegister={()=>{ setGuestMode(false); setShowAuthMode("register"); }}
    />
    </ToastProvider>
    </LangCtx.Provider>
  );
}
