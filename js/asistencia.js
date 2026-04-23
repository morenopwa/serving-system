function renderAsistencia(){
  // Show worker selector only if user has no linked worker
  const hasWid = !!S.user?.wid;
  const wrap = document.getElementById('asis-selector-wrap');
  if(wrap) wrap.style.display = hasWid ? 'none' : 'block';
  // Populate selector with active workers
  if(!hasWid){
    const sel = document.getElementById('asis-trabajador-sel');
    if(sel){
      const prev = sel.value;
      sel.innerHTML = '<option value="">— Selecciona tu nombre —</option>' +
        S.workers.filter(w=>w.estado==='Activo').map(w=>`<option value="${w.id}">${w.nombre} — ${w.cargo}</option>`).join('');
      if(prev) sel.value = prev;
    }
  }
  renderMiAsistencia();
  updateRegBtn();
  if(typeof onRenderAsistenciaNotif==='function') onRenderAsistenciaNotif();
}
function renderMiAsistencia(){
  let wid=S.user?.wid;
  if(!wid){const sel=document.getElementById('asis-trabajador-sel');if(sel&&sel.value)wid=parseInt(sel.value);}
  if(!wid)wid=1;
  document.getElementById('t-mi-asis').innerHTML=S.asistencia.filter(a=>a.wid==wid).sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(a=>{const{n,e}=calcH(a.entrada,a.salida);return`<tr><td>${a.fecha}</td><td>${a.entrada||'--'}</td><td>${a.salida||'--'}</td><td>${n}</td><td style="color:${e>0?'var(--gold)':'var(--muted)'}">${e}</td><td>${n+e}</td></tr>`;}).join('')||'<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1rem">Sin registros</td></tr>';
}
function renderAsistenciaGeneral(){
  const hoy=today();
  const isAdmin=S.user?.nivel==='Admin';
  document.getElementById('t-asis-general').innerHTML=S.asistencia.filter(a=>a.fecha===hoy).map(a=>{
    const{n,e}=calcH(a.entrada,a.salida);
    const editBtn=isAdmin?`<button class="btn btn-o btn-sm" onclick="abrirEditAsistencia(${a.id})" style="padding:2px 8px;font-size:.68rem">✏</button>`:'';
    const gpsFlag=a.sinGPS?'<span class="b b-gold" title="Marcado sin GPS">⚠ sin GPS</span>':'';
    return`<tr><td>${W(a.wid).nombre} ${gpsFlag}</td><td>${a.entrada||'--'}</td><td>${a.salida||'--'}</td><td>${n}</td><td style="color:${e>0?'var(--gold)':'var(--muted)'}">${e}</td><td>${editBtn}</td></tr>`;
  }).join('')||'<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1rem">Sin asistencia hoy</td></tr>';
}

// ── WHATSAPP LISTA ──
function generarListaTexto(){
  const hoy=today();const fecha=new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const asistentes=S.asistencia.filter(a=>a.fecha===hoy);
  const prop=document.getElementById('wa-proposito')?.value||'menu';
  let texto=`*🏗 SERVING — SIMA*\n*Asistencia ${fecha}*\n\n`;
  asistentes.forEach((a,i)=>{const w=W(a.wid);texto+=`${i+1}. ${w.nombre} (${w.cargo})\n   Entrada: ${a.entrada||'--'}  Salida: ${a.salida||'--'}\n`;});
  texto+=`\n*Total: ${asistentes.length} trabajadores*`;
  if(prop==='menu'||prop==='ambos')texto+=`\n\n*📋 Pedido de menú para ${asistentes.length} personas*\nFavor preparar para mañana.\n_Gracias 🙏_`;
  return texto;
}
function enviarWA(){
  const numero=document.getElementById('wa-numero').value.replace(/\D/g,'');
  if(!numero){showToast('Ingresa un número de WhatsApp',false);return;}
  const texto=encodeURIComponent(generarListaTexto());
  window.open(`https://wa.me/${numero}?text=${texto}`,'_blank');
}
function copiarListaAsistencia(){
  const texto=generarListaTexto();
  navigator.clipboard.writeText(texto).then(()=>showToast('Lista copiada al portapapeles ✓')).catch(()=>{const ta=document.createElement('textarea');ta.value=texto;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('Lista copiada ✓');});
}

