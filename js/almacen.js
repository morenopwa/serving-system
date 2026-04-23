// ── CONSUMIBLES ──
function renderConsumibles(){
  const q=(document.getElementById('sq-consumibles')?.value||'').toLowerCase();
  const cs=S.activos.filter(a=>a.tipo==='consumible').filter(a=>!q||a.codigo.toLowerCase().includes(q)||(a.desc||'').toLowerCase().includes(q));
  document.getElementById('cs-total').textContent=S.activos.filter(a=>a.tipo==='consumible').length;
  document.getElementById('cs-bajo').textContent=S.activos.filter(a=>a.tipo==='consumible'&&a.stock<=a.min).length;
  document.getElementById('cs-movs').textContent=S.consMov.filter(m=>m.fecha===today()).length;
  document.getElementById('t-consumibles').innerHTML=cs.map((a,i)=>`<tr id="cons-${a.id}">
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td><code>${a.codigo}</code></td><td>${a.desc}</td><td>${a.unidad}</td>
    <td><b style="color:${a.stock<=a.min?'var(--red)':'var(--green)'}">${a.stock}</b></td>
    <td style="color:var(--muted)">${a.min}</td>
    <td style="width:90px"><div class="pbar-wrap"><div class="pbar" style="width:${Math.min(100,Math.round(a.stock/Math.max(a.min*2,1)*100))}%;background:${a.stock<=a.min?'var(--red)':'var(--green)'}"></div></div></td>
    <td><span class="b ${a.stock<=a.min?'b-red':'b-green'}">${a.stock<=a.min?'Reponer':'OK'}</span></td>
    <td><button class="btn btn-o btn-sm" onclick="verDetalleActivo(${a.id})">Ficha</button></td>
  </tr>`).join('');
  // Movimientos: newest first, numbered
  document.getElementById('t-cons-movs').innerHTML=S.consMov.slice().reverse().map((m,i)=>`<tr id="cmov-${m.id}">
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td>${m.fecha}</td><td><code>${A(m.activoId).codigo}</code></td>
    <td><span class="b ${m.tipo==='compra'?'b-green':'b-red'}">${m.tipo==='compra'?'Compra':'Uso'}</span></td>
    <td style="color:${m.tipo==='compra'?'var(--green)':'var(--red)'}">${m.tipo==='compra'?'+':'-'}${m.qty}</td>
    <td style="color:var(--muted)">${m.wid?W(m.wid).nombre.split(',')[0]:'--'}</td>
    <td style="color:var(--muted)">${m.obra||m.prov||'--'}</td>
  </tr>`).join('');
}
function guardarUsoConsumible(){
  const aId=parseInt(document.getElementById('cu-item').value);
  const qty=parseFloat(document.getElementById('cu-qty').value);
  const wId=parseInt(document.getElementById('cu-trab').value);
  const cons=S.activos.find(a=>a.id===aId);if(!cons)return;
  if(cons.stock<qty){showToast('Stock insuficiente (hay: '+cons.stock+')',false);return;}
  cons.stock=+(cons.stock-qty).toFixed(2);
  const mov={id:nids.cmov++,activoId:aId,tipo:'uso',qty,fecha:today(),wid:wId,obra:document.getElementById('cu-obra').value};
  S.consMov.push(mov);
  S.movimientos=S.movimientos||[];
  S.movimientos.push({desc:cons.codigo+' -'+qty,accion:'Consumo',wid:wId,hora:nowT()});
  closeModal('m-cons-uso');
  if(DB_MODE)syncActivo(cons);
  showToast('Uso registrado: -'+qty+' '+cons.unidad);
  renderConsumibles();
  setTimeout(()=>highlightRow('cmov-'+mov.id),100);
}
function guardarCompraConsumible(){
  const aId=parseInt(document.getElementById('cc-item').value);
  const qty=parseFloat(document.getElementById('cc-qty').value);
  const cons=S.activos.find(a=>a.id===aId);if(!cons)return;
  cons.stock=+(cons.stock+qty).toFixed(2);
  const mov={id:nids.cmov++,activoId:aId,tipo:'compra',qty,fecha:today(),prov:document.getElementById('cc-prov').value,precio:parseFloat(document.getElementById('cc-precio').value)||0};
  S.consMov.push(mov);
  closeModal('m-cons-compra');
  if(DB_MODE)syncActivo(cons);
  showToast('Stock actualizado: +'+qty);
  renderConsumibles();
  setTimeout(()=>highlightRow('cmov-'+mov.id),100);
}

