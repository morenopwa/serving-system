function renderVoz(){
  renderVozLog();
  const saved = localStorage.getItem('voz_api_key');
  if(saved){ vozState.apiKey = saved; const el=document.getElementById('voz-api-key'); if(el) el.value=saved; }
  // Restore always-on state
  if(vozState.siempreActivo) activarSiempreActivo();
}

function guardarApiKey(){
  vozState.apiKey = document.getElementById('voz-api-key')?.value?.trim()||'';
  try{ localStorage.setItem('voz_api_key', vozState.apiKey); } catch(e){}
  showToast(vozState.apiKey ? 'API key guardada ✓' : 'Modo local activado');
}

// ══ SIEMPRE ACTIVO ══
function toggleSiempreActivo(){
  vozState.siempreActivo = !vozState.siempreActivo;
  if(vozState.siempreActivo){
    activarSiempreActivo();
    actualizarIndicadorVoz('activo');
    showToast('🎙 Escuchando — habla cuando quieras');
  } else {
    detenerGrabacion();
    actualizarIndicadorVoz('inactivo');
    showToast('Asistente pausado');
  }
}

function activarSiempreActivo(){
  if(!window.SpeechRecognition && !window.webkitSpeechRecognition){
    showToast('Tu navegador no soporta reconocimiento de voz. Usa Chrome.', false);
    vozState.siempreActivo = false; return;
  }
  iniciarEscucha();
}

function iniciarEscucha(){
  if(vozState.grabando) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ showToast('Reconocimiento de voz no disponible en este navegador. Usa Chrome.', false); return; }
  // Reuse existing recognition instance to avoid repeated permission prompts
  if(vozState.recognition && vozState.grabando === false){
    try { vozState.recognition.start(); return; } catch(e) { /* create new if start fails */ }
  }
  const rec = new SR();
  rec.lang = 'es-PE';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  vozState.recognition = rec;

  rec.onstart = () => {
    vozState.grabando = true;
    setMicStatus('escuchando');
  };

  let finalTranscript = '';
  let interimTranscript = '';

  rec.onresult = (e) => {
    interimTranscript = '';
    for(let i = e.resultIndex; i < e.results.length; i++){
      if(e.results[i].isFinal){
        finalTranscript += e.results[i][0].transcript + ' ';
      } else {
        interimTranscript += e.results[i][0].transcript;
      }
    }
    const display = document.getElementById('voz-transcript');
    if(display) display.textContent = (finalTranscript + interimTranscript).trim();
    const box = document.getElementById('voz-transcript-box');
    if(box) box.style.display = 'block';

    // ── MODO CONVERSACIÓN: acumula frases, procesa al cierre ──
    clearTimeout(vozState.silencioTimer);
    clearTimeout(vozState.timerConversacion);

    if(finalTranscript.trim()){
      const ahora = Date.now();
      // Si pasó más de SILENCIO_FRASE entre frases → es una frase separada, guardarla
      if(ahora - vozState.ultimaFrase > vozState.SILENCIO_FRASE && vozState.ultimaFrase > 0){
        const frase = finalTranscript.trim();
        finalTranscript = '';
        if(frase.length > 1){
          vozState.bufferConversacion.push({texto: frase, tiempo: ahora});
          mostrarBufferConversacion();
        }
      }
      vozState.ultimaFrase = ahora;

      // Cierre de conversación: silencio prolongado = procesar todo
      vozState.timerConversacion = setTimeout(()=>{
        // Añadir lo que queda en finalTranscript
        const restoFinal = finalTranscript.trim();
        if(restoFinal.length > 1){
          vozState.bufferConversacion.push({texto: restoFinal, tiempo: Date.now()});
          finalTranscript = '';
        }
        if(vozState.bufferConversacion.length > 0){
          procesarConversacion();
        }
      }, vozState.SILENCIO_CIERRE);
    }
  };

  rec.onerror = (e) => {
    vozState.grabando = false;
    if(e.error === 'no-speech' || e.error === 'aborted'){
      // Normal - restart if still active
      if(vozState.siempreActivo) setTimeout(iniciarEscucha, 500);
    } else if(e.error === 'not-allowed'){
      setMicStatus('error');
      showToast('Permiso de micrófono denegado', false);
      vozState.siempreActivo = false;
    } else {
      if(vozState.siempreActivo) setTimeout(iniciarEscucha, 1000);
    }
  };

  rec.onend = () => {
    vozState.grabando = false;
    setMicStatus('inactivo');
    // Auto-restart: try to restart same instance first (avoids permission prompt)
    if(vozState.siempreActivo){
      setTimeout(()=>{
        if(vozState.siempreActivo && !vozState.grabando){
          try {
            vozState.recognition.start(); // restart same instance
          } catch(e) {
            iniciarEscucha(); // fallback: new instance only if needed
          }
        }
      }, 150);
    }
  };

  try { rec.start(); } catch(e){ setTimeout(iniciarEscucha, 1000); }
}

function detenerGrabacion(){
  vozState.grabando = false;
  vozState.siempreActivo = false; // ensure it doesn't auto-restart
  if(vozState.recognition){
    try{ vozState.recognition.stop(); }catch(e){}
    // Don't null out recognition - keep instance for next time
  }
  setMicStatus('inactivo');
}

// Botón manual para un solo dictado
function grabacionManual(){
  if(vozState.siempreActivo){ showToast('El asistente ya está escuchando continuamente'); return; }
  if(vozState.grabando){ detenerGrabacion(); return; }
  activarSiempreActivo();
  vozState.siempreActivo = false; // one-shot
}

