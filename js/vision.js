function renderVision(){
  renderEtiquetas();
  // Populate trabajador select in scan (filterable list, no empty option needed)
  filtrarListaTrabajadores();
}

// ── CÁMARA QR SCANNER ──
async function iniciarCamara(){
  try {
    const constraints = {
      video: { facingMode: 'environment', width: {ideal:1280}, height: {ideal:720} }
    };
    camStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById('cam-video');
    video.srcObject = camStream;
    await video.play();
    document.getElementById('btn-cam-start').style.display = 'none';
    document.getElementById('btn-cam-stop').style.display = 'inline-block';
    document.getElementById('btn-foto-ia').style.display = 'inline-block';
    document.getElementById('scan-status').textContent = '🟢 Cámara activa — apunta al código QR';
    document.getElementById('scan-status').style.color = 'var(--green)';
    // Start scanning loop
    iniciarScanLoop();
  } catch(e) {
    document.getElementById('scan-status').textContent = '❌ No se pudo acceder a la cámara: ' + e.message;
    document.getElementById('scan-status').style.color = 'var(--red)';
    showToast('Error de cámara: ' + e.message, false);
  }
}

function detenerCamara(){
  if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; }
  clearInterval(scanInterval); scanInterval=null;
  const video = document.getElementById('cam-video');
  if(video) video.srcObject = null;
  document.getElementById('btn-cam-start').style.display = 'inline-block';
  document.getElementById('btn-cam-stop').style.display = 'none';
  document.getElementById('btn-foto-ia').style.display = 'none';
  document.getElementById('scan-status').textContent = 'Cámara detenida';
  document.getElementById('scan-status').style.color = 'var(--muted)';
}

function iniciarScanLoop(){
  clearInterval(scanInterval);
  // Try native BarcodeDetector API first (Chrome 88+, Android)
  if('BarcodeDetector' in window){
    const detector = new BarcodeDetector({formats:['qr_code','code_128','code_39','ean_13','ean_8','data_matrix']});
    scanInterval = setInterval(async ()=>{
      const video = document.getElementById('cam-video');
      if(!video || video.readyState < 2) return;
      try {
        const codes = await detector.detect(video);
        if(codes.length > 0){
          procesarCodigoDetectado(codes[0].rawValue);
        }
      } catch(e){}
    }, 300);
    document.getElementById('scan-status').textContent = '🟢 Escaneando con detector nativo...';
  } else {
    // Fallback: use jsQR library loaded dynamically
    cargarJsQR();
  }
}

function cargarJsQR(){
  if(window.jsQR){ iniciarScanLoopJsQR(); return; }
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.min.js';
  script.onload = () => { iniciarScanLoopJsQR(); };
  script.onerror = () => {
    document.getElementById('scan-status').textContent = '⚠ Sin conexión para cargar escáner. Usa "Foto → IA" o escribe el código manualmente.';
    document.getElementById('scan-status').style.color = 'var(--gold)';
    // Show manual input fallback
    mostrarEntradaManualCodigo();
  };
  document.head.appendChild(script);
}

function iniciarScanLoopJsQR(){
  const canvas = document.getElementById('cam-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  scanInterval = setInterval(()=>{
    const video = document.getElementById('cam-video');
    if(!video || video.readyState < 2 || !ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {inversionAttempts:'dontInvert'});
      if(code) procesarCodigoDetectado(code.data);
    } catch(e){}
  }, 200);
  document.getElementById('scan-status').textContent = '🟢 Escaneando con jsQR...';
}

function mostrarEntradaManualCodigo(){
  const container = document.getElementById('cam-container');
  if(!container) return;
  const existing = document.getElementById('manual-code-input');
  if(existing) return;
  const div = document.createElement('div');
  div.id = 'manual-code-input';
  div.style.cssText = 'padding:1rem;background:var(--bg2);border:1px solid var(--border);border-radius:8px;margin-top:.8rem';
  div.innerHTML = '<div style="font-size:.75rem;color:var(--muted);margin-bottom:.5rem;text-transform:uppercase;letter-spacing:1px">Entrada manual de código</div>'
    + '<div style="display:flex;gap:8px"><input id="manual-code-val" type="text" placeholder="Ej: MAQ-001, HER-002, G1..." '
    + 'style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;outline:none"/>'
    + '<button class="btn btn-p" onclick="procesarCodigoManual()">Buscar</button></div>';
  container.parentNode.insertBefore(div, container.nextSibling);
}

