import { useState, useRef, useEffect, useCallback } from "react";

import { sb } from "./supabase.js";
import LandingPage from "./LandingPage.jsx";
import { T, CSS_BASE } from "./theme.js";

const { RED, RED2, GOLD, BLUE, GREEN, DANGER, PUR, BG, BG2, BG3, CARD, SURF, BORDER, BORDER2, TEXT, SUB, MUTED } = T;

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

/* ══════════════════════════════════════════════════════════════
   MATCH ENGINE — IA analiza similitud entre publicación y solicitud
══════════════════════════════════════════════════════════════ */
async function analyzeImage(base64Data, mediaType) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch(e) {
    return null;
  }
}

async function analyzeMatch(listingText, requestText) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": import.meta.env.VITE_ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
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
    const data = await response.json();
    const text = data.content?.[0]?.text || '{"match":false,"score":0,"reason":"Error"}';
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch(e) {
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
  const newText = buildText(newItem);
  
  // Buscar el lado opuesto
  const table = type === "listing" ? "requests" : "listings";
  const { data: candidates } = await sb.from(table).select("*").limit(50);
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
  }).catch(()=>{}); // graceful if table doesn't exist yet

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
  }).catch(()=>{});

  return { otherUserId, autoMsg, candidate };
}


/* ── Icon system ────────────────────────────────────────────── */
const Ic = ({ n, s=22, c="currentColor", sw=1.8, fill="none" }) => {
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
    wa:       null,
  };
  if (n === "wa") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
    </svg>
  );
  return <svg width={s} height={s} fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{p[n]}</svg>;
};

/* ── Logo ───────────────────────────────────────────────────── */
function SpartsLogo({ size=36 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:size*0.28 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#F04423"/>
        <text x="18" y="26" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="24" fill="white" letterSpacing="1">S</text>
        <circle cx="26" cy="10" r="4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
        <circle cx="26" cy="10" r="1.5" fill="rgba(255,255,255,0.9)"/>
      </svg>
      <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:size*0.6, letterSpacing:size*0.04, color:"#F2F5F7", lineHeight:1 }}>
        SPARTSHUB
      </span>
    </div>
  );
}
function Logo({ size=16 }) { return <SpartsLogo size={size===16?36:size+20}/>; }

/* ── Spinner ────────────────────────────────────────────────── */
function Spin({ size=22 }) {
  return <div className="spinner" style={{ width:size, height:size }}/>;
}

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ name, size=40, color=RED }) {
  const initials = (name||"U").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`rgba(240,68,35,.15)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      <span style={{ color:RED, fontWeight:700, fontSize:size*0.38, fontFamily:"Barlow Condensed,sans-serif" }}>{initials}</span>
    </div>
  );
}

/* ── Constants ──────────────────────────────────────────────── */
const CATS = [
  { id:"all",   label:"Todas",               emoji:"◈" },
  { id:"min",   label:"Minería",              emoji:"⚙️" },
  { id:"for",   label:"Forestal",             emoji:"🌲" },
  { id:"const", label:"Construcción",         emoji:"🏗️" },
  { id:"ene",   label:"Energía",              emoji:"⚡" },
  { id:"trans", label:"Transporte",           emoji:"🚛" },
  { id:"fae",   label:"Faenas",               emoji:"⛏️" },
  { id:"rut",   label:"Rutas y Caminos",      emoji:"🛣️" },
  { id:"san",   label:"Sanitarias",           emoji:"💧" },
  { id:"serv",  label:"Servicios",            emoji:"🔧" },
];
const CONDITIONS  = ["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"];
const OPERATIONS  = ["Venta","Arriendo","Trade"];
const CURRENCIES  = ["USD","CLP","EUR","COP","PEN","MXN"];

const fmtTs = ts => {
  const d = new Date(ts), diff = Math.floor((Date.now()-d)/1000);
  if (diff < 60) return "Ahora"; if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`; return `${Math.floor(diff/86400)}d`;
};
const fmtPrice = (p, cur) => `${cur} ${Number(p)>=1000?(Number(p)/1000).toFixed(0)+"k":Number(p).toLocaleString()}`;

/* ── Photo placeholder ──────────────────────────────────────── */
function PhotoPlaceholder({ emoji="📦", h=160 }) {
  return (
    <div style={{ width:"100%", height:h, background:BG2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:44 }}>
      {emoji}
    </div>
  );
}

/* ── Demo listings ──────────────────────────────────────────── */