function setMicStatus(estado){
  // Update small indicator (scanner page etc.)
  const mic = document.getElementById('voz-mic-indicador');
  const txt = document.getElementById('voz-status');
  if(mic){
    if(estado==='escuchando'){ mic.style.background='rgba(248,81,73,.3)'; mic.style.borderColor='var(--red)'; mic.textContent='🔴'; }
    else if(estado==='procesando'){ mic.style.background='rgba(240,165,0,.2)'; mic.style.borderColor='var(--gold)'; mic.textContent='⚡'; }
    else{ mic.style.background='var(--bg3)'; mic.style.borderColor='var(--border2)'; mic.textContent='🎙'; }
  }
  if(txt){
    if(estado==='escuchando') txt.textContent='🔴 Escuchando...';
    else if(estado==='procesando') txt.textContent='⚡ Procesando...';
    else txt.textContent=vozState.siempreActivo?'▶ Reiniciando...':'En espera';
  }
  // Update big indicator on voice page
  actualizarIndicadorVoz(estado==='escuchando'?'activo':estado==='procesando'?'procesando':'inactivo');
  // Show transcript
  const escWrap = document.getElementById('voz-escucho-wrap');
  if(escWrap && estado==='escuchando') escWrap.style.display='block';
}

// ══ PROCESAR COMANDO ══
async function procesarComando(texto){
  setMicStatus('procesando');
  document.getElementById('voz-status').textContent = '⚡ Interpretando: "' + texto + '"';

  if(vozState.apiKey){
    await procesarConIA(texto);
  } else {
    interpretarLocalmente(texto);
  }
}

async function procesarTextoIA(){
  const texto = document.getElementById('voz-texto').value.trim();
  if(!texto){ showToast('Escribe o dicta algo primero', false); return; }
  await procesarComando(texto);
}

async function procesarConIA(texto){
  const trabajadoresCtx = S.workers.map(w=>`ID:${w.id} "${w.nombre}" cargo:"${w.cargo}"`).join(', ');
  const activosCtx = S.activos.filter(a=>a.tipo==='maquinaria'||a.tipo==='herramienta')
    .map(a=>`ID:${a.id} codigo:"${a.codigo}" desc:"${a.desc}"`).join(', ');
  const consumiblesCtx = S.activos.filter(a=>a.tipo==='consumible')
    .map(a=>`ID:${a.id} codigo:"${a.codigo}" desc:"${a.desc}" unidad:"${a.unidad}" stock:${a.stock}`).join(', ');
  const eppStockCtx = S.activos.filter(a=>a.tipo==='epp-s')
    .map(a=>`ID:${a.id} codigo:"${a.codigo}" tipo:"${a.tipoepp}" stock:${a.stock}`).join(', ');

  // Context about last action (for return detection)
  const ultimoCtx = vozState.ultimoRegistro 
    ? `ÚLTIMO REGISTRO: tipo="${vozState.ultimoRegistro.tipo}" codigo="${vozState.ultimoRegistro.codigo}" desc="${vozState.ultimoRegistro.desc}" trabId=${vozState.ultimoRegistro.trabId} hace ${Math.round((Date.now()-vozState.ultimoRegistro.timestamp)/1000)}s`
    : 'Sin registro previo en esta sesión';

  const systemPrompt = `Eres el asistente de registro del sistema SERVING (construcción naval). Interpretas frases informales en español peruano.

REGLA CLAVE DE DEVOLUCIÓN: Si el usuario menciona un código o nombre de herramienta/EPP que fue el ÚLTIMO REGISTRO entregado, se trata de una DEVOLUCIÓN aunque no lo diga explícitamente. Siempre informa de quién fue el último portador.

TRABAJADORES: ${trabajadoresCtx}
MAQUINARIA/HERRAMIENTAS: ${activosCtx}
CONSUMIBLES: ${consumiblesCtx}
EPP STOCK: ${eppStockCtx}
${ultimoCtx}
HOY: ${today()} HORA: ${nowT()}

Devuelve SOLO JSON sin backticks:
{
  "accion": "prestamo"|"devolucion"|"asistencia_entrada"|"asistencia_salida"|"epp_entrega"|"epp_devolucion"|"consumo"|"sima_entrada"|"mantenimiento"|"no_entendido",
  "descripcion": "texto breve de lo que vas a registrar",
  "confianza": "alta"|"media"|"baja",
  "aviso": "mensaje especial si es devolución (ej: 'Lo tenía Pedro Ramos desde 08:30')",
  "datos": {
    "activoId": null, "activoDesc": "", "activoCodigo": "",
    "widTrabajador": null, "nombreTrabajador": "",
    "cantidad": null, "unidad": "", "obra": "",
    "hora": "", "talla": "", "tipoEPP": "",
    "modulo": "", "descripcion": "", "tipo": ""
  }
}`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': vozState.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: texto }]
      })
    });
    const data = await resp.json();
    const raw = data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(clean);
    mostrarResultadoIA(parsed, texto);
  } catch(err){
    // Fallback to local on API error
    interpretarLocalmente(texto);
  }
}

function mostrarResultadoIA(parsed, textoOriginal){
  vozState.pendiente = { parsed, textoOriginal };

  // ── SIEMPRE EJECUTAR DIRECTO — sin pasos de confirmación ──
  if(parsed.accion === 'no_entendido'){
    mostrarFeedbackRapido('❓', parsed.datos?.sugerencia || 'No entendí — repite más claro', 'var(--red)', 2500);
    if(vozState.siempreActivo) setTimeout(iniciarEscucha, 2500);
    return;
  }
  // Ejecutar inmediatamente y seguir escuchando
  ejecutarParsed(parsed, textoOriginal);
  if(vozState.siempreActivo) setTimeout(iniciarEscucha, 200);
}



