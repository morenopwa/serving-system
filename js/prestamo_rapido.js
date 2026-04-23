// ══ REGISTRO RÁPIDO DE PRÉSTAMOS ══
let _filasPrestamo = [];
let _acFocusRow = -1;
let _acFocusField = '';
let _acSelectedIdx = -1;

function initPrestamosRapido(){
  _filasPrestamo = [];
  _agregarFila();
  renderFilasPrestamo();
}

function _agregarFila(){
  _filasPrestamo.push({activoId:null, wid:null, fecha:today(), _activoText:'', _trabText:''});
}

function agregarFilaPrestamo(){
  _agregarFila();
  renderFilasPrestamo();
  setTimeout(()=>{
    const rows = document.querySelectorAll('#t-prest-filas tr');
    rows[rows.length-1]?.querySelector('.inp-activo')?.focus();
  }, 40);
}

function renderFilasPrestamo(){
  const tbody = document.getElementById('t-prest-filas');
  if(!tbody) return;
  tbody.innerHTML = _filasPrestamo.map((f,i)=>`
    <tr id="pfila-${i}">
      <td style="color:var(--muted);font-size:.72rem;text-align:center;padding:6px 3px">${i+1}</td>
      <td style="padding:4px;position:relative">
        <input class="inp-activo" data-row="${i}" value="${esc(f._activoText)}"
          placeholder="código o nombre del activo..."
          style="width:100%;padding:7px 9px;background:${f.activoId?'rgba(57,211,83,.1)':'var(--bg3)'};border:1px solid ${f.activoId?'var(--green)':'var(--border)'};border-radius:6px;color:var(--text);font-family:inherit;font-size:.82rem;box-sizing:border-box"
          oninput="onActivo(this,${i})" onkeydown="onKeyFila(event,${i},'activo')" onfocus="onActivo(this,${i})" onblur="delayHide()"/>
        ${f.activoId?'<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--green)">✓</span>':''}
      </td>
      <td style="padding:4px;position:relative">
        <input class="inp-trab" data-row="${i}" value="${esc(f._trabText)}"
          placeholder="nombre o DNI del trabajador..."
          style="width:100%;padding:7px 9px;background:${f.wid?'rgba(57,211,83,.1)':'var(--bg3)'};border:1px solid ${f.wid?'var(--green)':'var(--border)'};border-radius:6px;color:var(--text);font-family:inherit;font-size:.82rem;box-sizing:border-box"
          oninput="onTrab(this,${i})" onkeydown="onKeyFila(event,${i},'trab')" onfocus="onTrab(this,${i})" onblur="delayHide()"/>
        ${f.wid?'<span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);color:var(--green)">✓</span>':''}
      </td>
      <td style="padding:4px">
        <input type="date" value="${f.fecha}"
          style="padding:7px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:.8rem;width:100%"
          onchange="_filasPrestamo[${i}].fecha=this.value" onkeydown="onKeyFila(event,${i},'fecha')"/>
      </td>
      <td style="padding:4px;text-align:center">
        <button onclick="eliminarFilaPrestamo(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:2px 8px" title="Quitar fila">✕</button>
      </td>
    </tr>`).join('');
}