// ── MANTENIMIENTO ──
function renderMantenimiento(){
  const q=(document.getElementById('sq-mant')?.value||'').toLowerCase();
  const pend=S.mantenimientos.filter(m=>m.estado!=='Completado')
    .filter(m=>!q||(A(m.activoId).desc||'').toLowerCase().includes(q)||A(m.activoId).codigo.toLowerCase().includes(q))
    .slice().sort((a,b)=>b.fecha>a.fecha?1:-1);
  document.getElementById('lista-mant-pend').innerHTML=pend.length?pend.map(m=>`<div class="asset-card" id="mant-${m.id}">
    <div style="width:52px;height:52px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">⚙</div>
    <div class="asset-body">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px">
        <code>${A(m.activoId).codigo}</code>
        <span class="b ${m.tipo==='Correctivo'?'b-red':'b-blue'}">${m.tipo}</span>
        <span class="b ${m.estado==='En proceso'?'b-gold':'b-gray'}">${m.estado}</span>
      </div>
      <div class="asset-name">${A(m.activoId).desc}</div>
      <div class="asset-meta"><span>📅 ${m.fecha}</span><span>👷 ${m.tecnico}</span><span>S/ ${m.costo}</span>${m.desc?`<span>${m.desc}</span>`:''}</div>
    </div>
    <button class="btn btn-s btn-sm" onclick="completarMant(${m.id})">✓ Completar</button>
  </div>`).join(''):'<div class="alert al-ok">Sin mantenimientos pendientes.</div>';
  const hist=S.mantenimientos.filter(m=>m.estado==='Completado').slice().sort((a,b)=>b.fecha>a.fecha?1:-1);
  document.getElementById('t-mant-hist').innerHTML=hist.map((m,i)=>`<tr>
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td>${A(m.activoId).desc}</td>
    <td><span class="b ${m.tipo==='Correctivo'?'b-red':'b-blue'}">${m.tipo}</span></td>
    <td>${m.fecha}</td><td>${m.tecnico}</td><td>S/ ${m.costo}</td>
    <td><span class="b b-green">Completado</span></td>
  </tr>`).join('');
}
function guardarMantenimiento(){
  const aId=parseInt(document.getElementById('mn-activo').value);
  const fecha=document.getElementById('mn-fecha').value;
  const tec=document.getElementById('mn-tecnico').value;
  if(!fecha||!tec){showToast('Completa los campos requeridos',false);return;}
  const estado=document.getElementById('mn-estado').value;
  const m={id:nids.mant++,activoId:aId,tipo:document.getElementById('mn-tipo').value,fecha,tecnico:tec,costo:parseFloat(document.getElementById('mn-costo').value)||0,estado,desc:document.getElementById('mn-desc').value};
  S.mantenimientos.push(m);
  const a=S.activos.find(x=>x.id===aId);
  if(a&&a.tipo==='maquinaria'&&estado!=='Completado')a.estado='Mantenimiento';
  closeModal('m-mant');
  showToast('Mantenimiento registrado');
  renderMantenimiento();
  setTimeout(()=>highlightRow('mant-'+m.id),100);
}
function completarMant(id){
  const m=S.mantenimientos.find(x=>x.id==id);if(!m)return;
  m.estado='Completado';
  const a=S.activos.find(x=>x.id===m.activoId);
  if(a&&a.tipo==='maquinaria')a.estado='Operativo';
  showToast('Mantenimiento completado ✓');
  renderMantenimiento();
}