function mostrarFeedbackRapido(icono, texto, color, duracion){
  const rap = document.getElementById('voz-resultado-rapido');
  const cont = document.getElementById('voz-resultado-contenido');
  if(!rap||!cont) return;
  cont.style.background = color==='var(--green)' ? 'rgba(63,185,80,.12)' :
                          color==='var(--red)'   ? 'rgba(248,81,73,.12)' :
                          color==='var(--gold)'  ? 'rgba(240,165,0,.12)' : 'var(--bg2)';
  cont.style.border = '1px solid ' + color;
  cont.innerHTML = `<div style="font-size:1.6rem;margin-bottom:.3rem">${icono}</div><div style="font-size:.9rem;color:var(--text);font-weight:600">${texto}</div>`;
  rap.style.display = 'block';
  setTimeout(()=>{ rap.style.display='none'; }, duracion||2000);
}

function actualizarIndicadorVoz(estado){
  const ind = document.getElementById('voz-indicador-principal');
  const mic = document.getElementById('voz-mic-big');
  const lbl = document.getElementById('voz-estado-label');
  if(!ind||!mic||!lbl) return;

  if(estado === 'activo'){
    ind.style.background = 'rgba(63,185,80,.1)';
    ind.style.borderColor = 'var(--green)';
    ind.style.animation = 'pulso 2s ease-in-out infinite';
    mic.textContent = '🎙';
    lbl.textContent = 'Escuchando...';
    lbl.style.color = 'var(--green)';
  } else if(estado === 'procesando'){
    ind.style.background = 'rgba(240,165,0,.1)';
    ind.style.borderColor = 'var(--gold)';
    ind.style.animation = '';
    mic.textContent = '⚡';
    lbl.textContent = 'Procesando...';
    lbl.style.color = 'var(--gold)';
  } else if(estado === 'ejecutado'){
    ind.style.background = 'rgba(63,185,80,.2)';
    ind.style.borderColor = 'var(--green)';
    ind.style.animation = '';
    mic.textContent = '✓';
    lbl.textContent = 'Registrado';
    lbl.style.color = 'var(--green)';
    setTimeout(()=>actualizarIndicadorVoz('activo'), 1500);
  } else { // inactivo / apagado
    ind.style.background = 'var(--bg2)';
    ind.style.borderColor = 'var(--border2)';
    ind.style.animation = '';
    mic.textContent = '🎙';
    lbl.textContent = vozState.siempreActivo ? 'Toca para pausar' : 'Toca para activar';
    lbl.style.color = 'var(--muted)';
  }
}

function confirmarAccionVoz(){
  clearTimeout(vozState.autoConfTimer);
  document.getElementById('voz-confirmacion').style.display = 'none';
  if(vozState.pendiente){
    ejecutarParsed(vozState.pendiente.parsed, vozState.pendiente.textoOriginal);
    if(vozState.siempreActivo) setTimeout(iniciarEscucha, 300);
  }
}

function cancelarAccionVoz(){
  clearTimeout(vozState.autoConfTimer);
  document.getElementById('voz-confirmacion').style.display = 'none';
  vozState.pendiente = null;
  mostrarFeedbackRapido('✕', 'Cancelado', 'var(--muted)', 1200);
  if(vozState.siempreActivo) setTimeout(iniciarEscucha, 300);
}

function accionLabel(a){
  const m={'prestamo':'📤 Préstamo','devolucion':'📥 Devolución','asistencia_entrada':'▶ Entrada asistencia','asistencia_salida':'■ Salida asistencia','epp_entrega':'⬢ Entrega EPP','epp_devolucion':'↩ Devolución EPP','consumo':'◫ Consumo','sima_entrada':'⚓ Entrada SIMA','mantenimiento':'⚙ Mantenimiento','no_entendido':'❓ No entendido'};
  return m[a]||a;
}

function ejecutarAccionIA(){
  if(!vozState.pendiente) return;
  const { parsed, textoOriginal } = vozState.pendiente;
  ejecutarParsed(parsed, textoOriginal);
}

