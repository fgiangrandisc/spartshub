/* ═══════════════════════════════════════════════════════════════
   SPARTSHUB — UNIFIED DESIGN SYSTEM
   Dark industrial. Bebas Neue headings. Barlow body.
   Primary: #E8320A  |  Gold: #F5C842  |  Blue: #3B9EFF
═══════════════════════════════════════════════════════════════ */

export const T = {
  RED:    "#E8320A",
  RED2:   "#C42800",
  GOLD:   "#F5C842",
  BLUE:   "#3B9EFF",
  GREEN:  "#4ADE80",
  PUR:    "#A855F7",

  BG:     "#141618",   // page bg
  BG2:    "#1A1D20",   // section bg alt
  BG3:    "#1F2328",   // tertiary bg
  CARD:   "#1E2125",   // card bg
  SURF:   "#252A30",   // surface / input bg
  BORDER: "rgba(255,255,255,.07)",
  BORDER2:"rgba(255,255,255,.13)",

  TEXT:   "#E8ECF1",   // primary text
  SUB:    "#9CA3AF",   // secondary text
  MUTED:  "#4B5563",   // muted text
};

export const CSS_BASE = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:#141618;color:#E8ECF1;font-family:'Barlow',sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
button{cursor:pointer;border:none;font-family:inherit}
input,textarea,select{font-family:inherit;outline:none}
a{color:inherit;text-decoration:none}
img{object-fit:cover}

/* Typography */
.bebas{font-family:'Bebas Neue',sans-serif;letter-spacing:.5px}
.bc{font-family:'Barlow Condensed',sans-serif}
.mono{font-family:'Share Tech Mono',monospace}

/* Layout */
.wrap{max-width:1100px;margin:0 auto;padding:0 48px}
@media(max-width:768px){.wrap{padding:0 24px}}

