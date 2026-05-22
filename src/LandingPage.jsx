import { useState, useEffect } from "react";
import { sb } from "./supabase.js";

const RED    = "#E8320A";
const GOLD   = "#F5C842";
const BG     = "#141618";
const BG2    = "#1A1D20";
const BG3    = "#1F2328";
const CARD   = "#1E2125";
const BORDER = "rgba(255,255,255,.07)";
const BORDER2= "rgba(255,255,255,.12)";
const TEXT   = "#E8ECF1";
const SUB    = "#9CA3AF";
const MUTED  = "#4B5563";
const PUR    = "#A855F7";
const BLUE   = "#3B9EFF";

/* ── Blueprint SVGs ─────────────────────────────────────────── */
const BpBearing = ({ size=200, op=0.06 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke={BLUE} strokeWidth="0.8" opacity={op}>
    <circle cx="100" cy="100" r="90" strokeDasharray="4 2"/>
    <circle cx="100" cy="100" r="70"/>
    <circle cx="100" cy="100" r="50" strokeDasharray="4 2"/>
    <circle cx="100" cy="100" r="30"/>
    <circle cx="100" cy="100" r="12"/>
    {[0,45,90,135,180,225,270,315].map(a=>{
      const rad=a*Math.PI/180;
      return <circle key={a} cx={100+Math.cos(rad)*40} cy={100+Math.sin(rad)*40} r="9"/>;
    })}
    <line x1="100" y1="10" x2="100" y2="190" strokeDasharray="2 4" strokeWidth="0.4"/>
    <line x1="10" y1="100" x2="190" y2="100" strokeDasharray="2 4" strokeWidth="0.4"/>
    <text x="104" y="18" fill={BLUE} fontSize="7" fontFamily="monospace" opacity="0.7">Ø180</text>
    <text x="104" y="68" fill={BLUE} fontSize="7" fontFamily="monospace" opacity="0.7">Ø100</text>
  </svg>
);

const BpGear = ({ size=240, op=0.06 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" fill="none" stroke={BLUE} strokeWidth="0.8" opacity={op}>
    <circle cx="120" cy="120" r="100" strokeDasharray="4 2"/>
    <circle cx="120" cy="120" r="80"/>
    <circle cx="120" cy="120" r="55" strokeDasharray="3 2"/>
    <circle cx="120" cy="120" r="20"/>
    <circle cx="120" cy="120" r="10"/>
    {Array.from({length:16},(_,i)=>{
      const a=i*(360/16)*Math.PI/180;
      const x1=120+Math.cos(a)*80, y1=120+Math.sin(a)*80;
      const x2=120+Math.cos(a)*95, y2=120+Math.sin(a)*95;
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="5" strokeLinecap="square"/>;
    })}
    <line x1="120" y1="20" x2="120" y2="220" strokeDasharray="2 4" strokeWidth="0.4"/>
    <line x1="20" y1="120" x2="220" y2="120" strokeDasharray="2 4" strokeWidth="0.4"/>
    <text x="124" y="30" fill={BLUE} fontSize="7" fontFamily="monospace" opacity="0.6">Z=16</text>
  </svg>
);

const BpPump = ({ size=280, op=0.055 }) => (
  <svg width={size} height={size*0.72} viewBox="0 0 280 200" fill="none" stroke={BLUE} strokeWidth="0.8" opacity={op}>
    <rect x="60" y="50" width="160" height="100" rx="4"/>
    <circle cx="140" cy="100" r="40"/>
    <circle cx="140" cy="100" r="25"/>
    <circle cx="140" cy="100" r="10"/>
    {[0,90,180,270].map(a=>{
      const rad=a*Math.PI/180;
      return <line key={a} x1={140+Math.cos(rad)*25} y1={100+Math.sin(rad)*25} x2={140+Math.cos(rad)*38} y2={100+Math.sin(rad)*38}/>;
    })}
    <line x1="0" y1="90" x2="60" y2="90" strokeWidth="2"/>
    <line x1="0" y1="110" x2="60" y2="110" strokeWidth="2"/>
    <line x1="220" y1="85" x2="280" y2="85" strokeWidth="2"/>
    <line x1="220" y1="115" x2="280" y2="115" strokeWidth="2"/>
    <text x="5" y="85" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.7">IN</text>
    <text x="254" y="99" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.7">OUT</text>
    <text x="70" y="175" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.6">BOMBA HIDRÁULICA A10V</text>
  </svg>
);

const BpMotor = ({ size=260, op=0.055 }) => (
  <svg width={size} height={size*0.65} viewBox="0 0 260 170" fill="none" stroke={BLUE} strokeWidth="0.8" opacity={op}>
    <rect x="40" y="30" width="180" height="110" rx="6"/>
    <ellipse cx="40" cy="85" rx="20" ry="50"/>
    <ellipse cx="220" cy="85" rx="20" ry="50"/>
    {[45,65,85,105,125].map(y=>(
      <line key={y} x1="40" y1={y} x2="220" y2={y} strokeDasharray="3 3" strokeWidth="0.4"/>
    ))}
    <line x1="220" y1="85" x2="260" y2="85" strokeWidth="2.5"/>
    <rect x="255" y="78" width="5" height="14"/>
    <line x1="60" y1="20" x2="60" y2="30" strokeWidth="1.5"/>
    <line x1="130" y1="20" x2="130" y2="30" strokeWidth="1.5"/>
    <line x1="200" y1="20" x2="200" y2="30" strokeWidth="1.5"/>
    <text x="52" y="16" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.7">U</text>
    <text x="122" y="16" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.7">V</text>
    <text x="192" y="16" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.7">W</text>
    <text x="65" y="160" fill={BLUE} fontSize="6" fontFamily="monospace" opacity="0.6">MOTOR WEG IE3 — 15HP 380V</text>
  </svg>
);

const BpGrid = () => (
  <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none" }}>
    <defs>
      <pattern id="sg" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke={BLUE} strokeWidth="0.25" opacity="0.18"/>
      </pattern>
      <pattern id="bg" width="100" height="100" patternUnits="userSpaceOnUse">
        <rect width="100" height="100" fill="url(#sg)"/>
        <path d="M 100 0 L 0 0 0 100" fill="none" stroke={BLUE} strokeWidth="0.5" opacity="0.22"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
  </svg>
);

/* ── CSS ─────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:${BG};color:${TEXT};font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
button{cursor:pointer;border:none;font-family:inherit}input{font-family:inherit;outline:none}a{color:inherit;text-decoration:none}
.bebas{font-family:'Bebas Neue',sans-serif;letter-spacing:.5px}
.bc{font-family:'Barlow Condensed',sans-serif}
.mono{font-family:'Share Tech Mono',monospace}
.wrap{max-width:1100px;margin:0 auto;padding:0 48px}
@media(max-width:768px){.wrap{padding:0 24px}}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.tt{display:flex;animation:ticker 28s linear infinite;white-space:nowrap}
.tt:hover{animation-play-state:paused}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes toastIn{from{transform:translateY(80px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.fu{animation:fadeUp .5s ease both}.fi{animation:fadeIn .25s ease both}
.btn-red{background:${RED};color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:1.2px;text-transform:uppercase;border-radius:6px;padding:13px 28px;display:inline-flex;align-items:center;gap:8px;transition:all .18s;border:none}
.btn-red:hover{background:#d42800;transform:translateY(-1px);box-shadow:0 8px 28px rgba(232,50,10,.4)}
.btn-gold{background:${GOLD};color:#111;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;letter-spacing:1.2px;text-transform:uppercase;border-radius:6px;padding:13px 28px;display:inline-flex;align-items:center;gap:8px;transition:all .18s;border:none}
.btn-gold:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 8px 28px rgba(245,200,66,.3)}
.btn-ol{background:transparent;color:${TEXT};font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:14px;letter-spacing:1px;text-transform:uppercase;border:1.5px solid ${BORDER2};border-radius:6px;padding:12px 22px;display:inline-flex;align-items:center;gap:8px;transition:all .18s;cursor:pointer}
.btn-ol:hover{border-color:${RED};color:${RED}}
.tag{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:3px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10px;letter-spacing:1.2px;text-transform:uppercase}
.t-red{background:rgba(232,50,10,.12);color:${RED};border:1px solid rgba(232,50,10,.25)}
.t-gold{background:rgba(245,200,66,.1);color:${GOLD};border:1px solid rgba(245,200,66,.25)}
.t-blue{background:rgba(59,158,255,.1);color:${BLUE};border:1px solid rgba(59,158,255,.2)}
.t-dim{background:rgba(255,255,255,.05);color:${SUB};border:1px solid ${BORDER}}
.t-green{background:rgba(74,222,128,.1);color:#4ADE80;border:1px solid rgba(74,222,128,.2)}
.t-pur{background:rgba(168,85,247,.1);color:${PUR};border:1px solid rgba(168,85,247,.2)}
.card{background:${CARD};border:1px solid ${BORDER};border-radius:10px;transition:all .22s}
.card:hover{border-color:rgba(232,50,10,.3);box-shadow:0 0 24px rgba(232,50,10,.06)}
.nav{position:fixed;top:0;left:0;right:0;z-index:60;background:rgba(20,22,24,.92);backdrop-filter:blur(16px);border-bottom:1px solid ${BORDER};padding:13px 0}
.hr{height:1px;background:${BORDER}}
.sec{padding:88px 0}
@media(max-width:768px){.sec{padding:60px 0}}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
@media(max-width:900px){.g2{grid-template-columns:1fr}.g4{grid-template-columns:1fr 1fr}}
.cat-panel{display:none}
@media(min-width:960px){.cat-panel{display:block}}
@media(max-width:768px){.nav-badges{display:none!important}}
.prog{height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,${BLUE},rgba(59,158,255,.4))}
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:200;background:${BG3};border:1px solid ${BORDER2};border-radius:12px;padding:16px 20px;min-width:300px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:toastIn .3s ease}
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
.inp-dark{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:12px 14px;font-size:14px;color:#E8ECF1;width:100%;transition:border-color .2s;font-family:inherit;outline:none}
.inp-dark:focus{border-color:#E8320A}
.inp-dark::placeholder{color:#4B5563}
.auth-inp::placeholder{color:rgba(255,255,255,.5)!important}
.modal-box{background:${BG3};border:1px solid ${BORDER2};border-radius:16px;padding:36px 32px;max-width:420px;width:100%;animation:fadeUp .3s ease;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.6)}
.lcard{background:${CARD};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;transition:all .22s;cursor:pointer}
.lcard:hover{border-color:rgba(232,50,10,.35);transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,.3)}
.lcard.sol{border-color:rgba(168,85,247,.15)}
.lcard.sol:hover{border-color:${PUR}}
`;

/* ── Ticker ─────────────────────────────────────────────────── */
const TICKS = ["Rodamientos SKF","Bombas Hidráulicas","Motores WEG","Filtros Fleetguard","Correas Gates","Repuestos Komatsu","Variadores ABB","Compresores Atlas","Reductores SEW","Válvulas Parker","Repuestos CAT","Motores Siemens","Sellos Hidráulicos","Rodamientos FAG","Bombas Rexroth"];
function Ticker() {
  const items = [...TICKS, ...TICKS];
  return (
    <div style={{ background:`linear-gradient(90deg,${RED},#c42800)`, padding:"9px 0", overflow:"hidden" }}>
      <div className="tt">
        {items.map((t,i) => (
          <span key={i} className="bc" style={{ fontSize:12, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", color:"rgba(255,255,255,.88)", padding:"0 20px", flexShrink:0 }}>
            {t} <span style={{ opacity:.4 }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Data ───────────────────────────────────────────────────── */
const CATS = [
  { e:"⚙️", n:"Rodamientos & Bujes",  s:"SKF · NSK · Timken · FAG",        v:1840, p:92, Bp:BpBearing },
  { e:"💧", n:"Bombas Hidráulicas",    s:"Rexroth · Parker · Bosch",        v:1610, p:82, Bp:BpPump },
  { e:"⚡", n:"Motores Eléctricos",    s:"WEG · ABB · Siemens",             v:1390, p:72, Bp:BpMotor },
  { e:"🛢️", n:"Filtros Industriales",  s:"Fleetguard · Cummins · Mann",     v:1240, p:64, Bp:BpBearing },
  { e:"🔗", n:"Correas & Transmisión", s:"Gates · SKF · Optibelt",          v:980,  p:52, Bp:BpGear },
  { e:"🏗️", n:"Rep. Komatsu / CAT",   s:"Dientes · Sellos · Desgaste",     v:870,  p:46, Bp:BpGear },
  { e:"💨", n:"Compresores",           s:"Atlas Copco · Kaeser · Ingersoll",v:760,  p:40, Bp:BpPump },
];

const DEMO = [
  { id:1, type:"venta",    cat:"RODAMIENTOS",       title:"Rodamiento SKF 6205-2RS — Lote 50u",   desc:"Stock nuevo en bodega. Caja sellada original SKF. Retiro inmediato Santiago.",   price:"$4.200 CLP/u",   city:"Santiago",    ts:"2h", biz:"Industrias Metálicas S.A.", ini:"IM", ok:true,  s:47, badge:"⭐ Destacado", bt:"gold", e:"⚙️" },
  { id:2, type:"venta",    cat:"HIDRÁULICA",         title:"Bomba Rexroth A10VSO 28DR — 200hrs",   desc:"Desmontada, revisada. Garantía 90 días de funcionamiento.",                      price:"$1.850.000 CLP", city:"Antofagasta", ts:"5h", biz:"Minera Collahuasi Rep.",    ini:"MC", ok:true,  s:12, badge:"DISPONIBLE",   bt:"red",  e:"💧" },
  { id:3, type:"venta",    cat:"MOTORES",            title:"Motor WEG 15HP IE3 380V trifásico",    desc:"Nuevo en caja. Eje 42mm. Despacho nacional o retiro en Concepción.",             price:"$680.000 CLP",   city:"Concepción",  ts:"1d", biz:"Electro Sur Ltda.",         ini:"EL", ok:true,  s:83, badge:"🔥 Urgente",   bt:"red",  e:"⚡" },
  { id:4, type:"solicito", cat:"SOLICITUD",          title:"BUSCO: Filtros Fleetguard HF6337 ×20", desc:"Urgente para faena Atacama. Pago inmediato. Original o aftermarket certificado.",price:"A tratar",        city:"Atacama",     ts:"3h", biz:"Constructora Ponce SpA",    ini:"CP", ok:true,  s:0,  badge:"BUSCO",        bt:"pur",  e:"🔍" },
  { id:5, type:"venta",    cat:"TRANSMISIÓN",        title:"Reductor SEW-Eurodrive R57 Rel. 28:1", desc:"1.500hrs de uso. Perfectas condiciones. Incluye ficha técnica.",                  price:"$420.000 CLP",   city:"Valparaíso",  ts:"2d", biz:"Tecno Industrial Ltda.",    ini:"TI", ok:true,  s:29, badge:"DISPONIBLE",   bt:"red",  e:"⚙️" },
];

const BC = { red:{bg:"rgba(232,50,10,.15)",c:RED,b:"rgba(232,50,10,.3)"}, gold:{bg:"rgba(245,200,66,.12)",c:GOLD,b:"rgba(245,200,66,.3)"}, pur:{bg:"rgba(168,85,247,.12)",c:PUR,b:"rgba(168,85,247,.3)"} };
const Bdg = ({ text, type="red" }) => {
  const s = BC[type]||{bg:"rgba(255,255,255,.06)",c:SUB,b:BORDER};
  return <span className="bc" style={{ fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",background:s.bg,color:s.c,border:`1px solid ${s.b}`,borderRadius:3,padding:"3px 8px" }}>{text}</span>;
};

/* ── Modal ──────────────────────────────────────────────────── */
function Modal({ slots, onClose, onReg }) {
  useEffect(()=>{ const fn=e=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",fn); return ()=>window.removeEventListener("keydown",fn); },[]);
  return (
    <div className="modal-bg fi" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:14,background:"none",border:"none",color:SUB,cursor:"pointer",fontSize:20,lineHeight:1 }}>✕</button>
        <div style={{ textAlign:"center",marginBottom:22 }}>
          <div style={{ fontSize:44,marginBottom:12 }}>🔒</div>
          <h3 className="bebas" style={{ fontSize:30,marginBottom:8 }}>Regístrate para contactar</h3>
          <p style={{ color:SUB,fontSize:15,lineHeight:1.65 }}>Accede a miles de publicaciones y conecta directo con vendedores verificados.</p>
        </div>
        <div style={{ background:"rgba(245,200,66,.06)",border:"1px solid rgba(245,200,66,.2)",borderRadius:8,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,marginBottom:20,justifyContent:"center" }}>
          <span>⚡</span>
          <span className="bc" style={{ fontSize:14,fontWeight:700,color:GOLD }}>Plan gratis de por vida</span>
          <span style={{ color:SUB,fontSize:13 }}>— Solo <strong style={{ color:TEXT }}>{slots}</strong> cupos</span>
        </div>
        <button className="btn-red" style={{ width:"100%",justifyContent:"center",fontSize:16,padding:15 }} onClick={onReg}>Crear cuenta gratis →</button>
        <button onClick={onClose} style={{ width:"100%",marginTop:10,background:"none",border:"none",color:SUB,fontSize:14,cursor:"pointer",padding:8 }}>Seguir explorando como invitado</button>
      </div>
    </div>
  );
}

/* ── Toast ──────────────────────────────────────────────────── */
function Toast({ term, onClose, onReg }) {
  useEffect(()=>{ const t=setTimeout(onClose,7000); return ()=>clearTimeout(t); },[]);
  return (
    <div className="toast">
      <p style={{ fontWeight:600,marginBottom:4,fontSize:15 }}>Encontramos resultados para "<span style={{ color:RED }}>{term}</span>"</p>
      <p style={{ color:SUB,fontSize:14,marginBottom:12 }}>Regístrate gratis para ver detalles y contactar vendedores.</p>
      <div style={{ display:"flex",gap:10 }}>
        <button className="btn-red" style={{ padding:"8px 18px",fontSize:14 }} onClick={onReg}>Ver →</button>
        <button onClick={onClose} style={{ background:"none",border:"none",color:SUB,cursor:"pointer",fontSize:14 }}>Cerrar</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN
══════════════════════════════════════════════════════════════ */
export default function LandingPage({ onGoRegister, onGoLogin }) {
  const [slots, setSlots]         = useState(247);
  const [showModal, setShowModal] = useState(false);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBiz, setAuthBiz] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authOk, setAuthOk] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [toast, setToast]         = useState(null);
  const [searchQ, setSearchQ]     = useState("");
  const [listings, setListings]   = useState(DEMO);

  useEffect(()=>{
    sb.from("profiles").select("id",{count:"exact",head:true}).then(({count})=>{ if(count) setSlots(Math.max(300-count,0)); });
    sb.from("listings").select("*").order("created_at",{ascending:false}).limit(5).then(({data})=>{
      if(data&&data.length>=3) setListings(data.map(l=>({...l,type:"venta",ini:(l.biz||"U").slice(0,2).toUpperCase(),badge:"DISPONIBLE",bt:"red"})));
    });
  },[]);

  const openModal=()=>setShowModal(true);
  const [showRecovery, setShowRecovery] = useState(false);
  const doRecovery = async () => {
    if (!authEmail) { setAuthErr('Ingresa tu email primero.'); return; }
    setAuthLoading(true);
    await sb.auth.resetPasswordForEmail(authEmail, { redirectTo:'https://spartshub.com' });
    setAuthOk('Email enviado. Revisa tu bandeja de entrada.');
    setShowRecovery(false);
    setAuthLoading(false);
  };
  const doAuth = async () => {
    setAuthErr(''); setAuthOk(''); setAuthLoading(true);
    if (authModal === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email:authEmail, password:authPass });
      if (error) { setAuthErr(error.message); setAuthLoading(false); return; }
      window.location.reload();
    } else {
      if (!authName || !authBiz) { setAuthErr('Completa todos los campos.'); setAuthLoading(false); return; }
      const { data, error } = await sb.auth.signUp({ email:authEmail, password:authPass });
      if (error) { setAuthErr(error.message); setAuthLoading(false); return; }
      if (data.user) {
        await sb.from('profiles').upsert({ id:data.user.id, name:authName, biz:authBiz, phone:authPhone });
        setAuthOk('¡Cuenta creada! Revisa tu email para confirmar, luego inicia sesión.');
        setAuthModal('login');
      }
    }
    setAuthLoading(false);
  };
  const doSearch=()=>{ if(searchQ.trim()) setToast(searchQ.trim()); };

  return (
    <div style={{ background:BG,minHeight:"100vh",color:TEXT }}>
      <style>{CSS}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="wrap" style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:34,height:34,background:RED,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span className="bebas" style={{ fontSize:20,color:"#fff",lineHeight:1 }}>S</span>
            </div>
            <span className="bebas" style={{ fontSize:22,letterSpacing:1.5 }}>SPARTSHUB</span>
            <div className="nav-badges" style={{ display:"flex",gap:6,marginLeft:8 }}>
              {["P2P","Industrial","Chile"].map(t=><span key={t} className="tag t-dim" style={{ fontSize:9 }}>{t}</span>)}
            </div>
          </div>
          <button className="btn-ol" style={{ fontSize:13,padding:"9px 18px" }} onClick={()=>setAuthModal("login")}>Iniciar sesión</button>
        </div>
      </nav>

      {/* TICKER */}
      <div style={{ paddingTop:63 }}><Ticker/></div>

      {/* HERO */}
      <section style={{ padding:"72px 0 80px",position:"relative",overflow:"hidden",minHeight:"88vh",display:"flex",alignItems:"center" }}>
        <BpGrid/>
        {/* Floating blueprints */}
        <div style={{ position:"absolute",right:"3%",top:"6%",opacity:.06,animation:"float 7s ease-in-out infinite",pointerEvents:"none" }}><BpGear size={320} op={1}/></div>
        <div style={{ position:"absolute",right:"26%",bottom:"4%",opacity:.04,animation:"float 9s ease-in-out infinite 2s",pointerEvents:"none" }}><BpBearing size={200} op={1}/></div>
        <div style={{ position:"absolute",left:"-1%",bottom:"8%",opacity:.035,animation:"float 11s ease-in-out infinite 1s",pointerEvents:"none" }}><BpPump size={240} op={1}/></div>
        {/* Glows */}
        <div style={{ position:"absolute",top:"15%",left:"-8%",width:600,height:600,background:`radial-gradient(circle,rgba(232,50,10,.1) 0%,transparent 65%)`,pointerEvents:"none" }}/>
        <div style={{ position:"absolute",bottom:"-10%",right:"10%",width:400,height:400,background:`radial-gradient(circle,rgba(59,158,255,.05) 0%,transparent 65%)`,pointerEvents:"none" }}/>

        <div className="wrap" style={{ position:"relative",zIndex:2,width:"100%" }}>
          <div style={{ display:"flex",gap:64,alignItems:"center" }}>
            {/* Left */}
            <div style={{ flex:1,minWidth:0 }}>
              <div className="fu" style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20,animationDelay:".05s" }}>
                <span className="tag t-blue mono" style={{ fontSize:9 }}>SYS://MARKETPLACE.CL</span>
                <span className="tag t-red" style={{ fontSize:9 }}>● LIVE</span>
              </div>
              <h1 className="bebas fu" style={{ fontSize:"clamp(58px,9.5vw,116px)",lineHeight:.88,marginBottom:28,animationDelay:".1s" }}>
                <span style={{ color:"rgba(255,255,255,.22)" }}>Publica lo</span><br/>
                <span style={{ color:"rgba(255,255,255,.22)" }}>que </span><span style={{ color:RED }}>vendes</span><br/>
                <span style={{ color:"rgba(255,255,255,.22)" }}>o lo que </span><span style={{ color:GOLD }}>buscas.</span>
              </h1>
              <p className="fu" style={{ fontSize:17,color:SUB,lineHeight:1.8,marginBottom:28,maxWidth:500,animationDelay:".15s" }}>
                No dejes que tu faena frene la operación.<br/>
                No dejes que ese stock inmóvil en tu bodega siga perdiendo valor.<br/>
                <span style={{ color:"rgba(255,255,255,.72)",fontWeight:500 }}>Conecta con la industria chilena — directo, sin comisión.</span>
              </p>
              {/* Urgency */}
              <div className="fu" style={{ display:"inline-flex",alignItems:"center",gap:10,background:"rgba(245,200,66,.06)",border:"1px solid rgba(245,200,66,.2)",borderRadius:8,padding:"11px 18px",marginBottom:28,animationDelay:".18s" }}>
                <span style={{ fontSize:18 }}>⚡</span>
                <span className="bc" style={{ fontWeight:700,fontSize:14,color:GOLD }}>Plan gratis de por vida</span>
                <span className="mono" style={{ fontSize:13,color:TEXT }}>— Solo <span style={{ color:RED,fontWeight:700 }}>{slots}</span> cupos</span>
              </div>
              {/* CTAs */}
              <div className="fu" style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:32,animationDelay:".22s" }}>
                <button className="btn-red" style={{ fontSize:16,padding:"15px 34px" }} onClick={()=>setAuthModal("register")}>Comenzar gratis hoy →</button>
                <a href="#como-funciona" className="btn-ol" style={{ fontSize:14 }}>¿Cómo funciona? ↓</a>
              </div>
              {/* Trust */}
              <div className="fu" style={{ display:"flex",gap:16,flexWrap:"wrap",animationDelay:".26s" }}>
                {["Verificado","0% Comisión","Trade IA","P2P directo"].map(b=>(
                  <div key={b} style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:MUTED }}>
                    <span style={{ color:RED }}>✓</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — cat panel */}
            <div className="cat-panel" style={{ width:296,flexShrink:0 }}>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10 }}>
                {CATS.slice(0,6).map((c,i)=>(
                  <div key={i} className="card" style={{ padding:"13px 13px",position:"relative",overflow:"hidden",cursor:"pointer" }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(59,158,255,.35)";e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.transform="";}}>
                    <div style={{ position:"absolute",bottom:-10,right:-10,opacity:.14 }}><c.Bp size={60} op={1}/></div>
                    <div style={{ fontSize:18,marginBottom:5 }}>{c.e}</div>
                    <p style={{ fontSize:11,fontWeight:700,marginBottom:2,color:TEXT,position:"relative" }}>{c.n}</p>
                    <p style={{ fontSize:9,color:MUTED,marginBottom:7,position:"relative" }}>{c.s}</p>
                    <div className="prog" style={{ marginBottom:4,position:"relative" }}>
                      <div className="prog-fill" style={{ width:`${c.p}%` }}/>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between",position:"relative" }}>
                      <span className="mono" style={{ fontSize:9,color:BLUE }}>+{c.v.toLocaleString()}/mes</span>
                      <span className="bc" style={{ fontSize:8,color:MUTED,border:`1px solid ${BORDER}`,borderRadius:2,padding:"1px 4px" }}>TOP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* CÓMO FUNCIONA */}
      <section className="sec" id="como-funciona" style={{ position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",right:"-4%",top:"5%",opacity:.035,pointerEvents:"none" }}><BpMotor size={420} op={1}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ marginBottom:52 }}>
            <span className="tag t-red" style={{ marginBottom:16,display:"inline-flex" }}>CÓMO FUNCIONA</span>
            <h2 className="bebas" style={{ fontSize:"clamp(42px,6vw,76px)",lineHeight:.9 }}>
              <span style={{ color:"rgba(255,255,255,.18)" }}>SIMPLE. RÁPIDO. </span>
              <span style={{ color:RED }}>SIN COMPLICACIONES.</span>
            </h2>
          </div>
          <div className="g2">
            {[
              { n:"01",e:"📢",t:"Publica lo que vendes o lo que buscas",d:"¿Tienes stock parado en bodega? Publícalo. ¿Necesitas un repuesto urgente? Pídelo. Los proveedores llegan a ti en minutos." },
              { n:"02",e:"🤖",t:"La IA conecta oferta y demanda",        d:"Nuestro motor de Trade IA analiza tu necesidad y encuentra los matches más relevantes del catálogo industrial." },
              { n:"03",e:"🤝",t:"Negocian directo, sin comisión",         d:"Comprador y vendedor se contactan directamente. Sin intermediarios. Sin comisión. Solo negocios." },
              { n:"04",e:"⚙️",t:"Tu operación no se detiene",             d:"Reduce los tiempos de parada no planificada. Encuentra el repuesto que necesitas antes de que la faena se detenga." },
            ].map((s,i)=>(
              <div key={i} className="card" style={{ padding:28,display:"flex",gap:20 }}>
                <div style={{ flexShrink:0 }}>
                  <span className="bebas" style={{ fontSize:48,color:"rgba(232,50,10,.14)",lineHeight:1,display:"block" }}>{s.n}</span>
                  <div style={{ fontSize:26 }}>{s.e}</div>
                </div>
                <div>
                  <p style={{ fontSize:16,fontWeight:700,marginBottom:10,lineHeight:1.3 }}>{s.t}</p>
                  <p style={{ fontSize:14,color:SUB,lineHeight:1.75 }}>{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* DUAL */}
      <section className="sec" style={{ position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",left:"-3%",bottom:"5%",opacity:.035,pointerEvents:"none" }}><BpGear size={340} op={1}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div className="g2">
            <div style={{ background:"linear-gradient(135deg,rgba(232,50,10,.07),rgba(232,50,10,.02))",border:"1px solid rgba(232,50,10,.18)",borderRadius:16,padding:36 }}>
              <span className="tag t-red" style={{ marginBottom:20,display:"inline-flex" }}>• PARA QUIENES BUSCAN</span>
              <h3 className="bebas" style={{ fontSize:"clamp(28px,3.5vw,42px)",lineHeight:.95,marginBottom:18 }}>
                <span style={{ color:"rgba(255,255,255,.22)" }}>NO DEJES QUE TU FAENA</span><br/><span style={{ color:RED }}>FRENE LA OPERACIÓN.</span>
              </h3>
              <p style={{ color:SUB,fontSize:15,lineHeight:1.8,marginBottom:24 }}>Cada hora de parada no planificada cuesta. Encuentra el repuesto, máquina o servicio que necesitas hoy — sin llamadas en frío, sin cotizaciones eternas.</p>
              <ul style={{ listStyle:"none",marginBottom:32,display:"flex",flexDirection:"column",gap:12 }}>
                {["Publica tu necesidad y recibe ofertas de proveedores verificados","IA que identifica matches relevantes de todo Chile","Negocias directo, sin intermediarios ni comisiones"].map((b,i)=>(
                  <li key={i} style={{ display:"flex",gap:10,fontSize:14,color:SUB }}><span style={{ color:RED,flexShrink:0,fontWeight:700 }}>→</span>{b}</li>
                ))}
              </ul>
              <button className="btn-red" onClick={()=>setAuthModal("register")}>Buscar repuesto ahora →</button>
            </div>
            <div style={{ background:"linear-gradient(135deg,rgba(245,200,66,.06),rgba(245,200,66,.02))",border:"1px solid rgba(245,200,66,.15)",borderRadius:16,padding:36 }}>
              <span className="tag t-gold" style={{ marginBottom:20,display:"inline-flex" }}>• PARA QUIENES VENDEN</span>
              <h3 className="bebas" style={{ fontSize:"clamp(28px,3.5vw,42px)",lineHeight:.95,marginBottom:18 }}>
                <span style={{ color:"rgba(255,255,255,.22)" }}>NO DEJES QUE ESE STOCK</span><br/><span style={{ color:GOLD }}>SIGA PERDIENDO VALOR.</span>
              </h3>
              <p style={{ color:SUB,fontSize:15,lineHeight:1.8,marginBottom:24 }}>Repuestos parados son capital congelado. Publica tu inventario en minutos y accede a miles de compradores industriales que buscan exactamente lo que tú tienes.</p>
              <ul style={{ listStyle:"none",marginBottom:32,display:"flex",flexDirection:"column",gap:12 }}>
                {["0% de comisión — lo que vendes, es 100% tuyo","Tu catálogo visible para toda la industria chilena","Plan gratis de por vida para los primeros 300 usuarios"].map((b,i)=>(
                  <li key={i} style={{ display:"flex",gap:10,fontSize:14,color:SUB }}><span style={{ color:GOLD,flexShrink:0,fontWeight:700 }}>→</span>{b}</li>
                ))}
              </ul>
              <button className="btn-gold" onClick={()=>setAuthModal("register")}>Publicar mi inventario →</button>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* LO MÁS BUSCADO */}
      <section className="sec" style={{ background:BG2,position:"relative",overflow:"hidden" }}>
        <BpGrid/>
        <div style={{ position:"absolute",right:"-2%",top:"5%",opacity:.04,pointerEvents:"none" }}><BpBearing size={280} op={1}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ marginBottom:44 }}>
            <span className="tag t-blue" style={{ marginBottom:14,display:"inline-flex" }}>LO MÁS BUSCADO</span>
            <h2 className="bebas" style={{ fontSize:"clamp(38px,5.5vw,66px)",lineHeight:.9 }}>
              <span style={{ color:"rgba(255,255,255,.18)" }}>CATEGORÍAS </span><span style={{ color:RED }}>CALIENTES.</span>
            </h2>
            <p style={{ color:MUTED,fontSize:15,marginTop:10 }}>Repuestos y equipos más buscados por empresas industriales en Chile.</p>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:14 }}>
            {CATS.map((c,i)=>(
              <div key={i} className="card" style={{ padding:20,cursor:"pointer",position:"relative",overflow:"hidden" }}
                onClick={openModal}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(59,158,255,.3)";e.currentTarget.style.transform="translateY(-2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.transform="";}}>
                <div style={{ position:"absolute",bottom:-12,right:-12,opacity:.14 }}><c.Bp size={70} op={1}/></div>
                <div style={{ fontSize:26,marginBottom:10,position:"relative" }}>{c.e}</div>
                <p style={{ fontWeight:700,fontSize:13,marginBottom:3,position:"relative" }}>{c.n}</p>
                <p style={{ fontSize:10,color:MUTED,marginBottom:11,position:"relative" }}>{c.s}</p>
                <div className="prog" style={{ marginBottom:5,position:"relative" }}><div className="prog-fill" style={{ width:`${c.p}%` }}/></div>
                <div style={{ display:"flex",justifyContent:"space-between",position:"relative" }}>
                  <span className="mono" style={{ fontSize:10,color:BLUE }}>🔥 +{c.v.toLocaleString()}/mes</span>
                  <span className="bc" style={{ fontSize:9,color:MUTED,border:`1px solid ${BORDER}`,borderRadius:2,padding:"1px 5px" }}>TOP #{i+1}</span>
                </div>
              </div>
            ))}
            <div onClick={openModal} style={{ border:"1.5px dashed rgba(232,50,10,.22)",borderRadius:10,padding:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",cursor:"pointer",transition:"all .2s",minHeight:130 }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
              onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(232,50,10,.22)"}>
              <span style={{ fontSize:28,color:RED,marginBottom:8 }}>+</span>
              <p style={{ fontWeight:700,fontSize:13,color:RED,marginBottom:5 }}>Publica tu repuesto</p>
              <p style={{ fontSize:11,color:MUTED }}>Crea tu cuenta gratis</p>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* PUBLICACIONES */}
      <section className="sec" id="publicaciones" style={{ position:"relative",overflow:"hidden" }}>
        <div style={{ position:"absolute",left:"-3%",top:"8%",opacity:.03,pointerEvents:"none" }}><BpMotor size={380} op={1}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:20,marginBottom:32 }}>
            <div>
              <span className="tag t-red" style={{ marginBottom:12,display:"inline-flex" }}>EN VIVO</span>
              <h2 className="bebas" style={{ fontSize:"clamp(32px,5vw,60px)",lineHeight:.9 }}>
                <span style={{ color:"rgba(255,255,255,.18)" }}>LO QUE LA INDUSTRIA </span><span style={{ color:RED }}>OFRECE HOY.</span>
              </h2>
            </div>
            <div>
              <p className="bc" style={{ fontSize:10,color:MUTED,letterSpacing:1,marginBottom:8,textTransform:"uppercase" }}>Buscar sin registrarse</p>
              <div style={{ display:"flex",gap:8 }}>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  placeholder="Ej: Rodamiento SKF, Motor WEG..."
                  style={{ background:BG3,border:`1px solid ${BORDER2}`,borderRadius:8,padding:"10px 14px",fontSize:14,color:TEXT,width:230 }}/>
                <button className="btn-red" style={{ padding:"10px 16px",fontSize:13 }} onClick={doSearch}>Buscar →</button>
              </div>
              <p style={{ fontSize:11,color:MUTED,marginTop:6 }}>🔒 Regístrate para contactar al vendedor.</p>
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {listings.slice(0,5).map(l=>{
              const isSol=l.type==="solicito";
              return (
                <div key={l.id} className={`lcard${isSol?" sol":""}`}>
                  <div style={{ display:"flex" }}>
                    <div style={{ width:90,minHeight:108,background:BG2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0,position:"relative",borderRight:`1px solid ${BORDER}` }}>
                      {l.e||"📦"}
                      <div style={{ position:"absolute",top:7,left:7 }}><Bdg text={l.badge} type={l.bt}/></div>
                    </div>
                    <div style={{ flex:1,padding:"13px 16px" }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10 }}>
                        <div style={{ flex:1 }}>
                          <p className="bc" style={{ fontSize:9,fontWeight:700,color:isSol?PUR:BLUE,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4 }}>{l.cat}</p>
                          <p style={{ fontSize:15,fontWeight:700,marginBottom:5,lineHeight:1.3,color:isSol?PUR:TEXT }}>{l.title}</p>
                          <p style={{ fontSize:13,color:MUTED,marginBottom:8,lineHeight:1.5 }}>{l.desc}</p>
                          <div style={{ display:"flex",gap:14,flexWrap:"wrap" }}>
                            <span className="mono" style={{ fontSize:16,fontWeight:700,color:isSol?PUR:RED }}>{l.price}</span>
                            <span style={{ fontSize:12,color:MUTED }}>📍 {l.city}</span>
                            <span style={{ fontSize:12,color:MUTED }}>🕐 {l.ts}</span>
                          </div>
                        </div>
                        <button className={isSol?"btn-ol":"btn-red"} style={{ fontSize:13,padding:"8px 16px",flexShrink:0,...(isSol?{borderColor:PUR,color:PUR}:{}) }} onClick={openModal}>
                          {isSol?"Ofertar":"Contactar"}
                        </button>
                      </div>
                      <div style={{ height:"0.5px",background:BORDER,margin:"10px 0" }}/>
                      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                        <div style={{ width:26,height:26,borderRadius:"50%",background:"rgba(232,50,10,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:RED,flexShrink:0 }}>{l.ini}</div>
                        <p style={{ fontSize:13,fontWeight:600 }}>{l.biz}</p>
                        {l.ok&&<span style={{ fontSize:11,color:"#4ADE80" }}>✓ Verificado</span>}
                        {l.s>0&&<span style={{ fontSize:11,color:MUTED }}>· {l.s} ventas</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div onClick={openModal} style={{ border:"1.5px dashed rgba(232,50,10,.18)",borderRadius:12,padding:32,textAlign:"center",cursor:"pointer",transition:"all .2s" }}
              onMouseEnter={e=>e.currentTarget.style.borderColor=RED}
              onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(232,50,10,.18)"}>
              <p className="bebas" style={{ fontSize:36,color:RED,marginBottom:8 }}>+2.400 PUBLICACIONES ACTIVAS HOY</p>
              <p style={{ color:MUTED,fontSize:15,marginBottom:20 }}>Repuestos, máquinas, servicios y solicitudes de toda la industria chilena.</p>
              <button className="btn-red" style={{ fontSize:14 }}>Ver todas las publicaciones →</button>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* POR QUÉ */}
      <section className="sec" style={{ background:BG2,position:"relative",overflow:"hidden" }}>
        <BpGrid/>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ marginBottom:48,textAlign:"center" }}>
            <span className="tag t-blue" style={{ marginBottom:14,display:"inline-flex" }}>POR QUÉ SPARTSHUB</span>
            <h2 className="bebas" style={{ fontSize:"clamp(36px,5vw,62px)",lineHeight:.9 }}>
              <span style={{ color:"rgba(255,255,255,.18)" }}>EL MARKETPLACE QUE </span><span style={{ color:RED }}>LA INDUSTRIA NECESITABA.</span>
            </h2>
          </div>
          <div className="g4">
            {[
              { v:"0%",  l:"Sin comisiones",      d:"Lo que acuerdas, es tuyo. No cobramos porcentaje sobre ventas ni compras.", c:RED },
              { v:"P2P", l:"Contacto directo",     d:"Comprador y vendedor directos. Sin burocracia, sin formularios eternos.",    c:BLUE },
              { v:"IA",  l:"Trade Inteligente",    d:"Nuestra IA encuentra los mejores matches del catálogo industrial chileno.",   c:PUR },
              { v:"✓",   l:"Usuarios verificados", d:"Todos los proveedores pasan por verificación. Sabés con quién tratás.",      c:"#4ADE80" },
            ].map((v,i)=>(
              <div key={i} className="card" style={{ padding:28,textAlign:"center" }}>
                <p className="bebas" style={{ fontSize:50,color:v.c,lineHeight:1,marginBottom:10 }}>{v.v}</p>
                <p style={{ fontWeight:700,fontSize:15,marginBottom:8 }}>{v.l}</p>
                <p style={{ fontSize:13,color:MUTED,lineHeight:1.7 }}>{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* CTA FINAL */}
      <section className="sec" id="registro" style={{ position:"relative",overflow:"hidden" }}>
        <BpGrid/>
        <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse at center,rgba(232,50,10,.07) 0%,transparent 60%)`,pointerEvents:"none" }}/>
        <div style={{ position:"absolute",left:"4%",top:"10%",opacity:.045,animation:"float 8s ease-in-out infinite",pointerEvents:"none" }}><BpBearing size={240} op={1}/></div>
        <div style={{ position:"absolute",right:"4%",bottom:"8%",opacity:.045,animation:"float 10s ease-in-out infinite 2s",pointerEvents:"none" }}><BpGear size={240} op={1}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1,textAlign:"center",maxWidth:640,margin:"0 auto" }}>
          <span className="tag t-gold" style={{ marginBottom:20,display:"inline-flex" }}>⭐ OFERTA FUNDADORES</span>
          <h2 className="bebas" style={{ fontSize:"clamp(48px,7vw,86px)",lineHeight:.9,marginBottom:18 }}>
            <span style={{ color:"rgba(255,255,255,.18)" }}>ÚNETE HOY.</span><br/><span style={{ color:RED }}>GRATIS PARA SIEMPRE.</span>
          </h2>
          <p style={{ color:SUB,fontSize:17,lineHeight:1.7,marginBottom:36 }}>Aprovecha el plan fundador antes de que se agoten los cupos.<br/>Sin tarjeta de crédito. Sin letra chica.</p>
          <div style={{ display:"inline-flex",alignItems:"center",gap:28,background:BG3,border:`1px solid ${BORDER2}`,borderRadius:12,padding:"18px 36px",marginBottom:36,boxShadow:`0 0 40px rgba(232,50,10,.07)` }}>
            <div style={{ textAlign:"center" }}>
              <p className="bebas" style={{ fontSize:48,color:RED,lineHeight:1 }}>{slots}</p>
              <p className="mono" style={{ fontSize:10,color:MUTED,letterSpacing:1 }}>CUPOS DISPONIBLES</p>
            </div>
            <div style={{ width:1,height:52,background:BORDER }}/>
            <div style={{ textAlign:"center" }}>
              <p className="bebas" style={{ fontSize:48,color:"rgba(255,255,255,.12)",lineHeight:1 }}>300</p>
              <p className="mono" style={{ fontSize:10,color:MUTED,letterSpacing:1 }}>TOTAL FUNDADORES</p>
            </div>
          </div>
          <div style={{ display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:20 }}>
            <button className="btn-red" style={{ fontSize:17,padding:"16px 38px" }} onClick={()=>setAuthModal("register")}>Crear mi cuenta gratis</button>
            <button className="btn-ol" onClick={()=>setAuthModal("login")}>Ya tengo cuenta · Iniciar sesión</button>
          </div>
          <div style={{ display:"flex",gap:24,justifyContent:"center",flexWrap:"wrap" }}>
            {["Sin tarjeta de crédito","Activa en minutos","Cancela cuando quieras"].map(t=>(
              <span key={t} style={{ fontSize:13,color:MUTED,display:"flex",alignItems:"center",gap:5 }}><span style={{ color:"#4ADE80" }}>✓</span>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:"22px 0",borderTop:`1px solid ${BORDER}`,background:BG2 }}>
        <div className="wrap" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <div style={{ width:28,height:28,background:RED,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center" }}>
              <span className="bebas" style={{ fontSize:16,color:"#fff" }}>S</span>
            </div>
            <span className="bebas" style={{ fontSize:16,letterSpacing:1 }}>SPARTSHUB</span>
          </div>
          <p style={{ fontSize:12,color:MUTED }}>El marketplace industrial de Chile · P2P · 0% Comisión</p>
          <p style={{ fontSize:12,color:MUTED }}>© 2026 SpartsHub</p>
        </div>
      </footer>

      
      {/* AUTH MODAL */}
      {authModal && (
        <div className='modal-bg fi' onClick={()=>setAuthModal(null)} role='dialog' aria-modal='true'>
          <div className='modal-box' onClick={e=>e.stopPropagation()} style={{ maxWidth:400 }}>
            <button onClick={()=>setAuthModal(null)} style={{ position:'absolute',top:14,right:14,background:'none',border:'none',color:'#4B5563',cursor:'pointer',fontSize:20 }}>✕</button>
            <div style={{ display:'flex',background:'rgba(255,255,255,.05)',borderRadius:8,padding:3,marginBottom:22,gap:3 }}>
              {[['login','Iniciar sesión'],['register','Registrarse']].map(([m,l])=>(
                <div key={m} onClick={()=>{setAuthModal(m);setAuthErr('');setAuthOk('');}}
                  style={{ flex:1,padding:'8px',borderRadius:6,fontSize:13,fontWeight:700,textAlign:'center',cursor:'pointer',fontFamily:'Barlow Condensed,sans-serif',letterSpacing:.5,textTransform:'uppercase',transition:'all .15s',background:authModal===m?RED:'transparent',color:authModal===m?'#fff':'rgba(255,255,255,.6)' }}>
                  {l}
                </div>
              ))}
            </div>
            {authErr && <div style={{ background:'rgba(232,50,10,.1)',border:'1px solid rgba(232,50,10,.25)',borderRadius:8,padding:'10px 14px',fontSize:13,color:RED,marginBottom:14 }}>{authErr}</div>}
            {authOk  && <div style={{ background:'rgba(74,222,128,.1)',border:'1px solid rgba(74,222,128,.25)',borderRadius:8,padding:'10px 14px',fontSize:13,color:'#4ADE80',marginBottom:14 }}>{authOk}</div>}
            <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
              {authModal==='register' && <>
                <input placeholder='Nombre completo *' value={authName} onChange={e=>setAuthName(e.target.value)} style={{ background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 14px',fontSize:14,color:'#FFFFFF',width:'100%',outline:'none',fontFamily:'inherit' }}/>
                <input placeholder='Empresa o nombre comercial *' value={authBiz} onChange={e=>setAuthBiz(e.target.value)} style={{ background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 14px',fontSize:14,color:'#FFFFFF',width:'100%',outline:'none',fontFamily:'inherit' }}/>
                <input placeholder='WhatsApp (con código país)' value={authPhone} onChange={e=>setAuthPhone(e.target.value)} style={{ background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 14px',fontSize:14,color:'#FFFFFF',width:'100%',outline:'none',fontFamily:'inherit' }}/>
              </>}
              <input type='email' placeholder='Email *' value={authEmail} onChange={e=>setAuthEmail(e.target.value)} style={{ background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 14px',fontSize:14,color:'#FFFFFF',width:'100%',outline:'none',fontFamily:'inherit' }}/>
              <div style={{ position:'relative' }}>
                <input type={showPass?'text':'password'} placeholder='Contraseña *' value={authPass} onChange={e=>setAuthPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doAuth()} style={{ background:'rgba(255,255,255,.15)',border:'1.5px solid rgba(255,255,255,.3)',borderRadius:8,padding:'12px 44px 12px 14px',fontSize:14,color:'#FFFFFF',width:'100%',outline:'none',fontFamily:'inherit' }}/>
                <button onClick={()=>setShowPass(v=>!v)} style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#6B7280',fontSize:13,fontFamily:'inherit',padding:0 }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
              {authModal==='login' && (
                <div style={{ textAlign:'right', marginTop:-4 }}>
                  <button onClick={doRecovery} style={{ background:'none',border:'none',color:'#E8320A',fontSize:13,cursor:'pointer',padding:'4px 0',fontFamily:'inherit' }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
              <button className='btn-red' style={{ width:'100%',justifyContent:'center',fontSize:15,padding:'13px',marginTop:4,opacity:authLoading?.6:1 }} onClick={doAuth} disabled={authLoading}>
                {authLoading ? '...' : authModal==='login' ? 'Ingresar' : 'Crear cuenta gratis'}
              </button>
            </div>
            <p style={{ textAlign:'center',fontSize:12,color:'#4B5563',marginTop:14 }}>100% gratuito · Sin comisiones · Conexión directa</p>
          </div>
        </div>
      )}
      {showModal&&<Modal slots={slots} onClose={()=>setShowModal(false)} onReg={()=>{setShowModal(false);onGoRegister();}}/>}
      {toast&&<Toast term={toast} onClose={()=>setToast(null)} onReg={()=>{setToast(null);onGoRegister();}}/>}
    </div>
  );
}