function ejecutarParsed(parsed, textoOriginal){
  const d = parsed.datos||{};
  let logMsg='';

  try{
    const findWorker = (id, nombre) => S.workers.find(w=>w.id==id) || S.workers.find(w=>nombre&&w.nombre.toLowerCase().includes((nombre||'').toLowerCase().split(' ')[0]));
    const findActivo = (id, desc, cod) => S.activos.find(a=>a.id==id) || S.activos.find(a=>cod&&a.codigo.toLowerCase()===cod.toLowerCase()) || S.activos.find(a=>desc&&(a.desc||'').toLowerCase().includes((desc||'').toLowerCase().split(' ').filter(x=>x.length>3)[0]||'zzz'));

    if(parsed.accion==='prestamo'){
      let activo=findActivo(d.activoId,d.activoDesc,d.activoCodigo);
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      if(!worker){showToast('No encontré al trabajador — verifica el nombre',false);return;}
      // If activo not found, create it on-the-fly so loan is tracked
      if(!activo && (d.activoDesc||d.activoCodigo)){
        const newCode = d.activoCodigo || ('HER-VOZ-'+String(nids.act).padStart(3,'0'));
        const newActivo = {id:nids.act++,codigo:newCode,tipo:'herramienta',cat:'Creado por voz',desc:d.activoDesc||d.activoCodigo,qty:1,disponible:1,ubic:'Por definir',estado:'Operativo'};
        S.activos.push(newActivo);
        activo = newActivo;
        showToast(`Herramienta "${newActivo.desc}" agregada automáticamente`);
      }
      if(!activo){showToast('No encontré el equipo — verifica el nombre',false);return;}
      if(activo.tipo==='maquinaria')activo.estado='En préstamo';
      else if(activo.tipo==='herramienta'&&activo.disponible>0)activo.disponible--;
      const prest={id:nids.prest++,activoId:activo.id,wid:worker.id,fecha:today()+' '+(d.hora||nowT()),resp:S.user?.nombre||'Asistente IA',obs:'Voz: '+textoOriginal,devuelto:null};
      S.prestamos.push(prest);
      S.movimientos.push({desc:`Préstamo ${activo.codigo}`,accion:'Préstamo',wid:worker.id,hora:nowT()});
      // Save as last record for return detection
      vozState.ultimoRegistro={tipo:'prestamo',codigo:activo.codigo,desc:activo.desc,trabId:worker.id,trabNombre:worker.nombre,timestamp:Date.now()};
      logMsg=`✓ Préstamo: ${activo.codigo} → ${worker.nombre}`;

    } else if(parsed.accion==='devolucion'){
      const activo=findActivo(d.activoId,d.activoDesc,d.activoCodigo);
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      // Find active loan - by activo or by worker or last record
      let prest = S.prestamos.find(p=>!p.devuelto&&(activo?p.activoId===activo.id:false)&&(worker?p.wid===worker.id:true));
      if(!prest&&activo) prest=S.prestamos.find(p=>!p.devuelto&&p.activoId===activo.id);
      if(!prest&&vozState.ultimoRegistro) prest=S.prestamos.find(p=>!p.devuelto&&p.activoId===(S.activos.find(a=>a.codigo===vozState.ultimoRegistro.codigo)?.id));
      if(!prest){showToast('No encontré un préstamo activo para ese equipo',false);return;}
      const portador=W(prest.wid).nombre;
      prest.devuelto=today()+' '+nowT();
      const a=S.activos.find(x=>x.id===prest.activoId);
      if(a){if(a.tipo==='maquinaria')a.estado='Operativo';else if(a.tipo==='herramienta')a.disponible++;}
      logMsg=`✓ Devolución: ${A(prest.activoId).codigo} (lo tenía ${portador})`;
      if(parsed.aviso||portador) showToast(`↩ Devuelto: lo traía ${portador}`);
      vozState.ultimoRegistro=null;

    } else if(parsed.accion==='epp_entrega'){
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      if(!worker){showToast('No encontré al trabajador',false);return;}
      const tipoEPP=d.tipoEPP||d.activoDesc||'EPP';
      const cod=d.activoCodigo||'';
      S.epp.push({id:nids.epp++,wid:worker.id,tipo:tipoEPP,talla:d.talla||'Única',resp:S.user?.nombre||'Asistente IA',fecha:today(),codigo:cod});
      S.movimientos.push({desc:`EPP ${tipoEPP} ${cod}→${worker.nombre}`,accion:'EPP',wid:worker.id,hora:nowT()});
      vozState.ultimoRegistro={tipo:'epp',codigo:cod||tipoEPP,desc:tipoEPP,trabId:worker.id,trabNombre:worker.nombre,timestamp:Date.now()};
      logMsg=`✓ EPP ${tipoEPP}${cod?' ('+cod+')':''} → ${worker.nombre}`;

    } else if(parsed.accion==='epp_devolucion'){
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      const cod=d.activoCodigo||'';
      // Find who had it last
      let portador='';
      if(vozState.ultimoRegistro&&vozState.ultimoRegistro.tipo==='epp'){
        portador=vozState.ultimoRegistro.trabNombre;
      } else if(worker){
        portador=worker.nombre;
      }
      logMsg=`✓ Devolución EPP${cod?' '+cod:''} — lo traía ${portador||'trabajador'}`;
      showToast(`↩ EPP devuelto — portador: ${portador||'verificar'}`);
      vozState.ultimoRegistro=null;

    } else if(parsed.accion==='asistencia_entrada'||parsed.accion==='asistencia_salida'){
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      if(!worker){showToast('No encontré al trabajador',false);return;}
      const hora=d.hora||nowT();
      const hoy=today();
      let rec=S.asistencia.find(a=>a.fecha===hoy&&a.wid===worker.id);
      if(parsed.accion==='asistencia_entrada'){
        if(!rec){S.asistencia.push({id:nids.asis++,wid:worker.id,fecha:hoy,entrada:hora,salida:null});logMsg=`✓ Entrada: ${worker.nombre} ${hora}`;}
        else if(!rec.entrada){rec.entrada=hora;logMsg=`✓ Entrada corregida: ${worker.nombre} ${hora}`;}
        else{showToast(`${worker.nombre} ya tiene entrada (${rec.entrada})`,false);return;}
      } else {
        if(rec&&!rec.salida){rec.salida=hora;logMsg=`✓ Salida: ${worker.nombre} ${hora}`;}
        else{showToast(`${worker.nombre} no tiene entrada activa`,false);return;}
      }

    } else if(parsed.accion==='consumo'){
      const activo=findActivo(d.activoId,d.activoDesc,d.activoCodigo);
      if(!activo){showToast('No encontré el consumible',false);return;}
      const qty=parseFloat(d.cantidad)||1;
      if(activo.stock<qty){showToast(`Stock insuficiente: ${activo.stock} ${activo.unidad}`,false);return;}
      activo.stock=+(activo.stock-qty).toFixed(2);
      const worker=findWorker(d.widTrabajador,d.nombreTrabajador);
      S.consMov.push({id:nids.cmov++,activoId:activo.id,tipo:'uso',qty,fecha:today(),wid:worker?.id||S.user?.wid||1,obra:d.obra||''});
      S.movimientos.push({desc:`${activo.codigo} -${qty}${activo.unidad}`,accion:'Consumo',wid:worker?.id||1,hora:nowT()});
      logMsg=`✓ Consumo: ${activo.codigo} -${qty} ${activo.unidad}${d.obra?' ('+d.obra+')':''}`;

    } else if(parsed.accion==='sima_entrada'){
      const p={id:nids.sima++,codigo:`SIMA-${String(nids.sima).padStart(3,'0')}`,desc:d.descripcion||textoOriginal,modulo:d.modulo||'Por asignar',cat:'Otro',qty:parseInt(d.cantidad)||1,disponible:parseInt(d.cantidad)||1,unidad:d.unidad||'unidad',fecha:today(),ubic:'Por definir',almac:S.user?.nombre||'IA',estado:'En almacén',obs:'Voz'};
      S.piezasSIMA.push(p);
      S.simaMov.push({id:nids.smov++,piezaId:p.id,accion:'Entrada',qty:p.qty,fecha:today(),wid:S.user?.wid||4,obs:'Entrada por voz'});
      logMsg=`✓ SIMA: ${p.desc} x${p.qty}`;

    } else if(parsed.accion==='no_entendido'){
      showToast(`No entendí: "${textoOriginal.slice(0,40)}" — intenta de nuevo`, false);
      setMicStatus('inactivo');
      return;
    } else {
      showToast('Acción no reconocida', false); return;
    }

    // ── Éxito ──
    vozState.historial.unshift({hora:nowT(),texto:textoOriginal,resultado:logMsg});
    renderVozLog();
    // Visual feedback on big indicator
    actualizarIndicadorVoz('ejecutado');
    // Brief result flash
    mostrarFeedbackRapido('✅', logMsg.replace('✓ ',''), 'var(--green)', 2200);
    // Hide old UI elements if they exist
    const res=document.getElementById('voz-resultado');if(res)res.style.display='none';
    const txt=document.getElementById('voz-texto');if(txt)txt.value='';
    const box=document.getElementById('voz-transcript-box');if(box)box.style.display='none';
    document.getElementById('voz-confirmacion').style.display='none';
    vozState.pendiente=null;
    // Resume listening quickly
    if(vozState.siempreActivo) setTimeout(iniciarEscucha, 300);

  } catch(err){
    showToast('Error: '+err.message, false);
  }
}


