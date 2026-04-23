// ── DASHBOARD ──
function renderDashboard(){
  document.getElementById('dash-fecha').textContent=new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  document.getElementById('ds-activos').textContent=S.activos.length;
  document.getElementById('ds-prestamos').textContent=S.prestamos.filter(p=>!p.devuelto).length;
  document.getElementById('ds-sima').textContent=S.piezasSIMA.length;
  const hoy=today();
  document.getElementById('ds-asis').textContent=S.asistencia.filter(a=>a.fecha===hoy).length;
  document.getElementById('ds-stock').textContent=S.activos.filter(a=>(a.tipo==='consumible'||a.tipo==='epp-s')&&a.stock<=a.min).length;
  document.getElementById('ds-mant').textContent=S.mantenimientos.filter(m=>m.estado!=='Completado').length;
  document.getElementById('ds-proy').textContent=S.proyectos.filter(p=>p.estado==='En ejecución').length;
  document.getElementById('ds-trab').textContent=S.workers.filter(w=>w.estado==='Activo').length;
  // Solicitudes pañol badge
  const pendSol=(window.S_solicitudesPanol||[]).filter(s=>s.estado==='pendiente').length;
  const solBadgeEl=document.getElementById('ds-sol-pend');
  if(solBadgeEl){solBadgeEl.textContent=pendSol;solBadgeEl.style.display=pendSol>0?'block':'none';}
  updateSolBadge();

  const cumples=S.workers.filter(w=>w.cumple&&w.estado==='Activo').map(w=>({w,dias:diasHastaCumple(w.cumple)})).filter(x=>x.dias<=7).sort((a,b)=>a.dias-b.dias);
  document.getElementById('birthday-banner').innerHTML=cumples.length?`<div style="background:rgba(188,140,255,.08);border:1px solid rgba(188,140,255,.3);border-radius:8px;padding:.9rem 1rem;margin-bottom:1rem"><div style="font-size:.68rem;color:var(--purple);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:.6rem;font-weight:700">🎂 Cumpleaños próximos</div><div style="display:flex;flex-wrap:wrap;gap:.5rem">${cumples.map(x=>`<div class="bday-card" style="flex:1;min-width:190px"><div style="font-size:1.4rem">${x.dias===0?'🎉':'🎂'}</div><div><div style="font-size:.85rem;font-weight:600;color:var(--text)">${x.w.nombre}</div><div style="font-size:.7rem;color:var(--muted)">${x.w.cargo} · ${formatCumple(x.w.cumple)}</div></div><div style="font-size:1.1rem;font-weight:700;color:var(--purple)">${x.dias===0?'HOY':x.dias+'d'}</div></div>`).join('')}</div></div>`:'';

  document.getElementById('dt-movs').innerHTML=S.movimientos.slice().reverse().slice(0,6).map(m=>`<tr><td>${m.desc}</td><td><span class="b ${m.accion==='SIMA'?'b-blue':m.accion==='Préstamo'?'b-gold':m.accion==='Consumo'?'b-red':'b-teal'}">${m.accion}</span></td><td>${W(m.wid).nombre.split(' ')[0]}</td><td>${m.hora}</td></tr>`).join('');
  const alertas=[];
  S.activos.filter(a=>a.tipo==='consumible'&&a.stock<=a.min).forEach(a=>alertas.push(`<div class="alert al-err" style="margin-bottom:.4rem">⚠ Stock bajo: <b>${a.codigo}</b> ${a.desc} — ${a.stock} ${a.unidad}</div>`));
  S.activos.filter(a=>a.tipo==='epp-s'&&a.stock<=a.min).forEach(a=>alertas.push(`<div class="alert al-warn" style="margin-bottom:.4rem">⚠ EPP bajo: <b>${a.codigo}</b> ${a.tipoepp}</div>`));
  S.mantenimientos.filter(m=>m.estado!=='Completado').forEach(m=>alertas.push(`<div class="alert al-warn" style="margin-bottom:.4rem">🔧 Mant: <b>${A(m.activoId).codigo}</b> ${m.tipo} — ${m.fecha}</div>`));
  // Prestamos vencidos (>3 dias sin devolucion)
  var DIAS_ALT=3;
  S.prestamos.filter(function(p){return !p.devuelto&&daysBetween(p.fecha.split(' ')[0])>DIAS_ALT;}).forEach(function(p){
    alertas.push('<div class="alert al-warn" style="margin-bottom:.4rem;cursor:pointer" onclick="goPage(\"p-prestamos\")">' +
      '🔄 <b>' + A(p.activoId).codigo + '</b> prestado a <b>' + W(p.wid).nombre.split(',')[0] + '</b> hace <b>' + daysBetween(p.fecha.split(' ')[0]) + ' días</b> &mdash; ¿ya fue devuelto?' +
      '</div>');
  });
  cumples.forEach(x=>alertas.push(`<div class="alert al-birthday" style="margin-bottom:.4rem">🎂 ${x.dias===0?'HOY':'En '+x.dias+'d'}: <b>${x.w.nombre}</b></div>`));
  document.getElementById('dt-alertas').innerHTML=alertas.length?alertas.join(''):'<div class="alert al-ok">Sin alertas activas.</div>';
}

// ── ACTIVOS ──