function procesarCodigoManual(){
  const val = document.getElementById('manual-code-val')?.value?.trim();
  if(val) procesarCodigoDetectado(val);
}

let ultimoCodigo = '';
let ultimoCodigoTime = 0;
let combineMode = true;      // Flujo combinado cámara+voz activado por defecto
let scanTrabajadorId = null; // Trabajador detectado por voz en modo combinado
let micTrabRec = null;       // SpeechRecognition para detectar trabajador
function procesarCodigoDetectado(codigo){
  // Debounce: ignore same code within 3 seconds
  const now = Date.now();
  if(codigo === ultimoCodigo && now - ultimoCodigoTime < 3000) return;
  ultimoCodigo = codigo;
  ultimoCodigoTime = now;

  // Flash effect
  document.getElementById('scan-status').textContent = '⚡ Código detectado: ' + codigo;
  document.getElementById('scan-status').style.color = 'var(--gold)';

  // Find activo by codigo
  const activo = S.activos.find(a =>
    a.codigo && a.codigo.toUpperCase() === codigo.toUpperCase()
  ) || S.activos.find(a =>
    a.codigo && a.codigo.toUpperCase().includes(codigo.toUpperCase())
  );

  scanActivoDetectado = activo || null;
  const resBox = document.getElementById('scan-result-box');
  const detEl = document.getElementById('scan-detected');
  const infoEl = document.getElementById('scan-activo-info');
  const warnEl = document.getElementById('scan-prestamo-warn');
  const btnDev = document.getElementById('scan-btn-devolver');
  const btnPrest = document.getElementById('scan-btn-prestar');

  detEl.textContent = codigo;

  if(activo){
    infoEl.innerHTML = `<b>${activo.desc||activo.tipoepp||''}</b> &nbsp; ${tipoLabel(activo.tipo)} &nbsp; ${activoBadge(activo)}`;
    // Check for active loan
    const prestActivo = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id);
    if(prestActivo){
      const portador = W(prestActivo.wid).nombre.split(',')[0];
      const dias = daysBetween(prestActivo.fecha.split(' ')[0]);
      warnEl.style.display = 'block';
      warnEl.innerHTML = `⚠ Actualmente prestado a <b>${portador}</b> (${dias}d) — ¿lo está devolviendo?`;
      btnDev.style.display = 'inline-block';
      btnPrest.textContent = '📤 Nuevo préstamo (forzar)';
    } else {
      warnEl.style.display = 'none';
      btnDev.style.display = 'none';
      btnPrest.textContent = '📤 Registrar préstamo';
    }
    document.getElementById('scan-status').textContent = '✓ ' + activo.codigo + ' — ' + (activo.desc||activo.tipoepp||'');
    document.getElementById('scan-status').style.color = 'var(--green)';
  } else {
    infoEl.innerHTML = `<span style="color:var(--muted)">Código "<b>${codigo}</b>" no encontrado en inventario.</span> &nbsp; <button class="btn btn-o btn-sm" onclick="agregarActivoDesdeEscan('${codigo}')">+ Agregar al sistema</button>`;
    warnEl.style.display = 'none';
    btnDev.style.display = 'none';
    btnPrest.textContent = '📤 Registrar préstamo';
    document.getElementById('scan-status').textContent = '⚠ Código no encontrado: ' + codigo;
    document.getElementById('scan-status').style.color = 'var(--gold)';
  }

  resBox.style.display = 'block';
  // Vibrate if supported
  if(navigator.vibrate) navigator.vibrate([100, 50, 100]);

  // ── AUTO-TRIGGER VOZ para el trabajador ──
  // Si el modo combinado está activo, activar mic automáticamente tras detectar código
  if(combineMode){
    setTimeout(activarMicParaTrabajador, 400);
  }
}

