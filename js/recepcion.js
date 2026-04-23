// ── UI HELPERS ──
function togglePrecioKg(){
  const panel=document.getElementById('rec-precio-panel');
  if(panel) panel.style.display=panel.style.display==='none'?'block':'none';
}

function filtrarPiezas(){
  const q=(document.getElementById('rec-buscador')?.value||'').toLowerCase().trim();
  if(!q){ renderRecepcion(true); return; }
  // Show only matching vale cards / highlight matching rows
  const vales=window.S_vales;
  document.getElementById('rec-resumen').innerHTML=''; // hide resumen while filtering
  document.getElementById('rec-vales').innerHTML=vales.map(v=>{
    const precioKg=parseFloat(document.getElementById('rec-precio-kg')?.value)||0;
    const matchVale=v.numero.toLowerCase().includes(q)||(v.obs||'').toLowerCase().includes(q)||(v.modulo||'').toLowerCase().includes(q);
    const matchPiezas=v.piezas.filter(p=>
      (p.codigo||'').toLowerCase().includes(q)||
      (p.tipo||'').toLowerCase().includes(q)||
      (p.ubic||'').toLowerCase().includes(q)
    );
    if(!matchVale&&!matchPiezas.length) return '';
    // Render card but highlight matched piezas
    const proj=S.proyectos.find(p=>p.id==v.proyectoId);
    const totalKg=v.piezas.filter(p=>p.unidad==='kg').reduce((a,p)=>a+(parseFloat(p.peso)||0),0);
    return`<div class="card" style="margin-bottom:.8rem;border:1px solid var(--gold)">
      <div style="font-size:.8rem;color:var(--muted);margin-bottom:.5rem">
        <b style="color:var(--gold)">${v.numero}</b> · ${proj?proj.nombre:'?'} ${v.modulo?'· <b>'+v.modulo+'</b>':''} · ${v.fecha}
        ${matchPiezas.length?`<span class="b b-gold" style="margin-left:6px">${matchPiezas.length} coincidencia(s)</span>`:''}
      </div>
      <table style="font-size:.78rem"><thead><tr><th>#</th><th>Código</th><th>Tipo</th><th>Peso/Cant.</th><th>Ubicación</th><th>Monto</th></tr></thead>
      <tbody>${(matchVale?v.piezas:matchPiezas).map((p,i)=>`<tr style="background:${matchPiezas.includes(p)?'rgba(240,165,0,.08)':''}">
        <td style="color:var(--muted);text-align:center">${i+1}</td>
        <td><b style="font-family:monospace;color:var(--gold)">${p.codigo||'—'}</b></td>
        <td>${p.tipo||'—'}</td>
        <td>${p.peso||'—'} ${p.unidad||'kg'}</td>
        <td style="color:var(--muted)">${p.ubic||'—'}</td>
        <td style="color:var(--green)">${p.unidad==='kg'?'S/ '+((parseFloat(p.peso)||0)*precioKg).toFixed(2):'—'}</td>
      </tr>`).join('')}</tbody></table>
    </div>`;
  }).join('')||'<div class="alert al-info">No se encontraron piezas que coincidan con "'+q+'"</div>';
}

// ── SUPABASE SYNC ──
async function syncVale(v){
  if(!DB_MODE)return;
  try{
    await _sb.upsert('vales_recepcion',[{
      id:v.id, numero:v.numero, proyecto_id:v.proyectoId, modulo:v.modulo||'',
      fecha:v.fecha, recibido_por:v.recibidoPor||'',
      obs:v.obs||'', piezas:JSON.stringify(v.piezas)
    }]);
  }catch(e){console.error('syncVale:',e.message);}
}
async function deleteValeDB(id){
  if(!DB_MODE)return;
  try{await _sb.delete('vales_recepcion',{id});}catch(e){}
}
async function loadValesFromDB(){
  if(!DB_MODE)return;
  try{
    const rows=await _sb.query('vales_recepcion',{select:'*',order:'fecha'});
    if(rows&&rows.length){
      window.S_vales=rows.map(r=>({
        id:r.id, numero:r.numero, proyectoId:r.proyecto_id, modulo:r.modulo||'',
        fecha:r.fecha, recibidoPor:r.recibido_por||'',
        obs:r.obs||'', piezas:typeof r.piezas==='string'?JSON.parse(r.piezas):r.piezas||[]
      }));
      window.S_valeIdNext=Math.max(1,...window.S_vales.map(v=>v.id))+1;
      console.log('[recepcion] Vales cargados desde Supabase:',window.S_vales.length);
    }
  }catch(e){console.error('loadValesFromDB:',e.message);}
}

// ══════════════════════════════════════
// RECEPCIÓN DE PIEZAS
// Estructura: Vales → Piezas
// Vale: { id, numero, proyecto, fecha, recibidoPor, obs, piezas:[] }
// Pieza: { id, codigo, tipo, peso, unidad, ubic, precio, obs }
// ══════════════════════════════════════