// ══════════════════════════════════════════
// INTÉRPRETE INTELIGENTE LOCAL
// Cada frase se entiende por sí sola.
// Lógica:
//   - Consumibles (soldadura, electrodo, disco, gas, etc) → siempre CONSUMO
//   - Herramienta/EPP con código (G1, G2, A3...) → 1ra vez=PRÉSTAMO, 2da=DEVOLUCIÓN
//   - Herramienta/EPP sin código → 1ra vez=PRÉSTAMO, 2da=DEVOLUCIÓN
//   - Asistencia → detecta nombres + "llegó", "salió", hora
// ══════════════════════════════════════════

function normalizar(s){
  return (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim();
}

// Palabras que identifican consumibles (nunca se devuelven)
const CONSUMIBLE_KEYWORDS = [
  'soldadura','electrodo','6011','6013','7018','7024','7016','e6011','e6013','e7018',
  'disco','discos','corte','desbaste','flap','lija','lijas',
  'gas','argon','co2','oxigeno','acetileno','propano',
  'pintura','thiner','diluyente','anticorrosivo','epoxy','imprimante',
  'grasa','aceite','lubricante','waipe','trapo','estopa',
  'boquilla','manguera','electrodo','varilla','alambre','hilo',
  'tornillo','perno','tuerca','arandela','remache','clavo',
  'cinta','masking','silicona','soldaflux','fundente'
];

// Tipos de EPP conocidos
const EPP_KEYWORDS = [
  'casco','lentes','guantes','botas','chaleco','arnes','arnez','careta',
  'mascarilla','protector','tapones','faja','rodillera','respirador',
  'escarpines','polainas','mangas','delantal'
];

// Palabras de herramientas
const HERRAMIENTA_KEYWORDS = [
  'alicate','alicates','llave','llaves','martillo','combo','cincel','buril',
  'destornillador','torquimetro','nivel','regla','flexometro','cinta metrica',
  'esmeril','esmerila','soldadora','maquina','mig','tig','plasma',
  'taladro','amoladora','pulidora','lijadora','rotomartillo',
  'engrapadora','remachadora','pistola','soplete','antorcha',
  'prensa','gata','gato','cadena','aparejo','tecle','eslinga',
  'tenaza','pinza','grampa','clamp','sargento'
];

// Palabras de asistencia
const ENTRADA_KEYWORDS = ['llego','llego','entro','entro','ingreso','ingreso','asistio','esta aqui','vino'];
const SALIDA_KEYWORDS  = ['salio','salio','se fue','termino','termino','acabo','acabo','ya se fue','salio'];

// Detecta código tipo G1, G2, A3, B12, etc.
function detectarCodigo(texto){
  const m = normalizar(texto).match(/\b([a-z]{1,2}\d{1,3})\b/);
  return m ? m[1].toUpperCase() : null;
}

// Detecta cantidad + unidad  ("1 kg", "2 kilos", "media caja", "5 unidades")
function detectarCantidad(texto){
  const t = normalizar(texto);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|gramo|gramos|litro|litros|lt|metro|metros|caja|cajas|rollo|rollos|unidad|unidades|varilla|varillas)?/);
  if(!m) return {qty:1, unidad:''};
  const unidadMap = {
    'kilo':'kg','kilos':'kg','gramo':'g','gramos':'g',
    'litro':'litro','litros':'litro','lt':'litro',
    'metro':'metro','metros':'metro',
    'caja':'caja','cajas':'caja',
    'rollo':'rollo','rollos':'rollo',
    'varilla':'unidad','varillas':'unidad',
    'unidad':'unidad','unidades':'unidad'
  };
  return {
    qty: parseFloat((m[1]||'1').replace(',','.')),
    unidad: unidadMap[m[2]] || m[2] || ''
  };
}

