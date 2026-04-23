
// ── SESSION PERSISTENCE ──
function restoreSession(){
  try{
    const saved=localStorage.getItem('serving_session');
    if(!saved)return false;
    const {id,username}=JSON.parse(saved);
    // Wait until S.users is loaded, then try to restore
    const tryRestore=()=>{
      const users=S.users&&S.users.length?S.users:[];
      const u=users.find(x=>x.id==id&&x.username===username&&x.estado==='Activo');
      if(!u){
        // Users not loaded yet, retry
        return false;
      }
      S.user=u;
      document.getElementById('login').style.display='none';
      document.getElementById('sidebar').style.display='flex';
      document.getElementById('main').style.display='block';
      document.getElementById('uname').textContent=u.nombre;
      document.getElementById('urole').textContent=u.nivel||'';
      document.getElementById('uav').textContent=u.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
      if(window.innerWidth<=768){
        const hb=document.getElementById('hamburger');
        if(hb)hb.style.display='flex';
      }
      buildNav(u.nivel||'Lectura');
      goPage(u.nivel==='Lectura'?'p-asistencia':'p-dashboard');
      startClock();
      console.log('[session] Sesión restaurada:', u.nombre);
      return true;
    };
    // Try immediately, then retry up to 10 times waiting for data to load
    if(tryRestore())return true;
    let attempts=0;
    const retry=setInterval(()=>{
      attempts++;
      if(tryRestore()||attempts>20)clearInterval(retry);
    },300);
    return true;
  }catch(e){
    localStorage.removeItem('serving_session');
    return false;
  }
}


