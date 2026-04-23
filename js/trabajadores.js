// ── TRABAJADORES ──
function previewFotoTrab(input){
  const file=input.files[0];if(!file)return;
  if(file.size>2*1024*1024){showToast('Imagen muy grande (máx 2MB)',false);return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const data=e.target.result;
    document.getElementById('w-foto-data').value=data;
    const prev=document.getElementById('w-foto-preview');
    if(prev)prev.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  };
  reader.readAsDataURL(file);
}

function abrirNuevoTrabajador(){
  // Clear all fields
  document.getElementById('wid').value='';
  document.getElementById('mt-titulo').textContent='Nuevo Trabajador';
  ['nombre','dni','cargo','esp','email','tel','ingreso','cumple','apodos'].forEach(f=>{
    const el=document.getElementById('w-'+f);if(el)el.value='';
  });
  document.getElementById('w-contrato').value='Por hora';
  document.getElementById('w-tarifa').value='15';
  document.getElementById('w-estado').value='Activo';
  const prev=document.getElementById('w-foto-preview');
  if(prev)prev.innerHTML='👤';
  const fdata=document.getElementById('w-foto-data');
  if(fdata)fdata.value='';
  openModal('m-trabajador');
}

function renderTrabajadores(){
  const q=(document.getElementById('st-q')?.value||'').toLowerCase();
  const rows=S.workers.filter(w=>!q||w.nombre.toLowerCase().includes(q)||w.cargo.toLowerCase().includes(q)||(w.esp||'').toLowerCase().includes(q));
  const prox=S.workers.filter(w=>w.cumple&&diasHastaCumple(w.cumple)<=14&&w.estado==='Activo').sort((a,b)=>diasHastaCumple(a.cumple)-diasHastaCumple(b.cumple));
  const cd=document.getElementById('cumple-prox');
  if(cd)cd.innerHTML=prox.length?`<div style="background:rgba(188,140,255,.07);border:1px solid rgba(188,140,255,.25);border-radius:8px;padding:.8rem 1rem;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center"><span style="font-size:.68rem;color:var(--purple);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-right:.3rem">🎂 Próximos cumpleaños:</span>${prox.map(w=>{const d=diasHastaCumple(w.cumple);return`<span class="b b-purple">${w.nombre.split(' ')[0]} — ${d===0?'HOY 🎉':formatCumple(w.cumple)+' ('+d+'d)'}</span>`;}).join('')}</div>`:'';
  document.getElementById('t-trabajadores').innerHTML=rows.map((w,i)=>{
    const dc=w.cumple?diasHastaCumple(w.cumple):999;
    const avatar=w.foto
      ?`<img src="${w.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1px solid var(--border2)"/>`
      :`<div style="width:32px;height:32px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700;color:#fff;flex-shrink:0">${w.nombre.split(' ').map(x=>x[0]||'').join('').slice(0,2).toUpperCase()}</div>`;
    return`<tr data-id="${w.id}">
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">${avatar}<b>${w.nombre}</b></div></td>
      <td style="font-family:monospace;font-size:.78rem;color:var(--blue)">${w.dni||'--'}</td>
      <td>${w.cargo||'--'}</td>
      <td><span class="b b-gray">${w.contrato}</span></td>
      <td style="color:var(--green)">S/ ${w.tarifa}/h</td>
      <td>${w.cumple?`${formatCumple(w.cumple)}${dc<=7?` <span class="b b-purple" style="font-size:.6rem">${dc===0?'HOY':dc+'d'}</span>`:''}`:'-'}</td>
      <td><span class="b ${w.estado==='Activo'?'b-green':w.estado==='Inactivo'?'b-red':'b-gold'}">${w.estado}</span></td>
      <td><button class="btn btn-o btn-sm" onclick="editarTrab(${w.id})">Editar</button></td>
    </tr>`;
  }).join('');
}