// ── HORAS Y PAGOS ──

// ══════════════════════════════════════════════════
//  AGREGAR REGISTRO DE DÍA ANTERIOR
// ══════════════════════════════════════════════════

function abrirAgregarDiaAnterior() {
  const isAdmin = S.user?.nivel === 'Admin' || S.user?.nivel === 'Estandar';

  // Poblar selector de trabajador si es admin
  const workerWrap = document.getElementById('agregar-dia-worker-wrap');
  const workerSel  = document.getElementById('agregar-dia-worker');
  if (isAdmin) {
    workerWrap.style.display = 'block';
    const prev = workerSel.value;
    workerSel.innerHTML = '<option value="">— Selecciona trabajador —</option>' +
      S.workers.filter(w => w.estado === 'Activo')
        .map(w => `<option value="${w.id}">${w.nombre} — ${w.cargo}</option>`).join('');
    // Pre-seleccionar propio trabajador si tiene wid
    if (S.user?.wid) workerSel.value = S.user.wid;
    else if (prev) workerSel.value = prev;
  } else {
    workerWrap.style.display = 'none';
  }

  // Fecha: ayer por defecto
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const ayerStr = ayer.toISOString().slice(0, 10);
  document.getElementById('agregar-dia-fecha').value = ayerStr;
  document.getElementById('agregar-dia-fecha').max = ayerStr; // no permitir hoy ni futuro

  // Valores por defecto
  document.getElementById('agregar-dia-entrada').value = '08:00';
  document.getElementById('agregar-dia-salida').value  = '17:00';
  document.getElementById('agregar-dia-nota').value    = '';
  document.getElementById('agregar-dia-alerta').style.display = 'none';

  actualizarInfoDiaAnterior();
  actualizarPreviewDiaAnterior();
  openModal('m-agregar-dia');
}

function _getWidAgregarDia() {
  const isAdmin = S.user?.nivel === 'Admin' || S.user?.nivel === 'Estandar';
  if (isAdmin) {
    const v = document.getElementById('agregar-dia-worker')?.value;
    return v ? parseInt(v) : null;
  }
  return S.user?.wid || null;
}

function actualizarInfoDiaAnterior() {
  const fecha   = document.getElementById('agregar-dia-fecha')?.value;
  const wid     = _getWidAgregarDia();
  const alerta  = document.getElementById('agregar-dia-alerta');
  const btnConf = document.getElementById('btn-confirmar-dia');

  if (!fecha || !wid) {
    alerta.style.display = 'none';
    actualizarPreviewDiaAnterior();
    return;
  }

  const existente = S.asistencia.find(a => a.fecha === fecha && a.wid == wid);
  if (existente) {
    alerta.style.display = 'block';
    alerta.style.background = 'rgba(201,162,39,.13)';
    alerta.style.border     = '1px solid var(--gold)';
    alerta.style.color      = 'var(--gold)';
    alerta.innerHTML = `⚠ Ya existe un registro para este día:<br>
      <b>Entrada:</b> ${existente.entrada || '--'} &nbsp;·&nbsp;
      <b>Salida:</b> ${existente.salida || '--'}<br>
      <span style="font-size:.7rem;color:var(--muted)">Guardar reemplazará los valores existentes.</span>`;
    btnConf.textContent = '✓ Sobreescribir registro';
  } else {
    alerta.style.display = 'none';
    btnConf.textContent  = '✓ Guardar registro';
  }
  actualizarPreviewDiaAnterior();
}

