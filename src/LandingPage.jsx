import { useState, useEffect } from "react";
import { sb } from "./supabase.js";
import { T, CSS_BASE } from "./theme.js";

const { RED, RED2, GOLD, BLUE, GREEN, PUR, BG, BG2, BG3, CARD, SURF, BORDER, BORDER2, TEXT, SUB, MUTED } = T;


/* ── SpartsHub Logo component ─────────────────────────────── */
function SpartsLogo({ size=36 }) {
  const fw = size * 3.2;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:size*0.28 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="36" height="36" rx="8" fill="#E8320A"/>
        <text x="18" y="26" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="24" fill="white" letterSpacing="1">S</text>
        <circle cx="26" cy="10" r="4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
        <circle cx="26" cy="10" r="1.5" fill="rgba(255,255,255,0.9)"/>
      </svg>
      <span style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:size*0.6, letterSpacing:size*0.04, color:"#E8ECF1", lineHeight:1 }}>
        SPARTSHUB
      </span>
    </div>
  );
}

/* ── Blueprint SVGs ─────────────────────────────────────────── */
const BpBearing = ({ size=200 }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="1">
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
  </svg>
);

const BpGear = ({ size=240 }) => (
  <svg width={size} height={size} viewBox="0 0 240 240" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="1">
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
  </svg>
);

const BpPump = ({ size=280 }) => (
  <svg width={size} height={size*0.72} viewBox="0 0 280 200" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="1">
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
  </svg>
);

const BpMotor = ({ size=260 }) => (
  <svg width={size} height={size*0.65} viewBox="0 0 260 170" fill="none" stroke={BLUE} strokeWidth="0.8" opacity="1">
    <rect x="40" y="30" width="180" height="110" rx="6"/>
    <ellipse cx="40" cy="85" rx="20" ry="50"/>
    <ellipse cx="220" cy="85" rx="20" ry="50"/>
    {[45,65,85,105,125].map(y=>(
      <line key={y} x1="40" y1={y} x2="220" y2={y} strokeDasharray="3 3" strokeWidth="0.4"/>
    ))}
    <line x1="220" y1="85" x2="260" y2="85" strokeWidth="2.5"/>
    <rect x="255" y="78" width="5" height="14"/>
  </svg>
);