function guardarTrabajador(){
  const idE=document.getElementById('wid').value;
  const foto=document.getElementById('w-foto-data')?.value||'';
  const d={
    nombre:document.getElementById('w-nombre').value.trim(),
    dni:document.getElementById('w-dni').value.trim(),
    cargo:document.getElementById('w-cargo').value.trim(),
    esp:document.getElementById('w-esp').value.trim(),
    contrato:document.getElementById('w-contrato').value,
    tarifa:parseFloat(document.getElementById('w-tarifa').value)||15,
    email:document.getElementById('w-email').value.trim(),
    tel:document.getElementById('w-tel').value.trim(),
    ingreso:document.getElementById('w-ingreso').value,
    cumple:document.getElementById('w-cumple').value,
    estado:document.getElementById('w-estado').value,
    apodos:(document.getElementById('w-apodos')?.value||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
  };
  if(foto)d.foto=foto;
  if(!d.nombre){showToast('Ingresa el nombre',false);return;}
  if(idE){
    const w=S.workers.find(x=>x.id==idE);
    if(w){
      if(!foto&&w.foto)d.foto=w.foto; // keep existing photo
      Object.assign(w,d);
    }
    showToast('Trabajador actualizado ✓');
    if(DB_MODE){
      syncWorker({...d,id:parseInt(idE)})
        .then(()=>console.log('[worker] Actualizado en Supabase'))
        .catch(e=>showToast('Error actualizando en Supabase: '+e.message,false));
    }
  } else {
    d.id=nids.w++;
    d.apodos=d.apodos||[];
    S.workers.push(d);
    // Sync worker to Supabase with error feedback
    if(DB_MODE){
      syncWorker(d)
        .then(()=>console.log('[worker] Guardado en Supabase: '+d.nombre))
        .catch(e=>showToast('Error guardando trabajador en Supabase: '+e.message,false));
    }
    // Auto-crear usuario con DNI
    if(d.dni){
      const existeUser=S.users.find(u=>u.username===d.dni);
      if(!existeUser){
        const nuevoUser={id:1000+d.id,nombre:d.nombre,username:d.dni,email:d.email||'',pass:d.dni,nivel:'Lectura',estado:'Activo',wid:d.id};
        S.users.push(nuevoUser);
        if(DB_MODE){
          _sb.upsert('users',[{id:nuevoUser.id,nombre:nuevoUser.nombre,username:nuevoUser.username,email:nuevoUser.email,pass:nuevoUser.pass,nivel:nuevoUser.nivel,estado:nuevoUser.estado,wid:nuevoUser.wid}])
            .then(()=>console.log('[user] Usuario creado en Supabase: '+nuevoUser.username))
            .catch(e=>showToast('Error creando usuario en Supabase: '+e.message,false));
        }
        showToast('Trabajador + usuario creados (DNI: '+d.dni+') ✓');
      } else {
        showToast('Trabajador creado ✓ (ya existe usuario con DNI '+d.dni+')');
      }
    } else {
      showToast('⚠ Sin DNI — trabajador creado sin usuario. Agrega el DNI para crear su acceso.');
    }
  }
  closeModal('m-trabajador');
  renderTrabajadores();
  setTimeout(()=>{
    const row=document.querySelector(`#t-trabajadores tr[data-id="${idE||d.id}"]`);
    highlightRow(row);
  },100);
}

function editarTrab(id){
  const w=S.workers.find(x=>x.id==id);if(!w)return;
  document.getElementById('wid').value=w.id;
  document.getElementById('mt-titulo').textContent='Editar Trabajador';
  ['nombre','dni','cargo','esp','email','tel','ingreso','cumple','apodos'].forEach(f=>{
    const el=document.getElementById('w-'+f);if(el)el.value=w[f]||(Array.isArray(w[f])?(w[f]||[]).join(', '):'');
  });
  // apodos is array
  const apEl=document.getElementById('w-apodos');
  if(apEl)apEl.value=(w.apodos||[]).join(', ');
  document.getElementById('w-contrato').value=w.contrato||'Por hora';
  document.getElementById('w-tarifa').value=w.tarifa||15;
  document.getElementById('w-estado').value=w.estado||'Activo';
  const prev=document.getElementById('w-foto-preview');
  const fdata=document.getElementById('w-foto-data');
  if(fdata)fdata.value='';
  if(prev)prev.innerHTML=w.foto?`<img src="${w.foto}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`:'👤';
  openModal('m-trabajador');
}

// ── USUARIOS ──
function renderUsuarios(){
  const q=(document.getElementById('sq-usuarios')?.value||'').toLowerCase();
  const arr=S.users.filter(u=>!q
    ||u.nombre.toLowerCase().includes(q)
    ||(u.username||'').toLowerCase().includes(q)
    ||(u.nivel||'').toLowerCase().includes(q)
  );
  const isAdmin=S.user?.nivel==='Admin';
  const niveles={'Admin':'🔑 Admin','Estandar':'🔧 Estándar','Lectura':'👁 Solo lectura'};
  document.getElementById('t-usuarios').innerHTML=arr.map((u,i)=>{
    const w=u.wid?S.workers.find(x=>x.id==u.wid):null;
    const cargo=w?.cargo||(u.id===0||u.id===99?'Sistema':'');
    const rolBadge=u.nivel==='Admin'?'b-gold':u.nivel==='Estandar'?'b-blue':'b-gray';
    const rolCell=isAdmin&&u.id!==S.user?.id
      ?`<select onchange="cambiarRolUsuario(${u.id},this.value)" style="padding:2px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.72rem">
          ${Object.entries(niveles).map(([k,v])=>`<option value="${k}"${k===u.nivel?' selected':''}>${v}</option>`).join('')}
        </select>`
      :`<span class="b ${rolBadge}">${niveles[u.nivel]||u.nivel}</span>`;
    const estadoCell=`<span class="b ${u.estado==='Activo'?'b-green':'b-red'}">${u.estado}</span>`;
    const accionCell=isAdmin&&u.id!==S.user?.id
      ?`<div style="display:flex;gap:4px">
          <button class="btn btn-o btn-sm" onclick="abrirEditarUsuario(${u.id})">✏</button>
          <button class="btn btn-o btn-sm" onclick="toggleUser(${u.id})">${u.estado==='Activo'?'Desactivar':'Activar'}</button>
        </div>`
      :'<span style="font-size:.7rem;color:var(--dim)">Sesión activa</span>';
    const tipoLabel=u.tipo&&u.tipo!=='Trabajador SERVING'?`<span class="b b-gray" style="font-size:.6rem">${u.tipo}</span>`:'';
    return`<tr id="user-row-${u.id}">
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td><b>${u.nombre.split(',')[0]}</b>${cargo?`<br><span style="color:var(--muted);font-size:.68rem">${cargo}</span>`:''}${tipoLabel?`<br>${tipoLabel}`:''}</td>
      <td style="font-family:monospace;font-size:.78rem;color:var(--gold)">${u.username||'--'}</td>
      <td>${rolCell}</td>
      <td>${estadoCell}</td>
      <td>${accionCell}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:1rem">Sin usuarios</td></tr>';
}

function abrirEditarUsuario(id){
  const u=S.users.find(x=>x.id==id);if(!u)return;
  document.getElementById('eu-id').value=u.id;
  document.getElementById('eu-nombre').value=u.nombre||'';
  document.getElementById('eu-username').value=u.username||'';
  document.getElementById('eu-pass').value='';
  document.getElementById('eu-nivel').value=u.nivel||'Lectura';
  document.getElementById('eu-estado').value=u.estado||'Activo';
  openModal('m-edit-usuario');
}
function guardarEditUsuario(){
  const id=document.getElementById('eu-id').value;
  const u=S.users.find(x=>x.id==id);if(!u)return;
  u.nombre=document.getElementById('eu-nombre').value.trim()||u.nombre;
  u.username=document.getElementById('eu-username').value.trim()||u.username;
  const newPass=document.getElementById('eu-pass').value;
  if(newPass)u.pass=newPass;
  u.nivel=document.getElementById('eu-nivel').value;
  u.estado=document.getElementById('eu-estado').value;
  if(DB_MODE)_sb.update('users',{nombre:u.nombre,username:u.username,pass:u.pass,nivel:u.nivel,estado:u.estado},{id:u.id});
  showToast('Usuario actualizado ✓');
  closeModal('m-edit-usuario');
  renderUsuarios();
  setTimeout(()=>highlightRow(document.getElementById('user-row-'+u.id)),100);
}
function selTipoUsuario(btn){
  document.querySelectorAll('.u-tipo-btn').forEach(b=>{
    b.style.borderColor='var(--border)';
    b.style.background='var(--bg3)';
    b.style.color='var(--muted)';
  });
  btn.style.borderColor='var(--gold)';
  btn.style.background='rgba(240,165,0,.12)';
  btn.style.color='var(--gold)';
  const tipo=btn.dataset.tipo;
  document.getElementById('u-tipo-hidden').value=tipo||document.getElementById('u-tipo-otro').value||'Otro';
}

function guardarUsuario(){
  const nombre=document.getElementById('u-nombre').value.trim();
  const usernameInput=document.getElementById('u-email').value.trim();
  const pass=document.getElementById('u-pass').value;
  const rolVal=document.getElementById('u-rol').value;
  const nivel=rolVal==='Admin'?'Admin':rolVal==='Estandar'?'Estandar':'Lectura';
  const tipo=document.getElementById('u-tipo-hidden')?.value||'Trabajador SERVING';
  if(!nombre||!pass){showToast('Nombre y contraseña son requeridos',false);return;}
  const username=usernameInput||nombre.toLowerCase().replace(/[\s,]+/g,'.');
  const email=usernameInput.includes('@')?usernameInput:'';
  const u={id:nids.u++,nombre,username,email,pass,nivel,estado:'Activo',wid:null,tipo};
  S.users.push(u);
  if(DB_MODE)_sb.upsert('users',[{id:u.id,nombre:u.nombre,username:u.username,email:u.email,pass:u.pass,nivel:u.nivel,estado:u.estado,wid:null,tipo:u.tipo}]);
  showToast('Usuario '+tipo+' creado ✓');
  closeModal('m-usuario');
  // Reset form for next use
  ['u-nombre','u-email','u-pass','u-tipo-otro'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('u-tipo-hidden').value='Trabajador SERVING';
  document.querySelectorAll('.u-tipo-btn').forEach((b,i)=>{
    b.style.borderColor=i===0?'var(--gold)':'var(--border)';
    b.style.background=i===0?'rgba(240,165,0,.12)':'var(--bg3)';
    b.style.color=i===0?'var(--gold)':'var(--muted)';
  });
  renderUsuarios();
}
function toggleUser(id){
  const u=S.users.find(x=>x.id==id);if(!u)return;
  u.estado=u.estado==='Activo'?'Inactivo':'Activo';
  showToast(u.nombre.split(',')[0]+' '+(u.estado==='Activo'?'activado':'desactivado'));
  if(DB_MODE)_sb.upsert('users',[{id:u.id,nombre:u.nombre,username:u.username||'',email:u.email||'',pass:u.pass||'',nivel:u.nivel||'Lectura',estado:u.estado,wid:u.wid||null}]).catch(e=>showToast('Error Supabase: '+e.message,false));
  renderUsuarios();
}
function cambiarRolUsuario(uid,nuevoNivel){
  const u=S.users.find(x=>x.id==uid);if(!u)return;
  const nombres={'Admin':'Admin','Estandar':'Estándar','Lectura':'Solo lectura'};
  u.nivel=nuevoNivel;
  showToast(u.nombre.split(',')[0]+' → '+nombres[nuevoNivel]);
  if(DB_MODE){
    // Use upsert with full record to guarantee it writes even if id mismatch
    _sb.upsert('users',[{id:u.id,nombre:u.nombre,username:u.username||'',email:u.email||'',pass:u.pass||'',nivel:nuevoNivel,estado:u.estado||'Activo',wid:u.wid||null}])
      .then(()=>console.log('[rol] Guardado en Supabase: '+u.username+' → '+nuevoNivel))
      .catch(e=>showToast('Error al guardar en Supabase: '+e.message,false));
  }
  renderUsuarios();
}
function hacerAdmin(id){
  const u=S.users.find(x=>x.id==id);if(!u)return;
  if(!confirm('¿Convertir a '+u.nombre+' en Administrador?'))return;
  u.nivel='Admin';
  if(DB_MODE)_sb.update('users',{nivel:'Admin'},{id:u.id});
  showToast(u.nombre+' es ahora Admin');
  renderUsuarios();
}
