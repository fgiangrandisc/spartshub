import { useState, useRef, useEffect, useCallback } from "react";
import { sb } from "./supabase.js";
import LandingPage from "./LandingPage.jsx";

/* ─────────────────────────────────────────────────────────────
   DESIGN: iOS-style, white/light gray, red primary (#E8331A)
   Oswald headings, SF-Pro-like body, photo cards, bottom nav
───────────────────────────────────────────────────────────── */

const RED    = "#C13F1E";
const RED2   = "#A33218";
const BG     = "#F5F0E8";
const CREAM  = "#EDE8DF";
const CARD   = "#FDFAF6";
const GRAY1  = "#EDE8DF";
const GRAY2  = "#E2DDD4";
const GRAY3  = "#CCC8BE";
const GRAY4  = "#9C9888";
const DARK   = "#1A1A18";
const DARK2  = "#3D3D38";
const TEXT   = "#1A1A18";
const SUB    = "#6B6860";
const WHITE  = "#FDFAF6";
const GREEN  = "#2D8653";
const ORANGE = "#D4780A";
const BLUE   = "#1A5FA8";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${BG}; color: ${TEXT}; font-family: 'Barlow', -apple-system, sans-serif; min-height: 100vh; -webkit-font-smoothing: antialiased; }
::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-thumb { background: ${GRAY3}; border-radius: 3px; }
button { cursor: pointer; border: none; background: none; font-family: inherit; -webkit-tap-highlight-color: transparent; }
input, textarea, select { font-family: inherit; outline: none; }
img { object-fit: cover; }

.display { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.3px; }

/* Buttons */
.btn-red  { background: ${RED}; color: #fff; border-radius: 14px; padding: 15px 24px; font-size: 16px; font-weight: 600; width: 100%; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-red:active  { background: ${RED2}; transform: scale(.98); }
.btn-dark { background: ${DARK}; color: #fff; border-radius: 14px; padding: 15px 24px; font-size: 16px; font-weight: 600; width: 100%; transition: all .15s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.btn-dark:active { transform: scale(.98); }
.btn-outline { border: 1.5px solid ${GRAY3}; color: ${DARK}; border-radius: 12px; padding: 13px 20px; font-size: 15px; font-weight: 500; transition: all .15s; display: flex; align-items: center; gap: 8px; }
.btn-outline:active { background: ${BG}; }
.btn-ghost { color: ${SUB}; border-radius: 10px; padding: 8px 12px; font-size: 14px; transition: background .15s; display: flex; align-items: center; gap: 6px; }
.btn-ghost:active { background: ${GRAY2}; }

/* Inputs */
.inp { background: ${BG}; border: none; border-radius: 12px; padding: 14px 16px; font-size: 15px; color: ${TEXT}; width: 100%; transition: all .2s; }
.inp:focus { background: ${GRAY2}; }
.inp::placeholder { color: ${GRAY4}; }

/* Cards */
.card { background: ${CARD}; border-radius: 16px; border: 1px solid ${GRAY2}; overflow: hidden; }
.sheet { background: ${CARD}; border-radius: 24px 24px 0 0; }

/* Badges */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .2px; }
.b-red    { background: rgba(232,51,26,.1); color: ${RED}; }
.b-green  { background: rgba(52,199,89,.12); color: ${GREEN}; }
.b-orange { background: rgba(255,149,0,.12); color: ${ORANGE}; }
.b-blue   { background: rgba(0,122,255,.1); color: ${BLUE}; }
.b-gray   { background: ${GRAY2}; color: ${SUB}; }
.b-dark   { background: ${DARK}; color: #fff; }

/* Navigation */
.tab-bar { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 520px; background: rgba(255,255,255,.92); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 0.5px solid ${GRAY3}; display: flex; align-items: center; padding: 8px 0 20px; z-index: 50; }
.tab-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 4px 0; cursor: pointer; }
.tab-label { font-size: 10px; font-weight: 600; transition: color .15s; }

/* Animations */
@keyframes slideUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
@keyframes sheetUp  { from { transform:translateY(100%); } to { transform:translateY(0); } }
@keyframes spin      { to { transform:rotate(360deg); } }

.slide-up  { animation: slideUp .35s cubic-bezier(.32,.72,0,1) both; }
.fade-in   { animation: fadeIn .2s ease both; }
.sheet-up  { animation: sheetUp .35s cubic-bezier(.32,.72,0,1) both; }
.spinner   { width:22px;height:22px;border:2.5px solid rgba(0,0,0,.1);border-top-color:${RED};border-radius:50%;animation:spin .7s linear infinite; }

/* List item */
.list-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 0.5px solid ${GRAY2}; cursor: pointer; }
.list-row:last-child { border-bottom: none; }
.list-row:active { background: ${BG}; margin: 0 -16px; padding: 14px 16px; border-radius: 12px; }

/* Search bar */
.search-bar { background: ${BG}; border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px; }
.search-bar input { background: none; border: none; outline: none; font-size: 15px; color: ${TEXT}; flex: 1; }
.search-bar input::placeholder { color: ${GRAY4}; }

/* Divider */
.div { height: 0.5px; background: ${GRAY2}; }

/* Photo card grid */
.photo-card { border-radius: 14px; overflow: hidden; position: relative; cursor: pointer; background: ${GRAY2}; }
.photo-card:active { transform: scale(.97); }

/* Segment control */
.seg { display: flex; background: ${BG}; border-radius: 10px; padding: 2px; gap: 2px; }
.seg-btn { flex: 1; padding: 7px; border-radius: 8px; font-size: 13px; font-weight: 600; transition: all .15s; color: ${SUB}; text-align: center; cursor: pointer; }
.seg-btn.active { background: ${CARD}; color: ${TEXT}; box-shadow: 0 1px 3px rgba(0,0,0,.12); }

/* Section header */
.sec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.sec-title { font-size: 18px; font-weight: 700; color: ${TEXT}; }
.sec-link  { font-size: 14px; font-weight: 600; color: ${RED}; }
`;

/* ── Icons ─────────────────────────────────────────────────── */
const Ic = ({ n, s=22, c="currentColor", sw=1.8, fill="none" }) => {
  const p = {
    home:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    search:   <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></>,
    plus:     <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    msg:      <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    user:     <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    chevR:    <polyline points="9 18 15 12 9 6"/>,
    chevL:    <polyline points="15 18 9 12 15 6"/>,
    chevD:    <polyline points="6 9 12 15 18 9"/>,
    x:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check:    <polyline points="20 6 9 17 4 12"/>,
    map:      <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>,
    camera:   <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    star:     <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill={fill} stroke={c}/>,
    send:     <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    tree:     <><path d="M17 14l-5-10-5 10h4v6h2v-6z"/></>,
    building: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></>,
    "hard-hat":<><path d="M2 18h20"/><path d="M12 2L4 10v8h16v-8z"/><path d="M12 2v16"/></>,
    road:     <><path d="M3 18l9-15 9 15"/><line x1="12" y1="3" x2="12" y2="18"/></>,
    droplet:  <><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></>,
    zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    truck:    <><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></>,
    bell:     <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    tag:      <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    verify:   <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    wa:       null,
    zap:      <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    box:      <><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></>,
    img:      <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>,
    grid:     <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    phone:    <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.56 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>,
  };
  if (n === "wa") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
    </svg>
  );
  return <svg width={s} height={s} fill={fill} stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{p[n]}</svg>;
};

/* ── Logo ──────────────────────────────────────────────────── */
function Logo({ size=18 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ width:32, height:32, background:RED, borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ color:"#fff", fontFamily:"Oswald,sans-serif", fontWeight:700, fontSize:15, letterSpacing:-.5 }}>S</span>
      </div>
      <span style={{ fontFamily:"Oswald,sans-serif", fontWeight:700, fontSize:size+2, letterSpacing:.5, color:TEXT }}>SPARTSHUB</span>
    </div>
  );
}

/* ── Spinner ───────────────────────────────────────────────── */
function Spin({ size=22 }) {
  return <div className="spinner" style={{ width:size, height:size }}/>;
}

/* ── Constants ─────────────────────────────────────────────── */
const CATS = [
  { id:"all",   label:"Todas",                    icon:"grid" },
  { id:"min",   label:"Minería",                  icon:"tool" },
  { id:"for",   label:"Forestal",                 icon:"tree" },
  { id:"const", label:"Construcción",             icon:"building" },
  { id:"ene",   label:"Energía",                  icon:"zap" },
  { id:"trans", label:"Transporte y Logística",   icon:"truck" },
  { id:"fae",   label:"Faenas",                   icon:"hard-hat" },
  { id:"rut",   label:"Rutas y Caminos",          icon:"road" },
  { id:"san",   label:"Sanitarias",               icon:"droplet" },
  { id:"serv",  label:"Servicios",                icon:"settings" },
];
const CONDITIONS = ["Nuevo","Usado – Bueno","Usado – Regular","Reacondicionado"];
const OPERATIONS = ["Venta","Arriendo","Trade"];
const CURRENCIES = ["USD","CLP","EUR","COP","PEN","MXN"];
const CAT_ICON = { min:"⚙", for:"▲", const:"■", ene:"⚡", trans:"▶", fae:"◆", rut:"→", san:"◉", serv:"✦", all:"◈" };

const fmtTs = ts => {
  const d = new Date(ts), diff = Math.floor((Date.now()-d)/1000);
  if (diff < 60) return "Ahora"; if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`; return `${Math.floor(diff/86400)}d`;
};
const fmtPrice = (p, cur) => `${cur} ${Number(p) >= 1000 ? (Number(p)/1000).toFixed(Number(p)%1000===0?0:0)+"k" : Number(p).toLocaleString()}`;