function registrarDesdeScan(tipo){
  const wId = parseInt(document.getElementById('scan-trabajador').value);
  if(!wId){ showToast('Selecciona un trabajador', false); return; }
  if(!scanActivoDetectado){ showToast('No hay elemento detectado', false); return; }

  const activo = scanActivoDetectado;
  const hora = nowT();
  const fecha = today() + ' ' + hora;

  if(tipo === 'devolucion'){
    const prest = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id);
    if(prest){
      prest.devuelto = fecha;
      prest.obs = (prest.obs||'') + ' [Dev. por escáner]';
      if(activo.tipo==='maquinaria') activo.estado='Operativo';
      else if(activo.tipo==='herramienta') activo.disponible++;
      const logEntry = {hora, codigo: activo.codigo, desc: activo.desc||activo.tipoepp, accion:'Devolución', trabajador: W(prest.wid).nombre.split(',')[0]};
      scanLog.unshift(logEntry);
      renderScanLog();
      showToast('↩ Devolución de ' + W(prest.wid).nombre.split(',')[0] + ' registrada');
      resetScan();
    }
  } else {
    // Check conflict
    const prestActivo = S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id);
    if(prestActivo){
      // Force return first
      prestActivo.devuelto = fecha;
      prestActivo.obs = (prestActivo.obs||'') + ' [Dev. forzada por escáner]';
      prestActivo.devolucionForzada = true;
      if(activo.tipo==='maquinaria') activo.estado='Operativo';
      else if(activo.tipo==='herramienta') activo.disponible++;
    }
    // New loan
    if(activo.tipo==='maquinaria') activo.estado='En préstamo';
    else if(activo.tipo==='herramienta'&&activo.disponible>0) activo.disponible--;
    S.prestamos.push({id:nids.prest++,activoId:activo.id,wid:wId,fecha,resp:S.user?.nombre||'Escáner',obs:'Registrado por escáner QR',devuelto:null});
    S.movimientos.push({desc:'Préstamo '+activo.codigo, accion:'Préstamo', wid:wId, hora});
    const logEntry = {hora, codigo: activo.codigo, desc: activo.desc||activo.tipoepp, accion:'Préstamo', trabajador: W(wId).nombre.split(',')[0]};
    scanLog.unshift(logEntry);
    renderScanLog();
    showToast('✓ Préstamo: ' + activo.codigo + ' → ' + W(wId).nombre.split(',')[0]);
    resetScan();
    // Continue scanning
    ultimoCodigoTime = 0;
  }
}

function resetScan(){
  scanActivoDetectado = null;
  document.getElementById('scan-result-box').style.display = 'none';
  document.getElementById('scan-status').textContent = '🟢 Listo para escanear...';
  document.getElementById('scan-status').style.color = 'var(--green)';
  ultimoCodigo = '';
}

function agregarActivoDesdeEscan(codigo){
  // Pre-fill the activo modal with the scanned code
  document.getElementById('act-id-edit').value = '';
  document.getElementById('am-cod').value = codigo;
  document.getElementById('m-activo-t').textContent = 'Nuevo Activo — ' + codigo;
  openModal('m-activo');
}

function renderScanLog(){
  const el = document.getElementById('scan-log-list');
  if(!el) return;
  if(!scanLog.length){ el.innerHTML = '<span style="color:var(--muted)">Sin escaneos aún.</span>'; return; }
  el.innerHTML = scanLog.slice(0,10).map(l =>
    `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:.78rem;align-items:center">
      <span style="color:var(--dim);flex-shrink:0">${l.hora}</span>
      <code style="color:var(--gold)">${l.codigo}</code>
      <span class="b ${l.accion==='Devolución'?'b-green':'b-gold'}" style="flex-shrink:0">${l.accion}</span>
      <span style="color:var(--muted)">${l.trabajador}</span>
    </div>`
  ).join('');
}

// ── FOTO → IA ──
async function iniciarFotoCam(){
  try {
    const constraints = { video: { facingMode: 'environment' } };
    fotoStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById('foto-video');
    video.srcObject = fotoStream;
    await video.play();
    document.getElementById('btn-capturar-foto').style.display = 'inline-block';
  } catch(e){
    showToast('Error cámara: ' + e.message, false);
  }
}

function capturarFoto(){
  const video = document.getElementById('foto-video');
  const canvas = document.getElementById('foto-canvas');
  if(!video || !canvas) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  fotoImagenB64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  const img = document.getElementById('foto-preview');
  img.src = 'data:image/jpeg;base64,' + fotoImagenB64;
  document.getElementById('foto-preview-wrap').style.display = 'block';
  // Stop camera to save battery
  if(fotoStream){ fotoStream.getTracks().forEach(t=>t.stop()); fotoStream=null; }
}

