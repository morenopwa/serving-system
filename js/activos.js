function tipoLabel(t){return t==='maquinaria'?'<span class="b b-blue">Máq</span>':t==='herramienta'?'<span class="b b-purple">Herr</span>':t==='epp-s'?'<span class="b b-gold">EPP</span>':t==='consumible'?'<span class="b b-teal">Cons</span>':'<span class="b b-gray">'+t+'</span>';}
function activoBadge(a){
  if(a.tipo==='maquinaria'||a.tipo==='herramienta'){const s=a.estado||'';return s==='En préstamo'?'<span class="b b-red">Prestado</span>':s==='Mantenimiento'?'<span class="b b-gold">Mant.</span>':'<span class="b b-green">Disponible</span>';}
  if(a.tipo==='epp-s'||a.tipo==='consumible'){return a.stock<=a.min?'<span class="b b-red">Stock bajo</span>':'<span class="b b-green">OK</span>';}
  return '';
}
function abrirModalActivo(id=null){
  // Reset form
  ['am-cod','am-desc','am-serie','am-notas','am-apodos','ah-cod','ah-desc','ae-cod','ae-prov','ac-cod','ac-desc','ac-prov'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  document.getElementById('act-id-edit').value=id||'';
  document.getElementById('m-activo-t').textContent=id?'Editar Activo':'Nuevo Activo';
  if(id){
    const a=S.activos.find(x=>x.id==id);if(!a)return;
    // Activate correct tab
    const tabMap={maquinaria:'maquinaria',herramienta:'herramienta','epp-s':'epp-s',consumible:'consumible'};
    const tabId=tabMap[a.tipo]||'maquinaria';
    document.querySelectorAll('#m-activo .tabs .tab').forEach(b=>{
      b.classList.toggle('active', b.onclick?.toString().includes(tabId)||b.getAttribute('onclick')?.includes(tabId));
    });
    document.querySelectorAll('[id^="act-tipo-"]').forEach(el=>el.style.display='none');
    const td=document.getElementById('act-tipo-'+tabId);if(td)td.style.display='block';
    // Fill fields
    if(a.tipo==='maquinaria'){
      document.getElementById('am-cod').value=a.codigo||'';
      document.getElementById('am-cat').value=a.cat||'';
      document.getElementById('am-desc').value=a.desc||'';
      document.getElementById('am-serie').value=a.serie||'';
      document.getElementById('am-ano').value=a.ano||'';
      document.getElementById('am-valor').value=a.valor||0;
      document.getElementById('am-mant').value=a.mantFrec||'Trimestral';
      document.getElementById('am-estado').value=a.estado||'Operativo';
      document.getElementById('am-ubic').value=a.ubic||'';
      document.getElementById('am-notas').value=a.notas||'';
      document.getElementById('am-apodos').value=(a.apodos||[]).join(', ');
    } else if(a.tipo==='herramienta'){
      document.getElementById('ah-cod').value=a.codigo||'';
      document.getElementById('ah-cat').value=a.cat||'';
      document.getElementById('ah-desc').value=a.desc||'';
      document.getElementById('ah-qty').value=a.qty||1;
      document.getElementById('ah-ubic').value=a.ubic||'';
      document.getElementById('ah-estado').value=a.estado||'Operativo';
    } else if(a.tipo==='epp-s'){
      document.getElementById('ae-cod').value=a.codigo||'';
      document.getElementById('ae-tipo').value=a.tipoepp||'';
      document.getElementById('ae-stock').value=a.stock||0;
      document.getElementById('ae-min').value=a.min||5;
      document.getElementById('ae-prov').value=a.prov||'';
    } else if(a.tipo==='consumible'){
      document.getElementById('ac-cod').value=a.codigo||'';
      document.getElementById('ac-desc').value=a.desc||'';
      document.getElementById('ac-cat').value=a.cat||'';
      document.getElementById('ac-unidad').value=a.unidad||'kg';
      document.getElementById('ac-stock').value=a.stock||0;
      document.getElementById('ac-min').value=a.min||5;
      document.getElementById('ac-prov').value=a.prov||'';
      document.getElementById('ac-precio').value=a.precio||0;
    }
  }
  openModal('m-activo');
}
function getQ(tabSuffix){
  const qmap={'todos':'sa-q','maquinaria':'sa-q','herramientas':'sa-q','epp-inv':'sa-q','consumibles':'sa-q'};
  return (document.getElementById(qmap[tabSuffix]||'sa-q')?.value||'').toLowerCase();
}
function renderActivos(tab){
  const q=getQ(tab);
  const est=document.getElementById('sa-est')?.value||'';
  let arr=S.activos;
  const typeMap={'maquinaria':'maquinaria','herramientas':'herramienta','epp-inv':'epp-s','consumibles':'consumible'};
  if(tab!=='todos')arr=arr.filter(a=>a.tipo===typeMap[tab]);
  if(q)arr=arr.filter(a=>a.codigo.toLowerCase().includes(q)||(a.desc||a.tipoepp||'').toLowerCase().includes(q)||(a.cat||'').toLowerCase().includes(q));
  if(est)arr=arr.filter(a=>a.estado===est);
  const tid=tab==='todos'?'lista-activos-todos':`lista-activos-${tab}`;
  const el=document.getElementById(tid);if(!el)return;
  const isAdmin=S.user?.nivel==='Admin';
  el.innerHTML=arr.map(a=>`<div class="asset-card" id="asset-${a.id}">
    <div style="width:52px;height:52px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;font-size:.55rem;color:var(--gold);font-family:monospace;font-weight:700;text-align:center">${a.codigo}</div>
    <div class="asset-body">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px"><span class="asset-code">${a.codigo}</span>${tipoLabel(a.tipo)}${activoBadge(a)}</div>
      <div class="asset-name">${a.desc||a.tipoepp||''}</div>
      <div class="asset-meta">
        ${a.cat?`<span>📁 ${a.cat}</span>`:''}${a.ubic?`<span>📍 ${a.ubic}</span>`:''}
        ${a.tipo==='maquinaria'?`<span>🔧 ${a.mantFrec}</span><span>S/ ${a.valor||0}</span>`:''}
        ${a.tipo==='herramienta'?`<span>Total: ${a.qty} | Disp: ${a.disponible}</span>`:''}
        ${a.tipo==='consumible'?`<span>Stock: ${a.stock} ${a.unidad}</span><span>Mín: ${a.min}</span>`:''}
        ${a.tipo==='epp-s'?`<span>Stock: ${a.stock} uds</span><span>Mín: ${a.min}</span>`:''}
      </div>
      ${a.tipo==='consumible'?`<div class="pbar-wrap"><div class="pbar" style="width:${Math.min(100,Math.round(a.stock/Math.max(a.min*2,1)*100))}%;background:${a.stock<=a.min?'var(--red)':'var(--green)'}"></div></div>`:''}
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
      <button class="btn btn-o btn-sm" onclick="verDetalleActivo(${a.id})">Ver ficha</button>
      ${isAdmin?`<button class="btn btn-o btn-sm" onclick="abrirModalActivo(${a.id})">Editar</button><button class="btn btn-d btn-sm" onclick="eliminarActivo(${a.id})">🗑</button>`:''}
    </div>
  </div>`).join('')||'<div class="alert al-info">No se encontraron activos.</div>';
}

function verDetalleActivo(id){
  const a=S.activos.find(x=>x.id==id);if(!a)return;
  const prest=S.prestamos.filter(p=>p.activoId==id);
  const mants=S.mantenimientos.filter(m=>m.activoId==id);
  const movs=S.consMov.filter(m=>m.activoId==id);
  let html=`<div class="detail-panel"><div class="dp-head">Información del activo</div>
    <div class="dp-row"><span class="k">Código</span><code>${a.codigo}</code></div>
    <div class="dp-row"><span class="k">Tipo</span>${tipoLabel(a.tipo)}</div>
    <div class="dp-row"><span class="k">Descripción</span>${a.desc||a.tipoepp||'--'}</div>
    ${a.ubic?`<div class="dp-row"><span class="k">Ubicación</span>${a.ubic}</div>`:''}
    ${a.tipo==='maquinaria'?`<div class="dp-row"><span class="k">N° Serie</span>${a.serie||'--'}</div><div class="dp-row"><span class="k">Valor</span>S/ ${a.valor||0}</div>`:''}
    ${a.tipo==='herramienta'?`<div class="dp-row"><span class="k">Cantidad</span>${a.qty} total / ${a.disponible} disponibles</div>`:''}
    ${(a.tipo==='consumible'||a.tipo==='epp-s')?`<div class="dp-row"><span class="k">Stock</span>${a.stock} / mín ${a.min}</div>`:''}
    <div class="dp-head" style="margin-top:1rem">Historial de movimientos</div>`;
  const allMovs=[
    ...prest.map(p=>({fecha:p.fecha,tipo:'Préstamo',persona:W(p.wid).nombre.split(',')[0],detalle:p.devuelto?`Devuelto ${p.devuelto}`:'En uso'})),
    ...mants.map(m=>({fecha:m.fecha,tipo:'Mantenimiento',persona:m.tecnico||'--',detalle:m.tipo+' — '+m.estado})),
    ...movs.map(m=>({fecha:m.fecha,tipo:m.tipo==='uso'?'Consumo':'Compra',persona:m.wid?W(m.wid).nombre.split(',')[0]:'--',detalle:`${m.qty} ${a.unidad||'u'}`})),
  ].sort((a,b)=>b.fecha>a.fecha?1:-1);
  html+=allMovs.length?allMovs.map(m=>`<div class="dp-row"><span class="k">${m.fecha}</span><div><b>${m.tipo}</b> · ${m.persona}<br><span style="color:var(--muted);font-size:.75rem">${m.detalle}</span></div></div>`).join(''):'<div style="color:var(--muted);font-size:.8rem;padding:.5rem 0">Sin movimientos registrados</div>';
  html+='</div>';
  document.getElementById('det-activo-body').innerHTML=html;
  openModal('m-det-activo');
}

function renderQRView(){
  const q=(document.getElementById('sq-qr')?.value||'').toLowerCase();
  const arr=S.activos.filter(a=>!q||a.codigo.toLowerCase().includes(q)||(a.desc||a.tipoepp||'').toLowerCase().includes(q));
  document.getElementById('qr-grid').innerHTML=arr.map(a=>`<div class="qr-card" onclick="genQR('${a.codigo}')"><div class="qr-code" id="qrc-${a.codigo}"></div><div class="qr-label">${a.codigo}</div><div style="font-size:.65rem;color:var(--muted);text-align:center;margin-top:2px">${(a.desc||a.tipoepp||'').slice(0,28)}</div></div>`).join('');
  arr.forEach(a=>genQR(a.codigo));
}
function genQR(code){
  const h=code.split('').reduce((a,c,i)=>((a<<5)-a+c.charCodeAt(0))|0,0);
  const el=document.getElementById('qrc-'+code);if(!el)return;
  const size=80,cells=21;const cell=Math.floor(size/cells);
  let svg=`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`;
  svg+=`<rect width="${size}" height="${size}" fill="white"/>`;
  for(let r=0;r<cells;r++)for(let c2=0;c2<cells;c2++){const on=(Math.sin(h*r+c2*7.3)*1000)%1>.35;if(on)svg+=`<rect x="${c2*cell}" y="${r*cell}" width="${cell}" height="${cell}" fill="black"/>`;}
  const fp=[[0,0],[14,0],[0,14]];fp.forEach(([x,y])=>{svg+=`<rect x="${x*cell}" y="${y*cell}" width="${7*cell}" height="${7*cell}" fill="black"/>`;svg+=`<rect x="${(x+1)*cell}" y="${(y+1)*cell}" width="${5*cell}" height="${5*cell}" fill="white"/>`;svg+=`<rect x="${(x+2)*cell}" y="${(y+2)*cell}" width="${3*cell}" height="${3*cell}" fill="black"/>`;});
  svg+='</svg>';el.innerHTML=svg;
}
function guardarActivo(){
  // Detect active modal tab by which div is visible
  const tipos=['maquinaria','herramienta','epp-s','consumible'];
  let tipo='maquinaria';
  for(const t of tipos){const el=document.getElementById('act-tipo-'+t);if(el&&el.style.display!=='none'){tipo=t;break;}}
  let obj={};const idE=document.getElementById('act-id-edit').value;
  if(tipo==='maquinaria'){
    const desc=document.getElementById('am-desc').value.trim();
    if(!desc){showToast('Ingresa la descripción',false);return;}
    obj={tipo:'maquinaria',codigo:document.getElementById('am-cod').value||`MAQ-${String(nids.act).padStart(3,'0')}`,cat:document.getElementById('am-cat').value,desc,serie:document.getElementById('am-serie').value,ano:document.getElementById('am-ano').value,valor:parseFloat(document.getElementById('am-valor').value)||0,mantFrec:document.getElementById('am-mant').value,estado:document.getElementById('am-estado').value,ubic:document.getElementById('am-ubic').value,notas:document.getElementById('am-notas').value,apodos:(document.getElementById('am-apodos')?.value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)};
  } else if(tipo==='herramienta'){
    const desc=document.getElementById('ah-desc').value.trim();
    if(!desc){showToast('Ingresa la descripción',false);return;}
    const qty=parseInt(document.getElementById('ah-qty').value)||1;
    obj={tipo:'herramienta',codigo:document.getElementById('ah-cod').value||`HER-${String(nids.act).padStart(3,'0')}`,cat:document.getElementById('ah-cat').value,desc,qty,disponible:qty,ubic:document.getElementById('ah-ubic').value,estado:document.getElementById('ah-estado').value};
  } else if(tipo==='epp-s'){
    const tipoepp=document.getElementById('ae-tipo').value;
    if(!tipoepp){showToast('Selecciona el tipo de EPP',false);return;}
    const stk=parseInt(document.getElementById('ae-stock').value)||0;
    const mn=parseInt(document.getElementById('ae-min').value)||5;
    obj={tipo:'epp-s',codigo:document.getElementById('ae-cod').value||`EPP-${String(nids.act).padStart(3,'0')}`,tipoepp,stock:stk,min:mn,prov:document.getElementById('ae-prov').value,estado:stk<=mn?'Stock bajo':'OK'};
  } else {
    const desc=document.getElementById('ac-desc').value.trim();
    if(!desc){showToast('Ingresa la descripción',false);return;}
    const stk=parseFloat(document.getElementById('ac-stock').value)||0;
    const mn=parseFloat(document.getElementById('ac-min').value)||5;
    obj={tipo:'consumible',codigo:document.getElementById('ac-cod').value||`CONS-${String(nids.act).padStart(3,'0')}`,cat:document.getElementById('ac-cat').value,desc,unidad:document.getElementById('ac-unidad').value,stock:stk,min:mn,prov:document.getElementById('ac-prov').value,precio:parseFloat(document.getElementById('ac-precio').value)||0};
  }
  let savedId;
  if(idE){
    const idx=S.activos.findIndex(a=>a.id==idE);
    if(idx>=0){obj.id=parseInt(idE);S.activos[idx]=obj;savedId=obj.id;}
    showToast('Activo actualizado');
  } else {
    obj.id=nids.act++;S.activos.push(obj);savedId=obj.id;
    showToast(`Activo ${obj.codigo} creado`);
  }
  closeModal('m-activo');
  if(DB_MODE)syncActivo(S.activos.find(a=>a.id==savedId)||{});
  renderActivos('todos');
  setTimeout(()=>highlightRow('asset-'+savedId),100);
}

function eliminarActivo(id){
  const a=S.activos.find(x=>x.id==id);if(!a)return;
  // Check if has active loans
  const prestActivo=S.prestamos.find(p=>!p.devuelto&&p.activoId===id);
  if(prestActivo){
    showToast('No se puede eliminar — está en préstamo a '+W(prestActivo.wid).nombre.split(',')[0],false);
    return;
  }
  if(!confirm('¿Eliminar '+a.codigo+' — '+(a.desc||a.tipoepp||'')+'?\nEsta acción no se puede deshacer.'))return;
  const idx=S.activos.findIndex(x=>x.id==id);
  if(idx>=0)S.activos.splice(idx,1);
  if(DB_MODE)_sb.delete('activos',{id}).catch(e=>console.error('deleteActivo:',e.message));
  showToast(a.codigo+' eliminado ✓');
  renderActivos('todos');
  // Also re-render the current active tab
  const activeTab=document.querySelector('#p-activos .tabs .tab.active');
  if(activeTab)activeTab.click();
}

function renderPrestamos(){
  const q=(document.getElementById('sq-prest')?.value||'').toLowerCase();
  const act=S.prestamos.filter(p=>!p.devuelto);
  const arr=q?act.filter(p=>A(p.activoId).codigo.toLowerCase().includes(q)||W(p.wid).nombre.toLowerCase().includes(q)):act;
  const tbody=document.getElementById('t-prest-act')||document.getElementById('t-prestamos');
  if(!tbody)return;
  tbody.innerHTML=arr.map((p,i)=>{
    const dias=Math.floor((new Date()-new Date(p.fecha))/86400000);
    return`<tr id="prest-${p.id}">
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td><code>${A(p.activoId).codigo}</code></td>
      <td>${A(p.activoId).desc||A(p.activoId).tipoepp||''}</td>
      <td>${W(p.wid).nombre.split(',')[0]}</td>
      <td>${p.fecha}</td>
      <td style="color:${dias>7?'var(--red)':'var(--muted)'};font-weight:${dias>7?'700':'400'}">${dias}d</td>
      <td>${p.resp||'--'}</td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-s btn-sm" onclick="devolver(${p.id})">✓ Devolver</button>
        <button class="btn btn-b btn-sm" onclick="reasignarPrestamo(${p.id})">↔ Prestar</button>
      </td>
    </tr>`;
  }).join('')||'<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:1rem">Sin préstamos activos</td></tr>';
  renderPrestamosHist();
}
function renderPrestamosHist(){
  const q=(document.getElementById('sq-prest-h')?.value||'').toLowerCase();
  let hist=S.prestamos.filter(p=>p.devuelto);
  if(q)hist=hist.filter(p=>A(p.activoId).codigo.toLowerCase().includes(q)||W(p.wid).nombre.toLowerCase().includes(q));
  hist.sort((a,b)=>b.devuelto>a.devuelto?1:-1);
  const el=document.getElementById('t-prest-hist');if(!el)return;
  el.innerHTML=hist.map((p,i)=>`<tr>
    <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
    <td><code>${A(p.activoId).codigo}</code></td>
    <td>${A(p.activoId).desc||A(p.activoId).tipoepp||''}</td>
    <td>${W(p.wid).nombre.split(',')[0]}</td>
    <td>${p.fecha}</td>
    <td>${p.devuelto}</td>
    <td>${p.devolucionForzada?'<span class="b b-gold" title="'+p.obs+'">Dev. forzada ⚠</span>':'<span class="b b-green">Devuelto ✓</span>'}</td>
  </tr>`).join('')||'<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:1rem">Sin historial</td></tr>';
}
function guardarPrestamo(forzar){
  forzar=forzar||false;
  const aId=parseInt(document.getElementById('p-activo').value);const wId=parseInt(document.getElementById('p-trab').value);
  const fecha=document.getElementById('p-fecha').value;const resp=document.getElementById('p-resp').value||S.user?.nombre||'';
  const obs=document.getElementById('p-obs').value;
  if(!aId||!wId){showToast('Selecciona activo y trabajador',false);return;}
  const activo=S.activos.find(a=>a.id===aId);if(!activo){showToast('Activo no encontrado',false);return;}
  if(!forzar){
    if(activo.tipo==='herramienta'){
      // For herramientas: only block if no units available — multiple loans are normal
      if(activo.disponible<=0){showToast('Sin unidades disponibles ('+activo.qty+' prestadas)',false);return;}
    } else {
      // For maquinaria: only one loan at a time
      const prestActivo=S.prestamos.find(p=>!p.devuelto&&p.activoId===aId);
      if(prestActivo){
        const who=W(prestActivo.wid).nombre.split(',')[0];
        if(!confirm(activo.codigo+' está prestado a '+who+'.\n¿Forzar devolución y registrar nuevo préstamo?'))return;
        return forzarDevolucionYPrestar(prestActivo.id);
      }
    }
  }
  const p={id:nids.prest++,activoId:aId,wid:wId,fecha:fecha.slice(0,10),resp,obs,devuelto:null};
  S.prestamos.push(p);
  if(activo.tipo==='maquinaria')activo.estado='En préstamo';
  else if(activo.tipo==='herramienta')activo.disponible--;
  S.movimientos=S.movimientos||[];
  S.movimientos.push({desc:'Préstamo '+activo.codigo,accion:'Préstamo',wid:wId,hora:nowT()});
  showToast('Préstamo registrado — '+activo.codigo+' → '+W(wId).nombre.split(',')[0]);
  if(DB_MODE){syncPrestamo(p);syncActivo(activo);}
  // Clear modal fields for next use
  document.getElementById('p-obs').value='';
  document.getElementById('p-resp').value='';
  document.getElementById('p-fecha').value=localISO();
  closeModal('m-prestamo');renderPrestamos();
  setTimeout(()=>highlightRow(document.getElementById('prest-'+p.id)),100);
}
function forzarDevolucionYPrestar(prestId){
  const p=S.prestamos.find(x=>x.id===prestId);if(!p)return;
  p.devuelto=today();p.devolucionForzada=true;p.obs=(p.obs||'')+' [Dev. forzada]';
  const a=S.activos.find(x=>x.id===p.activoId);
  if(a){if(a.tipo==='maquinaria')a.estado='Operativo';else if(a.tipo==='herramienta')a.disponible++;}
  guardarPrestamo(true);
}
function devolver(id){
  const p=S.prestamos.find(x=>x.id==id);if(!p)return;
  p.devuelto=today();
  const a=S.activos.find(x=>x.id===p.activoId);
  if(a){if(a.tipo==='maquinaria')a.estado='Operativo';else if(a.tipo==='herramienta')a.disponible++;}
  if(DB_MODE){syncDevolucion(p.id,p.devuelto);if(a)syncActivo(a);}
  showToast('Devolución registrada ✓');renderPrestamos();
}
function reasignarPrestamo(id){
  const p=S.prestamos.find(x=>x.id==id);if(!p)return;
  const activo=S.activos.find(a=>a.id===p.activoId);if(!activo)return;
  const quien=W(p.wid).nombre.split(',')[0];
  // Show inline mini-modal
  const opts=S.workers.filter(w=>w.estado==='Activo'&&w.id!==p.wid)
    .map(w=>`<option value="${w.id}">${w.nombre.split(',')[0]} (${w.cargo||'--'})</option>`).join('');
  // Inject a floating panel
  let panel=document.getElementById('reasignar-panel');
  if(!panel){panel=document.createElement('div');panel.id='reasignar-panel';document.body.appendChild(panel);}
  panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:200;background:var(--bg2);border:1px solid var(--border2);border-radius:12px;padding:1.5rem;min-width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,.5)';
  panel.innerHTML=`
    <div style="font-size:.88rem;font-weight:700;color:var(--gold);margin-bottom:.8rem">↔ Reasignar préstamo</div>
    <div style="font-size:.8rem;color:var(--muted);margin-bottom:.8rem">
      <b style="color:var(--text)">${activo.codigo}</b> — actualmente con <b style="color:var(--text)">${quien}</b>
    </div>
    <div style="font-size:.72rem;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px">Nuevo trabajador</div>
    <select id="reasignar-sel" style="width:100%;padding:9px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.83rem;margin-bottom:1rem">
      <option value="">— Selecciona trabajador —</option>${opts}
    </select>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-o" onclick="document.getElementById('reasignar-panel').remove()">Cancelar</button>
      <button class="btn btn-b" onclick="confirmarReasignar(${p.id})">↔ Reasignar</button>
    </div>`;
}
function confirmarReasignar(prestId){
  const p=S.prestamos.find(x=>x.id==prestId);if(!p)return;
  const activo=S.activos.find(a=>a.id===p.activoId);if(!activo)return;
  const nuevoWid=parseInt(document.getElementById('reasignar-sel').value);
  if(!nuevoWid){showToast('Selecciona un trabajador',false);return;}
  const nuevoW=S.workers.find(w=>w.id===nuevoWid);if(!nuevoW)return;
  const quien=W(p.wid).nombre.split(',')[0];
  // Close panel
  document.getElementById('reasignar-panel')?.remove();
  // Devolver al anterior
  p.devuelto=today();p.devolucionForzada=true;
  p.obs=(p.obs||'')+' [Reasignado → '+nuevoW.nombre.split(',')[0]+']';
  if(DB_MODE)syncDevolucion(p.id,p.devuelto);
  // Nuevo préstamo
  const nuevo={id:nids.prest++,activoId:activo.id,wid:nuevoWid,fecha:today(),
    resp:S.user?.nombre||'',obs:'Reasignado desde '+quien,devuelto:null,_isNew:true};
  S.prestamos.push(nuevo);
  if(DB_MODE){syncPrestamo(nuevo);syncActivo(activo);}
  showToast('↔ '+activo.codigo+' → '+nuevoW.nombre.split(',')[0]+' ✓');
  renderPrestamos();
  setTimeout(()=>highlightRow(document.getElementById('prest-'+nuevo.id)),100);
}