/* ── Photo placeholder ─────────────────────────────────────── */
function PhotoPlaceholder({ emoji="📦", size="100%", h=160 }) {
  return (
    <div style={{ width:size, height:h, background:`linear-gradient(145deg,${GRAY2},${GRAY3})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:48 }}>
      {emoji}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   AUTH SCREEN
══════════════════════════════════════════════════════════════ */
function AuthScreen({ onAuth, initialMode="login", onBack }) {
  const [mode, setMode] = useState("login");
  const [step, setStep] = useState(0); // 0=welcome 1=form
  const [f, setF] = useState({ email:"", pass:"", name:"", biz:"", phone:"", location:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    setErr("");
    if (!f.email || !f.pass) { setErr("Email y contraseña requeridos."); return; }
    setLoading(true);
    if (mode === "login") {
      const { data, error } = await sb.auth.signInWithPassword({ email:f.email, password:f.pass });
      if (error) setErr(error.message);
      else onAuth(data.user);
    } else {
      if (!f.name || !f.biz) { setErr("Completa todos los campos."); setLoading(false); return; }
      const { data, error } = await sb.auth.signUp({ email:f.email, password:f.pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (data.user) {
        await sb.from("profiles").upsert({ id:data.user.id, name:f.name, biz:f.biz, phone:f.phone, location:f.location });
        setErr(""); setMode("login"); setStep(1);
        alert("¡Cuenta creada! Revisa tu email para confirmar.");
      }
    }
    setLoading(false);
  };

  // Welcome screen
  if (step === 0) return (
    <div style={{ minHeight:"100vh", background:DARK, display:"flex", flexDirection:"column", position:"relative", overflow:"hidden" }}>
      <style>{CSS}</style>
      {/* Background industrial texture */}
      <div style={{ position:"absolute", inset:0, backgroundImage:`url('https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600&q=60')`, backgroundSize:"cover", backgroundPosition:"center", opacity:.35 }}/>
      <div style={{ position:"absolute", inset:0, background:`linear-gradient(to bottom, transparent 30%, ${DARK} 75%)` }}/>

      <div style={{ position:"relative", flex:1, display:"flex", flexDirection:"column", padding:28, paddingTop:80 }}>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <span className="badge b-dark" style={{ fontSize:10, letterSpacing:1 }}>P2P</span>
          <span className="badge b-dark" style={{ fontSize:10, letterSpacing:1 }}>INDUSTRIAL</span>
          <span className="badge b-dark" style={{ fontSize:10, letterSpacing:1 }}>CHILE</span>
        </div>

        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:24 }}>
          <div style={{ width:44, height:44, background:RED, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ color:"#fff", fontFamily:"Oswald,sans-serif", fontWeight:700, fontSize:22 }}>S</span>
          </div>
          <span style={{ fontFamily:"Oswald,sans-serif", fontWeight:700, fontSize:32, color:"#fff", letterSpacing:1 }}>SPARTSHUB</span>
        </div>

        <p style={{ fontSize:22, fontWeight:700, color:"#fff", lineHeight:1.3, marginBottom:8 }}>
          Conectamos personas,<br/>no repuestos.
        </p>
        <p style={{ fontSize:15, color:"rgba(255,255,255,.6)", marginBottom:32, lineHeight:1.6 }}>
          El marketplace industrial de Chile.
        </p>

        <div style={{ display:"flex", gap:8, marginBottom:40, flexWrap:"wrap" }}>
          {["✓ Verificado","0% Comisión","Trade IA"].map(t => (
            <span key={t} className="badge" style={{ background:"rgba(255,255,255,.12)", color:"rgba(255,255,255,.9)", fontSize:12 }}>{t}</span>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <button className="btn-red" onClick={()=>{ setMode("register"); setStep(1); }} style={{ borderRadius:16, fontSize:17, padding:"17px 24px" }}>
            Comenzar →
          </button>
          <button className="btn-dark" onClick={()=>{ setMode("login"); setStep(1); }} style={{ background:"rgba(255,255,255,.1)", backdropFilter:"blur(10px)", borderRadius:16, fontSize:15, padding:"15px 24px" }}>
            Ya tengo cuenta · Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:WHITE, display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      {/* Top bar */}
      <div style={{ padding:"56px 20px 20px", display:"flex", alignItems:"center", gap:12 }}>
        {onBack && <button className="btn-ghost" style={{ padding:"6px 8px" }} onClick={onBack}><Ic n="chevL" s={22} c={TEXT}/></button>}
        <button className="btn-ghost" onClick={()=>setStep(0)} style={{ padding:"8px" }}><Ic n="chevL" s={22} c={TEXT}/></button>
        <Logo />
      </div>

      <div style={{ flex:1, padding:"0 24px 40px", display:"flex", flexDirection:"column", gap:16 }}>
        <h2 style={{ fontSize:28, fontWeight:700, marginBottom:4 }}>
          {mode==="login" ? "Bienvenido de vuelta" : "Crear cuenta"}
        </h2>
        <p style={{ fontSize:15, color:SUB, marginBottom:8 }}>
          {mode==="login" ? "Ingresa para continuar" : "Únete a la red industrial"}
        </p>

        {/* Seg control */}
        <div className="seg" style={{ marginBottom:8 }}>
          {[["login","Iniciar sesión"],["register","Registrarse"]].map(([m,l]) => (
            <div key={m} className={`seg-btn${mode===m?" active":""}`} onClick={()=>{ setMode(m); setErr(""); }}>{l}</div>
          ))}
        </div>

        {err && <div style={{ background:"rgba(232,51,26,.08)", border:"1px solid rgba(232,51,26,.2)", borderRadius:12, padding:"12px 16px", fontSize:14, color:RED }}>{err}</div>}

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
          <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:GRAY4,fontSize:14,padding:0 }}>
            {showPass ? "🙈" : "👁️"}
          </button>
        </div>

        <button className="btn-red" onClick={submit} disabled={loading} style={{ marginTop:8, opacity:loading?.6:1 }}>
          {loading ? <Spin/> : mode==="login" ? "Ingresar" : "Crear cuenta"}
        </button>

        <p style={{ textAlign:"center", fontSize:13, color:GRAY4, marginTop:8 }}>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.from("listings").select("*").order("created_at", { ascending:false }).limit(20)
      .then(({ data }) => { setListings(data||[]); setLoading(false); });
  }, []);

  const featured = listings.slice(0,6);
  const recent   = listings.slice(0,4);

  return (
    <div style={{ paddingBottom:100 }}>
      {/* Header */}
      <div style={{ padding:"56px 20px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <Logo/>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn-ghost" style={{ padding:"8px", position:"relative" }}>
            <Ic n="bell" s={22} c={TEXT}/>
            <span style={{ position:"absolute", top:5, right:5, width:8, height:8, background:RED, borderRadius:"50%", border:`2px solid ${WHITE}` }}/>
          </button>
          <button className="btn-ghost" style={{ padding:"8px" }}>
            <Ic n="settings" s={22} c={TEXT}/>
          </button>
        </div>
      </div>

      {/* Search bar tap */}
      <div style={{ padding:"0 20px 20px" }}>
        <div className="search-bar" onClick={onGoSearch} style={{ cursor:"pointer" }}>
          <Ic n="search" s={16} c={GRAY4}/>
          <span style={{ fontSize:15, color:GRAY4 }}>Buscar repuestos, equipos…</span>
        </div>
      </div>

      {/* Category icons */}
      <div style={{ padding:"0 20px 24px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {CATS.slice(1,5).map(c => (
            <div key={c.id} onClick={onGoSearch} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, cursor:"pointer" }}>
              <div style={{ width:60, height:60, background:GRAY1, borderRadius:18, display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, transition:"transform .15s" }}
                onMouseDown={e=>e.currentTarget.style.transform="scale(.93)"}
                onMouseUp={e=>e.currentTarget.style.transform=""}>
                {c.emoji}
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:SUB }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Banner carousel */}
      <div style={{ padding:"0 20px 24px", display:"flex", gap:12, overflowX:"auto" }}>
        {/* Banner 1 */}
        <div style={{ minWidth:260, background:RED, borderRadius:18, padding:"18px 20px", position:"relative", overflow:"hidden", flexShrink:0 }}>
          <div style={{ position:"absolute", right:-10, top:-10, width:100, height:100, background:"rgba(255,255,255,.1)", borderRadius:"50%" }}/>
          <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.7)", letterSpacing:1, display:"block", marginBottom:6 }}>OFERTA RELÁMPAGO</span>
          <p style={{ fontSize:20, fontWeight:700, color:"#fff", lineHeight:1.2, marginBottom:4 }}>20% OFF en repuestos CAT</p>
          <p style={{ fontSize:12, color:"rgba(255,255,255,.75)" }}>Hasta agotar stock · 47 pub.</p>
        </div>
        {/* Banner 2 */}
        <div style={{ minWidth:220, background:DARK, borderRadius:18, padding:"18px 20px", flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,.5)", letterSpacing:1, display:"block", marginBottom:6 }}>TRADE ASISTIDO</span>
          <p style={{ fontSize:18, fontWeight:700, color:"#fff", lineHeight:1.2 }}>Lo encontramos por ti</p>
          <p style={{ fontSize:12, color:"rgba(255,255,255,.5)", marginTop:4 }}>Sin compromiso</p>
        </div>
      </div>

      {/* Best rated */}
      <div style={{ padding:"0 20px 24px" }}>
        <div className="sec-header">
          <span className="sec-title">⭐ Mejor calificados</span>
          <span className="sec-link" onClick={onGoSearch}>Ver todo →</span>
        </div>
        {loading ? (
          <div style={{ display:"flex", gap:12 }}>
            {[0,1].map(i => <div key={i} style={{ width:160, height:200, background:GRAY2, borderRadius:14 }}/>)}
          </div>
        ) : (
          <div style={{ display:"flex", gap:12, overflowX:"auto", paddingBottom:4 }}>
            {(featured.length ? featured : DEMO_LISTINGS).map(l => (
              <div key={l.id} className="photo-card" style={{ width:165, flexShrink:0 }} onClick={()=>onSelect(l)}>
                <PhotoPlaceholder emoji={l.emoji||"📦"||"📦"} h={120} size="100%"/>
                <div style={{ padding:"10px 12px" }}>
                  {l.condition?.includes("Nuevo") && <span className="badge b-green" style={{ fontSize:10, marginBottom:6 }}>Nuevo</span>}
                  {l.condition?.includes("Urgente") && <span className="badge b-red" style={{ fontSize:10, marginBottom:6 }}>URGENTE</span>}
                  <p style={{ fontSize:13, fontWeight:600, lineHeight:1.3, marginBottom:4, color:TEXT }}>{l.title}</p>
                  <p style={{ fontSize:12, color:SUB, marginBottom:6 }}>{l.location}</p>
                  <p style={{ fontSize:15, fontWeight:700, color:RED }}>{fmtPrice(l.price, l.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Urgent banner */}
      <div style={{ margin:"0 20px 24px", background:"rgba(255,149,0,.08)", border:"1px solid rgba(255,149,0,.2)", borderRadius:14, padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}
        onClick={onGoSearch}>
        <div style={{ width:36, height:36, background:ORANGE, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ic n="bell" s={16} c="#fff"/>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:14, fontWeight:600 }}>Urgencias hoy en tu zona</p>
          <p style={{ fontSize:12, color:SUB }}>31 solicitudes activas · Responde ahora</p>
        </div>
        <Ic n="chevR" s={18} c={GRAY4}/>
      </div>

      {/* Recent */}
      <div style={{ padding:"0 20px" }}>
        <div className="sec-header">
          <span className="sec-title">🔥 Destacados de la semana</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(listings.length ? listings.slice(0,5) : DEMO_LISTINGS.slice(0,3)).map(l => (
            <MiniCard key={l.id} l={l} onClick={()=>onSelect(l)}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ l, onClick }) {
  return (
    <div onClick={onClick} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:`0.5px solid ${GRAY2}`, cursor:"pointer" }}
      onMouseDown={e=>e.currentTarget.style.opacity=".7"}
      onMouseUp={e=>e.currentTarget.style.opacity="1"}>
      <div style={{ width:68, height:68, borderRadius:14, overflow:"hidden", background:GRAY2, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>
        {l.emoji||"📦"||"📦"}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ fontSize:14, fontWeight:600, lineHeight:1.3, marginBottom:3, color:TEXT }}>{l.title}</p>
        <p style={{ fontSize:12, color:SUB, marginBottom:6 }}>{l.biz} · {l.location}</p>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:16, fontWeight:700, color:RED }}>{fmtPrice(l.price, l.currency)}</span>
          <span style={{ fontSize:11, color:GRAY4 }}>{fmtTs(l.created_at)}</span>
        </div>
      </div>
    </div>
  );
}

/* Demo listings for empty state */
const DEMO_LISTINGS = [
  { id:"d1", cat:"min", title:"Motor CAT 3406E reacondicionado", biz:"EquipMinero CL", location:"Calama, CL", price:28500, currency:"USD", condition:"Reacondicionado", emoji:"🏭", created_at:new Date().toISOString() },
  { id:"d2", cat:"for", title:"Neumáticos 33.00R51 (4 unid.)", biz:"Forestal Sur", location:"Temuco, CL", price:78000, currency:"USD", condition:"Usado – Bueno", emoji:"🌲", created_at:new Date().toISOString() },
  { id:"d3", cat:"hyd", title:"Bomba Rexroth A10V", biz:"HidroTec", location:"Santiago, CL", price:1450, currency:"USD", condition:"Usado – Bueno", emoji:"🔧", created_at:new Date().toISOString() },
];

/* ══════════════════════════════════════════════════════════════
   SEARCH PAGE
══════════════════════════════════════════════════════════════ */
function SearchPage({ user, onSelect }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("grid"); // grid | list

  const load = useCallback(async () => {
    setLoading(true);
    let query = sb.from("listings").select("*").order("created_at", { ascending:false });
    if (cat !== "all") query = query.eq("cat", cat);
    if (q) query = query.ilike("title", `%${q}%`);
    const { data } = await query;
    setListings(data||[]);
    setLoading(false);
  }, [cat, q]);

  useEffect(() => { load(); }, [load]);

  const items = listings.length ? listings : DEMO_LISTINGS;

  return (
    <div style={{ paddingBottom:100 }}>
      {/* Top */}
      <div style={{ padding:"56px 20px 12px" }}>
        <div className="search-bar">
          <Ic n="search" s={16} c={GRAY4}/>
          <input placeholder="Buscar repuestos, equipos, marcas…" value={q} onChange={e=>setQ(e.target.value)} autoFocus/>
          {q && <button onClick={()=>setQ("")} style={{ color:GRAY4 }}><Ic n="x" s={16}/></button>}
        </div>
      </div>

      {/* Categories */}
      <div style={{ padding:"0 20px 14px", display:"flex", gap:8, overflowX:"auto" }}>
        {CATS.map(c => (
          <button key={c.id} onClick={()=>setCat(c.id)}
            style={{ flexShrink:0, padding:"7px 14px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", cursor:"pointer", transition:"all .15s",
              background: cat===c.id ? RED : GRAY1,
              color: cat===c.id ? "#fff" : SUB }}>
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Results header */}
      <div style={{ padding:"0 20px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:13, color:SUB }}>{items.length} publicaciones</span>
        <div style={{ display:"flex", gap:4 }}>
          <button onClick={()=>setViewMode("grid")} className="btn-ghost" style={{ padding:"6px 8px", color:viewMode==="grid"?RED:GRAY4 }}><Ic n="grid" s={18}/></button>
          <button onClick={()=>setViewMode("list")} className="btn-ghost" style={{ padding:"6px 8px", color:viewMode==="list"?RED:GRAY4 }}><Ic n="box" s={18}/></button>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", paddingTop:40 }}><Spin size={30}/></div>
      ) : viewMode === "grid" ? (
        <div style={{ padding:"0 20px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {items.map(l => (
            <div key={l.id} className="photo-card card" onClick={()=>onSelect(l)}>
              <PhotoPlaceholder emoji={l.emoji||"📦"||"📦"} h={130} size="100%"/>
              <div style={{ padding:"10px 12px 14px" }}>
                <div style={{ display:"flex", gap:4, marginBottom:6 }}>
                  <span className="badge b-gray" style={{ fontSize:10 }}>{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
                </div>
                <p style={{ fontSize:13, fontWeight:600, lineHeight:1.3, marginBottom:3, color:TEXT }}>{l.title}</p>
                <p style={{ fontSize:11, color:SUB, marginBottom:6 }}>{l.biz}</p>
                <p style={{ fontSize:15, fontWeight:700, color:RED }}>{fmtPrice(l.price, l.currency)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding:"0 20px" }}>
          {items.map(l => <MiniCard key={l.id} l={l} onClick={()=>onSelect(l)}/>)}
        </div>
      )}
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
    <div className="fade-in" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
        {/* drag handle */}
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, background:GRAY3, borderRadius:2 }}/>
        </div>
        {/* header */}
        <div style={{ padding:"8px 20px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span className="badge b-gray">{CATS.find(c=>c.id===l.cat)?.label||"—"}</span>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20}/></button>
        </div>
        <div style={{ overflowY:"auto", flex:1, paddingBottom:40 }}>
          {/* Photo */}
          <div style={{ height:220, background:GRAY2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:80 }}>
            {l.emoji||"📦"||"📦"}
          </div>
          <div style={{ padding:"20px 20px 0" }}>
            {/* title */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, marginBottom:8 }}>
              <h2 style={{ fontSize:22, fontWeight:700, lineHeight:1.2, color:TEXT, flex:1 }}>{l.title}</h2>
              {l.verified && <span className="badge b-green"><Ic n="verify" s={10} c={GREEN}/>Verificado</span>}
            </div>
            {/* price */}
            <p style={{ fontSize:28, fontWeight:700, color:RED, marginBottom:16 }}>{l.currency} {Number(l.price).toLocaleString()}</p>

            {/* info grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {[["Condición",l.condition],["Operación",l.operation||"Venta"],["Stock",`${l.stock||1} u.`],["Marca",l.brand||"—"]].map(([k,v])=>(
                <div key={k} style={{ background:GRAY1, borderRadius:12, padding:"12px 14px" }}>
                  <p style={{ fontSize:11, color:SUB, marginBottom:3, fontWeight:500 }}>{k}</p>
                  <p style={{ fontSize:14, fontWeight:600, color:TEXT }}>{v}</p>
                </div>
              ))}
            </div>

            {/* location */}
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, padding:"12px 14px", background:GRAY1, borderRadius:12 }}>
              <Ic n="map" s={16} c={RED}/>
              <span style={{ fontSize:14, fontWeight:500 }}>{l.location}</span>
            </div>

            {/* description */}
            {l.description && (
              <div style={{ marginBottom:20 }}>
                <p style={{ fontSize:13, fontWeight:600, color:DARK2, marginBottom:8 }}>DESCRIPCIÓN</p>
                <p style={{ fontSize:15, color:SUB, lineHeight:1.7 }}>{l.description}</p>
              </div>
            )}

            <div className="div" style={{ marginBottom:20 }}/>

            {/* Seller */}
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:24 }}>
              <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${RED},${RED2})`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ color:"#fff", fontWeight:700, fontSize:18 }}>{(l.biz||"U")[0]}</span>
              </div>
              <div>
                <p style={{ fontSize:16, fontWeight:700 }}>{l.biz}</p>
                <div style={{ display:"flex", gap:6, marginTop:2 }}>
                  {[1,2,3,4,5].map(i => <Ic key={i} n="star" s={12} c={ORANGE} fill={ORANGE}/>)}
                  <span style={{ fontSize:12, color:SUB }}>4.8 · 47 reseñas</span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div style={{ display:"flex", flexDirection:"column", gap:12, padding:"0 0 20px" }}>
              {l.phone && (
                <button onClick={wa} style={{ background:"#25D366", color:"#fff", borderRadius:14, padding:"16px", fontSize:16, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:10, border:"none", cursor:"pointer" }}>
                  <Ic n="wa" s={22} c="#fff"/>
                  Contactar por WhatsApp
                </button>
              )}
              <button className="btn-outline" style={{ justifyContent:"center", padding:15 }} onClick={()=>{ onClose(); onChat(l); }}>
                <Ic n="msg" s={18} c={RED}/>
                <span style={{ color:RED, fontWeight:600 }}>Mensaje en SpartsHub</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PUBLISH FLOW
══════════════════════════════════════════════════════════════ */
function PublishSheet({ user, profile, onClose, onDone }) {
  const [step, setStep] = useState(0); // 0=type selector 1=form
  const [type, setType] = useState("producto");
  const [f, setF] = useState({ title:"", brand:"", model:"", cat:"hyd", condition:"Nuevo", operation:"Venta", price:"", currency:"USD", stock:"1", location:profile?.location||"", phone:profile?.phone||"", biz:profile?.biz||"", description:"" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const upd = (k,v) => setF(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!f.title || !f.price) { setErr("Título y precio requeridos."); return; }
    setLoading(true);
    const { error } = await sb.from("listings").insert({
      user_id:user.id, title:f.title, brand:f.brand, model:f.model, cat:f.cat,
      condition:f.condition, operation:f.operation, price:Number(f.price), currency:f.currency,
      stock:Number(f.stock)||1, location:f.location, phone:f.phone||profile?.phone, biz:f.biz||profile?.biz,
      description:f.description, emoji:"📦"||"📦", verified:false,
    });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onDone();
  };

  const TYPES = [
    { id:"producto", icon:"box",    title:"Producto",           sub:"Repuesto, equipo o accesorio" },
    { id:"servicio", icon:"settings",title:"Servicio",          sub:"Taller, reparación, mantención" },
    { id:"excel",    icon:"grid",   title:"Carga masiva (Excel)",sub:"Sube hasta 234 ítems desde Excel" },
    { id:"ai",       icon:"camera", title:"Identifica con IA",  sub:"Toma una foto y la IA lo identifica", highlight:true },
  ];

  return (
    <div className="fade-in" style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:60, display:"flex", flexDirection:"column", justifyContent:"flex-end" }} onClick={onClose}>
      <div className="sheet sheet-up" style={{ maxHeight:"94vh", overflow:"hidden", display:"flex", flexDirection:"column" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:36, height:4, background:GRAY3, borderRadius:2 }}/>
        </div>
        <div style={{ padding:"8px 20px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {step===1 && <button className="btn-ghost" style={{ padding:"6px 8px" }} onClick={()=>setStep(0)}><Ic n="chevL" s={20}/></button>}
            <h3 style={{ fontSize:18, fontWeight:700 }}>{step===0 ? "Nueva publicación" : type==="producto" ? "Producto" : "Publicar"}</h3>
          </div>
          <button className="btn-ghost" style={{ padding:"6px" }} onClick={onClose}><Ic n="x" s={20}/></button>
        </div>

        <div style={{ overflowY:"auto", flex:1, padding:"0 20px 40px" }}>
          {step === 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <p style={{ fontSize:14, color:SUB, marginBottom:4 }}>¿Qué quieres publicar?</p>
              {TYPES.map(t => (
                <div key={t.id} onClick={()=>{ setType(t.id); setStep(1); }}
                  style={{ display:"flex", alignItems:"center", gap:16, padding:"16px", borderRadius:14, border:`1.5px solid ${t.highlight?RED:GRAY2}`, background:t.highlight?"rgba(232,51,26,.04)":WHITE, cursor:"pointer", transition:"all .15s" }}
                  onMouseDown={e=>e.currentTarget.style.background=GRAY1}
                  onMouseUp={e=>e.currentTarget.style.background=t.highlight?"rgba(232,51,26,.04)":WHITE}>
                  <div style={{ width:44, height:44, background:t.highlight?RED:GRAY1, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <Ic n={t.icon} s={20} c={t.highlight?"#fff":DARK2}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:16, fontWeight:600, marginBottom:2 }}>{t.title}</p>
                    <p style={{ fontSize:13, color:SUB }}>{t.sub}</p>
                  </div>
                  <Ic n="chevR" s={18} c={GRAY4}/>
                </div>
              ))}
            </div>
          )}

          {step === 1 && type === "producto" && (
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {/* Photo upload area */}
              <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:4 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width:80, height:80, background:GRAY1, borderRadius:14, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, flexShrink:0, border:`1.5px dashed ${i===0?RED:GRAY3}`, cursor:"pointer" }}>
                    <Ic n="camera" s={i===0?22:18} c={i===0?RED:GRAY4}/>
                    {i===0 && <span style={{ fontSize:10, color:RED, fontWeight:600 }}>Foto</span>}
                  </div>
                ))}
              </div>
              <p style={{ fontSize:12, color:GRAY4, marginTop:-8 }}>Hasta 8 fotos. La primera es la principal.</p>

              {err && <div style={{ background:"rgba(232,51,26,.08)", borderRadius:10, padding:"10px 14px", fontSize:13, color:RED }}>{err}</div>}

              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Título</p>
                <input className="inp" placeholder="Ej. Motor CAT 3406E reacondicionado" value={f.title} onChange={e=>upd("title",e.target.value)}/>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Industria</p>
                  <select className="inp" value={f.cat} onChange={e=>upd("cat",e.target.value)} style={{ appearance:"none" }}>
                    {CATS.filter(c=>c.id!=="all").map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Categoría</p>
                  <select className="inp" style={{ appearance:"none" }}>
                    <option>—</option>
                  </select>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Marca</p>
                  <input className="inp" placeholder="Caterpillar" value={f.brand} onChange={e=>upd("brand",e.target.value)}/>
                </div>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Modelo</p>
                  <input className="inp" placeholder="3406E" value={f.model} onChange={e=>upd("model",e.target.value)}/>
                </div>
              </div>

              {/* Condition */}
              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Estado</p>
                <div style={{ display:"flex", gap:8 }}>
                  {["Nuevo","Usado"].map(c => (
                    <button key={c} onClick={()=>upd("condition",c)}
                      style={{ flex:1, padding:"10px", borderRadius:10, border:`1.5px solid ${f.condition===c?RED:GRAY3}`, background:f.condition===c?"rgba(232,51,26,.06)":WHITE, fontWeight:600, fontSize:14, color:f.condition===c?RED:SUB, cursor:"pointer" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Operation */}
              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Operación</p>
                <div style={{ display:"flex", gap:8 }}>
                  {OPERATIONS.map(op => (
                    <button key={op} onClick={()=>upd("operation",op)}
                      style={{ flex:1, padding:"10px", borderRadius:10, border:`1.5px solid ${f.operation===op?RED:GRAY3}`, background:f.operation===op?"rgba(232,51,26,.06)":WHITE, fontWeight:600, fontSize:13, color:f.operation===op?RED:SUB, cursor:"pointer" }}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Precio</p>
                <div style={{ display:"flex", gap:8 }}>
                  <div style={{ position:"relative", flex:1 }}>
                    <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color:GRAY4 }}>$</span>
                    <input className="inp" type="number" placeholder="0" value={f.price} onChange={e=>upd("price",e.target.value)} style={{ paddingLeft:30 }}/>
                  </div>
                  <select className="inp" value={f.currency} onChange={e=>upd("currency",e.target.value)} style={{ width:90, appearance:"none" }}>
                    {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Descripción</p>
                <textarea className="inp" rows={3} placeholder="Detalles, compatibilidad, estado actual…" value={f.description} onChange={e=>upd("description",e.target.value)} style={{ resize:"none" }}/>
              </div>

              <div>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>Ubicación</p>
                <input className="inp" placeholder="Ciudad, País" value={f.location} onChange={e=>upd("location",e.target.value)}/>
              </div>

              <button className="btn-red" onClick={submit} disabled={loading||!f.title||!f.price} style={{ marginTop:8, opacity:(!f.title||!f.price||loading)?.5:1 }}>
                {loading ? <Spin/> : "Publicar gratis"}
              </button>
            </div>
          )}

          {step === 1 && type !== "producto" && (
            <div style={{ paddingTop:40, textAlign:"center" }}>
              <div style={{ fontSize:64, marginBottom:16 }}>🚧</div>
              <p style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Próximamente</p>
              <p style={{ fontSize:14, color:SUB }}>Esta función estará disponible pronto.</p>
              <button className="btn-red" style={{ marginTop:24 }} onClick={()=>setStep(0)}>Volver</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MESSAGES PAGE
══════════════════════════════════════════════════════════════ */
function MessagesPage({ user, initListing, onClear }) {
  const [contacts, setContacts] = useState([]);
  const [active, setActive] = useState(null);
  const [filter, setFilter] = useState("Todas");
  const FILTERS = ["Todas","Interesado","Negociación","Vendido"];

  useEffect(() => {
    if (initListing) {
      sb.from("profiles").select("*").eq("id", initListing.user_id).single().then(({ data }) => {
        if (data) setActive({ profile:data, listing:initListing });
        onClear();
      });
    }
  }, [initListing]);

  useEffect(() => {
    const load = async () => {
      const [{ data:s }, { data:r }] = await Promise.all([
        sb.from("messages").select("to_id").eq("from_id", user.id),
        sb.from("messages").select("from_id").eq("to_id", user.id),
      ]);
      const ids = new Set([...(s||[]).map(m=>m.to_id), ...(r||[]).map(m=>m.from_id)]);
      if (!ids.size) return;
      const { data } = await sb.from("profiles").select("*").in("id",[...ids]);
      setContacts(data||[]);
    };
    load();
  }, [user.id]);

  if (active) return <ChatView user={user} other={active.profile} listing={active.listing} onBack={()=>setActive(null)}/>;

  return (
    <div style={{ paddingBottom:100 }}>
      <div style={{ padding:"56px 20px 16px" }}>
        <h1 style={{ fontSize:28, fontWeight:700, marginBottom:16 }}>Chat</h1>
        {/* Search */}
        <div className="search-bar">
          <Ic n="search" s={16} c={GRAY4}/>
          <input placeholder="Buscar conversaciones…"/>
        </div>
      </div>
      {/* Filters */}
      <div style={{ padding:"0 20px 16px", display:"flex", gap:8, overflowX:"auto" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            style={{ flexShrink:0, padding:"7px 16px", borderRadius:20, fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
              background: filter===f ? DARK : GRAY1, color: filter===f ? "#fff" : SUB }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ padding:"0 20px" }}>
        {contacts.length === 0 ? (
          <div style={{ paddingTop:60, textAlign:"center" }}>
            <div style={{ fontSize:56, marginBottom:16 }}>💬</div>
            <p style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Sin conversaciones</p>
            <p style={{ fontSize:14, color:SUB }}>Contacta a un vendedor desde cualquier publicación</p>
          </div>
        ) : contacts.map(c => (
          <div key={c.id} className="list-row" onClick={()=>setActive({ profile:c, listing:null })}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:`linear-gradient(135deg,#8B5CF6,#7C3AED)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ color:"#fff", fontWeight:700, fontSize:18 }}>{(c.biz||c.name||"U")[0]}{(c.biz||c.name||"U")[1]||""}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:15, fontWeight:600, marginBottom:2 }}>{c.biz||c.name}</p>
              <p style={{ fontSize:13, color:SUB, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.location}</p>
            </div>
            <Ic n="chevR" s={18} c={GRAY4}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatView({ user, other, listing, onBack }) {
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(true);
  const endRef = useRef();

  const load = useCallback(async () => {
    const { data } = await sb.from("messages").select("*")
      .or(`and(from_id.eq.${user.id},to_id.eq.${other.id}),and(from_id.eq.${other.id},to_id.eq.${user.id})`)
      .order("created_at", { ascending:true });
    setMsgs(data||[]);
    setLoading(false);
  }, [user.id, other.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  useEffect(() => {
    const ch = sb.channel(`chat-${[user.id,other.id].sort().join("-")}`)
      .on("postgres_changes",{ event:"INSERT", schema:"public", table:"messages" }, load)
      .subscribe();
    return () => sb.removeChannel(ch);
  }, [user.id, other.id, load]);

  const send = async () => {
    const body = inp.trim();
    if (!body) return;
    setInp("");
    await sb.from("messages").insert({ from_id:user.id, to_id:other.id, body, listing_id:listing?.id||null });
    load();
  };

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column", background:WHITE }}>
      {/* Header */}
      <div style={{ padding:"56px 16px 12px", borderBottom:`0.5px solid ${GRAY2}`, display:"flex", gap:12, alignItems:"center", flexShrink:0 }}>
        <button className="btn-ghost" style={{ padding:"6px 8px" }} onClick={onBack}><Ic n="chevL" s={22}/></button>
        <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,#8B5CF6,#7C3AED)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ color:"#fff", fontWeight:700, fontSize:16 }}>{(other.biz||other.name||"U")[0]}</span>
        </div>
        <div style={{ flex:1 }}>
          <p style={{ fontSize:16, fontWeight:700 }}>{other.biz||other.name}</p>
          <p style={{ fontSize:12, color:GREEN, fontWeight:500 }}>● En línea</p>
        </div>
        <Ic n="phone" s={20} c={RED}/>
      </div>
      {listing && (
        <div style={{ padding:"10px 16px", background:GRAY1, borderBottom:`0.5px solid ${GRAY2}`, display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ fontSize:20 }}>{listing.emoji||"📦"}</span>
          <div>
            <p style={{ fontSize:12, color:SUB }}>Consulta sobre</p>
            <p style={{ fontSize:13, fontWeight:600 }}>{listing.title}</p>
          </div>
        </div>
      )}
      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px", display:"flex", flexDirection:"column", gap:8 }}>
        {loading ? <div style={{ display:"flex", justifyContent:"center", paddingTop:40 }}><Spin/></div> :
          msgs.length === 0 ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
              <div style={{ fontSize:48 }}>👋</div>
              <p style={{ fontSize:16, fontWeight:600 }}>Inicia la conversación</p>
              <p style={{ fontSize:14, color:SUB }}>Los mensajes son directos y privados</p>
            </div>
          ) : msgs.map((m,i)=>{
            const mine = m.from_id === user.id;
            return (
              <div key={m.id||i} style={{ display:"flex", justifyContent:mine?"flex-end":"flex-start" }}>
                <div style={{ maxWidth:"76%", background:mine?RED:GRAY1, color:mine?"#fff":TEXT, borderRadius:mine?"18px 18px 4px 18px":"18px 18px 18px 4px", padding:"11px 15px", fontSize:15, lineHeight:1.5 }}>
                  <p>{m.body}</p>
                  <p style={{ fontSize:10, opacity:.6, marginTop:4, textAlign:mine?"right":"left" }}>{fmtTs(m.created_at)}</p>
                </div>
              </div>
            );
          })
        }
        <div ref={endRef}/>
      </div>
      {/* Input */}
      <div style={{ padding:"12px 16px 32px", borderTop:`0.5px solid ${GRAY2}`, display:"flex", gap:10, flexShrink:0, background:WHITE }}>
        <input className="inp" value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Escribe un mensaje…" style={{ flex:1, borderRadius:24, padding:"12px 18px" }}/>
        <button onClick={send} style={{ width:44, height:44, background:RED, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", border:"none", cursor:"pointer", flexShrink:0 }}>
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
  const [section, setSection] = useState("perfil"); // perfil | settings | alertas | soporte
  const [listings, setListings] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ name:"", rut:"", biz:"", phone:"", address:"", location:"" });
  const [alertForm, setAlertForm] = useState({ keyword:"", cat:"all", email: user?.email||"", notifType:"email", wa:"" });
  const [alerts, setAlerts] = useState([]);
  const [alertSaved, setAlertSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [supportMsg, setSupportMsg] = useState("");
  const [supportSent, setSupportSent] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkDone, setBulkDone] = useState(false);
  const fileRef = useRef();
  const [listTab, setListTab] = useState("publicaciones");

  useEffect(() => {
    sb.from("listings").select("*").eq("user_id", user.id).order("created_at",{ascending:false}).then(({ data })=>setListings(data||[]));
  }, [user.id]);

  useEffect(() => {
    if (profile) setEditData({ name:profile.name||"", rut:profile.rut||"", biz:profile.biz||"", phone:profile.phone||"", address:profile.address||"", location:profile.location||"" });
  }, [profile]);

  const saveProfile = async () => {
    await sb.from("profiles").update(editData).eq("id", user.id);
    setEditMode(false);
  };

  const saveAlert = () => {
    if (!alertForm.keyword) return;
    setAlerts(a => [...a, { ...alertForm, id: Date.now() }]);
    setAlertForm({ keyword:"", cat:"all", email: user?.email||"" });
    setAlertSaved(true);
    setTimeout(() => setAlertSaved(false), 3000);
  };

  const deleteAlert = (id) => setAlerts(a => a.filter(x => x.id !== id));

  const sendSupport = () => {
    if (!supportMsg.trim()) return;
    setSupportSent(true);
    setSupportMsg("");
    setTimeout(() => setSupportSent(false), 4000);
  };

  const handleBulkFile = (file) => {
    setBulkFile(file);
    // Parse CSV/Excel preview (mock)
    const mockRows = [
      { title:"Rodamiento SKF 6205", cat:"min", condition:"Nuevo", price:"45000", currency:"CLP" },
      { title:"Bomba hidráulica Parker", cat:"const", condition:"Usado – Bueno", price:"850000", currency:"CLP" },
      { title:"Filtro Fleetguard HF337", cat:"trans", condition:"Nuevo", price:"28000", currency:"CLP" },
    ];
    setBulkRows(mockRows);
  };

  const uploadBulk = async () => {
    setBulkUploading(true);
    for (const row of bulkRows) {
      await sb.from("listings").insert({ user_id:user.id, title:row.title, cat:row.cat, condition:row.condition, price:Number(row.price), currency:row.currency, biz:profile?.biz||"", location:profile?.location||"", emoji:"📦", verified:false });
    }
    setBulkUploading(false);
    setBulkDone(true);
    setBulkRows([]);
    setBulkFile(null);
  };

  const initials = ((profile?.name||"U ").split(" ").map(w=>w[0]).join("")).slice(0,2).toUpperCase();
  const colors = ["#8B5CF6","#3B82F6","#10B981","#F59E0B","#EF4444"];
  const color = colors[(user.email||"").charCodeAt(0) % colors.length];

  const SECTIONS = [
    { id:"perfil",   label:"Mi Perfil",        icn:"user" },
    { id:"alertas",  label:"Mis Alertas",       icn:"bell" },
    { id:"bulk",     label:"Carga Masiva",      icn:"box" },
    { id:"soporte",  label:"Soporte",           icn:"msg" },
    { id:"settings", label:"Configuración",     icn:"settings" },
  ];

  return (
    <div style={{ display:"flex", height:"100%", background:GRAY1 }}>
      {/* Left sub-nav */}
      <div style={{ width:200, background:WHITE, borderRight:`1px solid ${GRAY2}`, padding:"20px 0", flexShrink:0, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"0 16px 20px", borderBottom:`1px solid ${GRAY2}`, marginBottom:8 }}>
          <div style={{ width:48, height:48, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:8 }}>
            <span style={{ color:"#fff", fontWeight:700, fontSize:18 }}>{initials}</span>
          </div>
          <p style={{ fontSize:14, fontWeight:700, color:TEXT }}>{profile?.name||"Usuario"}</p>
          <p style={{ fontSize:12, color:SUB }}>{profile?.biz||"—"}</p>
        </div>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={()=>setSection(s.id)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", background:section===s.id?"rgba(232,51,26,.06)":"transparent", color:section===s.id?RED:DARK2, fontWeight:section===s.id?700:400, fontSize:14, width:"100%", textAlign:"left", border:"none", cursor:"pointer", borderLeft:section===s.id?`3px solid ${RED}`:"3px solid transparent", transition:"all .15s" }}>
            <Ic n={s.icn} s={16} c={section===s.id?RED:GRAY4}/>
            {s.label}
          </button>
        ))}
        <div style={{ flex:1 }}/>
        <button onClick={onLogout} style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", color:RED, fontSize:14, width:"100%", textAlign:"left", border:"none", cursor:"pointer", background:"transparent" }}>
          <Ic n="logout" s={16} c={RED}/>Cerrar sesión
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflowY:"auto", padding:32 }}>

        {/* ── MI PERFIL ── */}
        {section === "perfil" && (
          <div style={{ maxWidth:600 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h2 style={{ fontSize:22, fontWeight:700 }}>Mi Perfil</h2>
              <button className="btn-outline" style={{ padding:"8px 16px", fontSize:13 }} onClick={()=>setEditMode(e=>!e)}>
                {editMode ? "Cancelar" : "Editar datos"}
              </button>
            </div>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
              {[["Publicaciones",listings.length],["Contactos recibidos","—"],["Miembro desde","May 2026"]].map(([k,v])=>(
                <div key={k} style={{ background:WHITE, borderRadius:12, padding:"16px", border:`1px solid ${GRAY2}`, textAlign:"center" }}>
                  <p style={{ fontSize:22, fontWeight:700, color:RED }}>{v}</p>
                  <p style={{ fontSize:11, color:SUB, marginTop:4 }}>{k.toUpperCase()}</p>
                </div>
              ))}
            </div>
            {/* Edit form */}
            <div style={{ background:WHITE, borderRadius:14, padding:24, border:`1px solid ${GRAY2}`, display:"flex", flexDirection:"column", gap:14 }}>
              {[["Nombre completo","name","Ej: Carlos Muñoz"],["RUT","rut","12.345.678-9"],["Empresa / Negocio","biz","Ej: Minera Los Andes"],["WhatsApp / Teléfono","phone","+56 9 1234 5678"],["Dirección","address","Ej: Av. Libertador 1234, Santiago"],["Ciudad y País","location","Santiago, Chile"]].map(([label,key,ph])=>(
                <div key={key}>
                  <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>{label.toUpperCase()}</p>
                  {editMode ? (
                    <div style={{ display:"flex", gap:8 }}>
                      <input className="inp" style={{ flex:1 }} value={editData[key]} onChange={e=>setEditData(d=>({...d,[key]:e.target.value}))} placeholder={ph}/>
                      {key==="location" && (
                        <button title="Usar mi ubicación" onClick={()=>{
                          if(navigator.geolocation) navigator.geolocation.getCurrentPosition(pos=>{
                            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
                              .then(r=>r.json()).then(d=>setEditData(ed=>({...ed,location:`${d.address?.city||d.address?.town||""}, ${d.address?.country||""}`})));
                          });
                        }} style={{ background:BG, border:`1px solid ${GRAY2}`, borderRadius:10, padding:"0 14px", cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", gap:4, fontSize:13, color:DARK2 }}>
                          <Ic n="map" s={15} c={DARK2}/> Auto
                        </button>
                      )}
                    </div>
                  ) : <p style={{ fontSize:15, color:TEXT, padding:"10px 0", borderBottom:`1px solid ${GRAY2}` }}>{editData[key]||"—"}</p>}
                </div>
              ))}
              <div>
                <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>EMAIL</p>
                <p style={{ fontSize:15, color:GRAY4, padding:"10px 0" }}>{user.email}</p>
              </div>
              {editMode && (
                <button className="btn-red" onClick={saveProfile}>Guardar cambios</button>
              )}
            </div>

            {/* Mis publicaciones */}
            <h3 style={{ fontSize:17, fontWeight:700, marginTop:28, marginBottom:16 }}>Mis publicaciones</h3>
            {listings.length === 0 ? (
              <div style={{ background:WHITE, borderRadius:12, padding:32, textAlign:"center", border:`1px solid ${GRAY2}` }}>
                <p style={{ color:SUB }}>No tienes publicaciones aún</p>
              </div>
            ) : listings.map(l => (
              <div key={l.id} style={{ background:WHITE, borderRadius:12, padding:16, marginBottom:10, border:`1px solid ${GRAY2}`, display:"flex", gap:12, alignItems:"center" }}>
                <div style={{ width:48, height:48, background:GRAY1, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>{l.emoji||"📦"}</div>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:600, fontSize:14 }}>{l.title}</p>
                  <p style={{ fontSize:13, color:RED, fontWeight:700 }}>{fmtPrice(l.price,l.currency)}</p>
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:GREEN, background:"rgba(52,199,89,.1)", padding:"4px 10px", borderRadius:20 }}>Activo</span>
              </div>
            ))}
          </div>
        )}

        {/* ── ALERTAS ── */}
        {section === "alertas" && (
          <div style={{ maxWidth:600 }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Mis Alertas de Búsqueda</h2>
            <p style={{ color:SUB, fontSize:14, marginBottom:24 }}>Recibe una notificación por email cuando se publique lo que estás buscando.</p>
            <div style={{ background:WHITE, borderRadius:14, padding:24, border:`1px solid ${GRAY2}`, marginBottom:24 }}>
              <p style={{ fontSize:13, fontWeight:700, marginBottom:16, color:DARK2 }}>CREAR NUEVA ALERTA</p>
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>QUÉ ESTÁS BUSCANDO</p>
                  <input className="inp" placeholder="Ej: Bomba hidráulica Rexroth A10V" value={alertForm.keyword} onChange={e=>setAlertForm(f=>({...f,keyword:e.target.value}))}/>
                </div>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>CATEGORÍA</p>
                  <select className="inp" value={alertForm.cat} onChange={e=>setAlertForm(f=>({...f,cat:e.target.value}))} style={{ appearance:"none" }}>
                    {CATS.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>NOTIFICAR A</p>
                  <input className="inp" value={alertForm.email} onChange={e=>setAlertForm(f=>({...f,email:e.target.value}))} placeholder="tu@email.com"/>
                </div>
                {alertSaved && <p style={{ color:GREEN, fontSize:13, fontWeight:600 }}>✓ Alerta guardada — te avisaremos cuando haya coincidencias</p>}
                <div>
                  <p style={{ fontSize:12, fontWeight:600, color:SUB, marginBottom:6 }}>NOTIFICAR POR</p>
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    {[["email","Email"],["whatsapp","WhatsApp"]].map(([val,lbl])=>(
                      <div key={val} onClick={()=>setAlertForm(f=>({...f,notifType:val}))}
                        style={{ flex:1, padding:"10px", borderRadius:8, border:`1.5px solid ${alertForm.notifType===val?RED:GRAY2}`, background:alertForm.notifType===val?`rgba(193,63,30,.06)`:CARD, cursor:"pointer", textAlign:"center" }}>
                        <p style={{ fontSize:13, fontWeight:700, color:alertForm.notifType===val?RED:DARK2 }}>{lbl}</p>
                      </div>
                    ))}
                  </div>
                  {alertForm.notifType==="whatsapp" && (
                    <input className="inp" placeholder="+56 9 1234 5678" value={alertForm.wa||""} onChange={e=>setAlertForm(f=>({...f,wa:e.target.value}))} style={{ marginBottom:12 }}/>
                  )}
                </div>
                <button className="btn-red" onClick={saveAlert} style={{ marginTop:4 }}>
                  <Ic n="bell" s={16} c="#fff"/> Activar alerta
                </button>
              </div>
            </div>
            {alerts.length > 0 && (
              <div>
                <p style={{ fontSize:13, fontWeight:700, marginBottom:12, color:DARK2 }}>ALERTAS ACTIVAS</p>
                {alerts.map(a => (
                  <div key={a.id} style={{ background:WHITE, borderRadius:12, padding:"14px 16px", marginBottom:8, border:`1px solid ${GRAY2}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <p style={{ fontWeight:600, fontSize:14 }}>{a.keyword}</p>
                      <p style={{ fontSize:12, color:SUB }}>{CATS.find(c=>c.id===a.cat)?.label} · {a.email}</p>
                    </div>
                    <button onClick={()=>deleteAlert(a.id)} style={{ color:RED, fontSize:12, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CARGA MASIVA ── */}
        {section === "bulk" && (
          <div style={{ maxWidth:700 }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Carga Masiva de Publicaciones</h2>
            <p style={{ color:SUB, fontSize:14, marginBottom:24 }}>Sube hasta 500 publicaciones de una sola vez usando un archivo Excel o CSV.</p>
            
            {/* Template download */}
            <div style={{ background:"rgba(232,51,26,.05)", border:`1px solid rgba(232,51,26,.2)`, borderRadius:12, padding:20, marginBottom:24, display:"flex", gap:16, alignItems:"center" }}>
              <div style={{ width:44, height:44, background:RED, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ic n="box" s={20} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:15 }}>Descargar plantilla Excel</p>
                <p style={{ fontSize:13, color:SUB, marginTop:2 }}>Usa esta plantilla con las columnas correctas para cargar tus productos.</p>
              </div>
              <button className="btn-outline" style={{ padding:"9px 18px", fontSize:13, flexShrink:0 }} onClick={()=>window.open("/plantilla_carga_masiva.xlsx","_blank")}>Descargar →</button>
            </div>

            {/* Upload area */}
            {!bulkFile ? (
              <div onClick={()=>fileRef.current.click()}
                style={{ border:`2px dashed ${GRAY3}`, borderRadius:14, padding:48, textAlign:"center", cursor:"pointer", transition:"all .2s" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
                onMouseLeave={e=>e.currentTarget.style.borderColor=GRAY3}>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }} onChange={e=>handleBulkFile(e.target.files[0])}/>
                <div style={{ width:56, height:56, background:GRAY1, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
                  <Ic n="box" s={28} c={GRAY4}/>
                </div>
                <p style={{ fontWeight:600, fontSize:16, marginBottom:6 }}>Arrastra tu archivo aquí</p>
                <p style={{ color:SUB, fontSize:14 }}>o haz click para seleccionar</p>
                <p style={{ color:GRAY4, fontSize:12, marginTop:8 }}>Excel (.xlsx) o CSV — máximo 500 filas</p>
              </div>
            ) : (
              <div>
                <div style={{ background:WHITE, borderRadius:12, padding:16, border:`1px solid ${GRAY2}`, marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:40, height:40, background:"rgba(52,199,89,.1)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <Ic n="check" s={18} c={GREEN}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:600 }}>{bulkFile.name}</p>
                    <p style={{ fontSize:13, color:GREEN }}>{bulkRows.length} publicaciones encontradas</p>
                  </div>
                  <button onClick={()=>{setBulkFile(null);setBulkRows([]);}} style={{ color:SUB, fontSize:13, background:"none", border:"none", cursor:"pointer" }}>Cambiar</button>
                </div>
                {/* Preview */}
                <div style={{ background:WHITE, borderRadius:12, border:`1px solid ${GRAY2}`, overflow:"hidden", marginBottom:16 }}>
                  <div style={{ background:GRAY1, padding:"10px 16px", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12 }}>
                    {["Título","Categoría","Condición","Precio"].map(h=><span key={h} style={{ fontSize:11, fontWeight:700, color:SUB }}>{h}</span>)}
                  </div>
                  {bulkRows.map((r,i)=>(
                    <div key={i} style={{ padding:"12px 16px", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:12, borderTop:`1px solid ${GRAY2}` }}>
                      <span style={{ fontSize:13 }}>{r.title}</span>
                      <span style={{ fontSize:13, color:SUB }}>{CATS.find(c=>c.id===r.cat)?.label||r.cat}</span>
                      <span style={{ fontSize:13, color:SUB }}>{r.condition}</span>
                      <span style={{ fontSize:13, color:RED, fontWeight:600 }}>{Number(r.price).toLocaleString()} {r.currency}</span>
                    </div>
                  ))}
                </div>
                {bulkDone
                  ? <p style={{ color:GREEN, fontSize:14, fontWeight:600, textAlign:"center" }}>✓ {bulkRows.length > 0 ? "Publicaciones cargadas" : "¡Carga completada!"}</p>
                  : <button className="btn-red" onClick={uploadBulk} disabled={bulkUploading}>
                      {bulkUploading ? "Subiendo..." : `Publicar ${bulkRows.length} productos`}
                    </button>
                }
              </div>
            )}
          </div>
        )}

        {/* ── SOPORTE ── */}
        {section === "soporte" && (
          <div style={{ maxWidth:600 }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>Soporte</h2>
            <p style={{ color:SUB, fontSize:14, marginBottom:28 }}>Estamos aquí para ayudarte. Elige cómo quieres contactarnos.</p>

            {/* IA Support */}
            <div style={{ background:`linear-gradient(135deg,rgba(232,51,26,.08),rgba(232,51,26,.02))`, border:`1px solid rgba(232,51,26,.2)`, borderRadius:14, padding:24, marginBottom:16 }}>
              <div style={{ display:"flex", gap:14, alignItems:"flex-start", marginBottom:16 }}>
                <div style={{ width:44, height:44, background:RED, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ color:"#fff", fontSize:22 }}>⚡</span>
                </div>
                <div>
                  <p style={{ fontWeight:700, fontSize:16 }}>Soporte con IA</p>
                  <p style={{ fontSize:13, color:SUB, marginTop:2 }}>Respuesta inmediata las 24 horas. Ideal para dudas sobre la plataforma, publicaciones y búsquedas.</p>
                </div>
              </div>
              <div style={{ background:WHITE, borderRadius:10, padding:16, marginBottom:12, minHeight:80, fontSize:14, color:GRAY4 }}>
                Hola, soy el asistente de SpartsHub. ¿En qué puedo ayudarte hoy?
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input className="inp" placeholder="Escribe tu pregunta…" style={{ flex:1, borderRadius:8, padding:"10px 14px", fontSize:14 }}/>
                <button className="btn-red" style={{ padding:"10px 18px", borderRadius:8 }}>
                  <Ic n="send" s={15} c="#fff"/>
                </button>
              </div>
            </div>

            {/* Human support */}
            <div style={{ background:WHITE, border:`1px solid ${GRAY2}`, borderRadius:14, padding:24, marginBottom:16 }}>
              <div style={{ display:"flex", gap:14, alignItems:"flex-start", marginBottom:16 }}>
                <div style={{ width:44, height:44, background:GRAY1, borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ic n="user" s={22} c={DARK2}/>
                </div>
                <div>
                  <p style={{ fontWeight:700, fontSize:16 }}>Soporte humano</p>
                  <p style={{ fontSize:13, color:SUB, marginTop:2 }}>Para temas complejos, reclamos o consultas comerciales. Respuesta en menos de 24 horas hábiles.</p>
                </div>
              </div>
              <textarea className="inp" rows={4} placeholder="Describe tu problema o consulta con el mayor detalle posible…" value={supportMsg} onChange={e=>setSupportMsg(e.target.value)} style={{ resize:"none", marginBottom:12 }}/>
              {supportSent
                ? <p style={{ color:GREEN, fontSize:13, fontWeight:600 }}>✓ Mensaje enviado — te responderemos en menos de 24 horas hábiles</p>
                : <button className="btn-red" onClick={sendSupport}>Enviar mensaje</button>
              }
            </div>

            {/* WhatsApp */}
            <div style={{ background:"rgba(37,211,102,.06)", border:"1px solid rgba(37,211,102,.25)", borderRadius:14, padding:20, display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ width:44, height:44, background:"#25D366", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ic n="wa" s={22} c="#fff"/>
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:15 }}>WhatsApp directo</p>
                <p style={{ fontSize:13, color:SUB, marginTop:2 }}>Lun–Vie 9:00–18:00 · +56 9 3268 9914</p>
              </div>
              <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20SpartsHub%2C%20necesito%20ayuda","_blank")}
                style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:9, padding:"9px 18px", fontSize:13, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                Chatear
              </button>
            </div>
          </div>
        )}

        {/* ── CONFIGURACIÓN ── */}
        {section === "settings" && (
          <div style={{ maxWidth:600 }}>
            <h2 style={{ fontSize:22, fontWeight:700, marginBottom:24 }}>Configuración</h2>

            {/* Notificaciones */}
            <div style={{ background:WHITE, borderRadius:14, padding:24, border:`1px solid ${GRAY2}`, marginBottom:16 }}>
              <p style={{ fontSize:14, fontWeight:700, color:DARK2, marginBottom:16 }}>NOTIFICACIONES</p>
              {[
                ["Nuevos mensajes","Recibir email cuando alguien te contacta",true],
                ["Alertas de búsqueda","Notificar cuando aparezcan productos que buscas",true],
                ["Novedades de SpartsHub","Actualizaciones y mejoras de la plataforma",false],
              ].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${GRAY2}` }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600 }}>{label}</p>
                    <p style={{ fontSize:12, color:SUB, marginTop:2 }}>{desc}</p>
                  </div>
                  <div style={{ width:44, height:26, background:def?RED:GRAY3, borderRadius:13, cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
                    <div style={{ width:22, height:22, background:WHITE, borderRadius:"50%", position:"absolute", top:2, left:def?20:2, transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Privacidad */}
            <div style={{ background:WHITE, borderRadius:14, padding:24, border:`1px solid ${GRAY2}`, marginBottom:16 }}>
              <p style={{ fontSize:14, fontWeight:700, color:DARK2, marginBottom:16 }}>PRIVACIDAD</p>
              {[
                ["Mostrar WhatsApp en publicaciones","Tu número aparece en el botón de contacto directo",true],
                ["Perfil visible en búsquedas","Otros usuarios pueden ver tu perfil público",true],
              ].map(([label,desc,def])=>(
                <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${GRAY2}` }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600 }}>{label}</p>
                    <p style={{ fontSize:12, color:SUB, marginTop:2 }}>{desc}</p>
                  </div>
                  <div style={{ width:44, height:26, background:def?RED:GRAY3, borderRadius:13, cursor:"pointer", position:"relative", flexShrink:0 }}>
                    <div style={{ width:22, height:22, background:WHITE, borderRadius:"50%", position:"absolute", top:2, left:def?20:2, boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                  </div>
                </div>
              ))}
            </div>

            {/* Seguridad */}
            <div style={{ background:WHITE, borderRadius:14, padding:24, border:`1px solid ${GRAY2}`, marginBottom:16 }}>
              <p style={{ fontSize:14, fontWeight:700, color:DARK2, marginBottom:16 }}>SEGURIDAD</p>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${GRAY2}` }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:600 }}>Cambiar contraseña</p>
                  <p style={{ fontSize:12, color:SUB }}>Recibirás un email con instrucciones</p>
                </div>
                <button className="btn-outline" style={{ padding:"8px 14px", fontSize:13 }}
                  onClick={async()=>{ await sb.auth.resetPasswordForEmail(user.email, { redirectTo:"https://spartshub.com" }); alert("Email enviado — revisa tu correo"); }}>
                  Enviar email
                </button>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0" }}>
                <div>
                  <p style={{ fontSize:14, fontWeight:600 }}>Email de la cuenta</p>
                  <p style={{ fontSize:12, color:SUB }}>{user.email}</p>
                </div>
              </div>
            </div>

            {/* Cerrar cuenta */}
            <div style={{ background:"rgba(232,51,26,.04)", border:`1px solid rgba(232,51,26,.15)`, borderRadius:14, padding:24 }}>
              <p style={{ fontSize:14, fontWeight:700, color:RED, marginBottom:8 }}>ZONA DE PELIGRO</p>
              {!showDeleteConfirm ? (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <p style={{ fontSize:14, fontWeight:600 }}>Cerrar mi cuenta</p>
                    <p style={{ fontSize:12, color:SUB, marginTop:2 }}>Esta acción es irreversible. Se eliminarán todos tus datos.</p>
                  </div>
                  <button onClick={()=>setShowDeleteConfirm(true)}
                    style={{ background:"none", border:`1.5px solid ${RED}`, color:RED, borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", flexShrink:0 }}>
                    Cerrar cuenta
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize:14, color:RED, fontWeight:600, marginBottom:12 }}>¿Estás seguro? Esta acción no se puede deshacer.</p>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={()=>setShowDeleteConfirm(false)} className="btn-outline" style={{ flex:1, justifyContent:"center" }}>Cancelar</button>
                    <button onClick={async()=>{ await sb.auth.signOut(); alert("Cuenta cerrada. Contacta a soporte para eliminar tus datos."); window.location.reload(); }}
                      style={{ flex:1, background:RED, color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:14, fontWeight:700, cursor:"pointer" }}>
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
   MAIN APP
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   DESKTOP LAYOUT
══════════════════════════════════════════════════════════════ */

function SupportPanel({ onClose }) {
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [aiResponse, setAiResponse] = useState("Hola, soy el asistente de SpartsHub. Puedo ayudarte con publicaciones, búsquedas, verificación de usuarios, facturación y más. ¿En qué puedo ayudarte?");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const sendAI = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    const q = aiInput; setAiInput("");
    setTimeout(() => {
      const responses = {
        "publicar": "Para publicar, haz clic en 'Publicar aquí' en el header. Completa el formulario con título, categoría, precio y descripción. ¡Es gratis!",
        "precio": "Puedes publicar en CLP, USD, EUR, COP, PEN o MXN. El precio debe ser un número sin puntos ni comas.",
        "contactar": "Para contactar a un vendedor, haz clic en 'Contactar' en la publicación. Necesitas estar registrado.",
        "cuenta": "Para problemas con tu cuenta, escríbenos directamente a fgiangrandisc@gmail.com o por WhatsApp al +56932689914.",
      };
      const key = Object.keys(responses).find(k => q.toLowerCase().includes(k));
      setAiResponse(key ? responses[key] : "Entiendo tu consulta. Para ayudarte mejor, te recomiendo escribir al soporte humano o contactarnos por WhatsApp. Nuestro equipo responde en menos de 24 horas hábiles.");
      setAiLoading(false);
    }, 800);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"flex-end", padding:24 }} onClick={onClose}>
      <div style={{ background:CARD, borderRadius:20, width:400, maxHeight:"80vh", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.2)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ background:RED, padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <p style={{ fontFamily:"Barlow Condensed,sans-serif", fontWeight:700, fontSize:18, color:"#fff", letterSpacing:.3 }}>SOPORTE SPARTSHUB</p>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.7)", marginTop:2 }}>Respuesta inmediata · IA + Humano</p>
          </div>
          <button onClick={onClose} style={{ color:"rgba(255,255,255,.8)", background:"none", border:"none", cursor:"pointer", fontSize:20 }}>✕</button>
        </div>

        <div style={{ overflowY:"auto", flex:1, padding:20, display:"flex", flexDirection:"column", gap:16 }}>
          {/* AI Chat */}
          <div style={{ background:BG, borderRadius:12, padding:16, border:`1px solid ${GRAY2}` }}>
            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
              <div style={{ width:32, height:32, background:RED, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <span style={{ color:"#fff", fontSize:14 }}>⚡</span>
              </div>
              <div>
                <p style={{ fontWeight:700, fontSize:13 }}>Asistente IA</p>
                <p style={{ fontSize:11, color:GREEN }}>● En línea ahora</p>
              </div>
            </div>
            <div style={{ background:CARD, borderRadius:10, padding:12, marginBottom:10, fontSize:13, color:TEXT, lineHeight:1.6 }}>{aiResponse}</div>
            <div style={{ display:"flex", gap:8 }}>
              <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendAI()} placeholder="Escribe tu pregunta…" style={{ flex:1, background:CARD, border:`1px solid ${GRAY2}`, borderRadius:8, padding:"8px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              <button onClick={sendAI} style={{ background:RED, color:"#fff", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer" }}>
                <Ic n="send" s={14} c="#fff"/>
              </button>
            </div>
          </div>

          {/* Human support */}
          <div style={{ background:BG, borderRadius:12, padding:16, border:`1px solid ${GRAY2}` }}>
            <p style={{ fontWeight:700, fontSize:13, marginBottom:8 }}>Soporte humano</p>
            <textarea value={msg} onChange={e=>setMsg(e.target.value)} placeholder="Describe tu problema en detalle…" rows={3} style={{ width:"100%", background:CARD, border:`1px solid ${GRAY2}`, borderRadius:8, padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", resize:"none", marginBottom:8 }}/>
            {sent ? <p style={{ color:GREEN, fontSize:13, fontWeight:600 }}>✓ Mensaje enviado — responderemos en menos de 24hrs hábiles</p>
              : <button onClick={()=>{ if(msg.trim()) setSent(true); }} style={{ width:"100%", background:DARK, color:"#fff", border:"none", borderRadius:8, padding:"10px", fontSize:13, fontWeight:700, cursor:"pointer" }}>Enviar mensaje</button>
            }
          </div>

          {/* WhatsApp */}
          <button onClick={()=>window.open("https://wa.me/56932689914?text=Hola%20SpartsHub%2C%20necesito%20ayuda","_blank")}
            style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:12, padding:"14px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Ic n="wa" s={18} c="#fff"/>
            WhatsApp directo — +56 9 3268 9914
          </button>
        </div>
      </div>
    </div>
  );
}

function DesktopLayout({ tab, setTab, session, profile, selected, setSelected, chatListing, setChatListing, showPublish, setShowPublish, openChat, logout, NAV }) {
  const [showPublishDesk, setShowPublishDesk] = useState(false);
  const [showSupport, setShowSupport] = useState(false);

  const SIDEBAR = [
    { id:"home",     icon:"home",   label:"Inicio" },
    { id:"search",   icon:"search", label:"Explorar" },
    { id:"messages", icon:"msg",    label:"Mensajes" },
    { id:"profile",  icon:"user",   label:"Perfil" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:BG, display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>

      {/* ── GLOBAL HEADER ── */}
      <header style={{ background:CARD, borderBottom:`1px solid ${GRAY2}`, position:"sticky", top:0, zIndex:50, padding:"0 32px" }}>
        <div style={{ display:"flex", alignItems:"center", height:60, gap:24 }}>
          <Logo/>
          <div style={{ width:1, height:32, background:GRAY2 }}/>
          {/* Nav links */}
          <nav style={{ display:"flex", gap:4, flex:1 }}>
            {[
              { id:"home",    label:"Inicio" },
              { id:"search",  label:"Publicaciones destacadas" },
              { id:"search",  label:"Buscar" },
            ].map((n,i) => (
              <button key={i} onClick={()=>setTab(n.id)}
                style={{ padding:"6px 14px", borderRadius:8, background:"none", border:"none", cursor:"pointer", fontSize:14, fontWeight:600, color:tab===n.id?RED:DARK2, transition:"all .15s" }}
                onMouseEnter={e=>e.currentTarget.style.background=GRAY1}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                {n.label}
              </button>
            ))}
          </nav>
          {/* Right actions */}
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>setShowPublishDesk(true)}
              style={{ background:RED, color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontSize:14, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:6, transition:"all .15s" }}
              onMouseEnter={e=>e.currentTarget.style.background=RED2}
              onMouseLeave={e=>e.currentTarget.style.background=RED}>
              <Ic n="plus" s={14} c="#fff"/>
              Publicar aquí
            </button>
            <button onClick={()=>setShowSupport(true)}
              style={{ background:BG, color:DARK2, border:`1px solid ${GRAY2}`, borderRadius:8, padding:"8px 14px", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <Ic n="msg" s={14} c={DARK2}/>
              Soporte
            </button>
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ display:"flex", flex:1, minHeight:0 }}>
        {/* Sidebar */}
        <div style={{ width:220, background:CARD, borderRight:`1px solid ${GRAY2}`, position:"sticky", top:60, height:"calc(100vh - 60px)", display:"flex", flexDirection:"column", padding:"20px 0", flexShrink:0, overflowY:"auto" }}>
          <nav style={{ padding:"0 12px", display:"flex", flexDirection:"column", gap:2, flex:1 }}>
            {SIDEBAR.map(n => {
              const active = tab === n.id;
              return (
                <button key={n.id} onClick={()=>{ setTab(n.id); if(n.id!=="messages") setChatListing(null); }}
                  style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", borderRadius:10, border:"none", cursor:"pointer", background:active?`rgba(193,63,30,.09)`:"transparent", color:active?RED:DARK2, fontWeight:active?700:500, fontSize:14, width:"100%", textAlign:"left", transition:"all .15s", borderLeft:active?`3px solid ${RED}`:"3px solid transparent" }}
                  onMouseEnter={e=>{ if(!active) e.currentTarget.style.background=BG; }}
                  onMouseLeave={e=>{ if(!active) e.currentTarget.style.background="transparent"; }}>
                  <Ic n={n.icon} s={18} c={active?RED:GRAY4}/>
                  {n.label}
                </button>
              );
            })}
          </nav>
          {/* User info */}
          {profile && (
            <div style={{ padding:"16px", borderTop:`1px solid ${GRAY2}`, display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:`rgba(193,63,30,.12)`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <span style={{ fontSize:14, fontWeight:700, color:RED }}>{(profile.name||"U")[0].toUpperCase()}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:600, color:TEXT, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{profile.biz||profile.name||"Usuario"}</p>
                <p style={{ fontSize:11, color:SUB, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{session.user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex:1, minWidth:0, overflowY:"auto", padding:"32px 40px 60px" }}>
          {tab==="home"     && <HomePage user={session.user} onSelect={setSelected} onGoSearch={()=>setTab("search")}/>}
          {tab==="search"   && <SearchPage user={session.user} onSelect={setSelected}/>}
          {tab==="messages" && <MessagesPage user={session.user} initListing={chatListing} onClear={()=>setChatListing(null)}/>}
          {tab==="profile"  && <ProfilePage user={session.user} profile={profile} onLogout={logout}/>}
        </div>
      </div>

      {selected && <ListingDetail l={selected} onClose={()=>setSelected(null)} onChat={openChat}/>}
      {showPublishDesk && <PublishSheet user={session.user} profile={profile} onClose={()=>setShowPublishDesk(false)} onDone={()=>setShowPublishDesk(false)}/>}
      {showSupport && <SupportPanel onClose={()=>setShowSupport(false)}/>}
    </div>
  );
}

export default function SpartsHub() {
  const [session, setSession]   = useState(null);
  const [showAuthMode, setShowAuthMode] = useState('landing');
  const [profile, setProfile]   = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab]           = useState("home");
  const [selected, setSelected] = useState(null);
  const [chatListing, setChatListing] = useState(null);
  const [showPublish, setShowPublish] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data:{ subscription } } = sb.auth.onAuthStateChange((_,s)=>setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    sb.from("profiles").select("*").eq("id",session.user.id).single().then(({ data })=>setProfile(data));
  }, [session]);

  const logout = async () => { await sb.auth.signOut(); setSession(null); };

  const openChat = l => {
    if (l.user_id === session?.user?.id) return;
    setChatListing(l);
    setTab("messages");
    setSelected(null);
  };

  if (!authReady) return (
    <div style={{ minHeight:"100vh", background:WHITE, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <style>{CSS}</style>
      <Logo/><Spin size={28}/>
    </div>
  );

  if (!session) {
    if (showAuthMode === "landing") return (
      <LandingPage
        onGoRegister={() => setShowAuthMode("register")}
        onGoLogin={() => setShowAuthMode("login")}
      />
    );
    return <AuthScreen
      initialMode={showAuthMode === "register" ? "register" : "login"}
      onAuth={()=>sb.auth.getSession().then(({ data })=>setSession(data.session))}
      onBack={() => setShowAuthMode("landing")}
    />;
  }

  const NAV = [
    { id:"home",     icon:"home",   label:"Inicio" },
    { id:"search",   icon:"search", label:"Buscar" },
    { id:"publish",  icon:"plus",   label:"",      center:true },
    { id:"messages", icon:"msg",    label:"Chat" },
    { id:"profile",  icon:"user",   label:"Perfil" },
  ];

  return (
    <DesktopLayout
      tab={tab} setTab={setTab} session={session} profile={profile}
      selected={selected} setSelected={setSelected}
      chatListing={chatListing} setChatListing={setChatListing}
      showPublish={showPublish} setShowPublish={setShowPublish}
      openChat={openChat} logout={logout} NAV={NAV}
    />
  );
}