function capturarFotoIA(){
  // Take a photo from the scanner camera and send to IA
  const video = document.getElementById('cam-video');
  if(!video) return;
  const canvas = document.getElementById('cam-canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  fotoImagenB64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
  // Switch to foto-ia tab
  document.querySelectorAll('#p-vision .tabs .tab').forEach((t,i)=>{ t.classList.toggle('active', i===1); });
  document.querySelectorAll('[id^="vis-"]').forEach(el=>el.style.display='none');
  document.getElementById('vis-foto-ia').style.display='block';
  const img = document.getElementById('foto-preview');
  img.src = 'data:image/jpeg;base64,' + fotoImagenB64;
  document.getElementById('foto-preview-wrap').style.display = 'block';
  showToast('Foto capturada — presiona "Analizar con IA"');
}

function procesarImagenSubida(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const b64 = e.target.result.split(',')[1];
    fotoImagenB64 = b64;
    const img = document.getElementById('foto-preview');
    img.src = e.target.result;
    document.getElementById('foto-preview-wrap').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function analizarFotoConIA(){
  if(!fotoImagenB64){ showToast('Primero captura o sube una foto', false); return; }
  const apiKey = vozState?.apiKey || document.getElementById('voz-api-key')?.value?.trim() || '';
  if(!apiKey){
    document.getElementById('foto-api-warn').style.display = 'block';
    document.getElementById('foto-result-card').style.display = 'none';
    showToast('Configura tu API key en Asistente de Voz', false); return;
  }

  const resCard = document.getElementById('foto-result-card');
  const resEl = document.getElementById('foto-ia-resultado');
  resCard.style.display = 'block';
  resEl.innerHTML = '<div style="color:var(--muted);font-size:.82rem">⚡ Analizando imagen...</div>';

  // Build inventory context
  const inventario = S.activos.filter(a=>a.tipo==='maquinaria'||a.tipo==='herramienta')
    .map(a=>`${a.codigo}: ${a.desc} (${a.cat||a.tipo})`).join('\n');

  const systemPrompt = `Eres el sistema de inventario de SERVING, empresa de construcción naval.
Analiza la imagen y:
1. Identifica qué herramienta o equipo es
2. Busca si coincide con alguno del inventario
3. Indica su estado probable (buen estado, desgaste, daño visible)

INVENTARIO ACTUAL:
${inventario}

Responde en JSON sin backticks:
{
  "identificado": "nombre del elemento que ves",
  "categoria": "soldadora|esmeril|herramienta manual|EPP|otro",
  "coincidencia": {"codigo": "MAQ-001 o null", "desc": "descripción del match o null", "confianza": "alta|media|baja"},
  "estado_visual": "descripción breve del estado que se ve",
  "observaciones": "cualquier dato relevante"
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: fotoImagenB64 }
          }, {
            type: 'text',
            text: '¿Qué herramienta o equipo es este? ¿Está en el inventario?'
          }]
        }]
      })
    });

    const data = await resp.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch(e) { parsed = null; }

    if(parsed){
      const match = parsed.coincidencia;
      const activo = match?.codigo ? S.activos.find(a=>a.codigo===match.codigo) : null;
      const prestActivo = activo ? S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id) : null;

      resEl.innerHTML = `
        <div style="margin-bottom:.7rem">
          <div style="font-size:.88rem;font-weight:700;color:var(--text)">${parsed.identificado}</div>
          <div style="font-size:.75rem;color:var(--muted)">${parsed.categoria}</div>
        </div>
        ${match?.codigo ? `
        <div style="background:var(--bg3);border-radius:6px;padding:.7rem;margin-bottom:.7rem">
          <div style="font-size:.75rem;color:var(--muted);margin-bottom:3px">Coincidencia en inventario</div>
          <div><code style="color:var(--gold)">${match.codigo}</code> — ${match.desc}</div>
          ${activo ? '<div style="margin-top:4px">'+activoBadge(activo)+'</div>' : ''}
          ${prestActivo ? '<div class="alert al-warn" style="margin-top:.5rem;margin-bottom:0">Actualmente prestado a <b>'+W(prestActivo.wid).nombre.split(',')[0]+'</b></div>' : ''}
        </div>
        ` : '<div class="alert al-info" style="margin-bottom:.7rem">No encontré este elemento en el inventario. Puedes agregarlo.</div>'}
        <div style="font-size:.78rem;color:var(--muted);margin-bottom:.3rem">Estado visual: <span style="color:var(--text)">${parsed.estado_visual}</span></div>
        ${parsed.observaciones ? '<div style="font-size:.78rem;color:var(--muted)">'+parsed.observaciones+'</div>' : ''}
        ${activo ? `
        <div style="display:flex;gap:8px;margin-top:.9rem;flex-wrap:wrap">
          <button class="btn btn-p btn-sm" onclick="irAPrestarDesdeVision('${activo.id}')">📤 Registrar préstamo</button>
          ${prestActivo ? '<button class="btn btn-s btn-sm" onclick="devolverDesdeVision('+prestActivo.id+')">📥 Registrar devolución</button>' : ''}
        </div>` : `<button class="btn btn-o btn-sm" style="margin-top:.7rem" onclick="agregarActivoDesdeEscan('NUEVO')">+ Agregar al inventario</button>`}
      `;
    } else {
      resEl.innerHTML = '<div class="alert al-warn">No pude interpretar la respuesta de la IA. Intenta con otra foto.</div>';
    }
  } catch(err){
    resEl.innerHTML = '<div class="alert al-err">Error al analizar: ' + err.message + '</div>';
  }
}

function irAPrestarDesdeVision(activoId){
  // Pre-select the activo in the loan modal and open it
  fillSelects();
  const sel = document.getElementById('p-activo');
  if(sel) sel.value = activoId;
  openModal('m-prestamo');
}

function devolverDesdeVision(prestId){
  const p = S.prestamos.find(x=>x.id===prestId);
  if(!p) return;
  if(!confirm('¿Registrar devolución de ' + A(p.activoId).codigo + ' de ' + W(p.wid).nombre.split(',')[0] + '?')) return;
  devolver(prestId);
  showToast('↩ Devolución registrada');
  analizarFotoConIA(); // refresh
}

// ── ETIQUETAS QR ──
function renderEtiquetas(){
  const q = (document.getElementById('etiq-q')?.value||'').toLowerCase();
  const tipo = document.getElementById('etiq-tipo')?.value||'';
  let arr = S.activos.filter(a=>a.tipo!=='consumible');
  if(tipo) arr = arr.filter(a=>a.tipo===tipo);
  if(q) arr = arr.filter(a=>a.codigo.toLowerCase().includes(q)||(a.desc||a.tipoepp||'').toLowerCase().includes(q));

  document.getElementById('etiquetas-grid').innerHTML = arr.map(a => {
    const qrSvg = generarQRSVGEtiqueta(a.codigo);
    return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:.8rem;text-align:center">
      <div style="background:white;border-radius:4px;padding:6px;display:inline-block;margin-bottom:.4rem">${qrSvg}</div>
      <div style="font-size:.72rem;font-weight:700;color:var(--gold);font-family:monospace">${a.codigo}</div>
      <div style="font-size:.65rem;color:var(--muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:160px;margin:0 auto">${(a.desc||a.tipoepp||'').slice(0,25)}</div>
      <div style="margin-top:.4rem">${tipoLabel(a.tipo)}</div>
    </div>`;
  }).join('') || '<div class="alert al-info">No hay activos para mostrar.</div>';
}