// ── SIDEBAR MOBILE ──
function toggleSidebar(){
  const sb=document.getElementById('sidebar');
  const ov=document.getElementById('sidebar-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── LOGIN ──
function doLogin(){
  const btn=document.getElementById('btn-login-submit');
  const e=document.getElementById('lu').value.trim().toLowerCase();
  const p=document.getElementById('lp').value;
  if(!e||!p){showToast('Ingresa usuario y contraseña',false);return;}
  if(btn){btn.disabled=true;btn.textContent='⏳ Verificando...';}
  setTimeout(()=>{
    const users=(S.users&&S.users.length)?S.users:[];
    const u=users.find(x=>x&&x.estado==='Activo'&&x.pass===p&&(x.email===e||x.username===e||(x.username&&x.username.toLowerCase()===e)));
    if(!u){
      showToast('Usuario o contraseña incorrectos',false);
      if(btn){btn.disabled=false;btn.textContent='▶ Ingresar';}
      return;
    }
    S.user=u;
    document.getElementById('login').style.display='none';
    document.getElementById('sidebar').style.display='flex';
    document.getElementById('main').style.display='block';
    // Show hamburger on mobile, hide sidebar initially
    if(window.innerWidth<=768){
      const hb=document.getElementById('hamburger');
      if(hb)hb.style.display='flex';
      document.getElementById('sidebar').classList.remove('open');
    }
    document.getElementById('uname').textContent=u.nombre;
    document.getElementById('urole').textContent=u.nivel||'';
    document.getElementById('uav').textContent=u.nombre.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
    if(btn){btn.disabled=false;btn.textContent='▶ Ingresar';}
    // Save session to localStorage so it survives page refresh
    try{localStorage.setItem('serving_session',JSON.stringify({id:u.id,username:u.username}));}catch(e){}
    buildNav(u.nivel||'Lectura');goPage(u.nivel==='Lectura'?'p-asistencia':'p-dashboard');startClock();
    // Iniciar notificaciones y marcación automática
    if(typeof iniciarNotificaciones==='function') iniciarNotificaciones();
  },50);
}
function doLogout(){
  S.user=null;
  document.getElementById('login').style.display='flex';
  document.getElementById('sidebar').style.display='none';
  document.getElementById('main').style.display='none';
  document.getElementById('lu').value='';
  document.getElementById('lp').value='';
  const hb=document.getElementById('hamburger');
  if(hb)hb.style.display='none';
  closeSidebar();
  try{localStorage.removeItem('serving_session');}catch(e){}
}

function updateSolBadge(){
  const pend=(window.S_solicitudesPanol||[]).filter(s=>s.estado==='pendiente').length;
  const badge=document.getElementById('nav-sol-badge');
  if(badge){badge.textContent=pend;badge.style.display=pend>0?'inline':'none';}
}
function notificarAdminSolicitud(){updateSolBadge();}

// ── EPP BADGE ──
function updateEPPBadge(){
  const pend=(S.solicitudesEPP||[]).filter(s=>s.estado==='Pendiente').length;
  const badge=document.getElementById('nav-epp-badge');
  if(badge){badge.textContent=pend;badge.style.display=pend>0?'inline':'none';}
}
function clearEPPBadge(){
  const badge=document.getElementById('nav-epp-badge');
  if(badge)badge.style.display='none';
}

// ── ASISTENCIA BADGE ──
let _asisBadgeCount=0;
function incrementAsisBadge(){
  _asisBadgeCount++;
  const badge=document.getElementById('nav-asis-badge');
  if(badge){badge.textContent=_asisBadgeCount;badge.style.display='inline';}
}
function clearAsisBadge(){
  _asisBadgeCount=0;
  const badge=document.getElementById('nav-asis-badge');
  if(badge){badge.textContent='0';badge.style.display='none';}
}

function buildNav(nivel){
  const nc=document.getElementById('nav-content');
  const isAdmin=nivel==='Admin';
  const isEstandar=nivel==='Estandar';
  const isLectura=nivel==='Lectura';

  if(isAdmin||isEstandar){
    nc.innerHTML=`
    <div class="nsec">Principal</div>
    <div class="ni" onclick="goPage('p-dashboard')"><span class="ic">◈</span>Dashboard</div>
    <div class="nsec">Almacén SERVING</div>
    <div class="ni" onclick="goPage('p-activos')"><span class="ic">⬡</span>Activos / Códigos</div>
    <div class="ni" onclick="goPage('p-prestamos')"><span class="ic">↔</span>Préstamos</div>
    <div class="ni" onclick="goPage('p-consumibles')"><span class="ic">◫</span>Consumibles</div>
    <div class="ni" onclick="goPage('p-mantenimiento')"><span class="ic">⚙</span>Mantenimiento</div>
    <div class="ni" onclick="goPage('p-sima')"><span class="ic">⚓</span>Piezas SIMA</div>
    ${isAdmin?`
    <div class="nsec">Proyectos</div>
    <div class="ni" onclick="goPage('p-proyectos')"><span class="ic">📋</span>Avance proyectos</div>
    <div class="ni" onclick="goPage('p-recepcion')"><span class="ic">📦</span>Recepción de piezas</div>
    <div class="nsec">RRHH</div>
    <div class="ni" onclick="goPage('p-epp');clearEPPBadge()"><span class="ic">⬢</span>EPP<span id="nav-epp-badge" style="display:none;background:var(--orange);color:#fff;border-radius:10px;font-size:.6rem;font-weight:700;padding:1px 5px;margin-left:auto">0</span></div>
    <div class="ni" id="nav-asis-item" onclick="goPage('p-asistencia');clearAsisBadge()"><span class="ic">◷</span>Asistencia<span id="nav-asis-badge" style="display:none;background:var(--green);color:#fff;border-radius:10px;font-size:.6rem;font-weight:700;padding:1px 5px;margin-left:auto">0</span></div>
    <div class="ni" onclick="goPage('p-horas')"><span class="ic">$</span>Horas / Pagos</div>
    <div class="nsec">Admin</div>
    <div class="ni" onclick="goPage('p-trabajadores')"><span class="ic">◉</span>Trabajadores</div>
    <div class="ni" onclick="goPage('p-usuarios')"><span class="ic">◎</span>Usuarios</div>
    <div class="nsec">Herramientas</div>
    <div class="ni" onclick="goPage('p-voz')" style="color:var(--purple)"><span class="ic">🎙</span>Asistente IA</div>
    <div class="ni" onclick="goPage('p-qr-personal')" style="color:var(--purple)"><span class="ic">🪪</span>QR Personal</div>
    <div class="ni" onclick="goPage('p-kiosko')" style="color:var(--green)"><span class="ic">🏪</span>Kiosco Pañol</div>
    <div class="ni" id="nav-sol-item" onclick="goPage('p-solicitudes')" style="color:var(--blue)"><span class="ic">📬</span>Solicitudes<span id="nav-sol-badge" style="display:none;background:var(--red);color:#fff;border-radius:10px;font-size:.6rem;font-weight:700;padding:1px 5px;margin-left:auto">0</span></div>
    <div class="ni" onclick="goPage('p-vision')" style="color:var(--teal)"><span class="ic">📷</span>Visión / Cámara</div>
    <div class="ni" onclick="goPage('p-config')"><span class="ic">⚙</span>Configuración</div>
    `:''}`;
  // Init badges after nav is built
  setTimeout(()=>{updateSolBadge();if(typeof updateEPPBadge==='function')updateEPPBadge();},100);
  } else {
    // Lectura — solo su área personal
    nc.innerHTML=`
    <div class="nsec">Mi área</div>
    <div class="ni" onclick="goPage('p-asistencia')"><span class="ic">◷</span>Mi Asistencia</div>
    <div class="ni" onclick="goPage('p-mi-pago')" style="color:var(--green)"><span class="ic">💰</span>Mi Pago</div>
    <div class="ni" onclick="goPage('p-mis-herr')"><span class="ic">🔧</span>Mis préstamos</div>
    <div class="ni" onclick="goPage('p-epp-sol')"><span class="ic">⬢</span>Solicitar EPP</div>
    <div class="ni" onclick="goPage('p-qr-personal')" style="color:var(--purple)"><span class="ic">🪪</span>Mi QR</div>`;
  }
  // Init badges
  setTimeout(()=>{updateSolBadge();if(typeof updateEPPBadge==='function')updateEPPBadge();},150);
}

function goPage(pid){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el=document.getElementById(pid);if(el)el.classList.add('active');
  document.querySelectorAll('.ni').forEach(n=>{
    n.classList.remove('active');
    if(n.getAttribute('onclick')?.includes(pid))n.classList.add('active');
  });
  // Auto-close sidebar on mobile after navigation
  if(window.innerWidth<=768)closeSidebar();
  const r={
    'p-dashboard':renderDashboard,'p-activos':()=>renderActivos('todos'),
    'p-prestamos':()=>{renderPrestamos();if(typeof initPrestamosRapido==='function')initPrestamosRapido();},'p-consumibles':renderConsumibles,
    'p-mantenimiento':renderMantenimiento,'p-epp':renderEPP,'p-sima':renderSIMA,
    'p-asistencia':renderAsistencia,'p-horas':()=>{fillSelects();renderHoras()},
    'p-trabajadores':renderTrabajadores,'p-usuarios':renderUsuarios,
    'p-epp-sol':renderMiEPP,'p-qrview':renderQRView,'p-config':renderConfig,
    'p-proyectos':renderProyectos,'p-recepcion':renderRecepcion,'p-mis-herr':renderMisHerramientas,
    'p-mi-pago':()=>{document.getElementById('mipago-mes').value=today().slice(0,7);renderMiPago();},
    'p-voz':()=>{renderVoz();if(!vozState.siempreActivo){vozState.siempreActivo=true;activarSiempreActivo();actualizarIndicadorVoz('activo');}},
    'p-vision':renderVision,'p-kiosko':renderKiosko,
    'p-solicitudes':renderSolicitudes,'p-qr-personal':renderQRPersonal
  };
  if(r[pid])r[pid]();
  if(pid==='p-asistencia'){
    const isAdmin=S.user?.nivel==='Admin'||S.user?.nivel==='Estandar';
    const adminPanel=document.getElementById('admin-asis-panel');
    if(adminPanel)adminPanel.style.display=isAdmin?'block':'none';
    if(isAdmin)renderAsistenciaGeneral();
    renderMiAsistencia();checkLoc();
  }
}