function actualizarPreviewDiaAnterior() {
  const entrada  = document.getElementById('agregar-dia-entrada')?.value || '';
  const salida   = document.getElementById('agregar-dia-salida')?.value  || '';
  const preview  = document.getElementById('agregar-dia-preview');
  const fecha    = document.getElementById('agregar-dia-fecha')?.value || '';
  if (!preview) return;

  // Nombre del día
  let diaLabel = '';
  if (fecha) {
    const d = new Date(fecha + 'T12:00:00');
    diaLabel = d.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  if (entrada && salida) {
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    const totalMin = (sh * 60 + sm) - (eh * 60 + em);
    if (totalMin > 0) {
      const { n, e } = calcH(entrada, salida);
      preview.innerHTML = `
        <div style="color:var(--muted);font-size:.72rem;margin-bottom:4px">${diaLabel}</div>
        <span style="color:var(--muted)">Entrada:</span> <b>${entrada}</b>
        &nbsp;→&nbsp;
        <span style="color:var(--muted)">Salida:</span> <b>${salida}</b>
        &nbsp;·&nbsp;
        <span style="color:var(--green)">⏱ ${n}h normales</span>
        ${e > 0 ? `&nbsp;+&nbsp;<span style="color:var(--gold)">${e}h extra</span>` : ''}`;
    } else {
      preview.innerHTML = `<span style="color:var(--red)">⚠ La salida debe ser posterior a la entrada</span>`;
    }
  } else if (entrada) {
    preview.innerHTML = `
      <div style="color:var(--muted);font-size:.72rem;margin-bottom:4px">${diaLabel}</div>
      <span style="color:var(--muted)">Entrada:</span> <b>${entrada}</b>
      &nbsp;·&nbsp; <span style="color:var(--gold)">Sin salida</span>`;
  } else {
    preview.innerHTML = `<span style="color:var(--dim)">Ingresa las horas para ver el cálculo</span>`;
  }
}

function confirmarAgregarDiaAnterior() {
  const wid    = _getWidAgregarDia();
  const fecha  = document.getElementById('agregar-dia-fecha')?.value;
  const entrada= document.getElementById('agregar-dia-entrada')?.value || null;
  const salida = document.getElementById('agregar-dia-salida')?.value  || null;
  const nota   = document.getElementById('agregar-dia-nota')?.value    || '';

  if (!wid)   { showToast('Selecciona un trabajador', false); return; }
  if (!fecha) { showToast('Selecciona una fecha', false); return; }
  if (!entrada){ showToast('La hora de entrada es obligatoria', false); return; }

  // Validar que no sea hoy ni futuro
  if (fecha >= today()) { showToast('Solo puedes agregar días anteriores a hoy', false); return; }

  // Validar horas
  if (entrada && salida) {
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    if ((sh * 60 + sm) <= (eh * 60 + em)) {
      showToast('La salida debe ser posterior a la entrada', false);
      return;
    }
  }

  // ¿Ya existe? → actualizar; si no → crear
  let rec = S.asistencia.find(a => a.fecha === fecha && a.wid == wid);
  if (rec) {
    rec.entrada = entrada;
    rec.salida  = salida;
    if (nota) rec._nota = nota;
    if (typeof DB_MODE !== 'undefined' && DB_MODE && typeof syncAsistencia === 'function') syncAsistencia(rec);
    showToast('✓ Registro actualizado: ' + fecha);
  } else {
    rec = { id: nids.asis++, wid, fecha, entrada, salida: salida || null, _isNew: true };
    if (nota) rec._nota = nota;
    S.asistencia.push(rec);
    if (typeof DB_MODE !== 'undefined' && DB_MODE && typeof syncAsistencia === 'function') syncAsistencia(rec);
    showToast('✓ Registro agregado: ' + fecha);
  }

  closeModal('m-agregar-dia');
  renderMiAsistencia();
  if (typeof renderAsistenciaGeneral === 'function') renderAsistenciaGeneral();
  if (typeof renderHoras === 'function') renderHoras();
}