// Detectar trabajador por apellido, nombre o APODO
function detectarTrabajador(texto){
  const t = normalizar(texto);
  const words = t.split(' ').filter(w => w.length >= 2);

  for(const w of words){
    // 1. Buscar por apodo exacto (mayor prioridad)
    const porApodo = S.workers.find(worker => {
      const apodos = worker.apodos || [];
      return apodos.some(a => normalizar(a) === w || normalizar(a).startsWith(w));
    });
    if(porApodo) return porApodo;

    // 2. Buscar por apellido
    const porApellido = S.workers.find(worker => {
      const apellidos = normalizar(worker.apellidos || '');
      const partes = apellidos.split(' ');
      return partes.some(p => p.length >= 3 && (p === w || p.startsWith(w)));
    });
    if(porApellido) return porApellido;

    // 3. Buscar por nombre
    const porNombre = S.workers.find(worker => {
      const nombres = normalizar(worker.nombres || '');
      const partes = nombres.split(' ');
      return partes.some(p => p.length >= 3 && p === w);
    });
    if(porNombre) return porNombre;
  }
  return null;
}

// Detectar si el texto menciona un consumible conocido
function esConsumible(texto){
  const t = normalizar(texto);
  return CONSUMIBLE_KEYWORDS.some(k => t.includes(k));
}

// Detectar si menciona EPP
function esEPP(texto){
  const t = normalizar(texto);
  return EPP_KEYWORDS.some(k => t.includes(k));
}

// Detectar si menciona herramienta
function esHerramienta(texto){
  const t = normalizar(texto);
  return HERRAMIENTA_KEYWORDS.some(k => t.includes(k));
}