function esc(s){ return (s||'').replace(/"/g,'&quot;'); }

let _hideTimer = null;
function delayHide(){ _hideTimer = setTimeout(()=>{ hideDrops(); }, 200); }
function cancelHide(){ clearTimeout(_hideTimer); }

// ── ACTIVO AUTOCOMPLETE ──
let _acActivoItems = [];
function onActivo(input, rowIdx){
  _acFocusRow = rowIdx;
  _acFocusField = 'activo';
  _acSelectedIdx = -1;
  const q = input.value.toLowerCase().trim();
  _filasPrestamo[rowIdx]._activoText = input.value;
  if(q.length < 1){ hideDrops(); return; }
  _acActivoItems = S.activos.filter(a=>
    (a.tipo==='maquinaria'||a.tipo==='herramienta'||a.tipo==='epp-s') &&
    (a.codigo.toLowerCase().includes(q)||(a.desc||a.tipoepp||'').toLowerCase().includes(q)||(a.apodos||[]).some(x=>x.includes(q)))
  ).slice(0,8);
  renderDrop('activo', _acActivoItems.map(a=>({
    html:`<b style="font-family:monospace;color:var(--gold);font-size:.78rem">${a.codigo}</b> <span style="font-size:.8rem">${a.desc||a.tipoepp||''}</span>`,
    sub: a.tipo==='herramienta'?`Disponibles: ${a.disponible||0}` : (a.estado||''),
    ok: a.tipo!=='herramienta'||(a.disponible||0)>0
  })), input);
}

function pickActivo(idx){
  cancelHide();
  const a = _acActivoItems[idx];
  if(!a) return;
  if(a.tipo==='herramienta'&&(a.disponible||0)<=0){ showToast(a.codigo+' sin disponibles',false); return; }
  const row = _acFocusRow;
  _filasPrestamo[row].activoId = a.id;
  _filasPrestamo[row]._activoText = a.codigo+' — '+(a.desc||a.tipoepp||'');
  hideDrops();
  renderFilasPrestamo();
  setTimeout(()=>document.querySelector(`#pfila-${row} .inp-trab`)?.focus(), 40);
}

// ── TRAB AUTOCOMPLETE ──
let _acTrabItems = [];
function onTrab(input, rowIdx){
  _acFocusRow = rowIdx;
  _acFocusField = 'trab';
  _acSelectedIdx = -1;
  const q = input.value.toLowerCase().trim();
  _filasPrestamo[rowIdx]._trabText = input.value;
  if(q.length < 1){ hideDrops(); return; }
  _acTrabItems = S.workers.filter(w=>
    w.estado==='Activo'&&(
      w.nombre.toLowerCase().includes(q)||(w.dni||'').includes(q)||
      (w.apodos||[]).some(x=>x.includes(q))||(w.cargo||'').toLowerCase().includes(q)
    )
  ).slice(0,8);
  renderDrop('trab', _acTrabItems.map(w=>({
    html:`<b style="font-size:.82rem">${w.nombre.split(',')[0]}</b>`,
    sub: (w.cargo||'')+(w.dni?' · '+w.dni:''),
    ok: true
  })), input);
}

function pickTrab(idx){
  cancelHide();
  const w = _acTrabItems[idx];
  if(!w) return;
  const row = _acFocusRow;
  _filasPrestamo[row].wid = w.id;
  _filasPrestamo[row]._trabText = w.nombre.split(',')[0]+(w.cargo?' — '+w.cargo:'');
  hideDrops();
  renderFilasPrestamo();
  setTimeout(()=>document.querySelector(`#pfila-${row} input[type=date]`)?.focus(), 40);
}

// ── DROPDOWN ──
function renderDrop(type, items, inputEl){
  const drop = document.getElementById('ac-'+type+'-drop');
  if(!drop){ return; }
  if(!items.length){ drop.style.display='none'; return; }
  const rect = inputEl.getBoundingClientRect();
  const scrollY = window.scrollY||0;
  drop.style.cssText = `display:block;position:fixed;left:${rect.left}px;top:${rect.bottom+2}px;width:${Math.max(rect.width,260)}px;z-index:400;background:var(--bg2);border:1px solid var(--border2);border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.45);max-height:240px;overflow-y:auto`;
  const fn = type==='activo'?'pickActivo':'pickTrab';
  drop.innerHTML = items.map((item,i)=>`
    <div id="ac-item-${type}-${i}" class="ac-drop-item"
      onmousedown="${fn}(${i})"
      onmouseenter="hlDrop('${type}',${i})"
      style="padding:9px 13px;cursor:pointer;border-bottom:1px solid var(--border);${!item.ok?'opacity:.5':''}">
      <div>${item.html}</div>
      ${item.sub?`<div style="font-size:.68rem;color:var(--muted);margin-top:2px">${item.sub}</div>`:''}
    </div>`).join('');
  _acSelectedIdx = -1;
}

function hlDrop(type, idx){
  document.querySelectorAll('.ac-drop-item').forEach((el,i)=>{
    el.style.background = i===idx?'var(--ni-active-bg)':'';
  });
  _acSelectedIdx = idx;
}

function hideDrops(){
  ['ac-activo-drop','ac-trab-drop'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
  _acSelectedIdx = -1;
}

// ── KEYBOARD ──
function onKeyFila(e, rowIdx, field){
  const isDropOpen = document.getElementById('ac-'+(_acFocusField===field?_acFocusField:'x')+'-drop')?.style.display==='block';
  
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    const type = field==='activo'?'activo':'trab';
    const items = type==='activo'?_acActivoItems:_acTrabItems;
    if(!items.length) return;
    _acSelectedIdx = e.key==='ArrowDown'
      ? Math.min(_acSelectedIdx+1, items.length-1)
      : Math.max(_acSelectedIdx-1, 0);
    // highlight
    document.querySelectorAll('.ac-drop-item').forEach((el,i)=>{
      el.style.background = i===_acSelectedIdx?'var(--ni-active-bg)':'';
    });
    return;
  }

  if(e.key==='Enter'){
    e.preventDefault();
    // If dropdown open and item selected → pick it
    if(_acSelectedIdx >= 0 && (document.getElementById('ac-activo-drop')?.style.display==='block'||document.getElementById('ac-trab-drop')?.style.display==='block')){
      if(field==='activo') pickActivo(_acSelectedIdx);
      else pickTrab(_acSelectedIdx);
      return;
    }
    // Otherwise advance to next cell
    if(field==='activo'){
      document.querySelector(`#pfila-${rowIdx} .inp-trab`)?.focus();
    } else if(field==='trab'){
      document.querySelector(`#pfila-${rowIdx} input[type=date]`)?.focus();
    } else if(field==='fecha'){
      if(rowIdx < _filasPrestamo.length-1){
        document.querySelector(`#pfila-${rowIdx+1} .inp-activo`)?.focus();
      } else {
        agregarFilaPrestamo();
      }
    }
    return;
  }

  if(e.key==='Escape'){ e.preventDefault(); hideDrops(); }
  if(e.key==='Tab'){ hideDrops(); }
}

function eliminarFilaPrestamo(idx){
  _filasPrestamo.splice(idx,1);
  if(!_filasPrestamo.length) _agregarFila();
  renderFilasPrestamo();
}

// ── CONFIRMAR ──
function confirmarFilasPrestamo(){
  const msg = document.getElementById('prest-rapido-msg');
  const validas = _filasPrestamo.filter(f=>f.activoId&&f.wid);
  const invalidas = _filasPrestamo.filter(f=>!f.activoId||!f.wid);
  if(!validas.length){
    showToast('Selecciona activo y trabajador en al menos una fila. Escribe y elige del desplegable.',false);
    return;
  }
  if(invalidas.length&&!confirm(`${invalidas.length} fila(s) sin activo o trabajador serán ignoradas.\n¿Registrar los ${validas.length} completos?`)) return;
  const resp = S.user?.nombre||'';
  let ok = 0;
  validas.forEach(f=>{
    const activo = S.activos.find(a=>a.id===f.activoId);
    if(!activo) return;
    if(activo.tipo==='herramienta'&&(activo.disponible||0)<=0){ showToast(activo.codigo+' sin disponibles — omitido',false); return; }
    const p={id:nids.prest++,activoId:f.activoId,wid:f.wid,fecha:f.fecha,resp,obs:'',devuelto:null,_isNew:true};
    S.prestamos.push(p);
    if(activo.tipo==='maquinaria') activo.estado='En préstamo';
    else if(activo.tipo==='herramienta') activo.disponible--;
    if(DB_MODE){ syncPrestamo(p); syncActivo(activo); }
    ok++;
  });
  showToast(`✓ ${ok} préstamo(s) registrado(s)`);
  if(msg) msg.textContent=`Último: ${ok} préstamo(s) — ${today()} ${nowT()}`;
  _filasPrestamo = [{activoId:null,wid:null,fecha:today(),_activoText:'',_trabText:''}];
  renderFilasPrestamo();
  renderPrestamos();
}

// Close on click outside
document.addEventListener('mousedown', e=>{
  if(!e.target.closest('.inp-activo')&&!e.target.closest('.inp-trab')&&!e.target.closest('.ac-drop-item')) hideDrops();
});
