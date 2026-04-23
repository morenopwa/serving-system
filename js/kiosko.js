let kioskState = {
  paso: 1,          // 1=escanear trabajador, 2=escanear equipo, 3=confirmar
  trabajador: null,
  activo: null,
  accion: 'prestamo',
  stream1: null,
  stream2: null,
  scanInterval1: null,
  scanInterval2: null,
  countdownTimer: null
};

// Solicitudes del pañol: {id, wid, activoId, accion, nota, hora, fecha, estado, respId, respNota}
if(!window.S_solicitudesPanol) window.S_solicitudesPanol = [];

function renderKiosko(){
  kioskState = {paso:1,trabajador:null,activo:null,accion:'prestamo',
    stream1:null,stream2:null,scanInterval1:null,scanInterval2:null,countdownTimer:null};
  mostrarPasoKiosk(1);
}

function mostrarPasoKiosk(paso){
  ['kiosk-inicio','kiosk-trabajador','kiosk-confirmar','kiosk-exito'].forEach((id,i)=>{
    const el=document.getElementById(id);
    if(el) el.style.display = (i===paso-1)?'flex':'none';
  });
  // Update step indicators
  [1,2,3].forEach(n=>{
    const el=document.getElementById('kstep-'+n);
    if(!el)return;
    el.className='kiosk-step'+(n<paso?' done':n===paso?' active':'');
    el.textContent = n<paso?'✓':String(n);
  });
}

// ── PASO 1: Iniciar cámara, escanear QR personal del trabajador ──
async function iniciarKiosko(){
  try {
    kioskState.stream1 = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'environment',width:{ideal:1280}}
    });
    const video = document.getElementById('kiosk-video');
    video.srcObject = kioskState.stream1;
    await video.play();
    document.getElementById('kiosk-cam-status').textContent = '🟢 Apunta tu tarjeta QR a la cámara';
    document.getElementById('kiosk-cam-status').style.color = 'var(--green)';
    document.getElementById('btn-kiosk-start').style.display = 'none';
    iniciarScanKiosk1();
  } catch(e){
    document.getElementById('kiosk-cam-status').textContent = 'Error: '+e.message+' — usa la entrada manual';
    mostrarEntradaManualKiosk1();
  }
}

function iniciarScanKiosk1(){
  const canvas = document.getElementById('kiosk-canvas');
  const video = document.getElementById('kiosk-video');
  let lastCode = '';

  function scan(){
    if(!video||video.readyState<2)return;
    if(canvas&&video.videoWidth>0){
      canvas.width=video.videoWidth;canvas.height=video.videoHeight;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(video,0,0);
    }

    // Try BarcodeDetector first
    if('BarcodeDetector' in window){
      const det = new BarcodeDetector({formats:['qr_code','code_128','code_39']});
      det.detect(video).then(codes=>{
        if(codes.length&&codes[0].rawValue!==lastCode){
          lastCode=codes[0].rawValue;
          procesarQRTrabajador(codes[0].rawValue);
        }
      }).catch(()=>{});
    } else if(window.jsQR&&canvas.width>0){
      const ctx=canvas.getContext('2d');
      const img=ctx.getImageData(0,0,canvas.width,canvas.height);
      const code=jsQR(img.data,img.width,img.height);
      if(code&&code.data!==lastCode){lastCode=code.data;procesarQRTrabajador(code.data);}
    }
  }

  kioskState.scanInterval1 = setInterval(scan,300);
  // Load jsQR if needed
  if(!('BarcodeDetector' in window)&&!window.jsQR){
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
    document.head.appendChild(s);
  }
}

function procesarQRTrabajador(codigo){
  // QR format: "SERVING-W-{id}" or just worker username/id
  let wid = null;
  const m = codigo.match(/SERVING-W-(\d+)/);
  if(m) wid = parseInt(m[1]);
  else {
    // Try username match
    const u = S.users.find(x=>x.username===codigo||x.dni===codigo||String(x.wid)===codigo);
    if(u) wid = u.wid;
    else wid = parseInt(codigo)||null;
  }

  const worker = wid ? S.workers.find(w=>w.id===wid) : null;
  if(!worker){
    document.getElementById('kiosk-cam-status').textContent = '⚠ Código no reconocido: '+codigo;
    document.getElementById('kiosk-cam-status').style.color='var(--red)';
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
    setTimeout(()=>{
      const el=document.getElementById('kiosk-cam-status');
      if(el){el.textContent='🟢 Apunta tu tarjeta QR a la cámara';el.style.color='var(--green)';}
    },2000);
    return;
  }

  // Worker found!
  clearInterval(kioskState.scanInterval1);
  if(navigator.vibrate) navigator.vibrate([100,50,100]);
  kioskState.trabajador = worker;

  // Populate step 2 UI
  document.getElementById('kiosk-avatar').textContent = worker.apellidos.slice(0,2).toUpperCase();
  document.getElementById('kiosk-nombre-trab').textContent = worker.nombre;
  document.getElementById('kiosk-cargo-trab').textContent = worker.cargo||'Trabajador';
  mostrarPasoKiosk(2);

  // Start camera for equipment scan
  setTimeout(()=>iniciarKiosk2(),400);
}

