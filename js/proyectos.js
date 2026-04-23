// ── PROYECTOS ──
function renderProyectos(){
  const q=(document.getElementById('sq-proy')?.value||'').toLowerCase();
  const arr=S.proyectos.filter(p=>!q||p.nombre.toLowerCase().includes(q)||p.cliente.toLowerCase().includes(q)||p.estado.toLowerCase().includes(q));
  const estadoColor=e=>e==='En ejecución'?'b-green':e==='Pausado'?'b-gold':e==='Completado'?'b-blue':'b-gray';
  const isAdmin=S.user?.nivel==='Admin';

  // Summary stats
  const total=S.proyectos.length;
  const enEjec=S.proyectos.filter(p=>p.estado==='En ejecución').length;
  const completados=S.proyectos.filter(p=>p.estado==='Completado').length;
  const pctPromedio=total?Math.round(S.proyectos.reduce((s,p)=>s+(p.pct||0),0)/total):0;

  const statsHtml=`<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:1.2rem">
    <div class="sc"><div class="sc-lbl">Total proyectos</div><div class="sc-val c-gold">${total}</div></div>
    <div class="sc"><div class="sc-lbl">En ejecución</div><div class="sc-val c-green">${enEjec}</div></div>
    <div class="sc"><div class="sc-lbl">Completados</div><div class="sc-val c-blue">${completados}</div></div>
    <div class="sc"><div class="sc-lbl">Avance promedio</div><div class="sc-val c-gold">${pctPromedio}%</div></div>
  </div>`;

  const cardsHtml=arr.map((p,pi)=>{
    const fases=p.fases||[];
    const fasesHtml=fases.length?fases.map((f,fi)=>`
      <div class="fase-item">
        <div class="fase-check ${f.estado==='done'?'fase-done':f.estado==='prog'?'fase-prog':'fase-pend'}">${f.estado==='done'?'✓':f.estado==='prog'?'…':String(fi+1)}</div>
        <span style="flex:1;color:${f.estado==='done'?'var(--muted)':'var(--text)'};text-decoration:${f.estado==='done'?'line-through':''}">${f.nombre}</span>
        <span style="font-size:.75rem;font-weight:700;color:${f.pct===100?'var(--green)':f.pct>0?'var(--gold)':'var(--dim)'};margin-right:8px">${f.pct}%</span>
        <div style="width:80px"><div class="pbar-wrap"><div class="pbar" style="width:${f.pct}%;background:${f.pct===100?'var(--green)':f.pct>0?'var(--gold)':'var(--bg4)'}"></div></div></div>
        ${isAdmin?`<button onclick="editarFaseRapido(${p.id},${fi})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:0 4px" title="Editar fase">✏</button>`:''}
      </div>`).join('')
    :'<div style="color:var(--muted);font-size:.78rem;padding:.5rem 0">Sin fases registradas</div>';

    // Timeline bar
    const hoy=new Date();
    const inicio=new Date(p.inicio);
    const fin=new Date(p.fin);
    const totalDias=(fin-inicio)/86400000;
    const diasPasados=(hoy-inicio)/86400000;
    const tiempoTranscurrido=Math.min(100,Math.max(0,Math.round(diasPasados/totalDias*100)));
    const diasRestantes=Math.max(0,Math.ceil((fin-hoy)/86400000));
    const atrasado=tiempoTranscurrido>p.pct&&p.estado!=='Completado';

    return`<div class="proj-card" id="proy-card-${p.id}">
      <div class="proj-header">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <div class="proj-name">${pi+1}. ${p.nombre}</div>
            <span class="b ${estadoColor(p.estado)}">${p.estado}</span>
            ${atrasado?'<span class="b b-red">⚠ Atrasado</span>':''}
            <span class="sima-badge">SIMA</span>
          </div>
          <div style="font-size:.74rem;color:var(--muted)">${p.cliente}</div>
          <div style="font-size:.74rem;color:var(--muted);margin-top:2px">📅 ${p.inicio} → ${p.fin} · ${diasRestantes} días restantes</div>
          ${p.desc||p.descripcion?`<div style="font-size:.78rem;color:var(--muted);margin-top:4px">${p.desc||p.descripcion}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="proj-pct">${p.pct}%</div>
          <div style="font-size:.65rem;color:var(--muted)">avance</div>
          ${isAdmin?`<div style="margin-top:8px;display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn-o btn-sm" onclick="editarProyecto(${p.id})">✏ Editar</button>
          </div>`:''}
        </div>
      </div>

      <!-- Barra de avance real -->
      <div style="margin-bottom:4px">
        <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);margin-bottom:3px">
          <span>Avance</span><span>${p.pct}%</span>
        </div>
        <div class="proj-bar-outer">
          <div class="proj-bar-inner" style="width:${p.pct}%"></div>
        </div>
      </div>

      <!-- Barra de tiempo transcurrido -->
      <div style="margin-bottom:1rem">
        <div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--muted);margin-bottom:3px">
          <span>Tiempo transcurrido</span><span style="color:${atrasado?'var(--red)':'var(--muted)'}">${tiempoTranscurrido}%${atrasado?' ⚠':''}</span>
        </div>
        <div class="proj-bar-outer">
          <div style="height:10px;border-radius:6px;width:${tiempoTranscurrido}%;background:${atrasado?'var(--red)':'var(--bg4)'}"></div>
        </div>
      </div>

      <!-- Fases -->
      <div style="border-top:1px solid var(--border);padding-top:.8rem">
        <div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem;font-weight:700">
          Fases (${fases.filter(f=>f.estado==='done').length}/${fases.length} completadas)
        </div>
        ${fasesHtml}
      </div>
    </div>`;
  }).join('')||'<div class="alert al-info">No se encontraron proyectos.</div>';

  document.getElementById('lista-proyectos').innerHTML=statsHtml+cardsHtml;
}

// Editar % de una fase directamente desde la tarjeta
function editarFaseRapido(proyId, faseIdx){
  const p=S.proyectos.find(x=>x.id===proyId);if(!p||!p.fases)return;
  const f=p.fases[faseIdx];if(!f)return;
  const nuevo=prompt(`Avance de "${f.nombre}" (0-100%):`, f.pct);
  if(nuevo===null)return;
  const pct=Math.min(100,Math.max(0,parseInt(nuevo)||0));
  f.pct=pct;
  f.estado=pct===100?'done':pct>0?'prog':'pend';
  // Recalculate project pct as average of fases
  p.pct=Math.round(p.fases.reduce((s,f)=>s+f.pct,0)/p.fases.length);
  if(DB_MODE)syncProyecto(p);
  renderProyectos();
  setTimeout(()=>highlightRow(document.getElementById('proy-card-'+proyId)),100);
}

// Fases dinámicas en el modal
let fasesTemp=[];
function abrirModalProyecto(){
  fasesTemp=[];
  document.getElementById('proy-id-edit').value='';
  document.getElementById('mproy-titulo').textContent='Nuevo Proyecto';
  ['proy-nombre','proy-cliente','proy-inicio','proy-fin','proy-desc'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('proy-pct').value='0';
  document.getElementById('proy-estado').value='En ejecución';
  renderFasesEdit();
  openModal('m-proyecto');
}
function editarProyecto(id){
  const p=S.proyectos.find(x=>x.id==id);if(!p)return;
  fasesTemp=(p.fases||[]).map(f=>({...f}));
  document.getElementById('proy-id-edit').value=p.id;
  document.getElementById('mproy-titulo').textContent='Editar Proyecto';
  document.getElementById('proy-nombre').value=p.nombre;
  document.getElementById('proy-cliente').value=p.cliente;
  document.getElementById('proy-inicio').value=p.inicio;
  document.getElementById('proy-fin').value=p.fin;
  document.getElementById('proy-pct').value=p.pct;
  document.getElementById('proy-estado').value=p.estado;
  document.getElementById('proy-desc').value=p.desc||p.descripcion||'';
  renderFasesEdit();
  openModal('m-proyecto');
}
function renderFasesEdit(){
  document.getElementById('fases-edit').innerHTML=fasesTemp.map((f,i)=>`
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
      <span style="color:var(--muted);font-size:.75rem;width:16px;flex-shrink:0">${i+1}</span>
      <input value="${f.nombre}" placeholder="Nombre de la fase" style="flex:1;padding:6px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem" onchange="fasesTemp[${i}].nombre=this.value"/>
      <input type="number" value="${f.pct}" min="0" max="100" style="width:60px;padding:6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem;text-align:center" onchange="fasesTemp[${i}].pct=parseInt(this.value)||0;fasesTemp[${i}].estado=fasesTemp[${i}].pct===100?'done':fasesTemp[${i}].pct>0?'prog':'pend'"/>
      <span style="font-size:.7rem;color:var(--muted)">%</span>
      <button class="btn btn-d btn-sm" onclick="fasesTemp.splice(${i},1);renderFasesEdit()">✕</button>
    </div>`).join('');
}
function agregarFase(){fasesTemp.push({nombre:'Nueva fase',pct:0,estado:'pend'});renderFasesEdit();}
function guardarProyecto(){
  const idE=document.getElementById('proy-id-edit').value;
  const pct=fasesTemp.length
    ? Math.round(fasesTemp.reduce((s,f)=>s+f.pct,0)/fasesTemp.length)
    : parseInt(document.getElementById('proy-pct').value)||0;
  const obj={
    id:idE?parseInt(idE):nids.proy++,
    nombre:document.getElementById('proy-nombre').value.trim(),
    cliente:document.getElementById('proy-cliente').value.trim(),
    inicio:document.getElementById('proy-inicio').value,
    fin:document.getElementById('proy-fin').value,
    pct,
    estado:document.getElementById('proy-estado').value,
    desc:document.getElementById('proy-desc').value,
    descripcion:document.getElementById('proy-desc').value,
    fases:fasesTemp.map(f=>({...f})),
    modulos:[],reportes:[]
  };
  if(!obj.nombre){showToast('Ingresa el nombre del proyecto',false);return;}
  if(idE){const idx=S.proyectos.findIndex(p=>p.id==idE);if(idx>=0)S.proyectos[idx]=obj;showToast('Proyecto actualizado ✓');}
  else{S.proyectos.push(obj);showToast('Proyecto '+obj.nombre+' creado ✓');}
  if(DB_MODE)syncProyecto(obj);
  closeModal('m-proyecto');
  renderProyectos();
  setTimeout(()=>highlightRow(document.getElementById('proy-card-'+obj.id)),100);
}

// ── CONFIGURACIÓN GPS ──