const BpGrid = () => (
  <svg className="bp-grid" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
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

/* ── Ticker ─────────────────────────────────────────────────── */
const TICKS = ["Rodamientos SKF","Bombas Hidráulicas","Motores WEG","Filtros Fleetguard","Correas Gates","Repuestos Komatsu","Variadores ABB","Compresores Atlas","Reductores SEW","Válvulas Parker","Repuestos CAT","Motores Siemens","Sellos Hidráulicos","Rodamientos FAG","Bombas Rexroth"];
function Ticker() {
  const items = [...TICKS, ...TICKS];
  return (
    <div style={{ background:`linear-gradient(90deg,${RED},${RED2})`, padding:"9px 0", overflow:"hidden" }}>
      <div className="tt">
        {items.map((t,i) => (
          <span key={i} className="bc" style={{ fontSize:11, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", color:"rgba(255,255,255,.85)", padding:"0 20px", flexShrink:0 }}>
            {t} <span style={{ opacity:.4 }}>◆</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Data ───────────────────────────────────────────────────── */
const CATS = [
  { e:"⛏️", n:"Minería",              s:"Equipos, repuestos y maquinaria para faenas mineras" },
  { e:"🌲", n:"Forestal",             s:"Equipamiento y piezas para la industria forestal" },
  { e:"🏗️", n:"Construcción",         s:"Maquinaria pesada, herramientas y repuestos" },
  { e:"⚡", n:"Energía",              s:"Generadores, transformadores y equipos eléctricos" },
  { e:"🚛", n:"Transporte",           s:"Repuestos, neumáticos y equipos para flotas" },
  { e:"⚙️", n:"Herramientas",         s:"Herramientas industriales y de precisión" },
  { e:"🔧", n:"Transmisión",          s:"Reductores, correas, cadenas y acoplamientos" },
  { e:"💧", n:"Fluidos & Hidráulica", s:"Bombas, válvulas, sellos y sistemas hidráulicos" },
  { e:"🛣️", n:"Rutas y Caminos",      s:"Equipos y maquinaria para obras viales" },
  { e:"🔩", n:"Sanitarias",           s:"Tuberías, válvulas y equipos sanitarios" },
];

const DEMO = [
  { id:1, type:"venta",    cat:"RODAMIENTOS",  title:"Rodamiento SKF 6205-2RS — Lote 50u",   desc:"Stock nuevo en bodega. Caja sellada original SKF. Retiro inmediato Santiago.", price:"$4.200 CLP/u",   city:"Santiago",    ts:"2h", biz:"Industrias Metálicas S.A.", ini:"IM", ok:true,  s:47, badge:"⭐ Destacado", bt:"gold", e:"⚙️" },
  { id:2, type:"venta",    cat:"HIDRÁULICA",   title:"Bomba Rexroth A10VSO 28DR — 200hrs",   desc:"Desmontada, revisada. Garantía 90 días de funcionamiento.",                  price:"$1.850.000 CLP", city:"Antofagasta", ts:"5h", biz:"Minera Collahuasi Rep.",    ini:"MC", ok:true,  s:12, badge:"DISPONIBLE",   bt:"red",  e:"💧" },
  { id:3, type:"venta",    cat:"MOTORES",       title:"Motor WEG 15HP IE3 380V trifásico",    desc:"Nuevo en caja. Eje 42mm. Despacho nacional o retiro en Concepción.",         price:"$680.000 CLP",   city:"Concepción",  ts:"1d", biz:"Electro Sur Ltda.",         ini:"EL", ok:true,  s:83, badge:"🔥 Urgente",   bt:"red",  e:"⚡" },
  { id:4, type:"solicito", cat:"SOLICITUD",     title:"BUSCO: Filtros Fleetguard HF6337 ×20", desc:"Urgente para faena Atacama. Pago inmediato. Original o aftermarket cert.",  price:"A tratar",       city:"Atacama",     ts:"3h", biz:"Constructora Ponce SpA",    ini:"CP", ok:true,  s:0,  badge:"BUSCO",        bt:"pur",  e:"🔍" },
  { id:5, type:"venta",    cat:"TRANSMISIÓN",   title:"Reductor SEW-Eurodrive R57 Rel. 28:1", desc:"1.500hrs de uso. Perfectas condiciones. Incluye ficha técnica.",            price:"$420.000 CLP",   city:"Valparaíso",  ts:"2d", biz:"Tecno Industrial Ltda.",    ini:"TI", ok:true,  s:29, badge:"DISPONIBLE",   bt:"red",  e:"⚙️" },
];

const BC = {
  red:  { bg:"rgba(232,50,10,.15)",  c:RED,  b:"rgba(232,50,10,.3)"  },
  gold: { bg:"rgba(245,200,66,.12)", c:GOLD, b:"rgba(245,200,66,.3)" },
  pur:  { bg:"rgba(168,85,247,.12)", c:PUR,  b:"rgba(168,85,247,.3)" },
};

const Bdg = ({ text, type="red" }) => {
  const s = BC[type]||{bg:"rgba(255,255,255,.06)",c:SUB,b:BORDER};
  return <span className="bc" style={{ fontSize:10,fontWeight:700,letterSpacing:.8,textTransform:"uppercase",background:s.bg,color:s.c,border:`1px solid ${s.b}`,borderRadius:3,padding:"3px 8px" }}>{text}</span>;
};

/* ── Auth Modal ─────────────────────────────────────────────── */
function AuthModal({ mode, onClose, onSuccess }) {
  const [tab, setTab]       = useState(mode||"login");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [name, setName]     = useState("");
  const [biz, setBiz]       = useState("");
  const [phone, setPhone]   = useState("");
  const [err, setErr]       = useState("");
  const [ok, setOk]         = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    const fn = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const doAuth = async () => {
    setErr(""); setOk(""); setLoading(true);
    if (tab === "login") {
      const { data, error } = await sb.auth.signInWithPassword({ email, password:pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      window.location.reload();
    } else {
      if (!name || !biz) { setErr("Completa todos los campos."); setLoading(false); return; }
      const { data, error } = await sb.auth.signUp({ email, password:pass });
      if (error) { setErr(error.message); setLoading(false); return; }
      if (data.user) {
        await sb.from("profiles").upsert({ id:data.user.id, name, biz, phone });
        setOk("¡Cuenta creada! Revisa tu email para confirmar, luego inicia sesión.");
        setTab("login");
      }
    }
    setLoading(false);
  };

  const doRecovery = async () => {
    if (!email) { setErr("Ingresa tu email primero."); return; }
    setLoading(true);
    await sb.auth.resetPasswordForEmail(email, { redirectTo:"https://spartshub.com" });
    setOk("Email enviado. Revisa tu bandeja de entrada.");
    setLoading(false);
  };

  const INP = { background:"rgba(255,255,255,.08)", border:"1.5px solid rgba(255,255,255,.15)", borderRadius:8, padding:"12px 14px", fontSize:14, color:"#E8ECF1", width:"100%", outline:"none", fontFamily:"inherit" };

  return (
    <div className="modal-bg fi" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box" onClick={e=>e.stopPropagation()} style={{ maxWidth:420 }}>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:14,background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,lineHeight:1 }}>✕</button>

        {/* Logo */}
        <div style={{ marginBottom:22 }}>
          <SpartsLogo size={32}/>
        </div>

        {/* Tabs */}
        <div className="seg" style={{ marginBottom:20 }}>
          {[["login","Iniciar sesión"],["register","Registrarse"]].map(([m,l])=>(
            <div key={m} className={`seg-btn${tab===m?" active":""}`} onClick={()=>{setTab(m);setErr("");setOk("");}}>{l}</div>
          ))}
        </div>

        {err && <div style={{ background:"rgba(232,50,10,.1)",border:"1px solid rgba(232,50,10,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:RED,marginBottom:14 }}>{err}</div>}
        {ok  && <div style={{ background:"rgba(74,222,128,.1)",border:"1px solid rgba(74,222,128,.25)",borderRadius:8,padding:"10px 14px",fontSize:13,color:GREEN,marginBottom:14 }}>{ok}</div>}

        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
          {tab === "register" && <>
            <input className="inp" placeholder="Nombre completo *" value={name} onChange={e=>setName(e.target.value)}/>
            <input className="inp" placeholder="Empresa o nombre comercial *" value={biz} onChange={e=>setBiz(e.target.value)}/>
            <input className="inp" placeholder="WhatsApp (con código país)" value={phone} onChange={e=>setPhone(e.target.value)}/>
          </>}
          <input className="inp" type="email" placeholder="Email *" value={email} onChange={e=>setEmail(e.target.value)}/>
          <div style={{ position:"relative" }}>
            <input className="inp" type={showPass?"text":"password"} placeholder="Contraseña *" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doAuth()} style={{ paddingRight:44 }}/>
            <button onClick={()=>setShowPass(v=>!v)} style={{ position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:MUTED,fontSize:13 }}>
              {showPass?"🙈":"👁️"}
            </button>
          </div>
          {tab==="login" && (
            <div style={{ textAlign:"right",marginTop:-4 }}>
              <button onClick={doRecovery} style={{ background:"none",border:"none",color:RED,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>¿Olvidaste tu contraseña?</button>
            </div>
          )}
          <button className="btn-red" style={{ width:"100%",marginTop:4,opacity:loading?.6:1,fontSize:15,padding:13 }} onClick={doAuth} disabled={loading}>
            {loading ? "..." : tab==="login" ? "Ingresar" : "Crear cuenta gratis"}
          </button>
        </div>
        <p style={{ textAlign:"center",fontSize:12,color:MUTED,marginTop:14 }}>100% gratuito · Sin comisiones · Conexión directa</p>
      </div>
    </div>
  );
}

/* ── Modal invitado ─────────────────────────────────────────── */
function GuestModal({ slots, onClose, onReg }) {
  useEffect(()=>{ const fn=e=>e.key==="Escape"&&onClose(); window.addEventListener("keydown",fn); return ()=>window.removeEventListener("keydown",fn); },[]);
  return (
    <div className="modal-bg fi" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <button onClick={onClose} style={{ position:"absolute",top:14,right:14,background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:20,lineHeight:1 }}>✕</button>
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
        <button onClick={onClose} style={{ width:"100%",marginTop:10,background:"none",border:"none",color:MUTED,fontSize:14,cursor:"pointer",padding:8 }}>Seguir explorando como invitado</button>
      </div>
    </div>
  );
}

/* ── Toast ──────────────────────────────────────────────────── */
function Toast({ term, onClose, onReg }) {
  useEffect(()=>{ const t=setTimeout(onClose,7000); return ()=>clearTimeout(t); },[]);
  return (
    <div className="toast">
      <p style={{ fontWeight:600,marginBottom:4,fontSize:15 }}>Resultados para "<span style={{ color:RED }}>{term}</span>"</p>
      <p style={{ color:SUB,fontSize:13,marginBottom:12 }}>Regístrate gratis para ver detalles y contactar vendedores.</p>
      <div style={{ display:"flex",gap:10 }}>
        <button className="btn-red" style={{ padding:"8px 18px",fontSize:13 }} onClick={onReg}>Ver →</button>
        <button onClick={onClose} style={{ background:"none",border:"none",color:MUTED,cursor:"pointer",fontSize:13 }}>Cerrar</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN LANDING
══════════════════════════════════════════════════════════════ */
export default function LandingPage({ onGoRegister, onGoLogin }) {
  const [slots, setSlots]         = useState(247);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [authModal, setAuthModal] = useState(null); // 'login' | 'register' | null
  const [toast, setToast]         = useState(null);
  const [searchQ, setSearchQ]     = useState("");
  const [listings, setListings]   = useState(DEMO);

  useEffect(()=>{
    sb.from("profiles").select("id",{count:"exact",head:true}).then(({count})=>{ if(count) setSlots(Math.max(300-count,0)); });
    sb.from("listings").select("*").order("created_at",{ascending:false}).limit(5).then(({data})=>{
      if(data&&data.length>=3) setListings(data.map(l=>({...l,type:"venta",ini:(l.biz||"U").slice(0,2).toUpperCase(),badge:"DISPONIBLE",bt:"red"})));
    });
  },[]);

  const openModal=()=>setShowGuestModal(true);
  const doSearch=()=>{ if(searchQ.trim()) setToast(searchQ.trim()); };

  return (
    <div style={{ background:BG, minHeight:"100vh", color:TEXT }}>
      <style>{CSS_BASE}</style>

      {/* NAV */}
      <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:60,background:"rgba(20,22,24,.92)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${BORDER}`,padding:"13px 0" }}>
        <div className="wrap" style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <SpartsLogo size={36}/>
            <span className="tag t-dim" style={{ fontSize:10,marginLeft:4 }}>No vendemos repuestos, conectamos personas</span>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button className="btn-ol" style={{ fontSize:12,padding:"8px 16px" }} onClick={()=>setAuthModal("login")}>Iniciar sesión</button>
            <button className="btn-red" style={{ fontSize:12,padding:"8px 16px" }} onClick={()=>setAuthModal("register")}>Registrarse →</button>
          </div>
        </div>
      </nav>

      {/* TICKER */}
      <div style={{ paddingTop:63 }}><Ticker/></div>

      {/* HERO */}
      <section style={{ padding:"72px 0 80px",position:"relative",overflow:"hidden",minHeight:"88vh",display:"flex",alignItems:"center" }}>
        <BpGrid/>
        <div style={{ position:"absolute",right:"3%",top:"6%",opacity:.06,animation:"float 7s ease-in-out infinite",pointerEvents:"none" }}><BpGear size={320}/></div>
        <div style={{ position:"absolute",right:"26%",bottom:"4%",opacity:.04,animation:"float 9s ease-in-out infinite 2s",pointerEvents:"none" }}><BpBearing size={200}/></div>
        <div style={{ position:"absolute",left:"-1%",bottom:"8%",opacity:.035,animation:"float 11s ease-in-out infinite 1s",pointerEvents:"none" }}><BpPump size={240}/></div>
        <div style={{ position:"absolute",top:"15%",left:"-8%",width:600,height:600,background:`radial-gradient(circle,rgba(232,50,10,.1) 0%,transparent 65%)`,pointerEvents:"none" }}/>

        <div className="wrap" style={{ position:"relative",zIndex:2,width:"100%" }}>
          <div style={{ display:"flex",gap:64,alignItems:"center" }}>
            {/* Left */}
            <div style={{ flex:1,minWidth:0 }}>

              <h1 className="bebas fu" style={{ fontSize:"clamp(58px,9.5vw,116px)",lineHeight:.88,marginBottom:28,animationDelay:".1s" }}>
                <span style={{ color:"rgba(255,255,255,.22)" }}>Publica lo</span><br/>
                <span style={{ color:"rgba(255,255,255,.22)" }}>que </span><span style={{ color:RED }}>vendes</span><br/>
                <span style={{ color:"rgba(255,255,255,.22)" }}>o lo que </span><span style={{ color:GOLD }}>buscas.</span>
              </h1>
              <p className="fu" style={{ fontSize:17,color:SUB,lineHeight:1.8,marginBottom:28,maxWidth:500,animationDelay:".15s" }}>
                Que tu operación no deje de producir, encuentra tus equipos, partes y repuestos en Spartshub.
              </p>
              <div className="fu" style={{ display:"inline-flex",alignItems:"center",gap:10,background:"rgba(245,200,66,.06)",border:"1px solid rgba(245,200,66,.2)",borderRadius:8,padding:"11px 18px",marginBottom:28,animationDelay:".18s" }}>
                <span style={{ fontSize:18 }}>⚡</span>
                <span className="bc" style={{ fontWeight:700,fontSize:14,color:GOLD }}>Plan gratis de por vida</span>
                <span className="mono" style={{ fontSize:13,color:TEXT }}>— Solo <span style={{ color:RED,fontWeight:700 }}>{slots}</span> cupos</span>
              </div>
              <div className="fu" style={{ display:"flex",gap:12,flexWrap:"wrap",marginBottom:32,animationDelay:".22s" }}>
                <button className="btn-red" style={{ fontSize:16,padding:"15px 34px" }} onClick={()=>setAuthModal("register")}>Comenzar gratis hoy →</button>
                <a href="#como-funciona" className="btn-ol" style={{ fontSize:14 }}>¿Cómo funciona? ↓</a>
              </div>
              <div className="fu" style={{ display:"flex",gap:16,flexWrap:"wrap",animationDelay:".26s" }}>
                {["Verificado","0% Comisión","Trade IA","P2P directo"].map(b=>(
                  <div key={b} style={{ display:"flex",alignItems:"center",gap:6,fontSize:13,color:MUTED }}>
                    <span style={{ color:RED }}>✓</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — industries list */}
            <div style={{ width:320,flexShrink:0,display:"none" }} className="cat-panel-hide">
              <style>{`@media(min-width:960px){.cat-panel-hide{display:block!important}}`}</style>
              <div style={{ background:"rgba(255,255,255,.03)",border:`1px solid rgba(255,255,255,.08)`,borderRadius:16,overflow:"hidden" }}>
                <div style={{ padding:"14px 18px",borderBottom:"1px solid rgba(255,255,255,.07)" }}>
                  <p className="bc" style={{ fontSize:10,fontWeight:700,color:MUTED,letterSpacing:1.2,textTransform:"uppercase" }}>Industrias que cubrimos</p>
                </div>
                {CATS.map((c,i)=>(
                  <div key={i} style={{ display:"flex",alignItems:"center",gap:14,padding:"11px 18px",borderBottom:i<CATS.length-1?"1px solid rgba(255,255,255,.05)":"none",transition:"background .15s",cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(232,50,10,.06)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize:18,flexShrink:0,width:28,textAlign:"center" }}>{c.e}</span>
                    <div style={{ flex:1 }}>
                      <p style={{ fontSize:13,fontWeight:700,color:TEXT,marginBottom:1 }}>{c.n}</p>
                      <p style={{ fontSize:11,color:MUTED,lineHeight:1.3 }}>{c.s}</p>
                    </div>
                    <span style={{ color:"rgba(232,50,10,.5)",fontSize:16,flexShrink:0 }}>›</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* CÓMO FUNCIONA */}
      <section style={{ padding:"88px 0",position:"relative",overflow:"hidden" }} id="como-funciona">
        <div style={{ position:"absolute",right:"-4%",top:"5%",opacity:.035,pointerEvents:"none" }}><BpMotor size={420}/></div>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ marginBottom:52 }}>
            <span className="tag t-red" style={{ marginBottom:16,display:"inline-flex" }}>CÓMO FUNCIONA</span>
            <h2 className="bebas" style={{ fontSize:"clamp(42px,6vw,76px)",lineHeight:.9 }}>
              <span style={{ color:"rgba(255,255,255,.18)" }}>SIMPLE. RÁPIDO. </span>
              <span style={{ color:RED }}>SIN COMPLICACIONES.</span>
            </h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:28 }}>
            {[
              { n:"01",e:"📢",t:"Publica lo que vendes o lo que buscas",d:"¿Tienes stock parado en bodega? Publícalo. ¿Necesitas un repuesto urgente? Pídelo. Los proveedores llegan a ti." },
              { n:"02",e:"🤖",t:"La IA conecta oferta y demanda",       d:"Nuestro motor de Trade IA analiza tu necesidad y encuentra los matches más relevantes del catálogo industrial." },
              { n:"03",e:"🤝",t:"Negocian directo, sin comisión",        d:"Comprador y vendedor se contactan directamente. Sin intermediarios. Sin comisión. Solo negocios." },
              { n:"04",e:"⚙️",t:"Tu operación no se detiene",            d:"Reduce los tiempos de Stall de operaciones. Encuentra lo que necesitas antes que sea tarde." },
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
      <section style={{ padding:"88px 0",position:"relative",overflow:"hidden" }}>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:28 }}>
            <div style={{ background:"linear-gradient(135deg,rgba(232,50,10,.07),rgba(232,50,10,.02))",border:"1px solid rgba(232,50,10,.18)",borderRadius:16,padding:36 }}>
              <span className="tag t-red" style={{ marginBottom:20,display:"inline-flex" }}>• PARA QUIENES BUSCAN</span>
              <h3 className="bebas" style={{ fontSize:"clamp(28px,3.5vw,42px)",lineHeight:.95,marginBottom:18 }}>
                <span style={{ color:"rgba(255,255,255,.22)" }}>NO DEJES QUE TU FAENA</span><br/><span style={{ color:RED }}>FRENE LA OPERACIÓN.</span>
              </h3>
              <p style={{ color:SUB,fontSize:15,lineHeight:1.8,marginBottom:24 }}>Cada hora de parada no planificada cuesta. Encuentra el repuesto que necesitas hoy.</p>
              <ul style={{ listStyle:"none",marginBottom:32,display:"flex",flexDirection:"column",gap:12 }}>
                {["Publica tu necesidad y recibe ofertas verificadas","IA que identifica matches relevantes a nivel global","Negocias directo, sin intermediarios"].map((b,i)=>(
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
              <p style={{ color:SUB,fontSize:15,lineHeight:1.8,marginBottom:24 }}>Repuestos parados son capital congelado. Publica tu inventario en minutos.</p>
              <ul style={{ listStyle:"none",marginBottom:32,display:"flex",flexDirection:"column",gap:12 }}>
                {["0% de comisión — lo que vendes, es 100% tuyo","Tu catálogo visible para la industria global","Plan gratis de por vida para los primeros 300"].map((b,i)=>(
                  <li key={i} style={{ display:"flex",gap:10,fontSize:14,color:SUB }}><span style={{ color:GOLD,flexShrink:0,fontWeight:700 }}>→</span>{b}</li>
                ))}
              </ul>
              <button className="btn-gold" onClick={()=>setAuthModal("register")}>Publicar mi inventario →</button>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* PUBLICACIONES */}
      <section style={{ padding:"88px 0",background:BG2,position:"relative",overflow:"hidden" }} id="publicaciones">
        <BpGrid/>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:20,marginBottom:32 }}>
            <div>
              <h2 className="bebas" style={{ fontSize:"clamp(32px,5vw,60px)",lineHeight:.9 }}>
                <span style={{ color:"rgba(255,255,255,.18)" }}>PUBLICACIONES </span><span style={{ color:RED }}>DESTACADAS.</span>
              </h2>
            </div>
            <div>
              <p className="bc" style={{ fontSize:10,color:MUTED,letterSpacing:1,marginBottom:8,textTransform:"uppercase" }}>Buscar sin registrarse</p>
              <div style={{ display:"flex",gap:8 }}>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  className="inp" placeholder="Ej: Motor WEG, Bomba Rexroth…" style={{ width:230 }}/>
                <button className="btn-red" style={{ padding:"11px 18px",fontSize:13 }} onClick={doSearch}>Buscar →</button>
              </div>
              <p style={{ fontSize:11,color:MUTED,marginTop:6 }}>🔒 Regístrate para contactar al vendedor.</p>
            </div>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
            {listings.slice(0,5).map(l=>{
              const isSol=l.type==="solicito";
              return (
                <div key={l.id} style={{ background:CARD,border:`1px solid ${isSol?"rgba(168,85,247,.15)":BORDER}`,borderRadius:12,overflow:"hidden",cursor:"pointer",transition:"all .22s" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=isSol?"rgba(168,85,247,.4)":"rgba(232,50,10,.35)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=isSol?"rgba(168,85,247,.15)":BORDER}>
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
                        {l.ok&&<span style={{ fontSize:11,color:GREEN }}>✓ Verificado</span>}
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
              <p style={{ color:MUTED,fontSize:15,marginBottom:20 }}>Repuestos, máquinas, servicios y solicitudes de la industria global.</p>
              <button className="btn-red" style={{ fontSize:14 }}>Ver todas las publicaciones →</button>
            </div>
          </div>
        </div>
      </section>

      <div className="hr"/>

      {/* POR QUÉ */}
      <section style={{ padding:"88px 0",position:"relative",overflow:"hidden" }}>
        <div className="wrap" style={{ position:"relative",zIndex:1 }}>
          <div style={{ marginBottom:48,textAlign:"center" }}>
            <span className="tag t-blue" style={{ marginBottom:14,display:"inline-flex" }}>POR QUÉ SPARTSHUB</span>
            <h2 className="bebas" style={{ fontSize:"clamp(36px,5vw,62px)",lineHeight:.9 }}>
              <span style={{ color:"rgba(255,255,255,.18)" }}>EL MARKETPLACE QUE </span><span style={{ color:RED }}>LA INDUSTRIA NECESITABA.</span>
            </h2>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16 }}>
            {[
              { v:"0%", l:"Sin comisiones",     d:"Lo que acuerdas, es tuyo. No cobramos porcentaje sobre ventas ni compras.", c:RED  },
              { v:"P2P",l:"Contacto directo",    d:"Comprador y vendedor directos. Sin burocracia, sin formularios eternos.",   c:BLUE },
              { v:"IA", l:"Trade Inteligente",   d:"Nuestra IA encuentra los mejores matches del catálogo industrial global.", c:PUR  },
              { v:"✓",  l:"Usuarios verificados",d:"Todos los proveedores pasan por verificación. Sabés con quién tratás.",     c:GREEN},
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
      <section style={{ padding:"88px 0",position:"relative",overflow:"hidden",background:BG2 }} id="registro">
        <BpGrid/>
        <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse at center,rgba(232,50,10,.07) 0%,transparent 60%)`,pointerEvents:"none" }}/>
        <div className="wrap" style={{ position:"relative",zIndex:1,textAlign:"center",maxWidth:640,margin:"0 auto" }}>
          <span className="tag t-gold" style={{ marginBottom:20,display:"inline-flex" }}>⭐ OFERTA FUNDADORES</span>
          <h2 className="bebas" style={{ fontSize:"clamp(48px,7vw,86px)",lineHeight:.9,marginBottom:18 }}>
            <span style={{ color:"rgba(255,255,255,.18)" }}>ÚNETE HOY.</span><br/><span style={{ color:RED }}>GRATIS PARA SIEMPRE.</span>
          </h2>
          <p style={{ color:SUB,fontSize:17,lineHeight:1.7,marginBottom:36 }}>Aprovecha el plan fundador antes de que se agoten los cupos.<br/>Sin tarjeta de crédito. Sin letra chica.</p>
          <div style={{ display:"inline-flex",alignItems:"center",gap:28,background:BG3,border:`1px solid ${BORDER2}`,borderRadius:12,padding:"18px 36px",marginBottom:36 }}>
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
              <span key={t} style={{ fontSize:13,color:MUTED,display:"flex",alignItems:"center",gap:5 }}><span style={{ color:GREEN }}>✓</span>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding:"22px 0",borderTop:`1px solid ${BORDER}`,background:BG3 }}>
        <div className="wrap" style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:16 }}>
          <SpartsLogo size={28}/>
          <p style={{ fontSize:12,color:MUTED }}>El marketplace industrial global · P2P · 0% Comisión</p>
          <p style={{ fontSize:12,color:MUTED }}>© 2026 SpartsHub</p>
        </div>
      </footer>

      {authModal && <AuthModal mode={authModal} onClose={()=>setAuthModal(null)}/>}
      {showGuestModal && <GuestModal slots={slots} onClose={()=>setShowGuestModal(false)} onReg={()=>{setShowGuestModal(false);setAuthModal("register");}}/>}
      {toast && <Toast term={toast} onClose={()=>setToast(null)} onReg={()=>{setToast(null);setAuthModal("register");}}/>}
    </div>
  );
}
