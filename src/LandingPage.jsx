import { useState } from "react";
import { T, CSS_BASE } from "./theme.js";

const { RED, RED2, BG, BG2, BG3, CARD, BORDER, BORDER2, TEXT, SUB, MUTED, GREEN, GOLD, BLUE } = T;

function SpartsLogo({ size = 36 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect width="36" height="36" rx="8" fill="#FF8C00" />
        <text x="18" y="26" textAnchor="middle" fontFamily="'Bebas Neue', sans-serif" fontSize="24" fill="white" letterSpacing="1">S</text>
        <circle cx="26" cy="10" r="4" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
        <circle cx="26" cy="10" r="1.5" fill="rgba(255,255,255,0.9)" />
      </svg>
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: size * 0.6, letterSpacing: size * 0.04, color: "#F2F5F7", lineHeight: 1 }}>
        SPARTSHUB
      </span>
    </div>
  );
}

export default function LandingPage({ onLogin, onRegister, onSearch, onEnter }) {
  const [searchQ, setSearchQ] = useState("");

  const handleSearch = () => {
    if (searchQ.trim()) onSearch?.(searchQ.trim());
    else onEnter?.();
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT, fontFamily: "'Barlow', sans-serif" }}>
      <style>{CSS_BASE}</style>

      {/* HEADER */}
      <header style={{ background: BG3, borderBottom: `1px solid ${BORDER}`, padding: "0 32px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", height: 64, gap: 24 }}>
          <SpartsLogo size={32} />
          <div style={{ flex: 1 }} />
          <button onClick={onLogin}
            style={{ background: "transparent", border: `1.5px solid ${BORDER2}`, borderRadius: 8, padding: "9px 20px", fontSize: 14, fontWeight: 700, color: TEXT, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .5, textTransform: "uppercase", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.color = RED; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.color = TEXT; }}>
            Iniciar Sesión
          </button>
          <button onClick={onRegister}
            style={{ background: RED, border: "none", borderRadius: 8, padding: "9px 24px", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .5, textTransform: "uppercase", transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = RED2}
            onMouseLeave={e => e.currentTarget.style.background = RED}>
            Registrarse →
          </button>
        </div>
      </header>

      {/* HERO */}
      <section style={{ padding: "80px 32px 64px", textAlign: "center", maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,140,0,.1)", border: "1px solid rgba(255,140,0,.3)", borderRadius: 20, padding: "6px 16px", marginBottom: 32 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: RED, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .5 }}>✓ GRATIS · SIN COMISIONES · CONTACTO DIRECTO</span>
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(48px, 8vw, 80px)", lineHeight: 1.05, color: TEXT, marginBottom: 16 }}>
          Encuentra el repuesto<br /><span style={{ color: RED }}>que necesitas hoy.</span>
        </h1>
        <p style={{ fontSize: 20, color: SUB, lineHeight: 1.6, marginBottom: 40, fontWeight: 400 }}>
          Conectamos compradores y vendedores de equipos industriales.<br />Sin intermediarios. Sin comisiones.
        </p>
        <div style={{ display: "flex", gap: 0, maxWidth: 560, margin: "0 auto 20px", borderRadius: 10, overflow: "hidden", border: `2px solid ${RED}`, background: BG3 }}>
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="¿Qué repuesto o equipo buscas?"
            style={{ flex: 1, padding: "16px 20px", background: "transparent", border: "none", outline: "none", fontSize: 16, color: TEXT, fontFamily: "Barlow, sans-serif" }}
          />
          <button onClick={handleSearch}
            style={{ background: RED, border: "none", padding: "16px 28px", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .6, textTransform: "uppercase", whiteSpace: "nowrap", transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = RED2}
            onMouseLeave={e => e.currentTarget.style.background = RED}>
            Buscar →
          </button>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={onRegister}
            style={{ background: RED, border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 16, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .6, textTransform: "uppercase", transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = RED2}
            onMouseLeave={e => e.currentTarget.style.background = RED}>
            Crear cuenta gratis →
          </button>
          <button onClick={onEnter}
            style={{ background: "transparent", border: `1.5px solid ${BORDER2}`, borderRadius: 10, padding: "14px 28px", fontSize: 16, fontWeight: 700, color: TEXT, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .6, textTransform: "uppercase", transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.color = RED; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.color = TEXT; }}>
            Explorar publicaciones
          </button>
        </div>
        <p style={{ fontSize: 13, color: MUTED }}>✓ Sin tarjeta de crédito &nbsp;&nbsp; ✓ Activa en minutos &nbsp;&nbsp; ✓ Gratis para siempre</p>
      </section>

      {/* COMO FUNCIONA */}
      <section style={{ padding: "56px 32px", background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: TEXT, textAlign: "center", marginBottom: 40 }}>¿Cómo funciona?</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {[
              { icon: "📢", title: "1. Publica o busca", desc: "Publica lo que vendes o pide lo que necesitas. Es gratis y toma menos de 2 minutos." },
              { icon: "🤖", title: "2. La IA busca matches", desc: "Nuestro sistema analiza el catálogo y te avisa cuando hay una coincidencia con tu búsqueda." },
              { icon: "🤝", title: "3. Contacto directo", desc: "Hablas directamente con el comprador o vendedor. Sin intermediarios, sin comisiones." },
            ].map((step, i) => (
              <div key={i} style={{ background: CARD, borderRadius: 14, padding: "32px 24px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 16 }}>{step.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: TEXT, marginBottom: 10, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .3 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: SUB, lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: "56px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
          {[
            { val: "0%", label: "Comisión siempre" },
            { val: "P2P", label: "Contacto directo" },
            { val: "✓", label: "Gratis para siempre" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 56, color: RED, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 15, color: SUB, marginTop: 8, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* INDUSTRIAS */}
      <section style={{ padding: "56px 32px", background: BG2, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, color: TEXT, marginBottom: 12 }}>Industrias que cubrimos</h2>
          <p style={{ fontSize: 15, color: SUB, marginBottom: 36 }}>Repuestos y equipos para toda la industria chilena</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {["⚙️ Minería", "🌲 Forestal", "🏗️ Construcción", "⚡ Energía", "🚛 Transporte", "🌾 Agroindustrial", "🔧 Herramientas", "💧 Sanitarias", "🍎 Alimentos", "🛣️ Rutas y Caminos"].map((ind, i) => (
              <button key={i} onClick={onEnter}
                style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "10px 20px", fontSize: 14, fontWeight: 700, color: TEXT, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .3, transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.color = RED; e.currentTarget.style.background = "rgba(255,140,0,.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT; e.currentTarget.style.background = CARD; }}>
                {ind}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: "80px 32px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 6vw, 56px)", color: TEXT, lineHeight: 1.1, marginBottom: 16 }}>
            Empieza hoy.<br /><span style={{ color: RED }}>Es completamente gratis.</span>
          </h2>
          <p style={{ fontSize: 16, color: SUB, marginBottom: 36, lineHeight: 1.6 }}>
            Únete a cientos de empresas que ya conectan directamente con compradores y vendedores industriales.
          </p>
          <button onClick={onRegister}
            style={{ background: RED, border: "none", borderRadius: 10, padding: "16px 40px", fontSize: 17, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: .6, textTransform: "uppercase", transition: "all .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = RED2}
            onMouseLeave={e => e.currentTarget.style.background = RED}>
            Crear cuenta gratis →
          </button>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 16 }}>Sin tarjeta de crédito · Sin comisiones · Sin contratos</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: BG3, borderTop: `1px solid ${BORDER}`, padding: "32px", textAlign: "center" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <SpartsLogo size={28} />
          </div>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>No vendemos repuestos, conectamos personas.</p>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {["Términos y condiciones", "Política de privacidad", "Contacto"].map((link, i) => (
              <span key={i} style={{ fontSize: 13, color: MUTED, cursor: "pointer", transition: "color .15s" }}
                onMouseEnter={e => e.currentTarget.style.color = TEXT}
                onMouseLeave={e => e.currentTarget.style.color = MUTED}>
                {link}
              </span>
            ))}
          </div>
          <p style={{ fontSize: 12, color: MUTED }}>© {new Date().getFullYear()} SpartsHub™ · fgiangrandisc@gmail.com · +56 9 3268 9914</p>
        </div>
      </footer>
    </div>
  );
}