function mostrarEntradaManualKiosk1(){
  const statusEl = document.getElementById('kiosk-cam-status');
  if(statusEl){
    statusEl.innerHTML = 'Sin cámara — <select id="kiosk-manual-trab" onchange="seleccionarTrabManual(this.value)" style="background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:4px 8px;font-family:inherit">'
      +'<option value="">Selecciona tu nombre</option>'
      +S.workers.filter(w=>w.estado==='Activo').map(w=>`<option value="${w.id}">${w.nombre}</option>`).join('')
      +'</select>';
  }
}

function seleccionarTrabManual(wid){
  if(!wid)return;
  const worker = S.workers.find(w=>w.id==wid);
  if(worker) procesarQRTrabajador('SERVING-W-'+worker.id);
}

// ── PASO 2: Escanear QR del equipo ──
async function iniciarKiosk2(){
  try {
    // Reuse stream if same device, otherwise open new
    const video2 = document.getElementById('kiosk-video2');
    kioskState.stream2 = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'environment'}
    });
    video2.srcObject = kioskState.stream2;
    await video2.play();
    document.getElementById('kiosk-equipo-status').textContent='🟢 Apunta al código del equipo';
    document.getElementById('kiosk-equipo-status').style.color='var(--green)';
    iniciarScanKiosk2();
  } catch(e){
    document.getElementById('kiosk-equipo-status').textContent='Sin cámara — escribe el código:';
    const statusEl=document.getElementById('kiosk-equipo-status');
    statusEl.innerHTML='<input id="kiosk-equipo-manual" type="text" placeholder="Ej: MAQ-001" style="padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;width:160px;margin-right:8px"/>'
      +'<button class="btn btn-p btn-sm" onclick="procesarQREquipo(document.getElementById(\'kiosk-equipo-manual\').value)">OK</button>';
  }
}

function iniciarScanKiosk2(){
  const canvas2=document.getElementById('kiosk-canvas2');
  const video2=document.getElementById('kiosk-video2');
  let lastCode='';

  kioskState.scanInterval2=setInterval(()=>{
    if(!video2||video2.readyState<2)return;
    if(canvas2&&video2.videoWidth>0){
      canvas2.width=video2.videoWidth;canvas2.height=video2.videoHeight;
      canvas2.getContext('2d').drawImage(video2,0,0);
    }
    if('BarcodeDetector' in window){
      const det=new BarcodeDetector({formats:['qr_code','code_128','code_39']});
      det.detect(video2).then(codes=>{
        if(codes.length&&codes[0].rawValue!==lastCode){lastCode=codes[0].rawValue;procesarQREquipo(codes[0].rawValue);}
      }).catch(()=>{});
    } else if(window.jsQR&&canvas2.width>0){
      const img=canvas2.getContext('2d').getImageData(0,0,canvas2.width,canvas2.height);
      const code=jsQR(img.data,img.width,img.height);
      if(code&&code.data!==lastCode){lastCode=code.data;procesarQREquipo(code.data);}
    }
  },300);
}

function procesarQREquipo(codigo){
  const activo = S.activos.find(a=>a.codigo&&a.codigo.toUpperCase()===codigo.toUpperCase())
    || S.activos.find(a=>a.codigo&&a.codigo.toUpperCase().includes(codigo.toUpperCase()));

  if(!activo){
    document.getElementById('kiosk-equipo-status').textContent='⚠ Equipo no encontrado: '+codigo;
    document.getElementById('kiosk-equipo-status').style.color='var(--red)';
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
    setTimeout(()=>{
      const el=document.getElementById('kiosk-equipo-status');
      if(el){el.textContent='🟢 Apunta al código del equipo';el.style.color='var(--green)';}
    },2000);
    return;
  }

  clearInterval(kioskState.scanInterval2);
  if(navigator.vibrate) navigator.vibrate([100,50,100]);
  kioskState.activo = activo;

  // Determine action: if active loan exists for this worker → devolucion, else prestamo
  const prestActivo = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id&&p.wid===kioskState.trabajador.id);
  const prestOtro = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id&&p.wid!==kioskState.trabajador.id);
  kioskState.accion = prestActivo ? 'devolucion' : 'prestamo';

  // Fill step 3
  document.getElementById('kiosk-conf-trab').textContent = kioskState.trabajador.nombre;
  document.getElementById('kiosk-conf-equipo').textContent = activo.desc||activo.tipoepp||activo.codigo;
  document.getElementById('kiosk-conf-codigo').textContent = activo.codigo;
  document.getElementById('kiosk-conf-accion').textContent = kioskState.accion==='devolucion'?'📥 Devolución':'📤 Solicitud de préstamo';
  document.getElementById('kiosk-conf-accion').style.color = kioskState.accion==='devolucion'?'var(--green)':'var(--gold)';

  // Warn if already loaned to someone else
  const warnEl = document.getElementById('kiosk-warn');
  if(prestOtro && kioskState.accion==='prestamo'){
    warnEl.style.display='block';
    warnEl.innerHTML='<div class="alert al-warn">⚠ Este equipo lo tiene <b>'+W(prestOtro.wid).nombre.split(',')[0]+'</b>. Tu solicitud quedará pendiente de aprobación.</div>';
  } else {
    warnEl.style.display='none';
  }

  // Stop streams before showing step 3
  [kioskState.stream1,kioskState.stream2].forEach(s=>{if(s)s.getTracks().forEach(t=>t.stop());});
  mostrarPasoKiosk(3);
}