// ── SIMA ──
function renderSIMA(){
  const q=(document.getElementById('sq-sima')?.value||'').toLowerCase();
  const arr=S.piezasSIMA.filter(p=>!q||p.codigo.toLowerCase().includes(q)||(p.desc||'').toLowerCase().includes(q)||(p.modulo||'').toLowerCase().includes(q));
  document.getElementById('sima-total').textContent=S.piezasSIMA.length;
  document.getElementById('sima-uso').textContent=S.piezasSIMA.filter(p=>p.estado==='En uso'||p.estado==='Instalado').length;
  document.getElementById('sima-stock').textContent=S.piezasSIMA.filter(p=>p.estado==='En almacén').length;
  const eb=e=>e==='En almacén'?'b-green':e==='En uso'?'b-gold':e==='Instalado'?'b-blue':'b-gray';
  document.getElementById('t-sima').innerHTML=arr.map((p,i)=>`<tr id="sima-row-${p.id}">
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td><code>${p.codigo}</code></td><td>${p.desc}</td>
    <td style="color:var(--muted);font-size:.78rem">${p.modulo}</td>
    <td style="text-align:center">${p.qty} ${p.unidad}</td>
    <td style="text-align:center"><b style="color:${p.disponible<p.qty?'var(--gold)':'var(--green)'}">${p.disponible}</b></td>
    <td style="color:var(--muted);font-size:.78rem">${p.ubic}</td>
    <td><span class="b ${eb(p.estado)}">${p.estado}</span></td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-o btn-sm" onclick="moverSIMA(${p.id},'Salida')">Usar</button>
      <button class="btn btn-b btn-sm" onclick="moverSIMA(${p.id},'Entrada')">+</button>
    </td>
  </tr>`).join('')||'<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:1rem">Sin piezas SIMA registradas</td></tr>';
  document.getElementById('t-sima-movs').innerHTML=S.simaMov.slice().reverse().map((m,i)=>{
    const p=S.piezasSIMA.find(x=>x.id==m.piezaId)||{codigo:'?'};
    return`<tr id="smov-${m.id}">
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td>${m.fecha}</td><td><code>${p.codigo}</code></td>
      <td><span class="b ${m.accion==='Entrada'?'b-green':'b-gold'}">${m.accion}</span></td>
      <td>${m.accion==='Entrada'?'+':'-'}${m.qty}</td>
      <td>${W(m.wid).nombre.split(',')[0]}</td>
      <td style="color:var(--muted);font-size:.78rem">${m.obs||'--'}</td>
    </tr>`;
  }).join('');
}
function guardarPiezaSIMA(){
  const idE=document.getElementById('sima-id-edit').value;
  const qty=parseInt(document.getElementById('si-qty').value)||1;
  const obj={id:idE?parseInt(idE):nids.sima++,codigo:document.getElementById('si-cod').value||`SIMA-${String(nids.sima).padStart(3,'0')}`,desc:document.getElementById('si-desc').value,modulo:document.getElementById('si-mod').value,cat:document.getElementById('si-cat').value,qty,disponible:qty,unidad:document.getElementById('si-unidad').value,fecha:document.getElementById('si-fecha').value||today(),ubic:document.getElementById('si-ubic').value,almac:document.getElementById('si-almac').value,estado:document.getElementById('si-estado').value,obs:document.getElementById('si-obs').value,apodos:[]};
  if(!obj.desc){showToast('Ingresa la descripción',false);return;}
  if(idE){const idx=S.piezasSIMA.findIndex(p=>p.id==idE);if(idx>=0)S.piezasSIMA[idx]=obj;showToast('Pieza actualizada ✓');}
  else{
    S.piezasSIMA.push(obj);
    const mov={id:nids.smov++,piezaId:obj.id,accion:'Entrada',qty,fecha:today(),wid:S.user?.wid||0,obs:'Registro inicial'};
    S.simaMov.push(mov);
    S.movimientos=S.movimientos||[];
    S.movimientos.push({desc:'SIMA '+obj.codigo,accion:'SIMA',wid:S.user?.wid||0,hora:nowT()});
    showToast('Pieza '+obj.codigo+' registrada ✓');
  }
  closeModal('m-sima');
  if(DB_MODE)syncActivo(obj);
  renderSIMA();
  setTimeout(()=>highlightRow('sima-row-'+obj.id),100);
}
function moverSIMA(id,tipo){
  const p=S.piezasSIMA.find(x=>x.id==id);if(!p)return;
  const qty=parseInt(prompt('Cantidad a '+(tipo==='Salida'?'retirar':'reponer')+' (disponible: '+p.disponible+'):', '1'))||0;
  if(!qty||qty<=0)return;
  if(tipo==='Salida'&&qty>p.disponible){showToast('Cantidad supera el disponible',false);return;}
  p.disponible=tipo==='Entrada'?p.disponible+qty:p.disponible-qty;
  if(tipo==='Salida')p.estado='En uso';
  const obs=prompt('Observación / obra:','')||'';
  const mov={id:nids.smov++,piezaId:id,accion:tipo,qty,fecha:today(),wid:S.user?.wid||0,obs};
  S.simaMov.push(mov);
  S.movimientos=S.movimientos||[];
  S.movimientos.push({desc:'SIMA '+p.codigo+' '+tipo.toLowerCase(),accion:'SIMA',wid:S.user?.wid||0,hora:nowT()});
  showToast(tipo+' registrada: '+(tipo==='Entrada'?'+':'-')+qty);
  renderSIMA();
  setTimeout(()=>highlightRow('smov-'+mov.id),100);
}