function generarQRSVGEtiqueta(code){
  const h = code.split('').reduce((a,c,i)=>a+(c.charCodeAt(0)*(i+1)),0);
  let r = '<svg width="80" height="80" viewBox="0 0 54 54" xmlns="http://www.w3.org/2000/svg">';
  r += '<rect width="54" height="54" fill="white"/>';
  for(let row=0;row<5;row++) for(let col=0;col<5;col++){
    if((h*(row+1)*(col+1)*7)%11<6) r+=`<rect x="${col*7+9}" y="${row*7+9}" width="6" height="6" fill="#111"/>`;
  }
  r += '<rect x="1" y="1" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
     +'<rect x="37" y="1" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
     +'<rect x="1" y="37" width="16" height="16" fill="none" stroke="#111" stroke-width="2"/>'
     +'<rect x="4" y="4" width="10" height="10" fill="#111"/>'
     +'<rect x="40" y="4" width="10" height="10" fill="#111"/>'
     +'<rect x="4" y="40" width="10" height="10" fill="#111"/>';
  return r + '</svg>';
}

function imprimirEtiquetas(){
  const q = (document.getElementById('etiq-q')?.value||'').toLowerCase();
  const tipo = document.getElementById('etiq-tipo')?.value||'';
  let arr = S.activos.filter(a=>a.tipo!=='consumible');
  if(tipo) arr = arr.filter(a=>a.tipo===tipo);
  if(q) arr = arr.filter(a=>a.codigo.toLowerCase().includes(q)||(a.desc||a.tipoepp||'').toLowerCase().includes(q));

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Etiquetas SERVING</title>
  <style>
    body{font-family:sans-serif;margin:0;padding:10px}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .etiq{border:1px solid #ccc;border-radius:6px;padding:8px;text-align:center;page-break-inside:avoid}
    .etiq svg{width:70px;height:70px}
    .codigo{font-size:9px;font-weight:700;font-family:monospace;color:#b76e00;margin-top:3px}
    .desc{font-size:8px;color:#666;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100px;margin:0 auto}
    .tipo{font-size:7px;background:#eee;border-radius:3px;padding:1px 4px;display:inline-block;margin-top:2px}
    @media print{body{padding:0}@page{margin:10mm}}
  </style></head><body>
  <div style="font-size:10px;color:#999;margin-bottom:8px">SERVING — Etiquetas de inventario (${arr.length} elementos) — ${new Date().toLocaleDateString('es-PE')}</div>
  <div class="grid">
  ${arr.map(a=>{
    const svg = generarQRSVGEtiqueta(a.codigo);
    return '<div class="etiq">'+svg+'<div class="codigo">'+a.codigo+'</div><div class="desc">'+(a.desc||a.tipoepp||'').slice(0,22)+'</div></div>';
  }).join('')}
  </div>
  <script>window.onload=()=>window.print();<\/script>
  </body></html>`;

  const w = window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
  else showToast('Permite ventanas emergentes para imprimir', false);
}


// ══ FLUJO COMBINADO CÁMARA + VOZ ══

function activarMicParaTrabajador(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Voz no disponible — selecciona de la lista', false); return; }

  // Stop any previous instance
  if(micTrabRec){ try{ micTrabRec.stop(); }catch(e){} }

  const btn = document.getElementById('scan-btn-mic');
  const status = document.getElementById('scan-voz-status');
  if(btn){ btn.style.background='rgba(248,81,73,.25)'; btn.style.borderColor='var(--red)'; btn.textContent='🔴'; }
  if(status){ status.textContent = '🔴 Escuchando... di el apellido del trabajador'; status.style.color='var(--red)'; }

  micTrabRec = new SR();
  micTrabRec.lang = 'es-PE';
  micTrabRec.continuous = false;
  micTrabRec.interimResults = true;
  micTrabRec.maxAlternatives = 3;

  let finalResult = '';

  micTrabRec.onresult = (e) => {
    let interim = '';
    for(let i = e.resultIndex; i < e.results.length; i++){
      if(e.results[i].isFinal){
        // Try all alternatives
        for(let j = 0; j < e.results[i].length; j++){
          const text = e.results[i][j].transcript;
          const worker = buscarTrabajadorPorVoz(text);
          if(worker){ finalResult = text; procesarTrabajadorDetectado(worker, text); return; }
        }
        finalResult = e.results[i][0].transcript;
      } else {
        interim = e.results[i][0].transcript;
      }
    }
    if(interim && status) status.textContent = '👂 "' + interim + '"';
  };

  micTrabRec.onend = () => {
    if(btn){ btn.style.background='var(--bg4)'; btn.style.borderColor='var(--border2)'; btn.textContent='🎙'; }
    if(!scanTrabajadorId){
      if(finalResult){
        // Last attempt with final transcript
        const worker = buscarTrabajadorPorVoz(finalResult);
        if(worker){ procesarTrabajadorDetectado(worker, finalResult); return; }
        if(status){ status.textContent = '⚠ No encontré "'+finalResult+'" — selecciona de la lista'; status.style.color='var(--gold)'; }
      } else {
        if(status){ status.textContent = 'Presiona el micrófono y di el nombre'; status.style.color='var(--muted)'; }
      }
    }
  };

  micTrabRec.onerror = (e) => {
    if(btn){ btn.style.background='var(--bg4)'; btn.style.borderColor='var(--border2)'; btn.textContent='🎙'; }
    if(e.error !== 'no-speech' && status){ status.textContent = 'Error micrófono: '+e.error; status.style.color='var(--red)'; }
  };

  try { micTrabRec.start(); } catch(e){ showToast('Error al iniciar micrófono', false); }
}

function buscarTrabajadorPorVoz(texto){
  const t = normalizar(texto);
  const words = t.split(' ').filter(w => w.length >= 2);

  const scored = S.workers.filter(w=>w.estado==='Activo').map(w => {
    const apellidos = normalizar(w.apellidos||'');
    const nombres   = normalizar(w.nombres||'');
    const apodos    = (w.apodos||[]).map(a=>normalizar(a));
    let score = 0;
    words.forEach(word => {
      // Apodo exacto = mayor prioridad
      if(apodos.some(a => a === word)) score += 15;
      if(apodos.some(a => a.startsWith(word) && word.length>=3)) score += 10;
      // Apellido
      const apParts = apellidos.split(' ');
      if(apParts.some(p => p === word && p.length >= 3)) score += 10;
      if(apParts.some(p => p.startsWith(word) && p.length >= 3)) score += 6;
      if(apellidos.includes(word) && word.length>=3) score += 3;
      if(nombres.includes(word) && word.length>=3) score += 2;
    });
    return { w, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

  return scored.length > 0 ? scored[0].w : null;
}

function procesarTrabajadorDetectado(worker, textoVoz){
  scanTrabajadorId = worker.id;

  // Update UI
  const status = document.getElementById('scan-voz-status');
  const nombreEl = document.getElementById('scan-voz-nombre');
  const clearBtn = document.getElementById('scan-voz-clear');
  const confDiv = document.getElementById('scan-trab-confirmado');
  const confNombre = document.getElementById('scan-trab-nombre-conf');

  if(status){ status.style.display='none'; }
  if(nombreEl){ nombreEl.style.display='block'; nombreEl.textContent='"'+textoVoz+'"'; }
  if(clearBtn) clearBtn.style.display='block';
  if(confDiv) confDiv.style.display='block';
  if(confNombre) confNombre.textContent = worker.apellidos + ', ' + worker.nombres;

  // Also select in dropdown
  const sel = document.getElementById('scan-trabajador');
  if(sel) sel.value = worker.id;

  // Vibrate confirmation
  if(navigator.vibrate) navigator.vibrate([50,30,50,30,100]);

  showToast('✓ Trabajador: ' + worker.apellidos.split(' ')[0]);

  // If activo already detected AND worker now set → auto-register if loan is clear
  if(scanActivoDetectado){
    const prestActivo = S.prestamos.find(p=>!p.devuelto&&p.activoId===scanActivoDetectado.id);
    if(!prestActivo){
      // Clean path: auto-register after brief delay so user sees confirmation
      setTimeout(()=>{
        if(scanTrabajadorId && scanActivoDetectado){
          mostrarConfirmacionRapida(scanActivoDetectado, worker);
        }
      }, 600);
    }
    // If there IS a conflict, the warning is already showing - user decides
  }
}

function mostrarConfirmacionRapida(activo, worker){
  // Show a 3-second auto-confirm banner
  const resBox = document.getElementById('scan-result-box');
  if(!resBox) return;

  const banner = document.createElement('div');
  banner.id = 'auto-confirm-banner';
  banner.style.cssText = 'background:rgba(63,185,80,.15);border:2px solid var(--green);border-radius:8px;padding:.9rem;margin-bottom:.7rem;text-align:center';

  let countdown = 3;
  const update = () => {
    banner.innerHTML = `<div style="font-size:.88rem;color:var(--green);font-weight:700">📤 ${activo.codigo} → ${worker.apellidos.split(' ')[0]}</div>`
      + `<div style="font-size:.75rem;color:var(--muted);margin:.3rem 0">Registrando automáticamente en <b style="color:var(--text)">${countdown}s</b>...</div>`
      + `<div style="display:flex;gap:8px;justify-content:center;margin-top:.5rem">`
      + `<button class="btn btn-s btn-sm" onclick="confirmarAutoRegistro()">✓ Ahora</button>`
      + `<button class="btn btn-d btn-sm" onclick="cancelarAutoRegistro()">✕ Cancelar</button>`
      + `</div>`;
  };

  // Insert at top of resBox
  resBox.insertBefore(banner, resBox.firstChild);
  update();

  window._autoConfirmTimer = setInterval(()=>{
    countdown--;
    if(countdown <= 0){
      clearInterval(window._autoConfirmTimer);
      confirmarAutoRegistro();
    } else {
      update();
    }
  }, 1000);
}

function confirmarAutoRegistro(){
  clearInterval(window._autoConfirmTimer);
  const banner = document.getElementById('auto-confirm-banner');
  if(banner) banner.remove();
  registrarDesdeScan('prestamo');
}

function cancelarAutoRegistro(){
  clearInterval(window._autoConfirmTimer);
  const banner = document.getElementById('auto-confirm-banner');
  if(banner) banner.remove();
  showToast('Auto-registro cancelado');
}

function limpiarVozTrabajador(){
  scanTrabajadorId = null;
  const status = document.getElementById('scan-voz-status');
  const nombreEl = document.getElementById('scan-voz-nombre');
  const clearBtn = document.getElementById('scan-voz-clear');
  const confDiv = document.getElementById('scan-trab-confirmado');
  if(status){ status.style.display='block'; status.textContent='Presiona el micrófono y di el nombre'; status.style.color='var(--muted)'; }
  if(nombreEl) nombreEl.style.display='none';
  if(clearBtn) clearBtn.style.display='none';
  if(confDiv) confDiv.style.display='none';
  const sel = document.getElementById('scan-trabajador');
  if(sel) sel.value='';
}

function seleccionarTrabajadorLista(wid){
  if(!wid) return;
  scanTrabajadorId = parseInt(wid);
  const worker = S.workers.find(w=>w.id==wid);
  if(!worker) return;

  const confDiv = document.getElementById('scan-trab-confirmado');
  const confNombre = document.getElementById('scan-trab-nombre-conf');
  if(confDiv) confDiv.style.display='block';
  if(confNombre) confNombre.textContent = worker.apellidos + ', ' + worker.nombres;

  const status = document.getElementById('scan-voz-status');
  if(status){ status.textContent='Seleccionado de la lista'; status.style.color='var(--green)'; }
}

function filtrarListaTrabajadores(){
  const q = normalizar(document.getElementById('scan-trab-filtro')?.value||'');
  const sel = document.getElementById('scan-trabajador');
  if(!sel) return;
  const filtered = S.workers.filter(w=>w.estado==='Activo').filter(w=>{
    if(!q) return true;
    const n = normalizar(w.nombre);
    return n.includes(q);
  });
  sel.innerHTML = filtered.map(w=>`<option value="${w.id}">${w.nombre}</option>`).join('');
}

// Override registrarDesdeScan to use scanTrabajadorId from voice if set
const _origRegistrar = registrarDesdeScan;
window.registrarDesdeScan = function(tipo){
  // If voice detected a worker, use that ID
  if(scanTrabajadorId){
    const sel = document.getElementById('scan-trabajador');
    if(sel) sel.value = scanTrabajadorId;
  }
  _origRegistrar(tipo);
};

// Override resetScan to also clear voice state
const _origReset = resetScan;
window.resetScan = function(){
  limpiarVozTrabajador();
  clearInterval(window._autoConfirmTimer);
  const banner = document.getElementById('auto-confirm-banner');
  if(banner) banner.remove();
  _origReset();
};

// Add combine mode toggle to camera section status bar
function toggleCombineMode(){
  combineMode = !combineMode;
  const btn = document.getElementById('btn-combine-mode');
  if(btn){
    btn.textContent = combineMode ? '🎙+📷 Modo combinado: ON' : '🎙+📷 Modo combinado: OFF';
    btn.style.borderColor = combineMode ? 'var(--gold)' : 'var(--border)';
    btn.style.color = combineMode ? 'var(--gold)' : 'var(--muted)';
  }
  showToast(combineMode ? '✓ Modo combinado activado — tras escanear, di el nombre' : 'Modo combinado desactivado');
}


// ══════════════════════════════════════════
// KIOSCO PAÑOL — SISTEMA DE SOLICITUDES
// ══════════════════════════════════════════

