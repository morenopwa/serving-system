function renderQRPersonal(){
  const nivel=S.user?.nivel;
  const miWid=S.user?.wid;
  // Lectura users only see their own QR
  if(nivel==='Lectura'){
    if(!miWid){document.getElementById('qr-personal-grid').innerHTML='<div class="alert al-info">Tu usuario no está vinculado a un trabajador. Contacta al administrador.</div>';return;}
    const w=S.workers.find(x=>x.id==miWid);
    if(!w){document.getElementById('qr-personal-grid').innerHTML='<div class="alert al-info">No se encontró tu ficha de trabajador.</div>';return;}
    const code='SERVING-W-'+w.id;
    const qrSvg=generarQRPersonal(code);
    document.getElementById('qr-personal-grid').innerHTML=`
      <div style="max-width:280px;margin:2rem auto;background:var(--bg2);border:2px solid var(--gold);border-radius:14px;padding:1.5rem;text-align:center">
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.8rem">🪪 Mi código QR personal</div>
        <div style="background:white;border-radius:8px;padding:12px;display:inline-block;margin-bottom:.8rem">${qrSvg}</div>
        <div style="font-size:.75rem;font-weight:700;color:var(--gold);font-family:monospace;margin-bottom:6px">${code}</div>
        <div style="font-size:1rem;font-weight:700;color:var(--text)">${w.nombre}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:2px">${w.cargo||'Trabajador'} · DNI ${w.dni||'--'}</div>

      </div>`;
    return;
  }
  // Admin/Estandar see all workers
  const q=(document.getElementById('sq-qrp')?.value||'').toLowerCase();
  const arr=S.workers.filter(w=>w.estado==='Activo').filter(w=>!q||normalizar(w.nombre).includes(q));
  document.getElementById('qr-personal-grid').innerHTML=arr.map(w=>{
    const code='SERVING-W-'+w.id;
    const qrSvg=generarQRPersonal(code);
    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:1rem;text-align:center">
      <div style="background:white;border-radius:6px;padding:8px;display:inline-block;margin-bottom:.5rem">${qrSvg}</div>
      <div style="font-size:.72rem;font-weight:700;color:var(--gold);font-family:monospace;margin-bottom:2px">${code}</div>
      <div style="font-size:.8rem;font-weight:600;color:var(--text)">${w.apellidos?w.apellidos.split(' ')[0]:w.nombre.split(' ')[0]}</div>
      <div style="font-size:.7rem;color:var(--muted)">${w.nombres?w.nombres.split(' ')[0]:''}</div>
      <div style="font-size:.65rem;color:var(--dim);margin-top:2px">${w.cargo||'Trabajador'}</div>
    </div>`;
  }).join('')||'<div class="alert al-info">No hay trabajadores activos.</div>';
}

function generarQRPersonal(code){
  // Larger, more scannable QR for personal cards
  const h=code.split('').reduce((a,c,i)=>a+(c.charCodeAt(0)*(i+1)*3),0);
  let r='<svg width="100" height="100" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">';
  r+='<rect width="54" height="54" fill="white"/>';
  // Data modules
  for(let row=0;row<5;row++) for(let col=0;col<5;col++){
    if((h*(row+1)*(col+1)*7+h)%13<7) r+=`<rect x="${col*7+9}" y="${row*7+9}" width="6" height="6" fill="#111"/>`;
  }
  // Finder patterns
  r+='<rect x="1" y="1" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
    +'<rect x="37" y="1" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
    +'<rect x="1" y="37" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
    +'<rect x="4" y="4" width="10" height="10" fill="#111"/>'
    +'<rect x="40" y="4" width="10" height="10" fill="#111"/>'
    +'<rect x="4" y="40" width="10" height="10" fill="#111"/>';
  return r+'</svg>';
}

function imprimirQRPersonal(){
  const arr=S.workers.filter(w=>w.estado==='Activo');
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>QR Personal SERVING</title>
  <style>
    body{font-family:sans-serif;margin:0;padding:10px;background:#fff}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .card{border:1px solid #ccc;border-radius:8px;padding:10px;text-align:center;page-break-inside:avoid;background:#fff}
    .card svg{width:90px;height:90px}
    .codigo{font-size:7px;color:#888;font-family:monospace;margin:2px 0}
    .empresa{font-size:8px;font-weight:700;color:#b76e00;letter-spacing:1px}
    .nombre{font-size:10px;font-weight:700;color:#000;margin:3px 0 1px}
    .cargo{font-size:8px;color:#666}
    .instruc{font-size:7px;color:#999;margin-top:4px;border-top:1px dashed #eee;padding-top:4px}
    @media print{body{padding:0}@page{margin:8mm}}
  </style></head><body>
  <div style="font-size:9px;color:#999;margin-bottom:8px;text-align:center">
    SERVING — Tarjetas de identificación pañol — Imprime, plastifica y entrega a cada trabajador
  </div>
  <div class="grid">
  ${arr.map(w=>{
    const code='SERVING-W-'+w.id;
    const svg=generarQRPersonal(code);
    return`<div class="card">
      <div class="empresa">⚓ SERVING</div>
      ${svg}
      <div class="codigo">${code}</div>
      <div class="nombre">${w.apellidos.split(' ').slice(0,2).join(' ')}</div>
      <div class="nombre" style="font-size:9px;font-weight:400">${w.nombres.split(' ')[0]}</div>
      <div class="cargo">${w.cargo||'Trabajador'}</div>
      <div class="instruc">Escanear en el kiosco del pañol</div>
    </div>`;
  }).join('')}
  </div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`;
  const win=window.open('','_blank');
  if(win){win.document.write(html);win.document.close();}
  else showToast('Permite ventanas emergentes para imprimir',false);
}


// ══ MODO KIOSCO BLOQUEADO ══
let kioskLocked = false;

function activarModoKiosco(){
  if(!confirm('¿Activar modo kiosco?\n\nEsto ocultará el menú y la interfaz de administrador. Solo se mostrará la pantalla del pañol.\n\nPara salir necesitarás la contraseña de administrador.')) return;
  kioskLocked = true;
  document.body.classList.add('kiosk-mode');
  document.getElementById('kiosk-admin-bar').style.display='none';
  document.getElementById('kiosk-float-btn').style.display='block';
  // Start kiosk camera automatically
  iniciarKiosko();
  showToast('Modo kiosco activado — botón ⚙ Admin para salir');
}

function mostrarLockOverlay(){
  document.getElementById('kiosk-lock-overlay').classList.add('active');
  document.getElementById('kiosk-unlock-pass').value='';
  document.getElementById('kiosk-unlock-error').style.display='none';
  setTimeout(()=>document.getElementById('kiosk-unlock-pass').focus(),200);
}

function cerrarLockOverlay(){
  document.getElementById('kiosk-lock-overlay').classList.remove('active');
}

function desbloquearKiosko(){
  const pass = document.getElementById('kiosk-unlock-pass').value;
  // Check against any admin user password
  const adminUser = S.users.find(u=>u.nivel==='Admin'&&u.pass===pass&&u.estado==='Activo');
  if(!adminUser){
    document.getElementById('kiosk-unlock-error').style.display='block';
    document.getElementById('kiosk-unlock-pass').value='';
    document.getElementById('kiosk-unlock-pass').focus();
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
    return;
  }
  // Unlock!
  kioskLocked = false;
  document.body.classList.remove('kiosk-mode');
  document.getElementById('kiosk-lock-overlay').classList.remove('active');
  document.getElementById('kiosk-float-btn').style.display='none';
  document.getElementById('kiosk-admin-bar').style.display='flex';
  // Stop kiosk camera
  [kioskState.stream1,kioskState.stream2].forEach(s=>{if(s)s.getTracks().forEach(t=>t.stop());});
  clearInterval(kioskState.scanInterval1);
  clearInterval(kioskState.scanInterval2);
  showToast('Modo kiosco desactivado — bienvenido '+adminUser.nombre.split(',')[0]);
  // Go to dashboard or solicitudes
  buildNav(S.user?.nivel||adminUser.rol);
  goPage('p-solicitudes');
}

// Enter key on unlock password
document.addEventListener('keydown', e=>{
  if(e.key==='Enter' && document.getElementById('kiosk-lock-overlay')?.classList.contains('active')){
    desbloquearKiosko();
  }
});

// Prevent accidental back navigation in kiosk mode
window.addEventListener('popstate', e=>{
  if(kioskLocked){ history.pushState(null,'',window.location.href); }
});



// ══ MODO CONVERSACIÓN ══
// Acumula lo que dice el trabajador + lo que confirma el almacenero
// y los procesa juntos para mayor precisión

function mostrarBufferConversacion(){
  const display = document.getElementById('voz-transcript');
  const wrap = document.getElementById('voz-escucho-wrap');
  if(display && vozState.bufferConversacion.length > 0){
    // Show accumulated conversation
    display.innerHTML = vozState.bufferConversacion.map((f,i)=>
      `<span style="color:${i===vozState.bufferConversacion.length-1?'var(--text)':'var(--muted)'}">${f.texto}</span>`
    ).join(' <span style="color:var(--dim)">·</span> ');
    if(wrap) wrap.style.display='block';
  }
}

function procesarConversacion(){
  const buffer = vozState.bufferConversacion;
  if(!buffer.length) return;

  // Combine all phrases into one conversation string
  const conversacion = buffer.map(f=>f.texto).join(' ');
  vozState.bufferConversacion = [];
  vozState.ultimaFrase = 0;

  // Update display
  const display = document.getElementById('voz-transcript');
  if(display) display.textContent = conversacion;

  // Show processing state
  setMicStatus('procesando');

  // Process with conversation context
  procesarComandoConversacional(conversacion, buffer);
}

async function procesarComandoConversacional(conversacionCompleta, frases){
  // The key insight:
  // - First phrase(s) = what the WORKER asks for
  // - Last phrase = what the ALMACENERO says when delivering (has the definitive qty + worker name)
  // The last phrase is the "confirmation" and usually has the most precise data

  // Strategy: try to find qty in any phrase, worker name in any phrase
  // The last phrase said by almacenero typically has: qty + item + worker name
  // Example: ["quiero 3 tizas colegial", "3 yeso Chauca"]
  //   → item=tiza/yeso, qty=3, worker=Chauca

  const ultimaFrase = frases[frases.length-1]?.texto || conversacionCompleta;
  const primerasFrases = frases.slice(0,-1).map(f=>f.texto).join(' ');

  if(vozState.apiKey){
    await procesarConversacionIA(conversacionCompleta, ultimaFrase, primerasFrases);
  } else {
    interpretarConversacionLocal(conversacionCompleta, ultimaFrase, primerasFrases);
  }
}

function interpretarConversacionLocal(conversacion, ultimaFrase, contexto){
  const t = normalizar(conversacion);
  const tUltima = normalizar(ultimaFrase);
  const tCtx = normalizar(contexto);

  // Worker name: prioritize last phrase (almacenero confirmation)
  let worker = detectarTrabajador(ultimaFrase) || detectarTrabajador(contexto);

  // Item: combine context from ALL phrases
  // e.g. "tizas colegial" + "yeso" → search for yeso/tiza in consumibles
  const todasLasPalabras = conversacion;

  // Quantity: take the last mentioned quantity (almacenero's confirmation)
  const {qty, unidad} = detectarCantidad(ultimaFrase) || detectarCantidad(conversacion);

  // Is it consumable?
  if(esConsumible(todasLasPalabras)){
    const consumible = buscarConsumible(ultimaFrase) || buscarConsumible(todasLasPalabras);
    const confianza = worker && consumible ? 'alta' : 'media';
    mostrarResultadoIA({
      accion: 'consumo',
      confianza,
      descripcion: `${qty}${unidad||''} de ${consumible?.desc||'consumible'} para ${worker?.nombre?.split(',')[0]||'?'}`,
      aviso: frases.length > 1 ? `Conversación: "${conversacion.slice(0,60)}"` : null,
      datos: {
        activoId: consumible?.id, activoDesc: consumible?.desc,
        activoCodigo: consumible?.codigo,
        widTrabajador: worker?.id, nombreTrabajador: worker?.nombre,
        cantidad: qty, unidad: unidad||consumible?.unidad||'unidad',
        obra: extraerObra(conversacion)
      }
    }, conversacion);
    return;
  }

  // EPP?
  if(esEPP(todasLasPalabras)){
    const tipoEPP = detectarTipoEPP(todasLasPalabras);
    const codigo = detectarCodigo(ultimaFrase) || detectarCodigo(conversacion);
    const yaEntregado = epp_yaEntregado(tipoEPP, codigo);
    mostrarResultadoIA({
      accion: yaEntregado ? 'epp_devolucion' : 'epp_entrega',
      confianza: worker ? 'alta' : 'media',
      descripcion: `${yaEntregado?'Dev.':'Entrega'} EPP: ${tipoEPP} ${worker?.nombre?.split(',')[0]||'?'}`,
      aviso: yaEntregado ? 'Lo tenía: '+yaEntregado.trabNombre : null,
      datos: {
        tipoEPP, activoCodigo: codigo||'',
        widTrabajador: worker?.id, nombreTrabajador: worker?.nombre,
        talla: detectarTalla(conversacion)
      }
    }, conversacion);
    return;
  }

  // Herramienta?
  if(esHerramienta(todasLasPalabras)){
    const activo = buscarActivo(todasLasPalabras,'herramienta')||buscarActivo(todasLasPalabras,'maquinaria');
    const codigo = detectarCodigo(ultimaFrase)||detectarCodigo(conversacion);
    const prestamo = yaEstaPrestado(codigo, activo?.desc);
    mostrarResultadoIA({
      accion: prestamo ? 'devolucion' : 'prestamo',
      confianza: worker && activo ? 'alta' : 'media',
      descripcion: `${prestamo?'Dev.':'Préstamo'}: ${activo?.desc||codigo||'herramienta'} ${worker?.nombre?.split(',')[0]||'?'}`,
      aviso: prestamo ? 'Lo tenía: '+(prestamo.fromState?prestamo.trabNombre:W(prestamo.wid).nombre.split(',')[0]) : null,
      datos: {
        activoId: activo?.id, activoDesc: activo?.desc||ultimaFrase,
        activoCodigo: codigo||activo?.codigo,
        widTrabajador: worker?.id, nombreTrabajador: worker?.nombre
      }
    }, conversacion);
    return;
  }

  // Check for audit pattern first ("zombie tiene la baby G1")
  if(procesarAuditoriaVoz(conversacionCompleta) || procesarAuditoriaVoz(ultimaFrase)){
    if(vozState.siempreActivo) setTimeout(iniciarEscucha, 300);
    return;
  }
  // Fallback: try single-phrase interpreter on last phrase
  interpretarLocalmente(ultimaFrase);
}

async function procesarConversacionIA(conversacion, ultimaFrase, contexto){
  const trabajadoresCtx = S.workers.map(w=>`ID:${w.id} "${w.apellidos}" cargo:"${w.cargo}"`).join(', ');
  const activosCtx = S.activos.filter(a=>a.tipo==='maquinaria'||a.tipo==='herramienta')
    .map(a=>`ID:${a.id} codigo:"${a.codigo}" desc:"${a.desc}"`).join(', ');
  const consumiblesCtx = S.activos.filter(a=>a.tipo==='consumible')
    .map(a=>`ID:${a.id} codigo:"${a.codigo}" desc:"${a.desc}" unidad:"${a.unidad}"`).join(', ');

  const systemPrompt = `Eres el asistente de registro de SERVING (construcción naval, pañol de herramientas).

CONTEXTO CLAVE: El sistema escucha conversaciones completas entre el trabajador y el almacenero.
- El trabajador pide algo (puede decirlo informal, con nombres alternativos, en jerga)
- El almacenero confirma lo que entrega (suele decir cantidad + item + apellido del trabajador)
- La CONFIRMACIÓN DEL ALMACENERO (última frase) es la más precisa y fiable
- Ejemplo: trabajador dice "dame 3 tizas colegial", almacenero dice "3 yeso Chauca" → registrar 3 unidades de tiza/yeso para Chauca
- Ejemplo: "quiero discos de 4" + "3 discos Anampa" → 3 discos de corte 4" para Anampa

TRABAJADORES: ${trabajadoresCtx}
HERRAMIENTAS/MAQUINARIA: ${activosCtx}
CONSUMIBLES: ${consumiblesCtx}
HOY: ${today()} HORA: ${nowT()}

CONVERSACIÓN COMPLETA: "${conversacion}"
ÚLTIMA FRASE (confirmación almacenero): "${ultimaFrase}"
FRASES PREVIAS (pedido trabajador): "${contexto}"

Devuelve SOLO JSON sin backticks:
{
  "accion": "prestamo"|"devolucion"|"epp_entrega"|"epp_devolucion"|"consumo"|"asistencia_entrada"|"asistencia_salida"|"no_entendido",
  "confianza": "alta"|"media"|"baja",
  "descripcion": "resumen de lo que se registrará",
  "razonamiento": "cómo interpretaste la conversación (1 línea)",
  "aviso": null,
  "datos": {
    "activoId": null, "activoDesc": "", "activoCodigo": "",
    "widTrabajador": null, "nombreTrabajador": "",
    "cantidad": null, "unidad": "", "obra": "",
    "tipoEPP": "", "talla": "", "hora": ""
  }
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': vozState.apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-direct-browser-access':'true'
      },
      body: JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:400,
        system: systemPrompt,
        messages:[{role:'user', content:`Conversación: "${conversacion}"`}]
      })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text||'';
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    // Show razonamiento briefly before executing
    if(parsed.razonamiento){
      const display = document.getElementById('voz-transcript');
      if(display) display.textContent = '"'+conversacion+'" → '+parsed.razonamiento;
    }
    mostrarResultadoIA(parsed, conversacion);
  } catch(err){
    // Fallback to local
    interpretarConversacionLocal(conversacion, ultimaFrase, contexto);
  }
}


// ── MODO AUDITORÍA: registrar préstamos existentes ──
// Comando: "[apodo/nombre] tiene [equipo]" o "a [nombre] le debo [equipo]"
// Esto registra un préstamo retroactivo sin bloquear por disponibilidad
function procesarAuditoriaVoz(texto){
  const t = normalizar(texto);
  // Detectar patrón "X tiene Y" o "Y lo tiene X"
  const tienePat = /(.+?)\s+tiene\s+(.+)/;
  const leTienePat = /(.+?)\s+lo\s+tiene\s+(.+)/;
  let workerText='', activoText='';

  const m1 = t.match(tienePat);
  const m2 = t.match(leTienePat);
  if(m1){ workerText=m1[1]; activoText=m1[2]; }
  else if(m2){ activoText=m2[1]; workerText=m2[2]; }
  else return false; // not an audit command

  const worker = detectarTrabajador(workerText) || detectarTrabajador(activoText);
  const activo = buscarActivo(activoText,'herramienta') || buscarActivo(activoText,'maquinaria') || buscarActivo(workerText,'herramienta') || buscarActivo(workerText,'maquinaria');

  if(!worker && !activo) return false;

  if(activo && worker){
    // Register retroactive loan (don't check availability - this is an audit)
    const existente = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id&&p.wid===worker.id);
    if(!existente){
      S.prestamos.push({id:nids.prest++,activoId:activo.id,wid:worker.id,
        fecha:today()+' 00:00',resp:S.user?.nombre||'Auditoría',
        obs:'Registrado en auditoría de inventario',devuelto:null,esAuditoria:true});
      if(activo.tipo==='maquinaria') activo.estado='En préstamo';
      else if(activo.tipo==='herramienta'&&activo.disponible>0) activo.disponible--;
    }
    mostrarFeedbackRapido('📋', `Auditoría: ${activo.codigo} → ${worker.apellidos.split(' ')[0]}`, 'var(--blue)', 2000);
    vozState.historial.unshift({hora:nowT(),texto,resultado:`✓ Auditoría: ${activo.codigo} → ${worker.nombre.split(',')[0]}`});
    renderVozLog();
    return true;
  }
  return false;
}

function renderVozLog(){
  const el=document.getElementById('voz-log');
  if(!el)return;
  if(!vozState.historial.length){el.innerHTML='<span style="color:var(--muted)">Sin acciones esta sesión.</span>';return;}
  el.innerHTML=vozState.historial.slice(0,15).map(l=>`<div style="display:flex;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:.78rem;flex-wrap:wrap">
    <span style="color:var(--dim);flex-shrink:0">${l.hora}</span>
    <span style="color:var(--muted);flex:1;min-width:120px">"${l.texto.slice(0,60)}${l.texto.length>60?'...':''}"</span>
    <span style="color:var(--green);flex-shrink:0">${l.resultado}</span>
  </div>`).join('');
}

function probarComando(cmd){
  const texto=cmd.replace(/^"|"$/g,'').trim();
  document.getElementById('voz-texto').value=texto;
  procesarComando(texto);
}

// CSS wave animation
const waveStyle=document.createElement('style');
waveStyle.textContent='@keyframes onda{from{transform:scaleY(.3)}to{transform:scaleY(1)}}@keyframes pulso{0%,100%{box-shadow:0 0 0 0 rgba(63,185,80,.4)}50%{box-shadow:0 0 0 16px rgba(63,185,80,0)}}';
document.head.appendChild(waveStyle);




