function renderSolicitudes(){updateSolBadge();
  const pend = (window.S_solicitudesPanol||[]).filter(s=>s.estado==='pendiente');
  document.getElementById('sol-pend-count').textContent = pend.length+' pendientes';
  document.getElementById('sol-pend-count').style.display = pend.length?'inline-block':'none';

  if(pend.length===0){
    document.getElementById('lista-solicitudes-panel').innerHTML='<div class="alert al-ok">Sin solicitudes pendientes. El pañol está bajo control ✓</div>';
  } else {
    document.getElementById('lista-solicitudes-panel').innerHTML = pend.map(s=>{
      const w=W(s.wid), a=A(s.activoId);
      const prestActivo=S.prestamos.find(p=>!p.devuelto&&p.activoId===s.activoId);
      const conflicto=prestActivo&&s.accion==='prestamo';
      const borderColor=conflicto?'var(--red)':'var(--border)';
      return `<div class="asset-card" style="border:1px solid ${borderColor}">
        <div style="width:52px;height:52px;background:var(--bg3);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;font-size:.65rem;color:var(--muted);text-align:center">
          <div style="font-size:1.2rem">${s.accion==='prestamo'?'📤':'📥'}</div>
          <div style="font-size:.6rem;margin-top:2px">${s.hora}</div>
        </div>
        <div class="asset-body">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px">
            <b>${w.nombre.split(',')[0]}</b>
            <span class="b ${s.accion==='prestamo'?'b-gold':'b-green'}">${s.accion==='prestamo'?'Solicita préstamo':'Devuelve'}</span>
            <code style="color:var(--gold);font-size:.72rem">${a.codigo}</code>
            ${conflicto?'<span class="b b-red">⚠ En uso</span>':''}
          </div>
          <div style="font-size:.82rem;color:var(--text)">${a.desc||a.tipoepp||''}</div>
          ${s.nota?`<div style="font-size:.75rem;color:var(--muted);margin-top:2px">Nota: ${s.nota}</div>`:''}
          ${conflicto?`<div style="font-size:.75rem;color:var(--red)">Lo tiene: ${W(prestActivo.wid).nombre.split(',')[0]} desde ${prestActivo.fecha}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
          <button class="btn btn-s btn-sm" onclick="aprobarSolicitudPanol(${s.id})">✓ Aprobar</button>
          <button class="btn btn-d btn-sm" onclick="rechazarSolicitudPanol(${s.id})">✗ Rechazar</button>
        </div>
      </div>`;
    }).join('');
  }

  // Historial
  const hist = (window.S_solicitudesPanol||[]).filter(s=>s.estado!=='pendiente');
  document.getElementById('t-sol-historial').innerHTML = hist.slice(0,30).map(s=>{
    const w=W(s.wid), a=A(s.activoId);
    const badge = s.estado==='aprobada'?'b-green':s.estado==='auto'?'b-teal':s.estado==='rechazada'?'b-red':'b-gray';
    const label = s.estado==='aprobada'?'Aprobada':s.estado==='auto'?'Automática':s.estado==='rechazada'?'Rechazada':'?';
    return`<tr><td>${s.fecha} ${s.hora}</td><td>${w.nombre.split(',')[0]}</td><td><code>${a.codigo}</code></td>
      <td><span class="b ${s.accion==='prestamo'?'b-gold':'b-green'}">${s.accion}</span></td>
      <td><span class="b ${badge}">${label}</span></td>
      <td style="color:var(--muted);font-size:.75rem">${s.nota||s.respNota||'--'}</td></tr>`;
  }).join('') || '<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1rem">Sin historial aún</td></tr>';
}

function aprobarSolicitudPanol(sid){
  const s=(window.S_solicitudesPanol||[]).find(x=>x.id===sid);
  if(!s)return;

  // Check conflict: if prestamo and still active loan on this item
  const prestActivo=S.prestamos.find(p=>!p.devuelto&&p.activoId===s.activoId);
  if(prestActivo&&s.accion==='prestamo'){
    // Force return first
    prestActivo.devuelto=today()+' '+nowT();
    prestActivo.obs=(prestActivo.obs||'')+' [Dev. forzada al aprobar solicitud pañol]';
    prestActivo.devolucionForzada=true;
    const aa=S.activos.find(x=>x.id===prestActivo.activoId);
    if(aa){if(aa.tipo==='maquinaria')aa.estado='Operativo';else if(aa.tipo==='herramienta')aa.disponible++;}
  }

  if(s.accion==='prestamo'){
    const activo=S.activos.find(a=>a.id===s.activoId);
    if(activo){
      if(activo.tipo==='maquinaria')activo.estado='En préstamo';
      else if(activo.tipo==='herramienta'&&activo.disponible>0)activo.disponible--;
    }
    S.prestamos.push({id:nids.prest++,activoId:s.activoId,wid:s.wid,
      fecha:s.fecha+' '+s.hora,resp:S.user?.nombre||'Pañol',
      obs:'Aprobado via kiosco. '+s.nota,devuelto:null});
  }

  s.estado='aprobada';
  s.respId=S.user?.id;
  showToast('✓ Solicitud aprobada: '+A(s.activoId).codigo+' → '+W(s.wid).nombre.split(',')[0]);
  renderSolicitudes();
  renderDashboard();
}

function rechazarSolicitudPanol(sid){
  const s=(window.S_solicitudesPanol||[]).find(x=>x.id===sid);
  if(!s)return;
  const motivo=prompt('Motivo del rechazo (opcional):')||'';
  s.estado='rechazada';
  s.respNota=motivo;
  s.respId=S.user?.id;
  showToast('Solicitud rechazada');
  renderSolicitudes();
}

function notificarWA_solicitudes(){
  const numero=document.getElementById('sol-wa-num')?.value?.replace(/\D/g,'')||'';
  if(!numero){showToast('Ingresa el número de WhatsApp',false);return;}
  const pend=(window.S_solicitudesPanol||[]).filter(s=>s.estado==='pendiente');
  if(!pend.length){showToast('No hay solicitudes pendientes');return;}
  let msg='*⚓ SERVING — Solicitudes del Pañol*\n'+new Date().toLocaleString('es-PE')+'\n\n';
  pend.forEach((s,i)=>{
    msg+=`${i+1}. *${W(s.wid).nombre.split(',')[0]}* → ${A(s.activoId).codigo} (${s.accion})\n`;
    if(s.nota)msg+=`   Nota: ${s.nota}\n`;
  });
  msg+=`\n_${pend.length} solicitudes pendientes de aprobación_`;
  window.open('https://wa.me/'+numero+'?text='+encodeURIComponent(msg),'_blank');
}

// ── QR PERSONAL ──
