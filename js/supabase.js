function setSupaStatus(msg, color){
  const el = document.getElementById('supa-status');
  if(el){ el.textContent = msg; el.style.color = color||'var(--muted)'; }
}
async function initSupabase(){
  console.log('[1/5] Iniciando conexión Supabase...');
  setSupaStatus('Conectando...','var(--gold)');
  if(!SUPA_URL||!SUPA_KEY){ DATA_READY=true; setSupaStatus('Sin credenciales','var(--red)'); return false; }
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/workers?select=id&limit=1`,
      {headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}});
    console.log('[1/5] HTTP response:', r.status);
    if(!r.ok) throw new Error('HTTP '+r.status);
    DB_MODE=true;
    setSupaStatus('✓ Conectado','var(--green)');
    console.log('[1/5] ✓ Conectado a Supabase'); return true;
  } catch(e){
    console.error('[1/5] ✗', e.message);
    DB_MODE=false; DATA_READY=true;
    setSupaStatus('✗ Sin conexión — usando datos locales','var(--red)');
    return false;
  }
}

async function loadFromSupabase(){
  if(!DB_MODE) return;
  try {
    console.log('[2/5] Cargando datos...');
    const results = await Promise.allSettled([
      _sb.query('workers',{select:'*',order:'nombre'}),
      _sb.query('users',{select:'*'}),
      _sb.query('activos',{select:'*'}),
      _sb.query('prestamos',{select:'*',order:'created_at'}),
      _sb.query('asistencia',{select:'*',order:'fecha'}),
      _sb.query('epp_entregas',{select:'*',order:'created_at'}),
      _sb.query('epp_solicitudes',{select:'*',order:'fecha'}),
      _sb.query('cons_movimientos',{select:'*',order:'created_at'}),
      _sb.query('mantenimientos',{select:'*'}),
      _sb.query('piezas_sima',{select:'*'}),
      _sb.query('sima_movimientos',{select:'*'}),
      _sb.query('proyectos',{select:'*'}),
      _sb.query('solicitudes_panol',{select:'*'}),
      _sb.query('config',{select:'*'}),
    ]);
    const names=['workers','users','activos','prestamos','asistencia','epp_entregas','epp_solicitudes',
                 'cons_movimientos','mantenimientos','piezas_sima','sima_movimientos',
                 'proyectos','solicitudes_panol','config'];
    results.forEach((r,i)=>{
      if(r.status==='fulfilled') console.log(`  ✓ ${names[i]}: ${r.value?.length||0} filas`);
      else console.error(`  ✗ ${names[i]}: ${r.reason}`);
    });
    const [workers,users,activos,prestamos,asistencia,epp,eppSols,consMov,mant,piezas,simaMov,proyectos,solicitudes,configRows]
      = results.map(r=>r.status==='fulfilled'?r.value:[]);

    if(workers&&workers.length)  S.workers  = workers.map(w=>({...w,apodos:w.apodos||[],foto:w.foto||null}));
    if(users&&users.length)      S.users    = users.map(u=>({...u,nivel:u.nivel||'Estandar',estado:u.estado||'Activo'}));
    if(activos&&activos.length)  S.activos  = activos.map(a=>({...a,desc:a.descripcion||a.desc||'',apodos:a.apodos||[],tallas:a.tallas||[]}));
    if(prestamos&&prestamos.length) S.prestamos = prestamos.map(p=>({id:p.id,activoId:p.activo_id,wid:p.wid,fecha:p.fecha,resp:p.resp,obs:p.obs||'',devuelto:p.devuelto||null}));
    if(asistencia&&asistencia.length) S.asistencia = asistencia.map(a=>({id:a.id,wid:a.wid,fecha:a.fecha,entrada:a.entrada||null,salida:a.salida||null}));
    if(epp&&epp.length)    S.epp    = epp.map(e=>({id:e.id,wid:e.wid,tipo:e.tipo,talla:e.talla||'Única',codigo:e.codigo||'',resp:e.resp,fecha:e.fecha}));
    if(eppSols&&eppSols.length) S.solicitudesEPP = eppSols.map(s=>({id:s.id,wid:s.wid,tipo:s.tipo,talla:s.talla||'',motivo:s.motivo||'',urg:s.urg||'Normal',fecha:s.fecha,estado:s.estado||'Pendiente'}));
    if(consMov&&consMov.length) S.consMov = consMov.map(m=>({id:m.id,activoId:m.activo_id,tipo:m.tipo,qty:m.qty,fecha:m.fecha,wid:m.wid,obra:m.obra||''}));
    if(mant&&mant.length)  S.mantenimientos = mant.map(m=>({id:m.id,activoId:m.activo_id,tipo:m.tipo,fecha:m.fecha,tecnico:m.tecnico,costo:m.costo||0,estado:m.estado,desc:m.detalle||m.desc||''}));
    if(piezas&&piezas.length) S.piezasSIMA = piezas;
    if(simaMov&&simaMov.length) S.simaMov = simaMov.map(m=>({id:m.id,piezaId:m.pieza_id,accion:m.accion,qty:m.qty,fecha:m.fecha,wid:m.wid,obs:m.obs||''}));
    if(proyectos&&proyectos.length) S.proyectos = proyectos.map(p=>({...p,desc:p.descripcion||p.desc||'',fases:p.fases||[],modulos:p.modulos||[],reportes:p.reportes||[]}));

    // Fallback to local if DB empty
    if(!S.users.length)   { console.warn('[2/5] Users vacíos — usando local'); S.users   = _localUsers; }
    if(!S.workers.length) { console.warn('[2/5] Workers vacíos — usando local'); S.workers = _localWorkers; }
    if(!S.activos.length) { console.warn('[2/5] Activos vacíos — usando local'); S.activos = _localActivos; }

    // Normalize
    S.workers = S.workers.map(w=>w?({...w,estado:w.estado||'Activo',apodos:w.apodos||[],foto:w.foto||null}):null).filter(Boolean);
    S.users   = S.users.map(u=>u?({...u,estado:u.estado||'Activo',nivel:u.nivel||'Estandar'}):null).filter(Boolean);
    S.activos = S.activos.map(a=>a?({...a,estado:a.estado||'Operativo',apodos:a.apodos||[]}):null).filter(Boolean);

    // Load GPS config from Supabase
    if(configRows&&configRows.length){
      const gpsCfg=configRows.find(r=>r.key==='gps');
      if(gpsCfg){try{GPS=JSON.parse(gpsCfg.value);localStorage.setItem('serving_gps',gpsCfg.value);console.log('[config] GPS cargado desde Supabase:',GPS);}catch(e){}}
    }
    // Recalculate nids from actual max IDs to avoid overwriting existing records
    if(S.asistencia.length) nids.asis = Math.max(nids.asis, ...S.asistencia.map(a=>a.id||0)) + 1;
    if(S.solicitudesEPP&&S.solicitudesEPP.length) nids.sol = Math.max(nids.sol, ...S.solicitudesEPP.map(s=>s.id||0)) + 1;
    if(S.prestamos.length)  nids.prest= Math.max(nids.prest,...S.prestamos.map(p=>p.id||0)) + 1;
    if(S.activos.length)    nids.act  = Math.max(nids.act,  ...S.activos.map(a=>a.id||0)) + 1;
    if(S.workers.length)    nids.w    = Math.max(nids.w,    ...S.workers.map(w=>w.id||0)) + 1;
    if(S.users.length)      nids.u    = Math.max(nids.u,    ...S.users.map(u=>u.id||0)) + 1;
    if(S.mantenimientos.length) nids.mant = Math.max(nids.mant,...S.mantenimientos.map(m=>m.id||0)) + 1;
    if(S.epp.length)        nids.epp  = Math.max(nids.epp,  ...S.epp.map(e=>e.id||0)) + 1;
    if(S.consMov.length)    nids.cmov = Math.max(nids.cmov, ...S.consMov.map(m=>m.id||0)) + 1;
    if(S.piezasSIMA.length) nids.sima = Math.max(nids.sima, ...S.piezasSIMA.map(p=>p.id||0)) + 1;
    if(S.simaMov.length)    nids.smov = Math.max(nids.smov, ...S.simaMov.map(m=>m.id||0)) + 1;
    if(S.proyectos.length)  nids.proy = Math.max(nids.proy, ...S.proyectos.map(p=>p.id||0)) + 1;
    console.log('[nids] Recalculados desde Supabase:', JSON.stringify(nids));
    DATA_READY = true;
    setSupaStatus('✓ Conectado — datos sincronizados','var(--green)');
    console.log('SERVING: Datos cargados desde Supabase ✓');
    const ls = document.getElementById('login-supa-status');
    if(ls&&ls.textContent.includes('ando')) ls.textContent='';
  } catch(e){
    console.error('[2/5] ✗ loadFromSupabase:', e.message);
    DATA_READY = true;
  }
}

function suscribirRealtime(){
  if(!DB_MODE) return;
  setInterval(async()=>{
    if(!DB_MODE||document.hidden) return;
    await loadFromSupabase();
    const ap=document.querySelector('.page.active');
    if(ap&&window.goPage) goPage(ap.id);
  }, 30000);
  console.log('SERVING: Sincronización automática activada (cada 30s)');
}

async function syncAsistencia(rec){
  if(!DB_MODE) return;
  try{
    // Check if record exists in Supabase - if id > loaded max, it's new → insert; else update
    if(rec._isNew){
      await _sb.insert('asistencia',[{id:rec.id,wid:rec.wid,fecha:rec.fecha,entrada:rec.entrada||null,salida:rec.salida||null,sin_gps:rec.sinGPS||false}]);
      delete rec._isNew;
    } else {
      await _sb.update('asistencia',{entrada:rec.entrada||null,salida:rec.salida||null,sin_gps:rec.sinGPS||false},{id:rec.id});
    }
  }catch(e){
    // Fallback: upsert if insert/update fails
    console.warn('syncAsistencia fallback upsert:',e.message);
    await _sb.upsert('asistencia',[{id:rec.id,wid:rec.wid,fecha:rec.fecha,entrada:rec.entrada||null,salida:rec.salida||null,sin_gps:rec.sinGPS||false}]);
  }
}
async function syncPrestamo(p){
  if(!DB_MODE) return;
  try{
    await _sb.upsert('prestamos',[{id:p.id,activo_id:p.activoId,wid:p.wid,fecha:p.fecha,resp:p.resp||'',obs:p.obs||'',devuelto:p.devuelto||null}]);
  }catch(e){console.error('syncPrestamo error:',e.message);}
}
async function syncDevolucion(prestId, fechaDevuelto){
  if(!DB_MODE) return;
  try{
    await _sb.update('prestamos',{devuelto:fechaDevuelto},{id:prestId});
  }catch(e){console.error('syncDevolucion error:',e.message);}
}
async function syncActivo(a){
  if(!DB_MODE) return;
  try{
    await _sb.upsert('activos',[{id:a.id,codigo:a.codigo,tipo:a.tipo||'',cat:a.cat||'',descripcion:a.desc||'',tipoepp:a.tipoepp||'',tallas:a.tallas||[],serie:a.serie||'',ano:a.ano||'',valor:a.valor||0,mant:a.mantFrec||'No aplica',estado:a.estado||'Operativo',ubic:a.ubic||'',notas:a.notas||'',apodos:a.apodos||[],qty:a.qty||1,disponible:a.disponible||1,stock:a.stock||0,minimo:a.min||0,unidad:a.unidad||'unidad',prov:a.prov||'',precio:a.precio||0}]);
  }catch(e){console.error('syncActivo error:',e.message);}
}
async function syncSolicitudEPP(s){
  if(!DB_MODE) return;
  try{
    if(s._isNew){
      await _sb.insert('epp_solicitudes',[{id:s.id,wid:s.wid,tipo:s.tipo,talla:s.talla||'',motivo:s.motivo||'',urg:s.urg||'Normal',fecha:s.fecha,estado:s.estado||'Pendiente'}]);
      delete s._isNew;
    } else {
      await _sb.update('epp_solicitudes',{estado:s.estado},{id:s.id});
    }
  }catch(e){console.error('syncSolicitudEPP:',e.message);}
}
async function syncEPPEntrega(e){
  if(!DB_MODE) return;
  try{
    await _sb.upsert('epp_entregas',[{id:e.id,wid:e.wid,tipo:e.tipo,talla:e.talla||'Única',codigo:e.codigo||'',resp:e.resp,fecha:e.fecha}]);
  }catch(e2){console.error('syncEPPEntrega:',e2.message);}
}
async function syncWorker(w){
  if(!DB_MODE) return;
  try{
    await _sb.upsert('workers',[{id:w.id,nombre:w.nombre,apellidos:w.apellidos||'',nombres:w.nombres||'',dni:w.dni||'',username:w.username||'',cargo:w.cargo||'',esp:w.esp||'',contrato:w.contrato||'Por hora',tarifa:w.tarifa||15,email:w.email||'',tel:w.tel||'',ingreso:w.ingreso||'',cumple:w.cumple||'',estado:w.estado||'Activo',nivel:w.nivel||'Estandar',apodos:w.apodos||[],foto:w.foto||null}]);
  }catch(e){
    console.error('syncWorker error:',e.message);
    throw e; // re-throw so caller can handle
  }
}
async function syncProyecto(p){
  if(!DB_MODE) return;
  await _sb.upsert('proyectos',[{id:p.id,nombre:p.nombre,cliente:p.cliente||'',inicio:p.inicio||'',fin:p.fin||'',pct:p.pct||0,estado:p.estado||'En ejecución',descripcion:p.desc||p.descripcion||'',fases:p.fases||[],modulos:p.modulos||[],reportes:p.reportes||[]}]);
}

function showError(titulo, detalle){
  const el=document.getElementById('error-debug-msg');
  if(el) el.textContent=titulo+'\n\n'+(typeof detalle==='object'?JSON.stringify(detalle,null,2):String(detalle));
  openModal('m-error-debug');
}

async function seedSupabase(){
  if(!DB_MODE){
    setSupaStatus('Conectando...','var(--gold)');
    showToast('Intentando conectar a Supabase...');
    const ok = await initSupabase();
    if(!ok){ showToast('No se pudo conectar a Supabase. Revisa tu conexión a internet.', false); return; }
  }
  if(!confirm('¿Subir datos a Supabase?\nEsto reemplazará todos los datos en la nube.\n\nSe crearán usuarios para todos los trabajadores con DNI como usuario y contraseña.')) return;
   showToast('Subiendo datos...');
  try {
    // ── WORKERS ──
    console.log('[seed] workers:', S.workers.length);
    await _sb.deleteAll('workers');
    await _sb.upsert('workers', S.workers.map(w=>({id:w.id,nombre:w.nombre,apellidos:w.apellidos||'',nombres:w.nombres||'',dni:w.dni||'',username:w.username||'',cargo:w.cargo||'',esp:w.esp||'',contrato:w.contrato||'Por hora',tarifa:w.tarifa||15,email:w.email||'',tel:w.tel||'',ingreso:w.ingreso||'',cumple:w.cumple||'',estado:w.estado||'Activo',nivel:w.nivel||'Estandar',apodos:w.apodos||[]})));
    console.log('[seed] ✓ workers');

    // ── USERS: admin/almacen + un usuario por trabajador (DNI como user y pass) ──
    // Deduplicar por DNI — si dos trabajadores tienen el mismo DNI, solo se crea un usuario (el primero)
    const adminUsers = [{id:0,nombre:'Admin',username:'admin',email:'admin@serving.pe',pass:'admin1234',nivel:'Admin',estado:'Activo',wid:null},{id:99,nombre:'Almacenero',username:'almacen',email:'almacen@serving.pe',pass:'almacen1234',nivel:'Estandar',estado:'Activo',wid:null}];
    const seenDni = new Set();
    const workerUsers = [];
    S.workers.filter(w=>w.dni&&w.dni.trim()).forEach(w=>{
      const dni = w.dni.trim();
      if(seenDni.has(dni)){ console.warn('[seed] DNI duplicado, omitido:', w.nombre, dni); return; }
      seenDni.add(dni);
      workerUsers.push({id: 1000+w.id, nombre:w.nombre, username:dni, email:w.email||'', pass:dni, nivel:'Lectura', estado:w.estado||'Activo', wid:w.id});
    });
    const allUsers = [...adminUsers, ...workerUsers];
    console.log('[seed] users:', allUsers.length, '(', workerUsers.length, 'trabajadores)');
    await _sb.deleteAll('users');
    // Insert in batches of 50 to avoid payload limits
    for(let i=0;i<allUsers.length;i+=50){
      const batch = allUsers.slice(i,i+50);
      await _sb.upsert('users', batch.map(u=>({id:u.id,nombre:u.nombre,username:u.username||'',email:u.email||'',pass:u.pass||'',nivel:u.nivel||'Lectura',estado:u.estado||'Activo',wid:u.wid||null})));
    }
    S.users = allUsers;
    console.log('[seed] ✓ users');

    // ── ACTIVOS ──
    console.log('[seed] activos:', S.activos.length);
    await _sb.deleteAll('activos');
    await _sb.upsert('activos', S.activos.map(a=>({id:a.id,codigo:a.codigo,tipo:a.tipo||'',cat:a.cat||'',descripcion:a.desc||'',tipoepp:a.tipoepp||'',tallas:a.tallas||[],serie:a.serie||'',ano:a.ano||'',valor:a.valor||0,mant:a.mant||'No aplica',estado:a.estado||'Operativo',ubic:a.ubic||'',notas:a.notas||'',apodos:a.apodos||[],qty:a.qty||1,disponible:a.disponible||1,stock:a.stock||0,minimo:a.min||0,unidad:a.unidad||'unidad'})));
    console.log('[seed] ✓ activos');

    // ── PROYECTOS ──
    if(S.proyectos&&S.proyectos.length){
      await _sb.deleteAll('proyectos');
      await _sb.upsert('proyectos', S.proyectos.map(p=>({id:p.id,nombre:p.nombre,cliente:p.cliente||'',inicio:p.inicio||'',fin:p.fin||'',estado:p.estado||'En ejecución',descripcion:p.desc||'',modulos:p.modulos||[],reportes:p.reportes||[]})));
      console.log('[seed] ✓ proyectos');
    }
    showToast('✓ Datos subidos — '+workerUsers.length+' usuarios creados con DNI');
    await loadFromSupabase();
  } catch(e){
    console.error('[seed] ERROR:', e);
    showError('Error al subir datos', e.message+'\n\nStack:\n'+(e.stack||''));
  }
}