// Buscar activo por código, apodo, descripción
function buscarActivo(texto, tipoFiltro){
  const t = normalizar(texto);
  const words = t.split(' ').filter(w => w.length >= 2);
  const codigo = detectarCodigo(texto);
  const arr = S.activos.filter(a => tipoFiltro ? a.tipo === tipoFiltro : true);

  // 1. Por código exacto (MAQ-001, G1, etc.)
  if(codigo){
    const byCode = arr.find(a => normalizar(a.codigo).includes(codigo.toLowerCase()));
    if(byCode) return byCode;
  }

  // 2. Por apodo exacto (baby, pistola, etc.)
  for(const w of words){
    const porApodo = arr.find(a =>
      (a.apodos||[]).some(ap => normalizar(ap) === w || normalizar(ap).startsWith(w))
    );
    if(porApodo){
      // If apodo matches AND there's a codigo in the text, try to match to specific unit
      if(codigo){
        const conCodigo = arr.find(a =>
          (a.apodos||[]).some(ap => normalizar(ap) === w) &&
          normalizar(a.codigo).includes(codigo.toLowerCase())
        );
        if(conCodigo) return conCodigo;
      }
      return porApodo;
    }
  }

  // 3. Por palabras en descripción/categoría
  const scored = arr.map(a => {
    const desc = normalizar(a.desc || a.tipoepp || '');
    const cat  = normalizar(a.cat || '');
    let score = 0;
    words.forEach(w => {
      if(w.length >= 3 && desc.includes(w)) score += 2;
      if(w.length >= 3 && cat.includes(w))  score += 1;
    });
    return {a, score};
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

  return scored.length ? scored[0].a : null;
}

// Buscar consumible por código de electrodo, nombre o APODO
function buscarConsumible(texto){
  const t = normalizar(texto);
  const consumibles = S.activos.filter(a => a.tipo === 'consumible');

  // Buscar por código de electrodo (6011, 7018, etc.)
  const electrodoCod = t.match(/\b(60\d{2}|70\d{2}|e60\d{2}|e70\d{2})\b/);
  if(electrodoCod){
    const cod = electrodoCod[1].replace('e','');
    const found = consumibles.find(c => normalizar(c.desc||'').includes(cod) || normalizar(c.codigo).includes(cod));
    if(found) return found;
  }

  // Buscar por apodos del activo (mayor prioridad que descripción genérica)
  const words = t.split(' ').filter(w => w.length >= 2);
  for(const w of words){
    const porApodo = consumibles.find(c =>
      (c.apodos||[]).some(a => normalizar(a) === w || normalizar(a).startsWith(w))
    );
    if(porApodo) return porApodo;
  }

  // Buscar por palabras en descripción
  const scored = consumibles.map(c => {
    const desc = normalizar(c.desc || '');
    const cat  = normalizar(c.cat || '');
    let score = words.filter(w => w.length>=3 && (desc.includes(w)||cat.includes(w))).length;
    return {c, score};
  }).filter(x => x.score > 0).sort((a,b) => b.score - a.score);

  return scored.length ? scored[0].c : null;
}

// Verificar si un código/elemento ya fue prestado (para detectar devolución)
function yaEstaPrestado(codigo, descripcion){
  // Check by exact code in prestamos activos
  if(codigo){
    const prestamo = S.prestamos.find(p => {
      if(p.devuelto) return false;
      const activo = S.activos.find(a => a.id === p.activoId);
      return activo && normalizar(activo.codigo).includes(codigo.toLowerCase());
    });
    if(prestamo) return prestamo;
  }
  // Check by description
  if(descripcion){
    const prestamo = S.prestamos.find(p => {
      if(p.devuelto) return false;
      const activo = S.activos.find(a => a.id === p.activoId);
      return activo && normalizar(activo.desc||'').includes(normalizar(descripcion).split(' ').filter(w=>w.length>3)[0]||'zzz');
    });
    if(prestamo) return prestamo;
  }
  // Check last record in state
  if(vozState.ultimoRegistro && vozState.ultimoRegistro.tipo === 'prestamo'){
    if(codigo && vozState.ultimoRegistro.codigo && 
       normalizar(vozState.ultimoRegistro.codigo).includes(codigo.toLowerCase())){
      return {fromState: true, wid: vozState.ultimoRegistro.trabId, trabNombre: vozState.ultimoRegistro.trabNombre};
    }
  }
  return null;
}

// Verificar si un EPP ya fue entregado (para detectar devolución)
function epp_yaEntregado(tipo, codigo){
  // Check EPP state last record
  if(vozState.ultimoRegistro && vozState.ultimoRegistro.tipo === 'epp'){
    const coincideTipo = tipo && normalizar(vozState.ultimoRegistro.desc||'').includes(normalizar(tipo).split(' ')[0]);
    const coincideCod  = codigo && vozState.ultimoRegistro.codigo === codigo;
    if(coincideTipo || coincideCod){
      return { trabNombre: vozState.ultimoRegistro.trabNombre, trabId: vozState.ultimoRegistro.trabId };
    }
  }
  // Check EPP records
  if(codigo || tipo){
    const epp = S.epp.slice().reverse().find(e => {
      if(codigo) return e.codigo === codigo;
      return tipo && normalizar(e.tipo).includes(normalizar(tipo).split(' ')[0]);
    });
    if(epp) return { trabNombre: W(epp.wid).nombre, trabId: epp.wid };
  }
  return null;
}

// ══ FUNCIÓN PRINCIPAL ══
function interpretarLocalmente(texto){
  const t = normalizar(texto);
  const worker = detectarTrabajador(texto);
  const codigo = detectarCodigo(texto);
  const {qty, unidad} = detectarCantidad(texto);

  // ── 1. CONSUMIBLE → siempre consumo, nunca devolución ──
  if(esConsumible(texto)){
    const consumible = buscarConsumible(texto);
    const result = {
      accion: 'consumo',
      confianza: consumible && worker ? 'alta' : consumible ? 'media' : 'baja',
      descripcion: `Consumo: ${qty}${unidad||''} de ${consumible?.desc||'consumible'} para ${worker?.nombre||'trabajador desconocido'}`,
      aviso: null,
      datos: {
        activoId: consumible?.id,
        activoDesc: consumible?.desc,
        activoCodigo: consumible?.codigo,
        widTrabajador: worker?.id,
        nombreTrabajador: worker?.nombre,
        cantidad: qty,
        unidad: unidad || consumible?.unidad || 'kg',
        obra: extraerObra(texto)
      }
    };
    mostrarResultadoIA(result, texto);
    return;
  }

  // ── 2. EPP con código → préstamo o devolución según contexto ──
  if(esEPP(texto)){
    const tipoEPP = detectarTipoEPP(texto);
    const yaEntregado = epp_yaEntregado(tipoEPP, codigo);

    if(yaEntregado){
      // DEVOLUCIÓN
      const result = {
        accion: 'epp_devolucion',
        confianza: 'alta',
        descripcion: `Devolución EPP${codigo?' '+codigo:''} ${tipoEPP} — lo tenía ${yaEntregado.trabNombre}`,
        aviso: `Lo tenía: ${yaEntregado.trabNombre}`,
        datos: {
          tipoEPP, activoCodigo: codigo,
          widTrabajador: yaEntregado.trabId,
          nombreTrabajador: yaEntregado.trabNombre
        }
      };
      mostrarResultadoIA(result, texto);
    } else {
      // ENTREGA
      const result = {
        accion: 'epp_entrega',
        confianza: worker ? 'alta' : 'media',
        descripcion: `Entrega EPP: ${tipoEPP}${codigo?' ('+codigo+')':''} → ${worker?.nombre||'?'}`,
        aviso: null,
        datos: {
          tipoEPP,
          activoCodigo: codigo || '',
          activoDesc: tipoEPP,
          talla: detectarTalla(texto),
          widTrabajador: worker?.id,
          nombreTrabajador: worker?.nombre
        }
      };
      mostrarResultadoIA(result, texto);
    }
    return;
  }

  // ── 3. HERRAMIENTA con código → préstamo o devolución ──
  if(esHerramienta(texto) || codigo){
    const activo = buscarActivo(texto, 'herramienta') || buscarActivo(texto, 'maquinaria');
    const prestamo = yaEstaPrestado(codigo, activo?.desc);

    if(prestamo){
      // DEVOLUCIÓN
      const portador = prestamo.fromState ? prestamo.trabNombre : W(prestamo.wid).nombre;
      const result = {
        accion: 'devolucion',
        confianza: 'alta',
        descripcion: `Devolución: ${activo?.desc||codigo||'herramienta'} — lo tenía ${portador}`,
        aviso: `Lo tenía: ${portador}`,
        datos: {
          activoId: activo?.id || prestamo.activoId,
          activoDesc: activo?.desc,
          activoCodigo: codigo,
          widTrabajador: prestamo.wid || prestamo.trabId,
          nombreTrabajador: portador
        }
      };
      mostrarResultadoIA(result, texto);
    } else {
      // PRÉSTAMO
      const result = {
        accion: 'prestamo',
        confianza: worker ? (activo ? 'alta' : 'media') : 'baja',
        descripcion: `Préstamo: ${activo?.desc||codigo||'herramienta'} → ${worker?.nombre||'?'}`,
        aviso: null,
        datos: {
          activoId: activo?.id,
          activoDesc: activo?.desc || (codigo ? 'Herramienta '+codigo : texto),
          activoCodigo: codigo || activo?.codigo,
          widTrabajador: worker?.id,
          nombreTrabajador: worker?.nombre
        }
      };
      mostrarResultadoIA(result, texto);
    }
    return;
  }

  // ── 4. ASISTENCIA ──
  const esEntrada = ENTRADA_KEYWORDS.some(k => t.includes(k));
  const esSalida  = SALIDA_KEYWORDS.some(k => t.includes(k));
  if((esEntrada || esSalida) && worker){
    const hora = detectarHora(texto);
    const result = {
      accion: esEntrada ? 'asistencia_entrada' : 'asistencia_salida',
      confianza: 'alta',
      descripcion: `${esEntrada?'Entrada':'Salida'}: ${worker.nombre} a las ${hora}`,
      aviso: null,
      datos: { widTrabajador: worker.id, nombreTrabajador: worker.nombre, hora }
    };
    mostrarResultadoIA(result, texto);
    return;
  }

  // ── 5. Solo nombre de trabajador + hora → asistencia entrada ──
  if(worker && detectarHora(texto) !== nowT()){
    const hora = detectarHora(texto);
    const result = {
      accion: 'asistencia_entrada',
      confianza: 'media',
      descripcion: `Entrada: ${worker.nombre} a las ${hora}`,
      aviso: null,
      datos: { widTrabajador: worker.id, nombreTrabajador: worker.nombre, hora }
    };
    mostrarResultadoIA(result, texto);
    return;
  }

  // ── 6. No entendido ──
  mostrarResultadoIA({
    accion: 'no_entendido',
    confianza: 'baja',
    descripcion: 'No pude interpretar el comando',
    aviso: null,
    datos: { sugerencia: 'Ej: "1 kg 7018 anampa" · "alicate G2 chauca" · "pedro llego 8" · "casco M garcia"' }
  }, texto);
}

// Helpers
function extraerObra(texto){
  const t = normalizar(texto);
  const m = t.match(/(?:para|en|obra|modulo|seccion|balog|opv)\s+([a-z0-9\s]{2,20}?)(?:\s|$)/);
  return m ? m[1].trim() : '';
}

function detectarTipoEPP(texto){
  const t = normalizar(texto);
  const tipos = [
    ['casco','Casco de seguridad'],
    ['lentes','Lentes de seguridad'],
    ['guantes','Guantes de cuero'],
    ['botas','Botas de punta de acero'],
    ['chaleco','Chaleco reflectivo'],
    ['arnes','Arnés de seguridad'],['arnez','Arnés de seguridad'],
    ['careta','Careta de soldar'],
    ['mascarilla','Mascarilla respiratoria'],
    ['respirador','Mascarilla respiratoria'],
    ['protector','Protector auditivo'],
    ['tapones','Protector auditivo'],
    ['faja','Faja de seguridad'],
  ];
  for(const [kw, nombre] of tipos){
    if(t.includes(kw)) return nombre;
  }
  return 'EPP';
}

function detectarTalla(texto){
  const t = normalizar(texto);
  const m = t.match(/\b(xs|s\b|m\b|l\b|xl|xxl|\d{2})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function detectarHora(texto){
  const t = normalizar(texto);
  const m = t.match(/(?:las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|horas?)?/);
  if(!m) return nowT();
  let h = parseInt(m[1]);
  const min = m[2] ? parseInt(m[2]) : 0;
  if(t.includes('pm') && h < 12) h += 12;
  if(h < 6) h += 12; // assume PM for hours < 6
  return `${String(Math.min(h,23)).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
}


function cambiarRolUsuario(uid, nuevoRol){
  const u = S.users.find(x=>x.id==uid);
  if(!u) return;
  const rolAnterior = u.nivel;
  u.nivel = nuevoRol;
  // Also update linked worker's rol field
  if(u.wid){
    const w = S.workers.find(x=>x.id==u.wid);
    if(w) w.rol = nuevoRol;
  }
  showToast(`Rol de ${u.nombre.split(',')[0]} cambiado: ${rolAnterior} → ${nuevoRol}`);
  // Rebuild nav if current user's role changed
  if(u.id === S.user?.id){ S.user.nivel = nuevoRol; buildNav(nuevoRol); }
}

function toggleUser(id){
  const u=S.users.find(x=>x.id==id);if(!u)return;
  u.estado=u.estado==='Activo'?'Inactivo':'Activo';
  showToast(u.nombre.split(',')[0]+' '+(u.estado==='Activo'?'activado':'desactivado'));
  if(DB_MODE)_sb.update('users',{estado:u.estado},{id:u.id});
  renderUsuarios();
}

function abrirCambiarContrasena(){
  const u = S.user;
  if(!u) return;
  document.getElementById('cp-username').textContent = u.username || u.email;
  document.getElementById('cp-actual').value='';
  document.getElementById('cp-nueva').value='';
  document.getElementById('cp-confirmar').value='';
  openModal('m-cambiar-pass');
}

function guardarNuevaContrasena(){
  const actual   = document.getElementById('cp-actual').value;
  const nueva    = document.getElementById('cp-nueva').value;
  const confirm2 = document.getElementById('cp-confirmar').value;
  const u = S.users.find(x=>x.id===S.user?.id);
  if(!u){ showToast('Usuario no encontrado',false); return; }
  if(u.pass !== actual){ showToast('La contraseña actual no es correcta',false); return; }
  if(nueva.length < 4){ showToast('La nueva contraseña debe tener al menos 4 caracteres',false); return; }
  if(nueva !== confirm2){ showToast('Las contraseñas no coinciden',false); return; }
  u.pass = nueva;
  showToast('✓ Contraseña cambiada correctamente');
  closeModal('m-cambiar-pass');
}


// ══════════════════════════════════════════
// VISIÓN ARTIFICIAL / CÁMARA
// ══════════════════════════════════════════

let camStream = null;
let scanInterval = null;
let scanLog = [];
let scanActivoDetectado = null;
let fotoStream = null;
let fotoImagenB64 = null;

