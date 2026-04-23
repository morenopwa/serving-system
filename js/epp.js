// ── ASISTENCIA ──
let locOK=false;
function esDispositivoMovil(){
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
function checkLoc(){
  const badge=document.getElementById('loc-badge');
  // If desktop/PC: skip GPS, allow marking freely
  if(!esDispositivoMovil()){
    badge.className='loc-badge loc-ok';
    badge.textContent='PC — ubicación no requerida ✓';
    locOK=true;updateRegBtn();return;
  }
  badge.className='loc-badge loc-chk';badge.textContent='Verificando GPS...';
  if(!navigator.geolocation){
    badge.className='loc-badge loc-bad';badge.textContent='GPS no disponible';
    mostrarBtnSinGPS();return;
  }
  // High accuracy + timeout + retry
  const opts={enableHighAccuracy:true,timeout:10000,maximumAge:0};
  navigator.geolocation.getCurrentPosition(pos=>{
    const acc=Math.round(pos.coords.accuracy);
    const d=Math.round(distKm(pos.coords.latitude,pos.coords.longitude,GPS.lat,GPS.lng)*1000);
    // Add accuracy margin — if phone GPS says ±50m, expand the effective check
    const efectivo=d-acc;
    if(efectivo<=GPS.radio){
      badge.className='loc-badge loc-ok';
      badge.textContent='Ubicación verificada ✓ ('+d+'m, precisión ±'+acc+'m)';
      locOK=true;updateRegBtn();
    } else {
      badge.className='loc-badge loc-bad';
      badge.textContent='Fuera de área — '+d+'m del punto de trabajo (radio: '+GPS.radio+'m)';
      locOK=false;
      document.getElementById('btn-reg').disabled=true;
    }
  },err=>{
    const msgs={1:'Permiso GPS denegado — actívalo en ajustes',2:'GPS no disponible',3:'Tiempo de espera agotado'};
    badge.className='loc-badge loc-bad';
    badge.textContent=msgs[err.code]||'Error de GPS';
    locOK=false;
    mostrarBtnSinGPS();
  },opts);
}

function mostrarBtnSinGPS(){
  // Show refresh GPS button when GPS fails
  const existing=document.getElementById('btn-refresh-gps');
  if(existing)return;
  const wrap=document.getElementById('btn-reg')?.parentElement;
  if(!wrap)return;
  const btn=document.createElement('button');
  btn.id='btn-refresh-gps';
  btn.className='btn btn-o';
  btn.style.cssText='margin-top:8px;width:100%;font-size:.78rem';
  btn.textContent='🔄 Reintentar GPS';
  btn.onclick=()=>{
    btn.remove();
    checkLoc();
  };
  wrap.appendChild(btn);
}
function distKm(a,b,c,d){const R=6371,dL=(c-a)*Math.PI/180,dO=(d-b)*Math.PI/180,x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dO/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
function updateRegBtn(){
  const hoy=today();
  let wid=S.user?.wid;
  if(!wid){
    const sel=document.getElementById('asis-trabajador-sel');
    if(sel&&sel.value) wid=parseInt(sel.value);
  }
  const rec=S.asistencia.find(a=>a.fecha===hoy&&a.wid==wid);
  const btn=document.getElementById('btn-reg'),est=document.getElementById('turno-estado');
  if(!rec){btn.textContent='▶ Marcar entrada';btn.className='reg-btn reg-in';btn.disabled=!locOK;est.textContent='';}
  else if(!rec.salida){btn.textContent='■ Marcar salida';btn.className='reg-btn reg-out';btn.disabled=!locOK;est.textContent=`Entrada: ${rec.entrada}`;}
  else{btn.textContent='✓ Jornada completada';btn.className='reg-btn';btn.disabled=true;est.textContent=`${rec.entrada} → ${rec.salida}`;}
}
function marcarAsistencia(){
  const hoy=today(),ahora=nowT();
  let wid=S.user?.wid;
  // Si el usuario no tiene trabajador vinculado, usar el selector de la página
  if(!wid){
    const sel=document.getElementById('asis-trabajador-sel');
    if(sel&&sel.value) wid=parseInt(sel.value);
    if(!wid){
      showToast('Selecciona tu nombre en la lista de abajo',false);
      if(sel)sel.style.borderColor='var(--red)';
      return;
    }
  }
  let rec=S.asistencia.find(a=>a.fecha===hoy&&a.wid==wid);
  if(!rec){
    rec={id:nids.asis++,wid,fecha:hoy,entrada:ahora,salida:null,_isNew:true};
    S.asistencia.push(rec);
    showToast('✓ Entrada registrada: '+ahora);
    if(typeof incrementAsisBadge==='function')incrementAsisBadge();
    // Programar preguntas de salida (ya hay entrada manual)
    if(typeof programarPreguntasSalida==='function') programarPreguntasSalida();
  } else if(!rec.salida){
    rec.salida=ahora;
    showToast('✓ Salida registrada: '+ahora);
    if(typeof incrementAsisBadge==='function')incrementAsisBadge();
    // Cancelar cualquier pregunta de salida pendiente
    if(typeof _notif!=='undefined'){_notif.yaPreguntoSalida=true;_notif.salidaTimers.forEach(t=>clearTimeout(t));_notif.salidaTimers=[];}
  }
  if(DB_MODE)syncAsistencia(rec);
  renderMiAsistencia();updateRegBtn();
}

// ── EDIT / DELETE ASISTENCIA (Admin) ──
function abrirEditAsistencia(id){
  const rec=S.asistencia.find(a=>a.id==id);if(!rec)return;
  document.getElementById('edit-asis-id').value=rec.id;
  document.getElementById('edit-asis-nombre').textContent=W(rec.wid).nombre;
  document.getElementById('edit-asis-fecha').textContent=rec.fecha;
  document.getElementById('edit-asis-entrada').value=rec.entrada||'';
  document.getElementById('edit-asis-salida').value=rec.salida||'';
  actualizarPreviewAsistencia();
  openModal('m-edit-asis');
}
function guardarEditAsistencia(){
  const id=document.getElementById('edit-asis-id').value;
  const rec=S.asistencia.find(a=>a.id==id);if(!rec)return;
  rec.entrada=document.getElementById('edit-asis-entrada').value||null;
  rec.salida=document.getElementById('edit-asis-salida').value||null;
  if(DB_MODE)syncAsistencia(rec);
  showToast('Asistencia actualizada ✓');
  closeModal('m-edit-asis');
  renderAsistenciaGeneral();
  renderMiAsistencia();
}
function eliminarAsistencia(){
  const id=document.getElementById('edit-asis-id').value;
  if(!confirm('¿Eliminar este registro de asistencia?'))return;
  const idx=S.asistencia.findIndex(a=>a.id==id);
  if(idx>=0)S.asistencia.splice(idx,1);
  if(DB_MODE)_sb.delete('asistencia',{id:parseInt(id)});
  showToast('Registro eliminado');
  closeModal('m-edit-asis');
  renderAsistenciaGeneral();
  renderMiAsistencia();
}