/* Buttons */
.btn-red{background:#E8320A;color:#fff;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;border-radius:7px;padding:12px 24px;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .18s;border:none;cursor:pointer}
.btn-red:hover{background:#C42800;transform:translateY(-1px);box-shadow:0 6px 24px rgba(232,50,10,.4)}
.btn-red:active{transform:scale(.97)}
.btn-red:disabled{opacity:.5;cursor:not-allowed;transform:none}
.btn-gold{background:#F5C842;color:#111;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;text-transform:uppercase;border-radius:7px;padding:12px 24px;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .18s;border:none;cursor:pointer}
.btn-gold:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn-ol{background:transparent;color:#E8ECF1;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:13px;letter-spacing:1px;text-transform:uppercase;border:1.5px solid rgba(255,255,255,.13);border-radius:7px;padding:11px 20px;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all .18s;cursor:pointer}
.btn-ol:hover{border-color:#E8320A;color:#E8320A}
.btn-ghost{background:transparent;color:#9CA3AF;border-radius:8px;padding:8px 10px;display:inline-flex;align-items:center;gap:6px;font-size:14px;transition:background .15s;cursor:pointer}
.btn-ghost:hover{background:rgba(255,255,255,.06);color:#E8ECF1}

/* Inputs */
.inp{background:#252A30;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:11px 14px;font-size:14px;color:#E8ECF1;width:100%;transition:border-color .2s}
.inp:focus{border-color:#E8320A}
.inp::placeholder{color:#4B5563}
select.inp{appearance:none}

/* Cards */
.card{background:#1E2125;border:1px solid rgba(255,255,255,.07);border-radius:10px;transition:border-color .2s}
.card:hover{border-color:rgba(232,50,10,.3)}

/* Tags / Badges */
.tag{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:3px;font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:10px;letter-spacing:1.2px;text-transform:uppercase}
.t-red{background:rgba(232,50,10,.12);color:#E8320A;border:1px solid rgba(232,50,10,.25)}
.t-gold{background:rgba(245,200,66,.1);color:#F5C842;border:1px solid rgba(245,200,66,.25)}
.t-blue{background:rgba(59,158,255,.1);color:#3B9EFF;border:1px solid rgba(59,158,255,.2)}
.t-green{background:rgba(74,222,128,.1);color:#4ADE80;border:1px solid rgba(74,222,128,.2)}
.t-pur{background:rgba(168,85,247,.1);color:#A855F7;border:1px solid rgba(168,85,247,.2)}
.t-dim{background:rgba(255,255,255,.05);color:#9CA3AF;border:1px solid rgba(255,255,255,.07)}

/* Animations */
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
@keyframes toastIn{from{transform:translateY(80px) translateX(-50%);opacity:0}to{transform:translateY(0) translateX(-50%);opacity:1}}
.fu{animation:slideUp .35s ease both}
.fi{animation:fadeIn .2s ease both}
.sheet-up{animation:sheetUp .35s cubic-bezier(.32,.72,0,1) both}

/* Spinner */
.spinner{border:2.5px solid rgba(255,255,255,.08);border-top-color:#E8320A;border-radius:50%;animation:spin .7s linear infinite}

/* Divider */
.hr{height:1px;background:rgba(255,255,255,.07)}

/* Search bar */
.search-bar{background:#252A30;border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px}
.search-bar input{background:none;border:none;outline:none;font-size:14px;color:#E8ECF1;flex:1}
.search-bar input::placeholder{color:#4B5563}

/* Segment control */
.seg{display:flex;background:#1F2328;border-radius:8px;padding:3px;gap:2px}
.seg-btn{flex:1;padding:7px;border-radius:6px;font-size:13px;font-weight:600;transition:all .15s;color:#9CA3AF;text-align:center;cursor:pointer;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;text-transform:uppercase}
.seg-btn.active{background:#E8320A;color:#fff}

/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(6px);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
.modal-box{background:#1F2328;border:1px solid rgba(255,255,255,.13);border-radius:16px;padding:36px 32px;max-width:440px;width:100%;animation:slideUp .3s ease;position:relative;box-shadow:0 24px 64px rgba(0,0,0,.6)}

/* Sheet (bottom modal) */
.sheet{background:#1F2328;border-radius:24px 24px 0 0;border-top:1px solid rgba(255,255,255,.1)}

/* List row */
.list-row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:0.5px solid rgba(255,255,255,.07);cursor:pointer}
.list-row:last-child{border-bottom:none}
.list-row:hover{opacity:.85}

/* Toggle */
.toggle{width:44px;height:26px;border-radius:13px;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0}
.toggle-knob{width:22px;height:22px;background:#E8ECF1;border-radius:50%;position:absolute;top:2px;transition:left .2s;box-shadow:0 1px 3px rgba(0,0,0,.4)}

/* Progress */
.prog{height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#3B9EFF,rgba(59,158,255,.4))}

/* Photo card */
.photo-card{border-radius:10px;overflow:hidden;cursor:pointer;background:#252A30;transition:transform .15s,border-color .15s}
.photo-card:hover{transform:translateY(-2px)}

/* Tabs (bottom nav) */
.tab-bar{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:520px;background:rgba(20,22,24,.95);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,.1);display:flex;align-items:center;padding:8px 0 20px;z-index:50}
.tab-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:4px 0;cursor:pointer}
.tab-label{font-size:10px;font-weight:600;font-family:'Barlow Condensed',sans-serif;letter-spacing:.5px;text-transform:uppercase;transition:color .15s}

/* Blueprint grid bg */
.bp-grid{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:1}

/* Ticker */
.tt{display:flex;animation:ticker 28s linear infinite;white-space:nowrap}
.tt:hover{animation-play-state:paused}

/* Toast */
.toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);z-index:200;background:#1F2328;border:1px solid rgba(255,255,255,.13);border-radius:12px;padding:16px 20px;min-width:300px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.5);animation:toastIn .3s ease}

/* Sidebar nav (desktop) */
.sidebar-btn{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;border:none;cursor:pointer;font-size:14px;width:100%;text-align:left;transition:all .15s;border-left:3px solid transparent}
.sidebar-btn.active{background:rgba(232,50,10,.1);color:#E8320A;font-weight:700;border-left-color:#E8320A}
.sidebar-btn:not(.active){background:transparent;color:#9CA3AF;font-weight:500}
.sidebar-btn:not(.active):hover{background:rgba(255,255,255,.05);color:#E8ECF1}
`;