if(!window.S_vales) window.S_vales = [];
if(!window.S_valeIdNext) window.S_valeIdNext = 1;

const TIPOS_PIEZA = [
  'Plancha','Perfil L','Perfil T','Perfil H','Tubo redondo','Tubo cuadrado',
  'Barra','Ángulo','Canal U','Viga I','Platina','Perno','Tuerca','Arandela',
  'Brida','Codo','Tee','Reducción','Válvula','Otro'
];

function renderRecepcion(skipLoad){
  if(!skipLoad&&DB_MODE&&window.S_vales.length===0){loadValesFromDB().then(()=>renderRecepcion(true));return;}
  const precioKg = parseFloat(document.getElementById('rec-precio-kg')?.value)||0;
  const vales = window.S_vales;

  // Resumen
  const totalVales = vales.length;
  const totalPiezas = vales.reduce((s,v)=>s+v.piezas.length,0);
  const totalKg = vales.reduce((s,v)=>s+v.piezas.filter(p=>p.unidad==='kg').reduce((a,p)=>a+(parseFloat(p.peso)||0),0),0);
  const totalMonto = totalKg * precioKg;
  document.getElementById('rec-resumen').innerHTML = `
    <div class="sc"><div class="sc-lbl">Vales registrados</div><div class="sc-val c-blue">${totalVales}</div></div>
    <div class="sc"><div class="sc-lbl">Total piezas</div><div class="sc-val c-gold">${totalPiezas}</div></div>
    <div class="sc"><div class="sc-lbl">Peso total (kg)</div><div class="sc-val c-purple">${totalKg.toFixed(2)}</div></div>
    <div class="sc"><div class="sc-lbl">Monto estimado</div><div class="sc-val c-green">S/ ${totalMonto.toFixed(2)}</div></div>`;

  // Render each vale
  document.getElementById('rec-vales').innerHTML = vales.length
    ? vales.map(v=>renderValeCard(v,precioKg)).join('')
    : '<div class="alert al-info">No hay vales registrados. Haz clic en "+ Nuevo vale" para comenzar.</div>';
}

function renderValeCard(v, precioKg){
  const proj = S.proyectos.find(p=>p.id==v.proyectoId);
  const totalKg = v.piezas.filter(p=>p.unidad==='kg').reduce((a,p)=>a+(parseFloat(p.peso)||0),0);
  const totalMonto = totalKg * (precioKg||0);
  const filas = v.piezas.map((p,i) => `
    <tr id="pieza-${v.id}-${i}">
      <td style="color:var(--muted);font-size:.72rem;text-align:center">${i+1}</td>
      <td><input value="${p.codigo||''}" placeholder="MAT-001"
        oninput="updatePieza(${v.id},${i},'codigo',this.value)"
        style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.78rem"/></td>
      <td><select onchange="updatePieza(${v.id},${i},'tipo',this.value)"
        style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.78rem">
        ${TIPOS_PIEZA.map(t=>`<option${t===p.tipo?' selected':''}>${t}</option>`).join('')}
      </select></td>
      <td style="display:flex;gap:3px;align-items:center">
        <input type="number" value="${p.peso||''}" placeholder="0.00" step="0.01"
          oninput="updatePieza(${v.id},${i},'peso',this.value);recalcularTotales()"
          style="width:72px;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.78rem"/>
        <select onchange="updatePieza(${v.id},${i},'unidad',this.value);recalcularTotales()"
          style="padding:4px 4px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.72rem">
          <option${p.unidad==='kg'?' selected':''}>kg</option>
          <option${p.unidad==='unidad'?' selected':''}>unidad</option>
          <option${p.unidad==='metro'?' selected':''}>metro</option>
        </select>
      </td>
      <td><input value="${p.ubic||'Almacén'}" placeholder="Almacén"
        oninput="updatePieza(${v.id},${i},'ubic',this.value)"
        style="width:100%;padding:4px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.78rem"/></td>
      <td style="color:${p.unidad==='kg'?'var(--green)':'var(--muted)'};font-size:.78rem;text-align:right;white-space:nowrap">
        ${p.unidad==='kg'?'S/ '+(((parseFloat(p.peso)||0)*(precioKg||0)).toFixed(2)):'—'}
      </td>
      <td><button onclick="eliminarPieza(${v.id},${i})"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.9rem;padding:2px 6px" title="Eliminar fila">✕</button></td>
    </tr>`).join('');

  return `<div class="card" id="vale-${v.id}" style="margin-bottom:1rem">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:.8rem">
      <div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Vale</span>
          <span style="font-size:1rem;font-weight:800;color:var(--gold);font-family:monospace">${v.numero}</span>
          <span class="b b-blue">${proj?proj.nombre:'Sin proyecto'}</span>
          ${v.modulo?`<span class="b b-purple">${v.modulo}</span>`:''}
          <span style="font-size:.72rem;color:var(--muted)">📅 ${v.fecha}</span>
          <span style="font-size:.72rem;color:var(--muted)">👷 ${v.recibidoPor||'--'}</span>
        </div>
        ${v.obs?`<div style="font-size:.72rem;color:var(--muted);margin-top:3px">${v.obs}</div>`:''}
      </div>
      <div style="text-align:right">
        <div style="font-size:.72rem;color:var(--muted)">${v.piezas.length} pieza(s) · ${totalKg.toFixed(2)} kg</div>
        <div style="font-size:1rem;font-weight:700;color:var(--green)">S/ ${totalMonto.toFixed(2)}</div>
        <button onclick="eliminarVale(${v.id})" class="btn btn-d btn-sm" style="margin-top:4px;font-size:.65rem">🗑 Eliminar vale</button>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table style="min-width:560px">
        <thead><tr>
          <th style="width:28px">#</th>
          <th>Código</th>
          <th>Tipo de pieza</th>
          <th>Peso / Cant.</th>
          <th>Ubicación</th>
          <th style="text-align:right">Monto</th>
          <th style="width:28px"></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <button onclick="agregarPieza(${v.id})" class="btn btn-o btn-sm" style="margin-top:.6rem;width:100%">
      + Agregar pieza
    </button>
  </div>`;
}