// ── EPP ──
function renderEPP(){updateEPPBadge();
  const qs=(document.getElementById('sq-epp-sol')?.value||'').toLowerCase();
  const qe=(document.getElementById('sq-epp-ent')?.value||'').toLowerCase();
  const pend=S.solicitudesEPP.filter(s=>s.estado==='Pendiente').filter(s=>!qs||W(s.wid).nombre.toLowerCase().includes(qs)||s.tipo.toLowerCase().includes(qs));
  document.getElementById('lista-sol-epp').innerHTML=pend.length?pend.map(s=>`<div class="asset-card" id="epp-sol-${s.id}">
    <div style="width:52px;height:52px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">⬢</div>
    <div class="asset-body">
      <div class="asset-name">${W(s.wid).nombre} — ${s.tipo}</div>
      <div class="asset-meta"><span>Talla: ${s.talla}</span><span>Motivo: ${s.motivo}</span><span>${s.fecha}</span><span class="b ${s.urg==='Urgente'?'b-red':'b-blue'}">${s.urg}</span></div>
    </div>
    <div style="display:flex;gap:5px;flex-direction:column;flex-shrink:0">
      <button class="btn btn-s btn-sm" onclick="aprobarEPP(${s.id})">Aprobar</button>
      <button class="btn btn-d btn-sm" onclick="rechazarEPP(${s.id})">Rechazar</button>
    </div>
  </div>`).join(''):'<div class="alert al-ok">Sin solicitudes pendientes.</div>';
  const eppFiltrado=S.epp.slice().reverse().filter(e=>!qe||W(e.wid).nombre.toLowerCase().includes(qe)||e.tipo.toLowerCase().includes(qe));
  document.getElementById('t-epp-ent').innerHTML=eppFiltrado.map((e,i)=>`<tr id="epp-row-${e.id}">
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td>${W(e.wid).nombre.split(',')[0]}</td><td>${e.tipo}</td><td>${e.fecha}</td><td>${e.talla}</td><td>${e.resp}</td>
  </tr>`).join('');
  const byW={};S.epp.forEach(e=>{if(!byW[e.wid])byW[e.wid]=[];byW[e.wid].push(e);});
  document.getElementById('aud-epp-content').innerHTML=Object.keys(byW).map(wid=>`<div class="card"><div class="ctitle">${W(parseInt(wid)).nombre} <span class="b b-teal" style="margin-left:8px">${byW[wid].length} EPP</span></div><table><thead><tr><th>EPP</th><th>Fecha</th><th>Talla</th><th>Entregado por</th></tr></thead><tbody>${byW[wid].map(e=>`<tr><td>${e.tipo}</td><td>${e.fecha}</td><td>${e.talla}</td><td>${e.resp}</td></tr>`).join('')}</tbody></table></div>`).join('');
}
function guardarEPP(){
  const wId=parseInt(document.getElementById('ea-trab').value);
  const resp=document.getElementById('ea-resp').value;
  if(!resp){showToast('Indica quién entrega',false);return;}
  const e={id:nids.epp++,wid:wId,tipo:document.getElementById('ea-tipo').value,talla:document.getElementById('ea-talla').value,resp,fecha:today()};
  S.epp.push(e);
  if(DB_MODE)syncEPPEntrega(e);
  closeModal('m-epp-asig');
  showToast('EPP registrado ✓');
  renderEPP();
  setTimeout(()=>highlightRow('epp-row-'+e.id),100);
}
function aprobarEPP(id){
  const s=S.solicitudesEPP.find(x=>x.id==id);if(!s)return;
  s.estado='Aprobado';
  const e={id:nids.epp++,wid:s.wid,tipo:s.tipo,talla:s.talla,resp:'Aprobado vía sistema',fecha:today()};
  S.epp.push(e);
  if(DB_MODE){syncSolicitudEPP(s);syncEPPEntrega(e);}
  updateEPPBadge();
  showToast('EPP aprobado ✓');
  renderEPP();
  setTimeout(()=>highlightRow('epp-row-'+e.id),100);
}
function rechazarEPP(id){
  const s=S.solicitudesEPP.find(x=>x.id==id);if(s){s.estado='Rechazado';if(DB_MODE)syncSolicitudEPP(s);}
  updateEPPBadge();
  showToast('Solicitud rechazada');renderEPP();
}
function renderMiEPP(){
  const wid=S.user?.wid;
  document.getElementById('t-mis-epp').innerHTML=S.epp.filter(e=>e.wid==wid).slice().reverse().map((e,i)=>`<tr>
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td>${e.tipo}</td><td>${e.fecha}</td><td>${e.talla}</td>
    <td><span class="b b-green">Entregado</span></td>
  </tr>`).join('')||'<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:1rem">Sin EPP registrado</td></tr>';
}
function enviarSolicitudEPP(){
  const wid=S.user?.wid;
  if(!wid){showToast('Usuario no vinculado a trabajador',false);return;}
  const talla=document.getElementById('ss-talla').value;
  if(!talla){showToast('Indica la talla',false);return;}
  const newSol={id:nids.sol++,wid,tipo:document.getElementById('ss-tipo').value,talla,motivo:document.getElementById('ss-motivo').value,urg:document.getElementById('ss-urg').value,fecha:today(),estado:'Pendiente',_isNew:true};
  S.solicitudesEPP.push(newSol);
  if(DB_MODE)syncSolicitudEPP(newSol);
  updateEPPBadge();
  showToast('Solicitud enviada ✓');renderMiEPP();
}