function volver_kiosk_paso2(){
  mostrarPasoKiosk(2);
  iniciarKiosk2();
}

// ── PASO 3: Enviar solicitud ──
function enviarSolicitudKiosko(){
  if(!kioskState.trabajador||!kioskState.activo)return;
  const nota = document.getElementById('kiosk-nota')?.value||'';
  const hora = nowT();
  const fecha = today();

  const solicitud = {
    id: (window.S_solicitudesPanol.length+1)*100+Date.now()%100,
    wid: kioskState.trabajador.id,
    activoId: kioskState.activo.id,
    accion: kioskState.accion,
    nota,
    hora,
    fecha,
    estado: 'pendiente',  // pendiente | aprobada | rechazada | auto
    respId: null,
    respNota: ''
  };

  // Auto-approve devolucion (no conflict possible)
  if(kioskState.accion==='devolucion'){
    solicitud.estado='auto';
    const prest=S.prestamos.find(p=>!p.devuelto&&p.activoId===kioskState.activo.id&&p.wid===kioskState.trabajador.id);
    if(prest){
      prest.devuelto=fecha+' '+hora;
      prest.obs=(prest.obs||'')+' [Dev. kiosco pañol]';
      const a=S.activos.find(x=>x.id===prest.activoId);
      if(a){if(a.tipo==='maquinaria')a.estado='Operativo';else if(a.tipo==='herramienta')a.disponible++;}
    }
  }

  window.S_solicitudesPanol.unshift(solicitud);
  S.movimientos.push({desc:'Solicitud pañol: '+kioskState.activo.codigo,accion:'Kiosco',wid:kioskState.trabajador.id,hora});
  updateSolBadge();
  // Show toast notification to admin if they're logged in (non-kiosko session)
  if(S.user?.nivel==='Admin'||S.user?.nivel==='Estandar'){
    const wNombre=kioskState.trabajador.nombre.split(',')[0];
    const accionLabel=kioskState.accion==='prestamo'?'solicitó préstamo de':'devolvió';
    showToast('📬 '+wNombre+' '+accionLabel+' '+kioskState.activo.codigo);
  }

  // Show success
  const msg = kioskState.accion==='devolucion'
    ? '✅ Devolución registrada automáticamente'
    : '📬 Solicitud enviada — espera aprobación del encargado';
  const sub = kioskState.accion==='devolucion'
    ? kioskState.activo.codigo+' devuelto por '+kioskState.trabajador.apellidos.split(' ')[0]
    : 'El encargado recibirá una notificación y aprobará tu solicitud';

  document.getElementById('kiosk-exito-msg').textContent = msg;
  document.getElementById('kiosk-exito-sub').textContent = sub;
  document.getElementById('kiosk-exito-msg').style.color = kioskState.accion==='devolucion'?'var(--green)':'var(--gold)';
  mostrarPasoKiosk(4);

  // Countdown to reset
  let count = 5;
  clearInterval(kioskState.countdownTimer);
  kioskState.countdownTimer = setInterval(()=>{
    count--;
    const el=document.getElementById('kiosk-countdown');
    if(el) el.textContent=count;
    if(count<=0){clearInterval(kioskState.countdownTimer);resetKiosko();}
  },1000);

  if(navigator.vibrate) navigator.vibrate([100,50,100,50,200]);
}

function resetKiosko(){
  clearInterval(kioskState.countdownTimer);
  [kioskState.scanInterval1,kioskState.scanInterval2].forEach(t=>{if(t)clearInterval(t);});
  [kioskState.stream1,kioskState.stream2].forEach(s=>{if(s)s.getTracks().forEach(t=>t.stop());});
  kioskState={paso:1,trabajador:null,activo:null,accion:'prestamo',
    stream1:null,stream2:null,scanInterval1:null,scanInterval2:null,countdownTimer:null};
  const btn=document.getElementById('btn-kiosk-start');
  if(btn)btn.style.display='inline-block';
  mostrarPasoKiosk(1);
  const nota=document.getElementById('kiosk-nota');
  if(nota)nota.value='';
}

// ── PANEL DE SOLICITUDES ──