function renderMisHerramientas(){
  const wid=S.user?.wid;
  if(!wid){document.getElementById('t-mis-herr').innerHTML='<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:1rem">Usuario no vinculado a trabajador</td></tr>';return;}
  // Activos activos
  const activos=S.prestamos.filter(p=>!p.devuelto&&p.wid==wid);
  document.getElementById('t-mis-herr').innerHTML=activos.map((p,i)=>{
    const a=A(p.activoId);
    const dias=Math.floor((new Date()-new Date(p.fecha))/86400000);
    return`<tr>
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td><code>${a.codigo}</code></td>
      <td>${tipoLabel(a.tipo)}</td>
      <td>${a.desc||a.tipoepp||''}</td>
      <td>${p.fecha}</td>
      <td style="color:${dias>7?'var(--red)':'var(--muted)'};font-weight:${dias>7?700:400}">${dias}d</td>
      <td style="color:var(--muted);font-size:.78rem">${p.resp||'--'}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:1rem">No tienes préstamos activos ✓</td></tr>';
  // Historial
  const hist=document.getElementById('t-mis-herr-hist');
  if(hist){
    const devueltos=S.prestamos.filter(p=>p.devuelto&&p.wid==wid).slice().reverse();
    hist.innerHTML=devueltos.map((p,i)=>{
      const a=A(p.activoId);
      return`<tr>
        <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
        <td><code>${a.codigo}</code></td>
        <td>${tipoLabel(a.tipo)}</td>
        <td>${a.desc||a.tipoepp||''}</td>
        <td>${p.fecha}</td>
        <td>${p.devuelto}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1rem">Sin historial</td></tr>';
  }
}