function nuevoVale(){
  // Fill modal defaults
  document.getElementById('vale-numero').value='';
  document.getElementById('vale-modulo').value='';
  document.getElementById('vale-fecha').value=today();
  document.getElementById('vale-recibido').value=S.user?.nombre||'';
  document.getElementById('vale-obs').value='';
  // Fill project select
  const sel=document.getElementById('vale-proyecto');
  sel.innerHTML=S.proyectos.map(p=>`<option value="${p.id}">${p.nombre} — ${p.cliente}</option>`).join('');
  openModal('m-nuevo-vale');
}
function confirmarNuevoVale(){
  const num=document.getElementById('vale-numero').value.trim();
  if(!num){showToast('Ingresa el número de vale',false);return;}
  const proyId=parseInt(document.getElementById('vale-proyecto').value);
  if(!proyId){showToast('Selecciona un proyecto',false);return;}
  const vale={
    id:window.S_valeIdNext++,
    numero:num,
    proyectoId:proyId,
    modulo:document.getElementById('vale-modulo').value.trim(),
    fecha:document.getElementById('vale-fecha').value||today(),
    recibidoPor:document.getElementById('vale-recibido').value||S.user?.nombre||'',
    obs:document.getElementById('vale-obs').value,
    piezas:[{codigo:'',tipo:'Plancha',peso:'',unidad:'kg',ubic:'Almacén',obs:''}]
  };
  window.S_vales.unshift(vale);
  syncVale(vale);
  closeModal('m-nuevo-vale');
  renderRecepcion(true);
  setTimeout(()=>{
    highlightRow(document.getElementById('vale-'+vale.id));
    // Focus first codigo input of new vale
    document.querySelector('#vale-'+vale.id+' tbody tr input')?.focus();
  },120);
}

function agregarPieza(valeId){
  const v = window.S_vales.find(x=>x.id===valeId);if(!v)return;
  v.piezas.push({codigo:'',tipo:'Plancha',peso:'',unidad:'kg',ubic:'Almacén',obs:''});
  syncVale(v);
  renderRecepcion(true);
  // Focus last row codigo input
  setTimeout(()=>{
    const rows = document.querySelectorAll(`#vale-${valeId} tbody tr`);
    const last = rows[rows.length-1];
    if(last)last.querySelector('input')?.focus();
  },50);
}

let _syncDebounce={};
function updatePieza(valeId, idx, field, value){
  const v = window.S_vales.find(x=>x.id===valeId);if(!v||!v.piezas[idx])return;
  v.piezas[idx][field] = value;
  // Debounce sync — wait 1.5s after last change before saving
  clearTimeout(_syncDebounce[valeId]);
  _syncDebounce[valeId]=setTimeout(()=>syncVale(v),1500);
}

function eliminarPieza(valeId, idx){
  const v = window.S_vales.find(x=>x.id===valeId);if(!v)return;
  if(v.piezas.length<=1){showToast('El vale debe tener al menos 1 pieza',false);return;}
  v.piezas.splice(idx,1);
  syncVale(v);
  renderRecepcion(true);
}

function eliminarVale(id){
  if(!confirm('¿Eliminar este vale y todas sus piezas?'))return;
  const idx = window.S_vales.findIndex(x=>x.id===id);
  if(idx>=0){
    deleteValeDB(window.S_vales[idx].id);
    window.S_vales.splice(idx,1);
  }
  renderRecepcion(true);
}

function recalcularTotales(){
  renderRecepcion(true);
}