/* ══════════════════════════════════════════════════════════════
   AUTH SCREEN
══════════════════════════════════════════════════════════════ */
function AuthScreen({ initialMode="login", onAuth, onBack }) {
  const [mode, setMode]     = useState(initialMode);
  const [step, setStep]     = useState(0);
  const [f, setF]           = useState({ email:"", pass:"", name:"", biz:"", phone:"", location:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    setErr("");
    if (!f.email || !f.pass) { setErr("Email y contraseña requeridos."); return; }
    setLoading(true);
    if (mode === "login") {
      const { data, error } = await sb.auth.signInWithPassword({ email:f.email, password:f.pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      onAuth(data.user);
    } else {
      if (!f.name || !f.biz) { setErr("Completa todos los campos."); setLoading(false); return; }
      const { data, error } = await sb.auth.signUp({ email:f.email, password:f.pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (data.user) {
        await sb.from("profiles").upsert({ id:data.user.id, name:f.name, biz:f.biz, phone:f.phone, location:f.location });
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
        setMode("login"); setStep(1);
      }
    }
    setLoading(false);
  };

  /* Welcome screen */
  if (step === 0) return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <style>{CSS_BASE}</style>
      <div style={{ position:"absolute", inset:0, backgroundImage:`url('https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&q=60')`, backgroundSize:"cover", backgroundPosition:"center", opacity:.25 }}/>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(to bottom, transparent 20%, ${BG} 70%)` }}/>

      <div style={{ position:"relative", flex:1, display:"flex", flexDirection:"column", padding:28, paddingTop:80 }}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {["P2P","INDUSTRIAL","GLOBAL"].map(t=><span key={t} className="tag t-dim" style={{ fontSize:9 }}>{t}</span>)}
        </div>
        <SpartsLogo size={38}/>
        <div style={{ marginTop:32, marginBottom:8 }}>
          <p className="bebas" style={{ fontSize:36, color:TEXT, lineHeight:1.1, marginBottom:8 }}>
            Conectamos personas,<br/><span style={{ color:RED }}>no repuestos.</span>
          </p>
          <p style={{ fontSize:15, color:SUB, marginBottom:32, lineHeight:1.6 }}>El marketplace industrial global.</p>
          <div style={{ display:"flex", gap:8, marginBottom:40, flexWrap:"wrap" }}>
            {["✓ Verificado","0% Comisión","Trade IA"].map(t=>(
              <span key={t} className="tag t-dim">{t}</span>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button className="btn-red" onClick={()=>{ setMode("register"); setStep(1); }} style={{ fontSize:16, padding:"16px 24px" }}>
            Comenzar →
          </button>
          <button className="btn-ol" onClick={()=>{ setMode("login"); setStep(1); }} style={{ fontSize:14, padding:"14px 24px" }}>
            Ya tengo cuenta · Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column" }}>
      <style>{CSS_BASE}</style>
      <div style={{ padding:"56px 20px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button className="btn-ghost" onClick={()=>setStep(0)}><Ic n="chevL" s={22} c={TEXT}/></button>
        <SpartsLogo size={36}/>
      </div>

      <div style={{ flex:1, padding:"0 24px 40px", display:"flex", flexDirection:"column", gap:14 }}>
        <h2 className="bebas" style={{ fontSize:34, color:TEXT, marginBottom:4 }}>
          {mode==="login" ? "Bienvenido de vuelta" : "Crear cuenta"}
        </h2>
        <p style={{ fontSize:15, color:SUB, marginBottom:8 }}>
          {mode==="login" ? "Ingresa para continuar" : "Únete a la red industrial"}
        </p>

        <div className="seg" style={{ marginBottom:4 }}>
          {[["login","Iniciar sesión"],["register","Registrarse"]].map(([m,l])=>(
            <div key={m} className={`seg-btn${mode===m?" active":""}`} onClick={()=>{ setMode(m); setErr(""); }}>{l}</div>
          ))}
        </div>

        {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.3)",borderRadius:8,padding:"12px 16px",fontSize:13,color:DANGER }}>{err}</div>}

        {mode === "register" && (
          <>
            <input className="inp" placeholder="Nombre completo" value={f.name} onChange={e=>upd("name",e.target.value)}/>
            <input className="inp" placeholder="Empresa o nombre comercial" value={f.biz} onChange={e=>upd("biz",e.target.value)}/>
            <input className="inp" placeholder="WhatsApp (con código país)" value={f.phone} onChange={e=>upd("phone",e.target.value)}/>
            <input className="inp" placeholder="Ubicación (Ciudad, País)" value={f.location} onChange={e=>upd("location",e.target.value)}/>
          </>
        )}

        <input className="inp" type="email" placeholder="Email" value={f.email} onChange={e=>upd("email",e.target.value)}/>
        <div style={{ position:"relative" }}>
          <input className="inp" type={showPass?"text":"password"} placeholder="Contraseña" value={f.pass} onChange={e=>upd("pass",e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} style={{ paddingRight:44 }}/>
          <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:14,padding:0 }}>
            {showPass?"🙈":"👁️"}
          </button>
        </div>

        <button className="btn-red" onClick={submit} disabled={loading} style={{ marginTop:4, opacity:loading?.6:1, padding:"15px" }}>
          {loading ? <Spin/> : mode==="login" ? "Ingresar" : "Crear cuenta"}
        </button>

        <p style={{ textAlign:"center", fontSize:12, color:MUTED, marginTop:4 }}>
          100% gratuito · Sin comisiones · Conexión directa
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOME PAGE
══════════════════════════════════════════════════════════════ */
function HomePage({ user, onSelect, onGoSearch }) {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    sb.from("listings").select("*").order("created_at",{ascending:false}).limit(20)
      .then(({ data })=>{ setListings(data||[]); setLoading(false); });
  },[]);

  return (
    <div>
      {/* Top stats bar */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
        {[[listings.length||"—","Publicaciones activas"],["0%","Comisión"],["P2P","Contacto directo"],["✓","Usuarios verificados"]].map(([v,l])=>(
          <div key={l} style={{ background:CARD,borderRadius:10,padding:"16px 20px",border:`1px solid ${BORDER}`,display:"flex",alignItems:"center",gap:14 }}>
            <p className="bebas" style={{ fontSize:28,color:RED,lineHeight:1 }}>{v}</p>
            <p style={{ fontSize:12,color:MUTED,lineHeight:1.4 }}>{l}</p>
          </div>
        ))}
      </div>



      {/* Category pills */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {CATS.slice(1).map(c=>(
          <button key={c.id} onClick={onGoSearch}
            style={{ padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:700,border:`1px solid ${BORDER}`,background:CARD,color:SUB,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",transition:"all .15s" }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor=RED; e.currentTarget.style.color=RED; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.color=SUB; }}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Featured grid — 4 columns */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <span className="bebas" style={{ fontSize:22,color:TEXT }}>⭐ Mejor calificados</span>
        <span style={{ fontSize:13,fontWeight:700,color:RED,cursor:"pointer" }} onClick={onGoSearch}>Ver todo →</span>
      </div>
      {loading ? (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24 }}>
          {[0,1,2,3].map(i=><div key={i} style={{ height:220,background:CARD,borderRadius:10 }}/>)}
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24 }}>
          {listings.slice(0,8).map(l=>(
            <div key={l.id} className="photo-card card" onClick={()=>onSelect(l)}>
              <PhotoPlaceholder emoji={l.emoji||"📦"} h={130}/>
              <div style={{ padding:"10px 12px 14px" }}>
                <span className="tag t-dim" style={{ fontSize:9,marginBottom:6,display:"inline-flex" }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                <p style={{ fontSize:13,fontWeight:700,lineHeight:1.3,marginBottom:4,color:TEXT }}>{l.title}</p>
                <p style={{ fontSize:11,color:MUTED,marginBottom:6 }}>{l.location}</p>
                <p className="bebas" style={{ fontSize:17,color:RED }}>{fmtPrice(l.price,l.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Destacados list — 2 columns */}
      {listings.length > 0 && <>
        <p className="bebas" style={{ fontSize:22,color:TEXT,marginBottom:14 }}>🔥 Destacados de la semana</p>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
          {listings.slice(0,6).map(l=><MiniCard key={l.id} l={l} onClick={()=>onSelect(l)}/>)}
        </div>
      </>}
    </div>
  );
}

function MiniCard({ l, onClick }) {
  return (
    <div onClick={onClick} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:`0.5px solid ${BORDER}`,cursor:"pointer",borderRadius:8,transition:"background .15s" }} onMouseEnter={e=>e.currentTarget.style.background=BG2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
      <div style={{ width:64, height:64, borderRadius:10, overflow:"hidden", background:BG2, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
        {l.emoji||"📦"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:600, lineHeight:1.3, marginBottom:3, color:TEXT }}>{l.title}</p>
        <p style={{ fontSize:12, color:MUTED, marginBottom:6 }}>{l.biz} · {l.location}</p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span className="bebas" style={{ fontSize:16, color:RED }}>{fmtPrice(l.price, l.currency)}</span>
          <span style={{ fontSize:11, color:MUTED }}>{fmtTs(l.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SEARCH PAGE
══════════════════════════════════════════════════════════════ */
function SearchPage({ user, onSelect }) {
  const [q,          setQ]          = useState("");
  const [cat,        setCat]        = useState("all");
  const [condition,  setCondition]  = useState("");
  const [marca,      setMarca]      = useState("");
  const [modelo,     setModelo]     = useState("");
  const [nSerie,     setNSerie]     = useState("");
  const [nParte,     setNParte]     = useState("");
  const [nMotor,     setNMotor]     = useState("");
  const [horasMin,   setHorasMin]   = useState("");
  const [horasMax,   setHorasMax]   = useState("");
  const [ciudad,     setCiudad]     = useState("");
  const [priceMin,   setPriceMin]   = useState("");
  const [priceMax,   setPriceMax]   = useState("");
  const [sortBy,     setSortBy]     = useState("newest");
  const [verified,   setVerified]   = useState(false);
  const [priceCur,   setPriceCur]   = useState("CLP");
  const [listings,   setListings]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [viewMode,   setViewMode]   = useState("grid");
  const [showFilters,setShowFilters]= useState(true);

  const MARCAS = ["","Caterpillar","Komatsu","Rexroth","Parker","WEG","ABB","Siemens","SKF","Cummins","Fleetguard","Gates","SEW","Atlas Copco","Bosch","NSK","FAG","Timken"];
  const SORT_OPTS = [["newest","Más recientes"],["price_asc","Menor precio"],["price_desc","Mayor precio"]];

  const load = useCallback(async () => {
    setLoading(true);
    const asc = sortBy === "price_asc";
    const col = sortBy.startsWith("price") ? "price" : "created_at";
    let query = sb.from("listings").select("*").order(col, {ascending: asc});
    if (cat !== "all")  query = query.eq("cat", cat);
    if (q)              query = query.ilike("title", `%${q}%`);
    if (condition)      query = query.eq("condition", condition);
    if (marca)          query = query.ilike("brand", `%${marca}%`);
    if (modelo)         query = query.ilike("model", `%${modelo}%`);
    if (nSerie)         query = query.ilike("serial_number", `%${nSerie}%`);
    if (nParte)         query = query.ilike("part_number", `%${nParte}%`);
    if (nMotor)         query = query.ilike("engine_number", `%${nMotor}%`);
    if (horasMin)       query = query.gte("hours", Number(horasMin));
    if (horasMax)       query = query.lte("hours", Number(horasMax));
    if (ciudad)         query = query.ilike("location", `%${ciudad}%`);
    if (priceMin)       query = query.gte("price", Number(priceMin));
    if (priceMax)       query = query.lte("price", Number(priceMax));
    if (priceMin||priceMax) query = query.eq("currency", priceCur);
    if (verified)       query = query.eq("verified", true);
    const { data } = await query;
    setListings(data||[]);
    setLoading(false);
  }, [cat, q, condition, marca, modelo, nSerie, nParte, nMotor, horasMin, horasMax, ciudad, priceMin, priceMax, priceCur, sortBy, verified]);

  useEffect(()=>{ load(); },[load]);

  const activeFilters = [condition,marca,modelo,nSerie,nParte,nMotor,horasMin,horasMax,ciudad,priceMin,priceMax,verified?'verificado':''].filter(Boolean).length;

  const resetFilters = () => { setCondition(""); setMarca(""); setModelo(""); setNSerie(""); setNParte(""); setNMotor(""); setHorasMin(""); setHorasMax(""); setCiudad(""); setPriceMin(""); setPriceMax(""); setPriceCur("CLP"); setVerified(false); setSortBy("newest"); };

  const INP = { background:SURF, border:`1px solid ${BORDER}`, borderRadius:8, padding:"9px 12px", fontSize:13, color:TEXT, width:"100%", outline:"none", fontFamily:"inherit", transition:"border-color .2s" };

  const isMobile = useIsMobile();

  return (
    <div style={{ display:isMobile?"block":"flex", gap:24, alignItems:"flex-start" }}>

      {/* ── Sidebar de filtros ── */}
      <div style={{ width:isMobile?"100%":220, flexShrink:0, background:BG3, borderRadius:12, border:`1px solid ${BORDER}`, padding:"20px 16px", position:isMobile?"relative":"sticky", top:0, marginBottom:isMobile?16:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <p className="bebas" style={{ fontSize:18, color:TEXT, letterSpacing:.5 }}>Filtros</p>
          {activeFilters > 0 && (
            <button onClick={resetFilters} style={{ fontSize:11, color:RED, background:"none", border:"none", cursor:"pointer", fontWeight:700, fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5 }}>
              Limpiar ({activeFilters})
            </button>
          )}
        </div>

        {/* Categoría */}
        <div style={{ marginBottom:20 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Categoría</p>
          <select value={cat} onChange={e=>setCat(e.target.value)}
            style={{ background:SURF, border:`1px solid ${cat!=="all"?RED:BORDER}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:cat!=="all"?RED:TEXT, width:"100%", outline:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:cat!=="all"?700:400, transition:"border-color .2s" }}>
            {CATS.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:20 }}/>

        {/* Condición */}
        <div style={{ marginBottom:18 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Condición</p>
          <select value={condition} onChange={e=>setCondition(e.target.value)}
            style={{ background:SURF, border:`1px solid ${condition?RED:BORDER}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:condition?RED:TEXT, width:"100%", outline:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:condition?700:400, transition:"border-color .2s" }}>
            <option value="">Todas</option>
            {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:20 }}/>

        {/* Marca */}
        <div style={{ marginBottom:18 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Marca</p>
          <select value={marca} onChange={e=>setMarca(e.target.value)} style={{ ...INP }}>
            {MARCAS.map(m=><option key={m} value={m}>{m||"Todas las marcas"}</option>)}
          </select>
        </div>

        {/* Modelo */}
        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Modelo</p>
          <input value={modelo} onChange={e=>setModelo(e.target.value)} placeholder="Ej: 3406E, A10V, 6205…" style={{ background:SURF, border:`1px solid ${modelo?RED:BORDER}`, borderRadius:8, padding:"10px 12px", fontSize:13, color:modelo?RED:TEXT, width:"100%", outline:"none", fontFamily:"inherit", fontWeight:modelo?700:400, transition:"border-color .2s" }}/>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:16 }}/>

        {/* Números técnicos */}
        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>N° de Serie</p>
          <input value={nSerie} onChange={e=>setNSerie(e.target.value)} placeholder="Nº serie del equipo" style={{ ...INP }}/>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:14 }}/>

        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>N° de Parte</p>
          <input value={nParte} onChange={e=>setNParte(e.target.value)} placeholder="Part number" style={{ ...INP }}/>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:14 }}/>

        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>N° de Motor</p>
          <input value={nMotor} onChange={e=>setNMotor(e.target.value)} placeholder="Nº motor" style={{ ...INP }}/>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:16 }}/>

        {/* Horas de uso */}
        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Horas de uso</p>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={horasMin} onChange={e=>setHorasMin(e.target.value)} placeholder="Mín" type="number" style={{ ...INP, width:"50%" }}/>
            <span style={{ color:MUTED, fontSize:13 }}>–</span>
            <input value={horasMax} onChange={e=>setHorasMax(e.target.value)} placeholder="Máx" type="number" style={{ ...INP, width:"50%" }}/>
          </div>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:16 }}/>

        {/* Ciudad */}
        <div style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", marginBottom:8, fontFamily:"Barlow Condensed,sans-serif" }}>Ciudad / Región</p>
          <input value={ciudad} onChange={e=>setCiudad(e.target.value)} placeholder="Ej: Santiago, Antofagasta…" style={{ ...INP }}/>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:16 }}/>

        {/* Precio */}
        <div style={{ marginBottom:18 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <p style={{ fontSize:10, fontWeight:700, color:MUTED, letterSpacing:1.2, textTransform:"uppercase", fontFamily:"Barlow Condensed,sans-serif" }}>Rango de precio</p>
            <div style={{ display:"flex", background:BG2, borderRadius:6, overflow:"hidden", border:`1px solid ${BORDER}` }}>
              {["CLP","USD"].map(c=>(
                <button key={c} onClick={()=>setPriceCur(c)}
                  style={{ padding:"3px 10px", fontSize:11, fontWeight:700, border:"none", cursor:"pointer", fontFamily:"Barlow Condensed,sans-serif", letterSpacing:.5, transition:"all .15s",
                    background:priceCur===c?RED:"transparent", color:priceCur===c?"#fff":MUTED }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input value={priceMin} onChange={e=>setPriceMin(e.target.value)} placeholder="Mín" type="number" style={{ ...INP, width:"50%" }}/>
            <span style={{ color:MUTED, fontSize:13 }}>–</span>
            <input value={priceMax} onChange={e=>setPriceMax(e.target.value)} placeholder="Máx" type="number" style={{ ...INP, width:"50%" }}/>
          </div>
        </div>

        <div style={{ height:1, background:BORDER, marginBottom:20 }}/>

        {/* Solo verificados */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, cursor:"pointer" }} onClick={()=>setVerified(v=>!v)}>
          <p style={{ fontSize:13, color:verified?TEXT:SUB, fontWeight:verified?700:400 }}>Solo verificados ✓</p>
          <div className="toggle" style={{ background:verified?RED:"rgba(255,255,255,.1)" }}>
            <div className="toggle-knob" style={{ left:verified?20:2 }}/>
          </div>
        </div>

        <button className="btn-red" onClick={load} style={{ width:"100%", padding:"11px", fontSize:13 }}>
          Buscar
        </button>
      </div>

      {/* ── Resultados ── */}
      <div style={{ flex:1, minWidth:0 }}>
        {/* Search bar + sort */}
        <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
          <div className="search-bar" style={{ flex:1 }}>
            <Ic n="search" s={16} c={MUTED}/>
            <input placeholder="Buscar repuestos, equipos, marcas…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} autoFocus/>
            {q && <button className="btn-ghost" style={{ padding:"2px 4px" }} onClick={()=>setQ("")}><Ic n="x" s={16} c={MUTED}/></button>}
          </div>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{ background:SURF, border:`1px solid ${BORDER}`, borderRadius:8, padding:"10px 14px", fontSize:13, color:TEXT, outline:"none", cursor:"pointer", fontFamily:"inherit" }}>
            {SORT_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
          <div style={{ display:"flex", gap:4 }}>
            <button className="btn-ghost" style={{ padding:"8px", color:viewMode==="grid"?RED:MUTED }} onClick={()=>setViewMode("grid")}><Ic n="grid" s={18}/></button>
            <button className="btn-ghost" style={{ padding:"8px", color:viewMode==="list"?RED:MUTED }} onClick={()=>setViewMode("list")}><Ic n="box" s={18}/></button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
            {condition && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setCondition("")}>{condition} ✕</span>}
            {marca     && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setMarca("")}>{marca} ✕</span>}
            {modelo    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setModelo("")}>Modelo: {modelo} ✕</span>}
            {nSerie    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNSerie("")}>Serie: {nSerie} ✕</span>}
            {nParte    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNParte("")}>Parte: {nParte} ✕</span>}
            {nMotor    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setNMotor("")}>Motor: {nMotor} ✕</span>}
            {horasMin  && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setHorasMin("")}>Hrs desde {horasMin} ✕</span>}
            {horasMax  && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setHorasMax("")}>Hrs hasta {horasMax} ✕</span>}
            {ciudad    && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setCiudad("")}>{ciudad} ✕</span>}
            {priceMin  && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setPriceMin("")}>Desde {priceMin} ✕</span>}
            {priceMax  && <span className="tag t-red" style={{ cursor:"pointer" }} onClick={()=>setPriceMax("")}>Hasta {priceMax} ✕</span>}
            {verified  && <span className="tag t-green" style={{ cursor:"pointer" }} onClick={()=>setVerified(false)}>Solo verificados ✕</span>}
          </div>
        )}

        {/* Count */}
        <p style={{ fontSize:13, color:MUTED, marginBottom:14 }}>
          {loading ? "Buscando…" : `${listings.length} publicaciones encontradas`}
        </p>

        {loading ? (
          <div style={{ display:"flex", justifyContent:"center", paddingTop:60 }}><Spin size={30}/></div>
        ) : listings.length === 0 ? (
          <div style={{ padding:"60px 0", textAlign:"center" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
            <p className="bebas" style={{ fontSize:24, color:TEXT, marginBottom:8 }}>Sin resultados</p>
            <p style={{ color:MUTED, fontSize:14, marginBottom:16 }}>Intentá con otro término o ajustá los filtros</p>
            <button className="btn-ol" onClick={resetFilters} style={{ fontSize:13 }}>Limpiar filtros</button>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
            {listings.map(l=>(
              <div key={l.id} className="photo-card card" onClick={()=>onSelect(l)}>
                <PhotoPlaceholder emoji={l.emoji||"📦"} h={130}/>
                <div style={{ padding:"10px 12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                    <span className="tag t-dim" style={{ fontSize:9 }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                    {l.verified && <span className="tag t-green" style={{ fontSize:9 }}>✓</span>}
                  </div>
                  <p style={{ fontSize:13, fontWeight:600, lineHeight:1.3, marginBottom:3, color:TEXT }}>{l.title}</p>
                  <p style={{ fontSize:11, color:MUTED, marginBottom:2 }}>{l.biz}</p>
                  {l.location && <p style={{ fontSize:11, color:MUTED, marginBottom:6 }}>📍 {l.location}</p>}
                  {l.brand && <p style={{ fontSize:11, color:MUTED, marginBottom:6 }}>🏷️ {l.brand}</p>}
                  <p className="bebas" style={{ fontSize:16, color:RED }}>{fmtPrice(l.price, l.currency)}</p>
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
function ListingDetail({ l, onClose, onChat }) {
  const wa = () => {
    const msg = encodeURIComponent(`Hola! Vi tu publicación en SpartsHub: *${l.title}*. Me interesa, ¿puedes darme más detalles?`);
    window.open(`https://wa.me/${(l.phone||"").replace(/\D/g,"")}?text=${msg}`, "_blank");
  };
  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"92vh",overflow:"hidden",display:"flex",flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}>
          <div style={{ width:36,height:4,background:MUTED,borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 14px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span className="tag t-dim">{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20} c={MUTED}/></button>
        </div>
        <div style={{ overflowY:"auto",flex:1,paddingBottom:40 }}>
          <div style={{ height:220,background:BG2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80 }}>
            {l.emoji||"📦"}
          </div>
          <div style={{ padding:"20px 20px 0" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:8 }}>
              <h2 style={{ fontSize:22,fontWeight:700,lineHeight:1.2,color:TEXT,flex:1 }}>{l.title}</h2>
              {l.verified&&<span className="tag t-green"><Ic n="verify" s={10} c={GREEN}/>Verificado</span>}
            </div>
            <p className="bebas" style={{ fontSize:30,color:RED,marginBottom:16 }}>{l.currency} {Number(l.price).toLocaleString()}</p>

            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:20 }}>
              {[["Condición",l.condition],["Marca",l.brand||"—"],["Modelo",l.model||"—"],["Stock",`${l.stock||1} u.`],l.hours&&["Horas de uso",`${l.hours} hrs`],l.serial_number&&["N° Serie",l.serial_number],l.part_number&&["N° Parte",l.part_number],l.engine_number&&["N° Motor",l.engine_number],l.chassis_number&&["N° Chasis",l.chassis_number]].filter(Boolean).map(([k,v])=>(
                <div key={k} style={{ background:BG2,borderRadius:10,padding:"12px 14px",border:`1px solid ${BORDER}` }}>
                  <p style={{ fontSize:11,color:MUTED,marginBottom:3,fontWeight:600,textTransform:"uppercase",letterSpacing:.5 }}>{k}</p>
                  <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>{v}</p>
                </div>
              ))}
            </div>

            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:16,padding:"12px 14px",background:BG2,borderRadius:10,border:`1px solid ${BORDER}` }}>
              <Ic n="map" s={16} c={RED}/>
              <span style={{ fontSize:14,fontWeight:500,color:TEXT }}>{l.location}</span>
            </div>

            {l.description && (
              <div style={{ marginBottom:20 }}>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:8 }}>DESCRIPCIÓN</p>
                <p style={{ fontSize:15,color:SUB,lineHeight:1.7 }}>{l.description}</p>
              </div>
            )}

            <div style={{ height:"0.5px",background:BORDER,marginBottom:20 }}/>

            {/* Seller */}
            <div style={{ display:"flex",gap:12,alignItems:"center",marginBottom:24 }}>
              <Avatar name={l.biz||"U"} size={46}/>
              <div>
                <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>{l.biz}</p>
                <div style={{ display:"flex",gap:4,alignItems:"center",marginTop:2 }}>
                  <span style={{ fontSize:12,color:MUTED }}>{l.location}</span>
                </div>
              </div>
            </div>

            <div style={{ display:"flex",flexDirection:"column",gap:12,padding:"0 0 20px" }}>
              <button onClick={l.phone ? wa : ()=>alert("Este vendedor no publicó su WhatsApp. Usa el chat interno.")} style={{ background:"#25D366",color:"#fff",borderRadius:10,padding:"15px",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",gap:10,border:"none",cursor:"pointer",opacity:l.phone?1:.7 }}>
                <Ic n="wa" s={20} c="#fff"/>{l.phone?"Contactar por WhatsApp":"WhatsApp no disponible"}
              </button>
              <button className="btn-ol" style={{ padding:14 }} onClick={()=>{ onClose(); onChat(l); }}>
                <Ic n="msg" s={18} c={RED}/><span style={{ color:RED,fontWeight:700 }}>Mensaje en SpartsHub</span>
              </button>
              <button className="btn-ghost" style={{ justifyContent:"center",padding:12 }} onClick={()=>{
                const url = window.location.href;
                if (navigator.share) { navigator.share({ title:l.title, text:`${l.title} — ${l.currency} ${Number(l.price).toLocaleString()}`, url }); }
                else { navigator.clipboard.writeText(url).then(()=>alert("Link copiado al portapapeles")); }
              }}>
                Compartir publicación 🔗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PUBLISH SHEET
══════════════════════════════════════════════════════════════ */
function PublishSheet({ user, profile, onClose, onDone }) {
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
  const [f, setF] = useState({
    title:"", brand:"", model:"", serial_number:"", part_number:"",
    engine_number:"", hours:"", cat:"min",
    condition:"Nuevo", price:"", currency:"USD", stock:"1",
    location:profile?.location||"", phone:profile?.phone||"",
    biz:profile?.biz||"", description:"", emoji:"📦"
  });
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!f.title || !f.price) { setErr("Título y precio requeridos."); return; }
    setLoading(true); setErr("");
    const { data:inserted, error } = await sb.from("listings").insert({
      user_id:user.id, title:f.title, brand:f.brand||null, model:f.model||null,
      serial_number:f.serial_number||null, part_number:f.part_number||null,
      engine_number:f.engine_number||null,
      hours:f.hours?Number(f.hours):null,
      cat:f.cat, condition:f.condition, operation:"Venta",
      price:Number(f.price), currency:f.currency,
      stock:Number(f.stock)||1, location:f.location,
      phone:f.phone||profile?.phone, biz:f.biz||profile?.biz,
      description:f.description, emoji:f.emoji||"📦", verified:false,
    }).select().single();
    setLoading(false);
    if (error) { setErr(error.message); return; }
    if (inserted) {
      runMatchEngine(inserted, "listing", user, profile).then(async matches => {
        for (const match of matches) await notifyMatch(match, inserted, "listing", user, profile);
        if (matches.length > 0) { setMatchCount(matches.length); setShowMatchAlert(true); }
      });
    }
    onDone();
  };

  const TYPES = [
    { id:"producto", icon:"box",     title:"Producto",            sub:"Repuesto, equipo o accesorio" },
    { id:"servicio", icon:"settings",title:"Servicio",            sub:"Taller, reparación, mantención" },
    { id:"excel",    icon:"grid",    title:"Carga masiva (Excel)", sub:"Sube hasta 500 ítems desde Excel" },
    { id:"ai",       icon:"camera",  title:"Identifica con IA",   sub:"Toma una foto y la IA lo identifica", highlight:true },
  ];

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:60,display:"flex",flexDirection:"column",justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"94vh",overflow:"hidden",display:"flex",flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"center",padding:"12px 0 4px" }}>
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
              <p style={{ fontSize:13,color:MUTED,marginBottom:4 }}>¿Qué querés publicar?</p>
              {TYPES.map(t=>(
                <div key={t.id} onClick={()=>{ setType(t.id); setStep(1); }}
                  style={{ display:"flex",alignItems:"center",gap:16,padding:"16px",borderRadius:12,border:`1.5px solid ${t.highlight?RED:BORDER}`,background:t.highlight?"rgba(240,68,35,.08)":CARD,cursor:"pointer",transition:"all .15s" }}>
                  <div style={{ width:44,height:44,background:t.highlight?RED:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                    <Ic n={t.icon} s={20} c={t.highlight?"#fff":SUB}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:15,fontWeight:700,marginBottom:2,color:TEXT }}>{t.title}</p>
                    <p style={{ fontSize:13,color:MUTED }}>{t.sub}</p>
                  </div>
                  <Ic n="chevR" s={18} c={MUTED}/>
                </div>
              ))}
            </div>
          )}

          {step===1&&type==="producto"&&(
            <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
              <div style={{ display:"flex",gap:10,overflowX:"auto",paddingBottom:4 }}>
                <input type="file" accept="image/*" multiple style={{ display:"none" }} id="photo-upload-input"/>
                {[0,1,2,3].map(i=>(
                  <div key={i} onClick={()=>document.getElementById("photo-upload-input").click()}
                    style={{ width:80,height:80,background:BG2,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,flexShrink:0,border:`1.5px dashed ${i===0?RED:BORDER}`,cursor:"pointer",transition:"border-color .15s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=i===0?RED:BORDER}>
                    <Ic n="camera" s={i===0?22:18} c={i===0?RED:MUTED}/>
                    {i===0&&<span style={{ fontSize:10,color:RED,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif" }}>FOTO</span>}
                  </div>
                ))}
              </div>

              {err&&<div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:DANGER }}>{err}</div>}

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Título *</p>
                <input className="inp" placeholder="Ej: Motor CAT 3406E reacondicionado" value={f.title} onChange={e=>upd("title",e.target.value)}/>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                <div>
                  <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Industria</p>
                  <select className="inp" value={f.cat} onChange={e=>upd("cat",e.target.value)}>
                    {CATS.filter(c=>c.id!=="all").map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Marca</p>
                  <input className="inp" placeholder="Caterpillar, SKF, WEG…" value={f.brand} onChange={e=>upd("brand",e.target.value)}/>
                </div>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Modelo <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input className="inp" placeholder="Ej: 3406E, A10V, 6205-2RS…" value={f.model} onChange={e=>upd("model",e.target.value)}/>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Serie <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input className="inp" placeholder="Nº serie del equipo" value={f.serial_number} onChange={e=>upd("serial_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Parte <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input className="inp" placeholder="Part number" value={f.part_number} onChange={e=>upd("part_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>N° de Motor <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input className="inp" placeholder="Nº motor" value={f.engine_number} onChange={e=>upd("engine_number",e.target.value)}/>
              </div>
              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Horas de uso <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input className="inp" type="number" placeholder="Ej: 4500" value={f.hours} onChange={e=>upd("hours",e.target.value)}/>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.5 }}>Estado</p>
                <div style={{ display:"flex",gap:8 }}>
                  {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=>(
                    <button key={c} onClick={()=>upd("condition",c)}
                      style={{ flex:1,padding:"9px 4px",borderRadius:8,border:`1.5px solid ${f.condition===c?RED:BORDER}`,background:f.condition===c?"rgba(240,68,35,.1)":CARD,fontWeight:700,fontSize:11,color:f.condition===c?RED:SUB,cursor:"pointer",fontFamily:"Barlow Condensed,sans-serif" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Precio *</p>
                <div style={{ display:"flex",gap:8 }}>
                  <div style={{ position:"relative",flex:1 }}>
                    <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:16,color:MUTED }}>$</span>
                    <input className="inp" type="number" placeholder="0" value={f.price} onChange={e=>upd("price",e.target.value)} style={{ paddingLeft:30 }}/>
                  </div>
                  <select className="inp" value={f.currency} onChange={e=>upd("currency",e.target.value)} style={{ width:88 }}>
                    {["USD","CLP","EUR","COP","PEN","MXN"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Descripción</p>
                <textarea className="inp" rows={3} placeholder="Detalles, compatibilidad, estado actual…" value={f.description} onChange={e=>upd("description",e.target.value)} style={{ resize:"none" }}/>
              </div>

              <div>
                <p style={{ fontSize:12,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.5 }}>Ubicación</p>
                <input className="inp" placeholder="Ciudad, País" value={f.location} onChange={e=>upd("location",e.target.value)}/>
              </div>

              <button className="btn-red" onClick={submit} disabled={loading||!f.title||!f.price}
                style={{ marginTop:8,opacity:(!f.title||!f.price||loading)?.5:1,padding:"15px",fontSize:15 }}>
                {loading?<Spin/>:"Publicar gratis"}
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
                      setAiFile(file);
                      setAiResult(null);
                      setAiError("");
                      setAiPreview(URL.createObjectURL(file));
                    }}/>
                  <div style={{ border:`2px dashed rgba(240,68,35,.4)`,borderRadius:16,padding:"48px 24px",textAlign:"center",background:"rgba(240,68,35,.04)",transition:"all .2s" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(240,68,35,.4)"}>
                    <div style={{ width:72,height:72,background:"rgba(240,68,35,.12)",borderRadius:20,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                      <Ic n="camera" s={32} c={RED}/>
                    </div>
                    <p style={{ fontSize:17,fontWeight:700,color:TEXT,marginBottom:6 }}>Tomar foto o subir imagen</p>
                    <p style={{ fontSize:13,color:MUTED,lineHeight:1.6 }}>La IA identificará el repuesto o equipo y completará el formulario automáticamente</p>
                    <div style={{ display:"flex",gap:8,justifyContent:"center",marginTop:16,flexWrap:"wrap" }}>
                      {["Rodamientos","Bombas","Motores","Filtros","Válvulas"].map(t=>(
                        <span key={t} className="tag t-dim" style={{ fontSize:10 }}>{t}</span>
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
                      <p style={{ fontSize:15,color:SUB,marginTop:14,fontWeight:600 }}>Analizando imagen con IA…</p>
                      <p style={{ fontSize:13,color:MUTED,marginTop:4 }}>Identificando marca, modelo y número de parte</p>
                    </div>
                  )}

                  {aiError&&!aiLoading&&(
                    <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:10,padding:"14px 16px",marginBottom:12 }}>
                      <p style={{ fontSize:14,color:DANGER,fontWeight:600,marginBottom:4 }}>No se pudo identificar el componente</p>
                      <p style={{ fontSize:13,color:MUTED }}>{aiError}</p>
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
                            <p style={{ fontSize:12,color:GREEN,fontWeight:600,marginTop:3 }}>
                              ✓ Identificado · Confianza {aiResult.confidence||"media"}
                            </p>
                          </div>
                        </div>
                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8 }}>
                          {[["Marca",aiResult.brand],["Modelo",aiResult.model],["N° Parte",aiResult.part_number],["Condición",aiResult.condition]].map(([k,v])=>v&&(
                            <div key={k} style={{ background:BG2,borderRadius:8,padding:"10px 12px",border:`1px solid ${BORDER}` }}>
                              <p style={{ fontSize:10,color:MUTED,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginBottom:3 }}>{k}</p>
                              <p style={{ fontSize:13,fontWeight:600,color:TEXT }}>{v}</p>
                            </div>
                          ))}
                        </div>
                        {aiResult.description&&(
                          <p style={{ fontSize:13,color:SUB,marginTop:12,lineHeight:1.6 }}>{aiResult.description}</p>
                        )}
                      </div>
                      <button className="btn-red" style={{ width:"100%",padding:"14px",fontSize:15 }}
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
                      <button className="btn-ghost" style={{ width:"100%",marginTop:8,justifyContent:"center",fontSize:13 }}
                        onClick={()=>{ setAiFile(null); setAiPreview(null); setAiResult(null); setAiError(""); }}>
                        Intentar con otra foto
                      </button>
                    </div>
                  )}

                  {!aiLoading&&!aiResult&&(
                    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                      <button className="btn-red" style={{ width:"100%",padding:"14px",fontSize:15 }}
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
                        Identificar con IA
                      </button>
                      <button className="btn-ghost" style={{ justifyContent:"center",fontSize:13 }}
                        onClick={()=>{ setAiFile(null); setAiPreview(null); }}>
                        Cambiar foto
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
              <p style={{ fontSize:14,color:MUTED }}>Esta función estará disponible pronto.</p>
              <button className="btn-red" style={{ marginTop:24 }} onClick={()=>setStep(0)}>Volver</button>
            </div>
          )}
        </div>
      </div>

      {showMatchAlert&&(
        <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }} onClick={()=>setShowMatchAlert(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:BG3,borderRadius:20,padding:36,maxWidth:420,textAlign:"center",border:`1px solid rgba(240,68,35,.3)`,boxShadow:"0 24px 80px rgba(0,0,0,.6)",animation:"slideUp .3s ease" }}>
            <div style={{ fontSize:56,marginBottom:12 }}>🤝</div>
            <p className="bebas" style={{ fontSize:32,color:RED,marginBottom:8 }}>¡{matchCount} MATCH{matchCount>1?"ES":""} ENCONTRADO{matchCount>1?"S":""}!</p>
            <p style={{ fontSize:15,color:TEXT,lineHeight:1.7,marginBottom:20 }}>
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
   MESSAGES PAGE
══════════════════════════════════════════════════════════════ */
function MessagesPage({ user, initListing, onClear }) {
  const [contacts, setContacts] = useState([]);
  const [active,   setActive]   = useState(null);
  const [filter,   setFilter]   = useState("Todas");
  const FILTERS = ["Todas","Interesado","Negociación","Vendido"];

  useEffect(()=>{
    if (initListing) {
      sb.from("profiles").select("*").eq("id",initListing.user_id).single().then(({ data })=>{
        if (data) setActive({ profile:data,listing:initListing });
        onClear();
      });
    }
  },[initListing]);

  useEffect(()=>{
    const load = async () => {
      const [{ data:s },{ data:r }] = await Promise.all([
        sb.from("messages").select("to_id").eq("from_id",user.id),
        sb.from("messages").select("from_id").eq("to_id",user.id),
      ]);
      const ids = new Set([...(s||[]).map(m=>m.to_id),...(r||[]).map(m=>m.from_id)]);
      if (!ids.size) return;
      const { data } = await sb.from("profiles").select("*").in("id",[...ids]);
      setContacts(data||[]);
    };
    load();
  },[user.id]);

  if (active) return <ChatView user={user} other={active.profile} listing={active.listing} onBack={()=>setActive(null)}/>;

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding:"56px 20px 16px" }}>
        <h1 className="bebas" style={{ fontSize:34,color:TEXT,marginBottom:16 }}>Chat</h1>
        <div className="search-bar">
          <Ic n="search" s={16} c={MUTED}/>
          <input placeholder="Buscar conversaciones…" onChange={e=>{
            const v = e.target.value.toLowerCase();
            // filter contacts by name/biz — future enhancement
          }}/>
        </div>
      </div>
      <div style={{ padding:"0 20px 16px",display:"flex",gap:8,overflowX:"auto" }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ flexShrink:0,padding:"7px 16px",borderRadius:20,fontSize:12,fontWeight:700,border:`1px solid ${filter===f?RED:BORDER}`,cursor:"pointer",background:filter===f?RED:CARD,color:filter===f?"#fff":SUB,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}>
            {f}
          </button>
        ))}
      </div>
      <div style={{ padding:"0" }}>
        {contacts.length===0 ? (
          <div style={{ paddingTop:60,textAlign:"center" }}>
            <div style={{ fontSize:56,marginBottom:16 }}>💬</div>
            <p className="bebas" style={{ fontSize:28,marginBottom:8 }}>Sin conversaciones</p>
            <p style={{ fontSize:14,color:MUTED }}>Contacta a un vendedor desde cualquier publicación</p>
          </div>
        ) : contacts.map(c=>(
          <div key={c.id} style={{ display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderBottom:`0.5px solid ${BORDER}`,cursor:"pointer",borderRadius:8,transition:"background .15s" }} onMouseEnter={e=>e.currentTarget.style.background=BG2} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setActive({ profile:c,listing:null })}>
            <Avatar name={c.biz||c.name||"U"} size={48}/>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:15,fontWeight:700,marginBottom:2,color:TEXT }}>{c.biz||c.name}</p>
              <p style={{ fontSize:13,color:MUTED,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{c.location}</p>
            </div>
            <Ic n="chevR" s={18} c={MUTED}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatView({ user, other, listing, onBack }) {
  const [msgs,    setMsgs]    = useState([]);
  const [inp,     setInp]     = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef();

  const load = useCallback(async ()=>{
    const { data } = await sb.from("messages").select("*")
      .or(`and(from_id.eq.${user.id},to_id.eq.${other.id}),and(from_id.eq.${other.id},to_id.eq.${user.id})`)
      .order("created_at",{ascending:true});
    setMsgs(data||[]); setLoading(false);
  },[user.id,other.id]);

  useEffect(()=>{ load(); },[load]);
  useEffect(()=>{ endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs]);

  useEffect(()=>{
    const ch = sb.channel(`chat-${[user.id,other.id].sort().join("-")}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},load).subscribe();
    return ()=>sb.removeChannel(ch);
  },[user.id,other.id,load]);

  const send = async ()=>{
    const body = inp.trim(); if(!body) return;
    setInp("");
    await sb.from("messages").insert({ from_id:user.id,to_id:other.id,body,listing_id:listing?.id||null });
    load();
  };

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",background:BG }}>
      {/* Header */}
      <div style={{ padding:"56px 16px 12px",borderBottom:`0.5px solid ${BORDER}`,display:"flex",gap:12,alignItems:"center",flexShrink:0,background:BG3 }}>
        <button className="btn-ghost" style={{ padding:"6px 8px" }} onClick={onBack}><Ic n="chevL" s={22} c={TEXT}/></button>
        <Avatar name={other.biz||other.name||"U"} size={40}/>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>{other.biz||other.name}</p>
          <p style={{ fontSize:12,color:GREEN,fontWeight:600 }}>● En línea</p>
        </div>
        <Ic n="phone" s={20} c={RED}/>
      </div>
      {listing&&(
        <div style={{ padding:"10px 16px",background:BG2,borderBottom:`0.5px solid ${BORDER}`,display:"flex",gap:10,alignItems:"center" }}>
          <span style={{ fontSize:20 }}>{listing.emoji||"📦"}</span>
          <div>
            <p style={{ fontSize:11,color:MUTED }}>Consulta sobre</p>
            <p style={{ fontSize:13,fontWeight:600,color:TEXT }}>{listing.title}</p>
          </div>
        </div>
      )}
      <div style={{ flex:1,overflowY:"auto",padding:"16px",display:"flex",flexDirection:"column",gap:8 }}>
        {loading ? <div style={{ display:"flex",justifyContent:"center",paddingTop:40 }}><Spin/></div>
          : msgs.length===0 ? (
            <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12 }}>
              <div style={{ fontSize:48 }}>👋</div>
              <p style={{ fontSize:16,fontWeight:700,color:TEXT }}>Inicia la conversación</p>
              <p style={{ fontSize:14,color:MUTED }}>Los mensajes son directos y privados</p>
            </div>
          ) : msgs.map((m,i)=>{
            const mine = m.from_id===user.id;
            return (
              <div key={m.id||i} style={{ display:"flex",justifyContent:mine?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"76%",background:mine?RED:CARD,color:"#fff",borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px",padding:"11px 15px",fontSize:15,lineHeight:1.5,border:mine?"none":`1px solid ${BORDER}` }}>
                  <p style={{ color:mine?"#fff":TEXT }}>{m.body}</p>
                  <p style={{ fontSize:10,opacity:.6,marginTop:4,textAlign:mine?"right":"left",color:mine?"rgba(255,255,255,.7)":MUTED }}>{fmtTs(m.created_at)}</p>
                </div>
              </div>
            );
          })
        }
        <div ref={endRef}/>
      </div>
      <div style={{ padding:"12px 16px 32px",borderTop:`0.5px solid ${BORDER}`,display:"flex",gap:10,flexShrink:0,background:BG3 }}>
        <input className="inp" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje…" style={{ flex:1,borderRadius:24,padding:"12px 18px" }}/>
        <button onClick={send} style={{ width:44,height:44,background:RED,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"none",cursor:"pointer",flexShrink:0 }}>
          <Ic n="send" s={18} c="#fff"/>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════════════════════════════ */
function ProfilePage({ user, profile, onLogout }) {
  const [section,          setSection]         = useState("perfil");
  const [listings,         setListings]         = useState([]);
  const [editMode,         setEditMode]         = useState(false);
  const [editData,         setEditData]         = useState({ name:"",rut:"",biz:"",phone:"",address:"",location:"" });
  const [alertForm,        setAlertForm]        = useState({ keyword:"",cat:"all",email:user?.email||"",notifType:"email",wa:"" });
  const [alerts,           setAlerts]           = useState([]);
  const [alertSaved,       setAlertSaved]       = useState(false);
  const [showDeleteConfirm,setShowDeleteConfirm]= useState(false);
  const [supportMsg,       setSupportMsg]       = useState("");
  const [supportSent,      setSupportSent]      = useState(false);
  const [bulkFile,         setBulkFile]         = useState(null);
  const [bulkRows,         setBulkRows]         = useState([]);
  const [bulkUploading,    setBulkUploading]    = useState(false);
  const [bulkDone,         setBulkDone]         = useState(false);
  const fileRef = useRef();

  useEffect(()=>{
    sb.from("listings").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).then(({data})=>setListings(data||[]));
  },[user.id]);
  useEffect(()=>{
    if (profile) setEditData({ name:profile.name||"",rut:profile.rut||"",biz:profile.biz||"",phone:profile.phone||"",address:profile.address||"",location:profile.location||"" });
  },[profile]);

  const saveProfile = async ()=>{ await sb.from("profiles").update(editData).eq("id",user.id); setEditMode(false); };
  const saveAlert   = ()=>{ if(!alertForm.keyword) return; setAlerts(a=>[...a,{...alertForm,id:Date.now()}]); setAlertForm({keyword:"",cat:"all",email:user?.email||""}); setAlertSaved(true); setTimeout(()=>setAlertSaved(false),3000); };
  const deleteAlert = id => setAlerts(a=>a.filter(x=>x.id!==id));
  const sendSupport = ()=>{ if(!supportMsg.trim()) return; setSupportSent(true); setSupportMsg(""); setTimeout(()=>setSupportSent(false),4000); };

  const handleBulkFile = file => {
    setBulkFile(file);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const lines = text.split("\n").filter(Boolean);
      const headers = lines[0].split(",").map(h=>h.trim().toLowerCase().replace(/"/g,""));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v=>v.trim().replace(/"/g,""));
        const obj = {};
        headers.forEach((h,i) => obj[h] = vals[i]||"");
        return { title:obj.titulo||obj.title||"", cat:obj.categoria||obj.cat||"min", condition:obj.condicion||obj.condition||"Nuevo", price:obj.precio||obj.price||"0", currency:obj.moneda||obj.currency||"CLP" };
      }).filter(r=>r.title);
      setBulkRows(rows);
    };
    reader.readAsText(file);
  };

  const uploadBulk = async ()=>{
    setBulkUploading(true);
    for (const row of bulkRows) {
      await sb.from("listings").insert({ user_id:user.id,title:row.title,cat:row.cat,condition:row.condition,price:Number(row.price),currency:row.currency,biz:profile?.biz||"",location:profile?.location||"",emoji:"📦",verified:false });
    }
    setBulkUploading(false); setBulkDone(true); setBulkRows([]); setBulkFile(null);
  };

  const initials = ((profile?.name||"U ").split(" ").map(w=>w[0]).join("")).slice(0,2).toUpperCase();

  const SECTIONS = [
    { id:"perfil",   label:"Mi Perfil",     icn:"user" },
    { id:"notif",    label:"Notificaciones", icn:"bell" },
    { id:"bulk",     label:"Carga Masiva",  icn:"box" },
    { id:"soporte",  label:"Soporte",       icn:"msg" },
    { id:"settings", label:"Configuración", icn:"settings" },
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
          <p style={{ fontSize:14,fontWeight:700,color:TEXT,marginTop:10 }}>{profile?.name||"Usuario"}</p>
          <p style={{ fontSize:12,color:MUTED }}>{profile?.biz||"—"}</p>
        </div>
        {SECTIONS.map(s=>(
          <button key={s.id} className={`sidebar-btn${section===s.id?" active":""}`} onClick={()=>setSection(s.id)}>
            <Ic n={s.icn} s={16} c={section===s.id?RED:MUTED}/>{s.label}
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <button onClick={onLogout} className="sidebar-btn" style={{ color:RED }}>
          <Ic n="logout" s={16} c={RED}/>Cerrar sesión
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex:1,overflowY:"auto",padding:32 }}>

        {/* ── PERFIL ── */}
        {section==="perfil"&&(
          <div style={{ maxWidth:"100%" }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
              <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mi Perfil</h2>
              <button className="btn-ol" style={{ padding:"8px 16px",fontSize:12 }} onClick={()=>setEditMode(e=>!e)}>
                {editMode?"Cancelar":"Editar datos"}
              </button>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24 }}>
              {[["Publicaciones",listings.length]].map(([k,v])=>(
                <div key={k} style={{ background:CARD,borderRadius:10,padding:"16px",border:`1px solid ${BORDER}`,textAlign:"center" }}>
                  <p className="bebas" style={{ fontSize:26,color:RED }}>{v}</p>
                  <p style={{ fontSize:11,color:MUTED,marginTop:4,textTransform:"uppercase",letterSpacing:.5,fontFamily:"Barlow Condensed,sans-serif" }}>{k}</p>
                </div>
              ))}
            </div>
            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,display:"flex",flexDirection:"column",gap:14 }}>
              {[["Nombre completo","name","Ej: Carlos García"],["RUT","rut","RUT / ID fiscal"],["Empresa / Negocio","biz","Ej: Mining Corp S.A."],["WhatsApp / Teléfono","phone","+1 555 1234 / +56 9 1234"],["Dirección","address","Ej: Av. Principal 1234"],["Ciudad y País","location","Ciudad, País"]].map(([label,key,ph])=>(
                <div key={key}>
                  <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>{label}</p>
                  {editMode
                    ? <input className="inp" value={editData[key]} onChange={e=>setEditData(d=>({...d,[key]:e.target.value}))} placeholder={ph}/>
                    : <p style={{ fontSize:15,color:editData[key]?TEXT:MUTED,padding:"10px 0",borderBottom:`1px solid ${BORDER}` }}>{editData[key]||"—"}</p>
                  }
                </div>
              ))}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Email</p>
                <p style={{ fontSize:15,color:MUTED,padding:"10px 0" }}>{user.email}</p>
              </div>
              {editMode&&<button className="btn-red" onClick={saveProfile} style={{ padding:"13px" }}>Guardar cambios</button>}
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
                  <p style={{ fontWeight:600,fontSize:14,color:TEXT }}>{l.title}</p>
                  <p className="bebas" style={{ fontSize:16,color:RED }}>{fmtPrice(l.price,l.currency)}</p>
                </div>
                <span className="tag t-green" style={{ fontSize:10 }}>Activo</span>
              </div>
            ))}
          </div>
        )}

        {/* ── ALERTAS ── */}
        {section==="notif"&&(
          <div style={{ maxWidth:"100%" }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Notificaciones</h2>
            <p style={{ color:MUTED,fontSize:14,marginBottom:24 }}>Tus notificaciones y alertas de búsqueda activas.</p>
            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:24,display:"flex",flexDirection:"column",gap:12 }}>
              <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif" }}>Crear nueva alerta</p>
              <input className="inp" placeholder="Ej: Bomba hidráulica Rexroth A10V" value={alertForm.keyword} onChange={e=>setAlertForm(f=>({...f,keyword:e.target.value}))}/>
              <select className="inp" value={alertForm.cat} onChange={e=>setAlertForm(f=>({...f,cat:e.target.value}))}>
                {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input className="inp" value={alertForm.email} onChange={e=>setAlertForm(f=>({...f,email:e.target.value}))} placeholder="tu@email.com"/>
              <div style={{ display:"flex",gap:8 }}>
                {[["email","Email"],["whatsapp","WhatsApp"]].map(([val,lbl])=>(
                  <div key={val} onClick={()=>setAlertForm(f=>({...f,notifType:val}))}
                    style={{ flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${alertForm.notifType===val?RED:BORDER}`,background:alertForm.notifType===val?"rgba(240,68,35,.1)":BG2,cursor:"pointer",textAlign:"center" }}>
                    <p style={{ fontSize:13,fontWeight:700,color:alertForm.notifType===val?RED:SUB,fontFamily:"Barlow Condensed,sans-serif" }}>{lbl}</p>
                  </div>
                ))}
              </div>
              {alertSaved&&<p style={{ color:GREEN,fontSize:13,fontWeight:600 }}>✓ Alerta guardada — te avisaremos cuando haya coincidencias</p>}
              <button className="btn-red" onClick={saveAlert} style={{ padding:"13px" }}>
                <Ic n="bell" s={16} c="#fff"/> Activar alerta
              </button>
            </div>
            {alerts.length>0&&(
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:12,fontFamily:"Barlow Condensed,sans-serif" }}>Alertas activas</p>
                {alerts.map(a=>(
                  <div key={a.id} style={{ background:CARD,borderRadius:10,padding:"14px 16px",marginBottom:8,border:`1px solid ${BORDER}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                    <div>
                      <p style={{ fontWeight:600,fontSize:14,color:TEXT }}>{a.keyword}</p>
                      <p style={{ fontSize:12,color:MUTED }}>{CATS.find(c=>c.id===a.cat)?.label} · {a.email}</p>
                    </div>
                    <button onClick={()=>deleteAlert(a.id)} style={{ color:RED,fontSize:12,background:"none",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"Barlow Condensed,sans-serif" }}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CARGA MASIVA ── */}
        {section==="bulk"&&(
          <div style={{ maxWidth:"100%" }}>
            <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Carga Masiva de Publicaciones</h2>
            <p style={{ color:MUTED,fontSize:14,marginBottom:24 }}>Sube hasta 500 publicaciones de una sola vez usando un archivo Excel o CSV.</p>
            <div style={{ background:"rgba(240,68,35,.06)",border:"1px solid rgba(240,68,35,.2)",borderRadius:12,padding:20,marginBottom:24,display:"flex",gap:16,alignItems:"center" }}>
              <div style={{ width:44,height:44,background:RED,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Ic n="box" s={20} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700,fontSize:15,color:TEXT }}>Descargar plantilla Excel</p>
                <p style={{ fontSize:13,color:MUTED,marginTop:2 }}>Usa esta plantilla con las columnas correctas.</p>
              </div>
              <button className="btn-ol" style={{ padding:"9px 18px",fontSize:12,flexShrink:0 }} onClick={()=>window.open("/plantilla_carga_masiva.xlsx","_blank")}>Descargar →</button>
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
                <p style={{ color:MUTED,fontSize:14 }}>o haz click para seleccionar</p>
                <p style={{ color:MUTED,fontSize:12,marginTop:8 }}>Excel (.xlsx) o CSV — máximo 500 filas</p>
              </div>
            ) : (
              <div>
                <div style={{ background:CARD,borderRadius:10,padding:16,border:`1px solid ${BORDER}`,marginBottom:16,display:"flex",alignItems:"center",gap:12 }}>
                  <div style={{ width:40,height:40,background:"rgba(34,197,94,.1)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    <Ic n="check" s={18} c={GREEN}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600,color:TEXT }}>{bulkFile.name}</p>
                    <p style={{ fontSize:13,color:GREEN }}>{bulkRows.length} publicaciones encontradas</p>
                  </div>
                  <button onClick={()=>{setBulkFile(null);setBulkRows([]);}} style={{ color:MUTED,fontSize:13,background:"none",border:"none",cursor:"pointer" }}>Cambiar</button>
                </div>
                {bulkRows.length > 0 && (
                <div style={{ background:CARD,borderRadius:10,border:`1px solid ${BORDER}`,overflow:"hidden",marginBottom:16 }}>
                  <div style={{ background:BG2,padding:"10px 16px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12 }}>
                    {["Título","Categoría","Condición","Precio"].map(h=><span key={h} style={{ fontSize:11,fontWeight:700,color:MUTED,fontFamily:"Barlow Condensed,sans-serif",textTransform:"uppercase" }}>{h}</span>)}
                  </div>
                  {bulkRows.map((r,i)=>(
                    <div key={i} style={{ padding:"12px 16px",display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12,borderTop:`1px solid ${BORDER}` }}>
                      <span style={{ fontSize:13,color:TEXT }}>{r.title}</span>
                      <span style={{ fontSize:13,color:MUTED }}>{CATS.find(c=>c.id===r.cat)?.label||r.cat}</span>
                      <span style={{ fontSize:13,color:MUTED }}>{r.condition}</span>
                      <span className="bebas" style={{ fontSize:14,color:RED }}>{Number(r.price).toLocaleString()} {r.currency}</span>
                    </div>
                  ))}
                </div>
                )}
                {bulkDone
                  ? <p style={{ color:GREEN,fontSize:14,fontWeight:700,textAlign:"center" }}>✓ ¡Carga completada!</p>
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
            <p style={{ color:MUTED,fontSize:14,marginBottom:28 }}>Estamos aquí para ayudarte. Elige cómo quieres contactarnos.</p>

            <div style={{ background:"rgba(240,68,35,.06)",border:"1px solid rgba(240,68,35,.2)",borderRadius:12,padding:24,marginBottom:16 }}>
              <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:16 }}>
                <div style={{ width:44,height:44,background:RED,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <span style={{ color:"#fff",fontSize:20 }}>⚡</span>
                </div>
                <div>
                  <p style={{ fontWeight:700,fontSize:15,color:TEXT }}>Soporte con IA</p>
                  <p style={{ fontSize:13,color:MUTED,marginTop:2 }}>Respuesta inmediata las 24 horas.</p>
                </div>
              </div>
              <div style={{ background:BG2,borderRadius:8,padding:14,marginBottom:12,minHeight:60,fontSize:14,color:MUTED,border:`1px solid ${BORDER}` }}>
                Escribe tu consulta y te responderemos a la brevedad.
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <input className="inp" placeholder="Escribe tu pregunta…" style={{ flex:1,borderRadius:8,padding:"10px 14px",fontSize:14 }}/>
                <button className="btn-red" style={{ padding:"10px 14px" }}><Ic n="send" s={15} c="#fff"/></button>
              </div>
            </div>

            <div style={{ background:CARD,border:`1px solid ${BORDER}`,borderRadius:12,padding:24,marginBottom:16 }}>
              <div style={{ display:"flex",gap:14,alignItems:"flex-start",marginBottom:16 }}>
                <div style={{ width:44,height:44,background:BG2,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${BORDER}` }}>
                  <Ic n="user" s={20} c={SUB}/>
                </div>
                <div>
                  <p style={{ fontWeight:700,fontSize:15,color:TEXT }}>Soporte humano</p>
                  <p style={{ fontSize:13,color:MUTED,marginTop:2 }}>Respuesta en menos de 24 horas hábiles.</p>
                </div>
              </div>
              <textarea className="inp" rows={4} placeholder="Describe tu problema o consulta…" value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} style={{ resize:"none",marginBottom:12 }}/>
              {supportSent
                ? <p style={{ color:GREEN,fontSize:13,fontWeight:700 }}>✓ Mensaje enviado — te responderemos en menos de 24hrs</p>
                : <button className="btn-red" onClick={sendSupport} style={{ padding:"13px" }}>Enviar mensaje</button>
              }
            </div>

            <div style={{ background:"rgba(37,211,102,.06)",border:"1px solid rgba(37,211,102,.25)",borderRadius:12,padding:20,display:"flex",gap:14,alignItems:"center" }}>
              <div style={{ width:44,height:44,background:"#25D366",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <Ic n="wa" s={20} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700,fontSize:15,color:TEXT }}>WhatsApp directo</p>
                <p style={{ fontSize:13,color:MUTED,marginTop:2 }}>Lun–Vie 9:00–18:00 · +56 9 3268 9914</p>
              </div>
              <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20SpartsHub","_blank")}
                style={{ background:"#25D366",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",flexShrink:0 }}>
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
              <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Notificaciones</p>
              {[["Nuevos mensajes","Recibir email cuando alguien te contacta",true],["Alertas de búsqueda","Notificar cuando aparezcan productos que buscas",true],["Novedades de SpartsHub","Actualizaciones y mejoras de la plataforma",false]].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>{label}</p>
                    <p style={{ fontSize:12,color:MUTED,marginTop:2 }}>{desc}</p>
                  </div>
                  <div className="toggle" style={{ background:def?RED:"rgba(255,255,255,.15)" }}>
                    <div className="toggle-knob" style={{ left:def?20:2 }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Privacidad</p>
              {[["Mostrar WhatsApp en publicaciones","Tu número aparece en el botón de contacto directo",true],["Perfil visible en búsquedas","Otros usuarios pueden ver tu perfil público",true]].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>{label}</p>
                    <p style={{ fontSize:12,color:MUTED,marginTop:2 }}>{desc}</p>
                  </div>
                  <div className="toggle" style={{ background:def?RED:"rgba(255,255,255,.15)" }}>
                    <div className="toggle-knob" style={{ left:def?20:2 }}/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:16 }}>
              <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:16,fontFamily:"Barlow Condensed,sans-serif" }}>Seguridad</p>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 0",borderBottom:`1px solid ${BORDER}` }}>
                <div>
                  <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>Cambiar contraseña</p>
                  <p style={{ fontSize:12,color:MUTED }}>Recibirás un email con instrucciones</p>
                </div>
                <button className="btn-ol" style={{ padding:"8px 14px",fontSize:12 }}
                  onClick={async()=>{ await sb.auth.resetPasswordForEmail(user.email,{redirectTo:"https://spartshub.com"}); alert("Email enviado — revisa tu correo"); }}>
                  Enviar email
                </button>
              </div>
              <div style={{ padding:"12px 0" }}>
                <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>Email de la cuenta</p>
                <p style={{ fontSize:12,color:MUTED,marginTop:2 }}>{user.email}</p>
              </div>
            </div>

            <div style={{ background:"rgba(240,68,35,.06)",border:"1px solid rgba(240,68,35,.2)",borderRadius:12,padding:24 }}>
              <p style={{ fontSize:11,fontWeight:700,color:RED,letterSpacing:1,textTransform:"uppercase",marginBottom:12,fontFamily:"Barlow Condensed,sans-serif" }}>Zona de peligro</p>
              {!showDeleteConfirm ? (
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <p style={{ fontSize:14,fontWeight:600,color:TEXT }}>Cerrar mi cuenta</p>
                    <p style={{ fontSize:12,color:MUTED,marginTop:2 }}>Esta acción es irreversible.</p>
                  </div>
                  <button onClick={()=>setShowDeleteConfirm(true)} className="btn-ol" style={{ borderColor:RED,color:RED,padding:"8px 16px",fontSize:12 }}>
                    Cerrar cuenta
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize:14,color:RED,fontWeight:700,marginBottom:12 }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
                  <div style={{ display:"flex",gap:10 }}>
                    <button className="btn-ol" onClick={()=>setShowDeleteConfirm(false)} style={{ flex:1,padding:"11px" }}>Cancelar</button>
                    <button onClick={async()=>{ await sb.auth.signOut(); window.location.reload(); }}
                      style={{ flex:1,background:RED,color:"#fff",border:"none",borderRadius:8,padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer" }}>
                      Sí, cerrar mi cuenta
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
  const [aiInput,  setAiInput]  = useState("");
  const [aiResp,   setAiResp]   = useState("Hola, soy el asistente de SpartsHub. ¿En qué puedo ayudarte?");
  const [aiLoading,setAiLoading]= useState(false);

  const sendAI = () => {
    if (!aiInput.trim()) return;
    const q = aiInput; setAiInput(""); setAiLoading(true);
    setTimeout(()=>{
      const R = { publicar:"Para publicar, haz clic en 'Publicar aquí'. ¡Es gratis!", precio:"Puedes publicar en CLP, USD, EUR y más.", contactar:"Para contactar a un vendedor, necesitas estar registrado.", cuenta:"Escríbenos a fgiangrandisc@gmail.com o por WhatsApp." };
      const key = Object.keys(R).find(k=>q.toLowerCase().includes(k));
      setAiResp(key?R[key]:"Entiendo tu consulta. Te recomiendo escribir al soporte humano o contactarnos por WhatsApp. Respondemos en menos de 24hrs.");
      setAiLoading(false);
    },800);
  };

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:24 }} onClick={onClose}>
      <div style={{ background:CARD,borderRadius:16,width:400,maxHeight:"80vh",display:"flex",flexDirection:"column",border:`1px solid ${BORDER2}`,boxShadow:"0 20px 60px rgba(0,0,0,.5)",overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ background:RED,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}><svg width={22} height={22} viewBox="0 0 36 36" fill="none"><rect width="36" height="36" rx="8" fill="rgba(255,255,255,0.2)"/><text x="18" y="26" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="24" fill="white">S</text></svg><p className="bebas" style={{ fontSize:18,color:"#fff",letterSpacing:.5 }}>SOPORTE</p></div>
            <p style={{ fontSize:12,color:"rgba(255,255,255,.7)",marginTop:2 }}>Respuesta inmediata · IA + Humano</p>
          </div>
          <button onClick={onClose} style={{ color:"rgba(255,255,255,.8)",background:"none",border:"none",cursor:"pointer",fontSize:20 }}>✕</button>
        </div>
        <div style={{ overflowY:"auto",flex:1,padding:20,display:"flex",flexDirection:"column",gap:16 }}>
          <div style={{ background:BG2,borderRadius:10,padding:16,border:`1px solid ${BORDER}` }}>
            <div style={{ display:"flex",gap:10,alignItems:"center",marginBottom:12 }}>
              <div style={{ width:32,height:32,background:RED,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <span style={{ color:"#fff",fontSize:14 }}>⚡</span>
              </div>
              <div>
                <p style={{ fontWeight:700,fontSize:13,color:TEXT }}>Asistente IA</p>
                <p style={{ fontSize:11,color:GREEN }}>● En línea ahora</p>
              </div>
            </div>
            <div style={{ background:CARD,borderRadius:8,padding:12,marginBottom:10,fontSize:13,color:TEXT,lineHeight:1.6,border:`1px solid ${BORDER}` }}>{aiResp}</div>
            <div style={{ display:"flex",gap:8 }}>
              <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendAI()} placeholder="Escribe tu pregunta…" className="inp" style={{ flex:1,borderRadius:8,padding:"8px 12px",fontSize:13 }}/>
              <button onClick={sendAI} className="btn-red" style={{ padding:"8px 12px" }}><Ic n="send" s={14} c="#fff"/></button>
            </div>
          </div>
          <div style={{ background:BG2,borderRadius:10,padding:16,border:`1px solid ${BORDER}` }}>
            <p style={{ fontWeight:700,fontSize:13,color:TEXT,marginBottom:8 }}>Soporte humano</p>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Describe tu problema…" rows={3} className="inp" style={{ resize:"none",marginBottom:8 }}/>
            {sent?<p style={{ color:GREEN,fontSize:13,fontWeight:700 }}>✓ Mensaje enviado — responderemos en menos de 24hrs</p>
              :<button onClick={()=>{ if(msg.trim()) setSent(true); }} className="btn-red" style={{ width:"100%",padding:"10px",fontSize:13 }}>Enviar mensaje</button>
            }
          </div>
          <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20SpartsHub","_blank")}
            style={{ background:"#25D366",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:14,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            <Ic n="wa" s={18} c="#fff"/>WhatsApp · +56 9 3268 9914
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ALERTAS PAGE
══════════════════════════════════════════════════════════════ */
function AlertasPage({ user, profile }) {
  const [alertForm, setAlertForm] = useState({ keyword:"", cat:"all", email:user?.email||"", notifType:"email", wa:"" });
  const [alerts,    setAlerts]    = useState([]);
  const [saved,     setSaved]     = useState(false);

  const saveAlert = () => {
    if (!alertForm.keyword) return;
    setAlerts(a=>[...a,{...alertForm,id:Date.now()}]);
    setAlertForm({keyword:"",cat:"all",email:user?.email||""});
    setSaved(true); setTimeout(()=>setSaved(false),3000);
  };

  return (
    <div>
      <h2 className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Mis Alertas de Búsqueda</h2>
      <p style={{ color:MUTED,fontSize:14,marginBottom:24 }}>Recibe una notificación cuando se publique lo que estás buscando.</p>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start" }}>
      <div style={{ background:CARD,borderRadius:12,padding:24,border:`1px solid ${BORDER}`,marginBottom:24,display:"flex",flexDirection:"column",gap:12 }}>
        <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif" }}>Crear nueva alerta</p>
        <input className="inp" placeholder="Ej: Bomba hidráulica Rexroth A10V" value={alertForm.keyword} onChange={e=>setAlertForm(f=>({...f,keyword:e.target.value}))}/>
        <select className="inp" value={alertForm.cat} onChange={e=>setAlertForm(f=>({...f,cat:e.target.value}))}>
          {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <input className="inp" value={alertForm.email} onChange={e=>setAlertForm(f=>({...f,email:e.target.value}))} placeholder="tu@email.com"/>
        <div style={{ display:"flex",gap:8 }}>
          {[["email","Email"],["whatsapp","WhatsApp"]].map(([val,lbl])=>(
            <div key={val} onClick={()=>setAlertForm(f=>({...f,notifType:val}))}
              style={{ flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${alertForm.notifType===val?RED:BORDER}`,background:alertForm.notifType===val?"rgba(240,68,35,.1)":BG2,cursor:"pointer",textAlign:"center" }}>
              <p style={{ fontSize:13,fontWeight:700,color:alertForm.notifType===val?RED:SUB,fontFamily:"Barlow Condensed,sans-serif" }}>{lbl}</p>
            </div>
          ))}
        </div>
        {alertForm.notifType==="whatsapp"&&(
          <input className="inp" placeholder="+1 555 1234 / +56 9 1234" value={alertForm.wa||""} onChange={e=>setAlertForm(f=>({...f,wa:e.target.value}))}/>
        )}
        {saved&&<p style={{ color:GREEN,fontSize:13,fontWeight:700 }}>✓ Alerta guardada — te avisaremos cuando haya coincidencias</p>}
        <button className="btn-red" onClick={saveAlert} style={{ padding:"13px" }}>
          <Ic n="bell" s={16} c="#fff"/> Activar alerta
        </button>
      </div>

      {alerts.length===0 ? (
        <div style={{ background:CARD,borderRadius:12,padding:40,textAlign:"center",border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:48,marginBottom:12 }}>🔔</div>
          <p className="bebas" style={{ fontSize:22,color:TEXT,marginBottom:6 }}>Sin alertas activas</p>
          <p style={{ color:MUTED,fontSize:14 }}>Crea una alerta para recibir notificaciones automáticas</p>
        </div>
      ) : (
        <div>
          <p style={{ fontSize:11,fontWeight:700,color:MUTED,letterSpacing:1,textTransform:"uppercase",marginBottom:12,fontFamily:"Barlow Condensed,sans-serif" }}>Alertas activas</p>
          {alerts.map(a=>(
            <div key={a.id} style={{ background:CARD,borderRadius:10,padding:"14px 16px",marginBottom:8,border:`1px solid ${BORDER}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <p style={{ fontWeight:600,fontSize:14,color:TEXT }}>{a.keyword}</p>
                <p style={{ fontSize:12,color:MUTED }}>{CATS.find(c=>c.id===a.cat)?.label} · {a.email}</p>
              </div>
              <button onClick={()=>setAlerts(x=>x.filter(i=>i.id!==a.id))} style={{ color:RED,fontSize:12,background:"none",border:"none",cursor:"pointer",fontWeight:700,fontFamily:"Barlow Condensed,sans-serif" }}>Eliminar</button>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MIS PUBLICACIONES PAGE
══════════════════════════════════════════════════════════════ */
function MisPublicaciones({ user, onSelect }) {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(()=>{
    sb.from("listings").select("*").eq("user_id",user.id).order("created_at",{ascending:false})
      .then(({ data })=>{ setListings(data||[]); setLoading(false); });
  },[user.id]);

  if (loading) return <div style={{ display:"flex",justifyContent:"center",paddingTop:60 }}><Spin size={30}/></div>;

  return (
    <div style={{ maxWidth:"100%" }}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
        <h2 className="bebas" style={{ fontSize:28,color:TEXT }}>Mis Publicaciones</h2>
        <span className="tag t-dim">{listings.length} publicaciones</span>
      </div>

      {listings.length===0 ? (
        <div style={{ background:CARD,borderRadius:12,padding:60,textAlign:"center",border:`1px solid ${BORDER}` }}>
          <div style={{ fontSize:56,marginBottom:16 }}>📦</div>
          <p className="bebas" style={{ fontSize:28,color:TEXT,marginBottom:8 }}>Todavía no publicaste nada</p>
          <p style={{ color:MUTED,fontSize:14,marginBottom:24 }}>Publicá tu primer producto o repuesto gratis</p>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12 }}>
          {listings.map(l=>(
            <div key={l.id} onClick={()=>onSelect(l)} className="photo-card card">
              <PhotoPlaceholder emoji={l.emoji||"📦"} h={120}/>
              <div style={{ padding:"12px 14px 16px" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
                  <span className="tag t-dim" style={{ fontSize:9 }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                  <span className="tag t-green" style={{ fontSize:9 }}>Activo</span>
                </div>
                <p style={{ fontWeight:700,fontSize:14,color:TEXT,marginBottom:3,lineHeight:1.3 }}>{l.title}</p>
                <p style={{ fontSize:11,color:MUTED,marginBottom:8 }}>{l.location} · {fmtTs(l.created_at)}</p>
                <p className="bebas" style={{ fontSize:18,color:RED }}>{fmtPrice(l.price,l.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SOLICITUD SHEET — Botón flotante
══════════════════════════════════════════════════════════════ */
function SolicitudSheet({ user, profile, onClose, onDone }) {
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [err,          setErr]          = useState("");
  const [matchCount,   setMatchCount]   = useState(0);
  const [showMatchAlert,setShowMatchAlert] = useState(false);
  const [done,    setDone]    = useState(false);
  const [solicitudMatches, setSolicitudMatches] = useState(0);
  const [notif,   setNotif]   = useState({ email:true, whatsapp:false, inapp:true });
  const [f, setF] = useState({
    title:"", brand:"", model:"", cat:"min",
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

  const URGENCY = [["normal","Normal — dentro de 7 días"],["urgente","Urgente — dentro de 48hrs"],["critico","Crítico — necesito hoy"]];
  const URGENCY_C = { normal:BLUE, urgente:GOLD, critico:RED };

  const submit = async () => {
    if (!f.title) { setErr("El título es obligatorio."); return; }
    setLoading(true); setErr("");
    const { data:inserted } = await sb.from("requests").insert({
      user_id:     user.id,
      title:       f.title,
      brand:       f.brand||null,
      model:       f.model||null,
      cat:         f.cat,
      serial_number:  f.serial_number||null,
      part_number:    f.part_number||null,
      engine_number:  f.engine_number||null,
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
    }).select().single().catch(()=>({ data:null }));
    setLoading(false);

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

  const INP = { background:"rgba(255,255,255,.07)", border:"1.5px solid rgba(255,255,255,.15)", borderRadius:8, padding:"11px 14px", fontSize:14, color:TEXT, width:"100%", outline:"none", fontFamily:"inherit", transition:"border-color .2s" };

  return (
    <div className="fi" style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.8)",zIndex:80,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#171D24",borderRadius:20,width:"100%",maxWidth:580,maxHeight:"92vh",display:"flex",flexDirection:"column",border:`1px solid rgba(240,68,35,.4)`,boxShadow:"0 24px 80px rgba(0,0,0,.8), 0 0 0 1px rgba(240,68,35,.15)",overflow:"hidden",animation:"slideUp .3s ease" }}>

        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${RED},#C03320)`,padding:"20px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0 }}>
          <div>
            <p className="bebas" style={{ fontSize:24,color:"#fff",letterSpacing:.5 }}>Solicita un repuesto</p>
            <p style={{ fontSize:13,color:"rgba(255,255,255,.75)",marginTop:2 }}>Te avisamos cuando alguien lo publique</p>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)",border:"none",cursor:"pointer",color:"#fff",fontSize:18,lineHeight:1,width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
        </div>

        {done ? (
          <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:48,textAlign:"center" }}>
            <div style={{ width:72,height:72,background:"rgba(34,197,94,.15)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:`2px solid ${GREEN}` }}>
              <Ic n="check" s={32} c={GREEN}/>
            </div>
            <p className="bebas" style={{ fontSize:28,color:TEXT }}>¡Solicitud enviada!</p>
            {solicitudMatches > 0 ? (
              <div style={{ background:"rgba(240,68,35,.1)",border:"1px solid rgba(240,68,35,.3)",borderRadius:12,padding:"16px 20px",maxWidth:320 }}>
                <p className="bebas" style={{ fontSize:22,color:RED,marginBottom:6 }}>🤝 {solicitudMatches} MATCH{solicitudMatches>1?"ES":""} ENCONTRADO{solicitudMatches>1?"S":""}</p>
                <p style={{ fontSize:14,color:TEXT,lineHeight:1.6 }}>¡Hay publicaciones que coinciden con tu búsqueda! Revisá tus mensajes para ver los contactos automáticos.</p>
              </div>
            ) : (
              <p style={{ fontSize:15,color:MUTED,lineHeight:1.7 }}>
                Analizando el catálogo con IA… Te notificaremos por {[notif.email&&"email",notif.whatsapp&&"WhatsApp",notif.inapp&&"la app"].filter(Boolean).join(", ")} cuando haya un match.
              </p>
            )}
          </div>
        ) : (
          <div style={{ overflowY:"auto",flex:1,padding:"24px" }}>
            {err && <div style={{ background:"rgba(220,38,38,.08)",border:"1px solid rgba(220,38,38,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:DANGER,marginBottom:16 }}>{err}</div>}

            <div style={{ display:"flex",flexDirection:"column",gap:16 }}>

              {/* Título */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>¿Qué estás buscando? *</p>
                <input style={{ ...INP,borderColor:f.title?"rgba(240,68,35,.4)":BORDER }} placeholder="Ej: Motor CAT 3406E, Bomba Rexroth A10V…" value={f.title} onChange={e=>upd("title",e.target.value)}/>
              </div>

              {/* Industria + Marca */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Industria</p>
                  <select style={{ ...INP }} value={f.cat} onChange={e=>upd("cat",e.target.value)}>
                    {CATS.filter(c=>c.id!=="all").map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Marca <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                  <input style={{ ...INP }} placeholder="Caterpillar, SKF, WEG…" value={f.brand} onChange={e=>upd("brand",e.target.value)}/>
                </div>
              </div>

              {/* Modelo */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Modelo <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <input style={{ ...INP }} placeholder="Ej: 3406E, A10V, 6205-2RS…" value={f.model} onChange={e=>upd("model",e.target.value)}/>
              </div>

              {/* Números técnicos */}
              <div style={{ background:BG2,borderRadius:10,padding:"14px 16px",border:`1px solid ${BORDER}` }}>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:12,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Números de identificación <span style={{ fontWeight:400,textTransform:"none",letterSpacing:0 }}>(opcionales)</span></p>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {[["serial_number","N° de Serie","Nº serie del equipo"],["part_number","N° de Parte","Part number"],["engine_number","N° de Motor","Nº motor"],["chassis_number","N° de Chasis","Nº chasis"]].map(([key,label,ph])=>(
                    <div key={key} style={{ display:"grid",gridTemplateColumns:"120px 1fr",alignItems:"center",gap:10 }}>
                      <p style={{ fontSize:12,color:MUTED }}>{label}</p>
                      <input style={{ ...INP,padding:"8px 12px" }} placeholder={ph} value={f[key]} onChange={e=>upd(key,e.target.value)}/>
                    </div>
                  ))}
                  <div style={{ display:"grid",gridTemplateColumns:"120px 1fr",alignItems:"center",gap:10 }}>
                    <p style={{ fontSize:12,color:MUTED }}>Horas de uso</p>
                    <input style={{ ...INP,padding:"8px 12px" }} type="number" placeholder="Máx aceptable" value={f.hours} onChange={e=>upd("hours",e.target.value)}/>
                  </div>
                </div>
              </div>

              {/* Condición */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Condición aceptada <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <select style={{ ...INP }} value={f.condition} onChange={e=>upd("condition",e.target.value)}>
                  <option value="">Cualquier condición</option>
                  {["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"].map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Descripción */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Descripción adicional <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <textarea style={{ ...INP,resize:"none" }} rows={3} placeholder="Compatibilidad, aplicación, urgencia, detalles técnicos…" value={f.description} onChange={e=>upd("description",e.target.value)}/>
              </div>

              {/* Presupuesto */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Presupuesto máximo <span style={{ fontWeight:400,textTransform:"none" }}>(opcional)</span></p>
                <div style={{ display:"flex",gap:8 }}>
                  <div style={{ position:"relative",flex:1 }}>
                    <span style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:MUTED }}>$</span>
                    <input style={{ ...INP,paddingLeft:28 }} type="number" placeholder="0" value={f.budget} onChange={e=>upd("budget",e.target.value)}/>
                  </div>
                  <select style={{ ...INP,width:88 }} value={f.currency} onChange={e=>upd("currency",e.target.value)}>
                    {["CLP","USD","EUR"].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Urgencia */}
              <div>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:8,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Urgencia</p>
                <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                  {URGENCY.map(([val,label])=>(
                    <div key={val} onClick={()=>upd("urgency",val)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${f.urgency===val?URGENCY_C[val]:BORDER}`,background:f.urgency===val?`rgba(${val==="critico"?"240,68,35":val==="urgente"?"245,158,11":"59,130,246"},.15)`:"rgba(255,255,255,.04)",cursor:"pointer",transition:"all .15s" }}>
                      <div style={{ width:10,height:10,borderRadius:"50%",background:URGENCY_C[val],flexShrink:0 }}/>
                      <p style={{ fontSize:13,fontWeight:f.urgency===val?700:400,color:f.urgency===val?TEXT:SUB }}>{label}</p>
                      {f.urgency===val&&<span style={{ marginLeft:"auto",fontSize:11,color:URGENCY_C[val] }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ubicación + contacto */}
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
                <div>
                  <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>Ciudad / Región</p>
                  <input style={{ ...INP }} placeholder="Santiago, Antofagasta…" value={f.location} onChange={e=>upd("location",e.target.value)}/>
                </div>
                <div>
                  <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:6,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>WhatsApp</p>
                  <input style={{ ...INP }} placeholder="+1 555 1234 / +56 9 1234" value={f.phone} onChange={e=>upd("phone",e.target.value)}/>
                </div>
              </div>

              {/* Notificaciones */}
              <div style={{ background:BG2,borderRadius:10,padding:"16px",border:`1px solid ${BORDER}` }}>
                <p style={{ fontSize:11,fontWeight:700,color:MUTED,marginBottom:12,textTransform:"uppercase",letterSpacing:.8,fontFamily:"Barlow Condensed,sans-serif" }}>¿Cómo querés recibir el aviso?</p>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {[["email","📧","Email",user?.email||""],["whatsapp","💬","WhatsApp",f.phone||"Agrega tu número arriba"],["inapp","🔔","Notificación en la app","Cuando estés conectado"]].map(([key,icon,label,sub])=>(
                    <div key={key} onClick={()=>toggleNotif(key)}
                      style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,border:`1.5px solid ${notif[key]?RED:BORDER}`,background:notif[key]?"rgba(240,68,35,.2)":"rgba(255,255,255,.04)",cursor:"pointer",transition:"all .15s" }}>
                      <span style={{ fontSize:18,flexShrink:0 }}>{icon}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:13,fontWeight:notif[key]?700:400,color:notif[key]?TEXT:SUB }}>{label}</p>
                        <p style={{ fontSize:11,color:MUTED }}>{sub}</p>
                      </div>
                      <div style={{ width:20,height:20,borderRadius:4,border:`2px solid ${notif[key]?RED:BORDER}`,background:notif[key]?RED:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s" }}>
                        {notif[key]&&<Ic n="check" s={12} c="#fff"/>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button className="btn-red" onClick={submit} disabled={loading||!f.title} style={{ padding:"15px",fontSize:15,opacity:(!f.title||loading)?.5:1,marginTop:4 }}>
                {loading ? <Spin/> : "Enviar solicitud"}
              </button>
              <p style={{ textAlign:"center",fontSize:12,color:MUTED,marginTop:-8 }}>Te avisamos en cuanto alguien publique lo que buscás</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FOOTER
══════════════════════════════════════════════════════════════ */
function AppFooter() {
  const COL = { display:"flex",flexDirection:"column",gap:10 };
  const LNK = { fontSize:13,color:SUB,cursor:"pointer",transition:"color .15s",textDecoration:"none",background:"none",border:"none",fontFamily:"inherit",textAlign:"left",padding:0 };
  const HDR = { fontSize:10,fontWeight:700,color:MUTED,letterSpacing:1.5,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif",marginBottom:6 };

  return (
    <footer style={{ background:BG3,borderTop:`1px solid ${BORDER}`,marginTop:48,padding:"48px 0 0" }}>
      <div style={{ maxWidth:1200,margin:"0 auto",padding:"0 36px" }}>

        {/* Top grid */}
        <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:48,marginBottom:48 }}>

          {/* Brand column */}
          <div>
            <SpartsLogo size={34}/>
            <p style={{ fontSize:15,fontWeight:700,color:RED,letterSpacing:1,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif",marginTop:10,marginBottom:8 }}>
              No vendemos repuestos,<br/>conectamos personas.
            </p>
            <p style={{ fontSize:13,color:MUTED,lineHeight:1.75,marginBottom:16,maxWidth:300 }}>
              El marketplace industrial P2P que conecta compradores y vendedores de equipos, partes y repuestos industriales a nivel global. Sin intermediarios. Sin comisiones.
            </p>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
              {["P2P","0% Comisión","Global","Verificado"].map(t=>(
                <span key={t} className="tag t-dim" style={{ fontSize:9 }}>{t}</span>
              ))}
            </div>
          </div>

          {/* Empresa */}
          <div style={COL}>
            <p style={HDR}>Empresa</p>
            {[["Quiénes somos","#"],["Cómo funciona","#"],["Industrias que cubrimos","#"],["Casos de éxito","#"],["Blog","#"],["Prensa","#"]].map(([l,h])=>(
              <a key={l} href={h} style={LNK}
                onMouseEnter={e=>e.currentTarget.style.color=RED}
                onMouseLeave={e=>e.currentTarget.style.color=SUB}>{l}</a>
            ))}
          </div>

          {/* Políticas */}
          <div style={COL}>
            <p style={HDR}>Políticas</p>
            {[["Términos y condiciones","#"],["Política de privacidad","#"],["Política de cookies","#"],["Política de uso aceptable","#"],["Resolución de disputas","#"],["Aviso legal","#"]].map(([l,h])=>(
              <a key={l} href={h} style={LNK}
                onMouseEnter={e=>e.currentTarget.style.color=RED}
                onMouseLeave={e=>e.currentTarget.style.color=SUB}>{l}</a>
            ))}
          </div>

          {/* Contacto */}
          <div style={COL}>
            <p style={HDR}>Contacto</p>
            <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
              <div>
                <p style={{ fontSize:11,color:MUTED,marginBottom:3 }}>Email general</p>
                <a href="mailto:contacto@spartshub.com" style={{ ...LNK,color:TEXT }}>contacto@spartshub.com</a>
              </div>
              <div>
                <p style={{ fontSize:11,color:MUTED,marginBottom:3 }}>Soporte</p>
                <a href="mailto:soporte@spartshub.com" style={{ ...LNK,color:TEXT }}>soporte@spartshub.com</a>
              </div>
              <div>
                <p style={{ fontSize:11,color:MUTED,marginBottom:3 }}>WhatsApp</p>
                <a href="https://wa.me/56932689914" target="_blank" style={{ ...LNK,color:TEXT }}>+56 9 3268 9914</a>
              </div>
              <div>
                <p style={{ fontSize:11,color:MUTED,marginBottom:3 }}>Ventas & Partnerships</p>
                <a href="mailto:partners@spartshub.com" style={{ ...LNK,color:TEXT }}>partners@spartshub.com</a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:1,background:BORDER,marginBottom:20 }}/>

        {/* Bottom bar */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12,paddingBottom:24 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
            <p style={{ fontSize:12,color:MUTED }}>
              © {new Date().getFullYear()} SpartsHub™ — Todos los derechos reservados.
            </p>
            <p style={{ fontSize:11,color:"rgba(255,255,255,.2)" }}>
              SpartsHub es una marca registrada. El nombre, logo y diseño son propiedad exclusiva de SpartsHub. Queda prohibida su reproducción sin autorización expresa.
            </p>
          </div>
          <div style={{ display:"flex",gap:16,alignItems:"center" }}>
            <span style={{ fontSize:12,color:MUTED }}>Privacidad</span>
            <span style={{ fontSize:12,color:MUTED }}>Términos</span>
            <span style={{ fontSize:12,color:MUTED }}>Cookies</span>
            <span style={{ fontSize:11,color:"rgba(255,255,255,.15)",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5 }}>® & ™ SpartsHub</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE TAB BAR
══════════════════════════════════════════════════════════════ */
function MobileTabBar({ tab, setTab, onPublish }) {
  const TABS = [
    { id:"home",    icon:"home",  label:"Inicio" },
    { id:"search",  icon:"search",label:"Buscar" },
    { id:"publish", icon:"plus",  label:"Publicar", accent:true },
    { id:"messages",icon:"msg",   label:"Chat" },
    { id:"profile", icon:"user",  label:"Perfil" },
  ];
  return (
    <div style={{ position:"fixed",bottom:0,left:0,right:0,zIndex:50,background:"rgba(20,22,24,.97)",backdropFilter:"blur(20px)",borderTop:`1px solid ${BORDER}`,display:"flex",alignItems:"center",padding:"8px 0 20px" }}>
      {TABS.map(t=>(
        <button key={t.id} onClick={()=>{ if(t.id==="publish"){onPublish();return;} setTab(t.id); }}
          style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 0",background:"none",border:"none",cursor:"pointer" }}>
          <div style={{ width:36,height:36,borderRadius:t.accent?12:10,background:t.accent?RED:tab===t.id?"rgba(240,68,35,.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s" }}>
            <Ic n={t.icon} s={20} c={t.accent?"#fff":tab===t.id?RED:MUTED}/>
          </div>
          <span style={{ fontSize:10,fontWeight:700,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,color:t.accent?RED:tab===t.id?RED:MUTED,textTransform:"uppercase" }}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MOBILE LAYOUT
══════════════════════════════════════════════════════════════ */
function MobileLayout({ tab, setTab, session, profile, selected, setSelected, chatListing, setChatListing, openChat, logout }) {
  const [showPublish,   setShowPublish]   = useState(false);
  const [showSupport,   setShowSupport]   = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);

  useEffect(()=>{
    if (!session?.user) return;
    const load = async () => {
      const { count } = await sb.from("messages").select("*",{count:"exact",head:true}).eq("to_id",session.user.id).eq("read",false).catch(()=>({count:0}));
      setUnreadCount(count||0);
    };
    load();
    const ch = sb.channel("unread-"+session.user.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`to_id=eq.${session.user.id}`},()=>{ setUnreadCount(c=>c+1); })
      .subscribe();
    return ()=>sb.removeChannel(ch);
  },[session?.user?.id]);

  return (
    <div style={{ background:BG, minHeight:"100vh", color:TEXT }}>
      <style>{CSS_BASE}</style>

      {/* Mobile header */}
      <div style={{ position:"fixed",top:0,left:0,right:0,zIndex:50,background:"rgba(20,22,24,.97)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${BORDER}`,padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <SpartsLogo size={28}/>
        <div style={{ display:"flex",gap:4 }}>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={()=>setShowSupport(true)}><Ic n="msg" s={20} c={MUTED}/></button>
          <button className="btn-ghost" style={{ position:"relative",padding:"6px" }}>
            <Ic n="bell" s={20} c={MUTED}/>
          </button>
        </div>
      </div>

      {/* Page content */}
      <div style={{ paddingTop:56, paddingBottom:90 }}>
        {tab==="home"    &&<HomePage    user={session.user} onSelect={setSelected} onGoSearch={()=>setTab("search")}/>}
        {tab==="search"  &&<SearchPage  user={session.user} onSelect={setSelected}/>}
        {tab==="messages"&&<MessagesPage user={session.user} initListing={chatListing} onClear={()=>setChatListing(null)}/>}
        {tab==="alertas" &&<AlertasPage  user={session.user} profile={profile} onSolicitud={()=>setShowSolicitud(true)}/>}
        {tab==="profile" &&<ProfilePage  user={session.user} profile={profile} onLogout={logout}/>}
        {tab==="mispubs" &&<MisPublicaciones user={session.user} onSelect={setSelected}/>}
      </div>

      {/* Bottom tab bar */}
      <MobileTabBar tab={tab} setTab={setTab} onPublish={()=>setShowPublish(true)}/>

      {/* Floating solicitud button — above tab bar */}
      {!showSolicitud&&!showPublish&&(
        <button onClick={()=>setShowSolicitud(true)}
          style={{ position:"fixed",bottom:88,right:16,zIndex:49,background:RED,color:"#fff",border:"none",borderRadius:14,padding:"10px 16px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 6px 24px rgba(240,68,35,.45)",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.8,textTransform:"uppercase" }}>
          <Ic n="search" s={16} c="#fff"/>Solicita un repuesto
        </button>
      )}

      {selected&&<ListingDetail l={selected} onClose={()=>setSelected(null)} onChat={openChat}/>}
      {showPublish&&<PublishSheet user={session.user} profile={profile} onClose={()=>setShowPublish(false)} onDone={()=>setShowPublish(false)}/>}
      {showSupport&&<SupportPanel onClose={()=>setShowSupport(false)}/>}
      {showSolicitud&&<SolicitudSheet user={session.user} profile={profile} onClose={()=>setShowSolicitud(false)} onDone={()=>setShowSolicitud(false)}/>}
    </div>
  );
}

/* ── Profile Dropdown ────────────────────────────────────────── */
function ProfileDropdown({ profile, onProfile, onLogout }) {
  const [open, setOpen] = useState(false);
  useEffect(()=>{
    if (!open) return;
    const fn = ()=>setOpen(false);
    setTimeout(()=>document.addEventListener("click",fn),0);
    return ()=>document.removeEventListener("click",fn);
  },[open]);
  const name = profile?.name||profile?.biz||"Mi cuenta";
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{ position:"relative" }}>
      <button onClick={e=>{ e.stopPropagation(); setOpen(v=>!v); }}
        style={{ display:"flex",alignItems:"center",gap:8,background:open?"rgba(240,68,35,.1)":CARD,border:`1px solid ${open?RED:BORDER}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",transition:"all .15s" }}>
        <div style={{ width:28,height:28,borderRadius:"50%",background:"rgba(240,68,35,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
          <span style={{ fontSize:11,fontWeight:700,color:RED,fontFamily:"Barlow Condensed,sans-serif" }}>{initials}</span>
        </div>
        <span style={{ fontSize:12,fontWeight:700,color:TEXT,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontFamily:"Barlow Condensed,sans-serif" }}>{profile?.biz||profile?.name||"Mi cuenta"}</span>
        <Ic n="chevR" s={14} c={MUTED} style={{ transform:open?"rotate(90deg)":"rotate(0deg)",transition:"transform .15s" }}/>
      </button>
      {open&&(
        <div onClick={e=>e.stopPropagation()} style={{ position:"absolute",top:"calc(100% + 8px)",right:0,background:BG3,border:`1px solid ${BORDER2}`,borderRadius:10,padding:"6px",minWidth:200,zIndex:100,boxShadow:"0 8px 32px rgba(0,0,0,.5)",animation:"fadeIn .15s ease" }}>
          <div style={{ padding:"10px 12px",borderBottom:`1px solid ${BORDER}`,marginBottom:4 }}>
            <p style={{ fontSize:13,fontWeight:700,color:TEXT }}>{profile?.name||"Usuario"}</p>
            <p style={{ fontSize:11,color:MUTED }}>{profile?.biz||""}</p>
          </div>
          {[
            {icon:"user",    label:"Mi perfil",          action:()=>{ onProfile(); setOpen(false); }},
            {icon:"box",     label:"Mis publicaciones",   action:null, tab:"mispubs"},
            {icon:"bell",    label:"Solicitudes & Alertas",action:null, tab:"alertas"},
            {icon:"settings",label:"Configuración",       action:null, tab:"profile_settings"},
          ].map(({icon,label,action,tab})=>(
            <button key={label} onClick={()=>{ setOpen(false); if(action) action(); else if(tab==="profile_settings"){ onProfile(); } else onProfile(); }}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:7,border:"none",background:"none",cursor:"pointer",width:"100%",textAlign:"left",fontSize:13,color:SUB,fontFamily:"inherit",transition:"all .15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,.05)"; e.currentTarget.style.color=TEXT; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color=SUB; }}>
              <Ic n={icon} s={15} c={MUTED}/>{label}
            </button>
          ))}
          <div style={{ height:1,background:BORDER,margin:"4px 0" }}/>
          <button onClick={()=>{ setOpen(false); onLogout(); }}
            style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:7,border:"none",background:"none",cursor:"pointer",width:"100%",textAlign:"left",fontSize:13,color:RED,fontFamily:"inherit",transition:"all .15s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(240,68,35,.08)"}
            onMouseLeave={e=>e.currentTarget.style.background="none"}>
            <Ic n="logout" s={15} c={RED}/>Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DESKTOP LAYOUT
══════════════════════════════════════════════════════════════ */
function DesktopLayout({ tab, setTab, session, profile, selected, setSelected, chatListing, setChatListing, openChat, logout }) {
  const [showPublish,   setShowPublish]   = useState(false);
  const [showSupport,   setShowSupport]   = useState(false);
  const [showSolicitud, setShowSolicitud] = useState(false);
  const [unreadCount,   setUnreadCount]   = useState(0);

  useEffect(()=>{
    if (!session?.user) return;
    const load = async () => {
      const { count } = await sb.from("messages").select("*",{count:"exact",head:true}).eq("to_id",session.user.id).eq("read",false).catch(()=>({count:0}));
      setUnreadCount(count||0);
    };
    load();
    const ch = sb.channel("unread-"+session.user.id)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:`to_id=eq.${session.user.id}`},()=>{ setUnreadCount(c=>c+1); })
      .subscribe();
    return ()=>sb.removeChannel(ch);
  },[session?.user?.id]);

  const SIDEBAR = [
    { id:"home",        icon:"home",    label:"Inicio" },
    { id:"publish",     icon:"plus",    label:"Publicar",             accent:true },
    { id:"solicitud",   icon:"search",  label:"Solicita un repuesto", solicitud:true, featured:true },
    { id:"search",      icon:"search",  label:"Explorar" },
    { id:"messages",    icon:"msg",     label:"Mensajes",  badge:true },
    { id:"mispubs",     icon:"box",     label:"Mis publicaciones" },
    { id:"profile",     icon:"user",    label:"Perfil" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column" }}>
      <style>{CSS_BASE}</style>

      {/* GLOBAL HEADER */}
      <header style={{ background:BG3, borderBottom:`1px solid ${BORDER}`, position:"sticky", top:0, zIndex:50, padding:"0 32px" }}>
        <div style={{ display:"flex", alignItems:"center", height:70, gap:24 }}>
          <div style={{ display:"flex",flexDirection:"column",gap:3 }}>
            <SpartsLogo size={30}/>
            <span style={{ fontSize:11,fontWeight:700,color:RED,letterSpacing:1.2,textTransform:"uppercase",fontFamily:"Barlow Condensed,sans-serif",paddingLeft:2,whiteSpace:"nowrap" }}>No vendemos repuestos, conectamos personas</span>
          </div>
          <div style={{ width:1, height:36, background:BORDER }}/>
          <nav style={{ display:"flex", gap:4, flex:1 }}>
            {[{id:"home",label:"Inicio"},{id:"search",label:"Buscar"},{id:"profile",label:"Mi Perfil"},{id:"soporte",label:"Soporte"}].map((n,i)=>(
              <button key={i} onClick={()=>{ if(n.id==="soporte"){setShowSupport(true);return;} setTab(n.id); }}
                style={{ padding:"6px 14px",borderRadius:6,background:"none",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:tab===n.id?RED:SUB,transition:"all .15s",fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase" }}
                onMouseEnter={e=>{ e.currentTarget.style.color=TEXT; }}
                onMouseLeave={e=>{ e.currentTarget.style.color=tab===n.id?RED:SUB; }}>
                {n.label}
              </button>
            ))}
          </nav>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>setShowSolicitud(true)}
              style={{ background:"transparent",color:RED,border:`1.5px solid ${RED}`,borderRadius:7,padding:"8px 16px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.8,textTransform:"uppercase",transition:"all .15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.background="rgba(240,68,35,.1)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; }}>
              <Ic n="search" s={14} c={RED}/>Solicita un repuesto
            </button>
            <button onClick={()=>setShowPublish(true)}
              style={{ background:RED,color:"#fff",border:"none",borderRadius:7,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.8,textTransform:"uppercase",transition:"all .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=RED2}
              onMouseLeave={e=>e.currentTarget.style.background=RED}>
              <Ic n="plus" s={14} c="#fff"/>Publicar aquí
            </button>
            <button onClick={()=>setShowSupport(true)}
              style={{ background:"none",color:SUB,border:`1px solid ${BORDER2}`,borderRadius:7,padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"Barlow Condensed,sans-serif",letterSpacing:.5,textTransform:"uppercase",transition:"all .15s" }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=RED; e.currentTarget.style.color=RED; }}
              onMouseLeave={e=>{ e.currentTarget.style.borderColor=BORDER2; e.currentTarget.style.color=SUB; }}>
              <Ic n="msg" s={14} c="currentColor"/>Soporte
            </button>
          </div>
        </div>
      </header>

      <div style={{ display:"flex", flex:1, minHeight:0 }}>
        {/* Sidebar */}
        <div style={{ width:180,background:BG3,borderRight:`1px solid ${BORDER}`,position:"sticky",top:70,height:"calc(100vh - 70px)",display:"flex",flexDirection:"column",padding:"12px 0",flexShrink:0,overflowY:"auto" }}>
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
                style={(n.accent||n.solicitud) ? { display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:14,width:"100%",textAlign:"left",marginTop:6,background:`linear-gradient(135deg,${RED},#C03320)`,color:"#fff",fontWeight:700,fontFamily:"inherit",transition:"all .15s",boxShadow:"0 4px 16px rgba(240,68,35,.35)" } : undefined}>
                <Ic n={n.icon} s={16} c={(n.accent||n.solicitud)?"#fff":tab===n.id?RED:MUTED}/>{n.label}
                {n.badge&&unreadCount>0&&<span style={{ marginLeft:"auto",background:RED,color:"#fff",fontSize:10,fontWeight:700,borderRadius:10,padding:"2px 7px",fontFamily:"Barlow Condensed,sans-serif" }}>{unreadCount}</span>}
              </button>
            ))}
          </nav>
          {profile&&(
            <div style={{ padding:"14px",borderTop:`1px solid ${BORDER}`,display:"flex",gap:10,alignItems:"center" }}>
              <Avatar name={profile.name||"U"} size={34}/>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:13,fontWeight:700,color:TEXT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{profile.biz||profile.name||"Usuario"}</p>
                <p style={{ fontSize:11,color:MUTED,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{session.user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Main */}
        <div style={{ flex:1,minWidth:0,overflowY:"auto",padding:"24px 32px 60px" }}>
          {tab==="home"    &&<HomePage    user={session.user} onSelect={setSelected} onGoSearch={()=>setTab("search")}/>}
          {tab==="search"  &&<SearchPage  user={session.user} onSelect={setSelected}/>}
          {tab==="messages"&&<MessagesPage user={session.user} initListing={chatListing} onClear={()=>setChatListing(null)}/>}
          {tab==="profile" &&<ProfilePage  user={session.user} profile={profile} onLogout={logout}/>}
          {tab==="mispubs" &&<MisPublicaciones user={session.user} onSelect={setSelected}/>}
        </div>
      </div>

      {selected&&<ListingDetail l={selected} onClose={()=>setSelected(null)} onChat={openChat}/>}
      {showPublish&&<PublishSheet user={session.user} profile={profile} onClose={()=>setShowPublish(false)} onDone={()=>setShowPublish(false)}/>}
      {showSupport&&<SupportPanel onClose={()=>setShowSupport(false)}/>}
      {showSolicitud&&<SolicitudSheet user={session.user} profile={profile} onClose={()=>setShowSolicitud(false)} onDone={()=>setShowSolicitud(false)}/>}


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
  const [profile,      setProfile]      = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [tab,          setTab]          = useState("home");
  const [selected,     setSelected]     = useState(null);
  const [chatListing,  setChatListing]  = useState(null);

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
  const openChat = l=>{ if(l.user_id===session?.user?.id) return; setChatListing(l); setTab("messages"); setSelected(null); };

  if (!authReady) return (
    <div style={{ minHeight:"100vh",background:BG,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
      <style>{CSS_BASE}</style>
      <SpartsLogo size={36}/><div className="spinner" style={{ width:28,height:28,marginTop:8 }}/>
    </div>
  );

  if (!session) {
    if (showAuthMode==="landing") return (
      <LandingPage onGoRegister={()=>setShowAuthMode("register")} onGoLogin={()=>setShowAuthMode("login")}/>
    );
    return <AuthScreen initialMode={showAuthMode==="register"?"register":"login"} onAuth={()=>sb.auth.getSession().then(({ data })=>setSession(data.session))} onBack={()=>setShowAuthMode("landing")}/>;
  }

  if (isMobile) return (
    <MobileLayout
      tab={tab} setTab={setTab} session={session} profile={profile}
      selected={selected} setSelected={setSelected}
      chatListing={chatListing} setChatListing={setChatListing}
      openChat={openChat} logout={logout}
    />
  );

  return (
    <DesktopLayout
      tab={tab} setTab={setTab} session={session} profile={profile}
      selected={selected} setSelected={setSelected}
      chatListing={chatListing} setChatListing={setChatListing}
      openChat={openChat} logout={logout}
    />
  );
}
