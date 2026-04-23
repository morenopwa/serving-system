// ══ PAGO SÁBADOS (Jue→Mié) ══
function getSemanasSabado(fW, fM){
  const rows = getHorasRows(fW, fM);
  if(!rows.length) return [];
  const workerMap = {};
  rows.forEach(a=>{
    const w=S.workers.find(x=>x.id==a.wid)||{nombre:'?',tarifa:15};
    const d=new Date(a.fecha);
    const dow=d.getDay();
    const daysToThu=((dow-4)+7)%7;
    const thu=new Date(d); thu.setDate(d.getDate()-daysToThu);
    const wed=new Date(thu); wed.setDate(thu.getDate()+6);
    const fmtD=d=>{return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    const key=fmtD(thu)+'_'+a.wid;
    if(!workerMap[key]) workerMap[key]={wid:a.wid,nombre:w.nombre,tarifa:w.tarifa,
      inicio:fmtD(thu),fin:fmtD(wed),dias:[],hn:0,he:0};
    const {n,e}=calcH(a.entrada,a.salida);
    workerMap[key].hn+=n; workerMap[key].he+=e; workerMap[key].dias.push(a.fecha);
  });
  return Object.values(workerMap).sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.nombre.localeCompare(b.nombre));
}

function renderPagoSabados(){
  const container=document.getElementById('sabados-container');
  if(!container) return;
  const fW=document.getElementById('fh-trab')?.value||'';
  const fM=document.getElementById('fh-mes')?.value||'';
  const semanas=getSemanasSabado(fW,fM);
  let totPagar=0;
  const rows=semanas.map(s=>{
    const te=+(s.tarifa*1.25).toFixed(2);
    const pagar=+(s.hn*s.tarifa+s.he*te).toFixed(2);
    totPagar+=pagar;
    return`<tr>
      <td style="font-size:.78rem">${s.nombre.split(',')[0]}</td>
      <td style="font-size:.72rem;color:var(--muted)">${s.inicio}</td>
      <td style="font-size:.72rem;color:var(--muted)">${s.fin}</td>
      <td style="text-align:center">${s.dias.length}</td>
      <td style="text-align:center;color:var(--blue)">${s.hn}h</td>
      <td style="text-align:center;color:${s.he>0?'var(--gold)':'var(--muted)'}">${s.he>0?s.he+'h':'—'}</td>
      <td style="font-weight:700;color:var(--green)">S/ ${pagar.toFixed(2)}</td>
    </tr>`;
  });
  container.innerHTML=`<div class="card" style="margin-top:1rem">
    <div class="ctitle" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
      <span>Pago por semana (Jue→Mié)</span>
      <span style="font-weight:700;color:var(--green)">S/ ${totPagar.toFixed(2)}</span>
    </div>
    <table><thead><tr><th>Trabajador</th><th>Desde (Jue)</th><th>Hasta (Mié)</th><th>Días</th><th>H. Normal</th><th>H. Extra</th><th>Total S/</th></tr></thead>
    <tbody>${rows.join('')||'<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:1rem">Sin registros</td></tr>'}</tbody>
    </table></div>`;
}

window.addEventListener('DOMContentLoaded',()=>{
  // Init Supabase in background (non-blocking)
  initSupabase().then(connected=>{
    if(connected){
      loadFromSupabase().then(()=>{
        // Try to restore session after data is loaded
        if(!S.user)restoreSession();
      });
    } else {
      // No Supabase - restore from local data
      setTimeout(()=>{if(!S.user)restoreSession();},200);
    }
  });
  // Attach login button safely
  const loginBtn = document.getElementById('btn-login-submit');
  if(loginBtn) loginBtn.onclick = doLogin;
  // Enter key on password
  const lpEl = document.getElementById('lp');
  if(lpEl) lpEl.addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });
  // Init default dates
  const pf=document.getElementById('p-fecha');
  if(pf) pf.value=localISO();
  const mf=document.getElementById('mn-fecha');
  if(mf) mf.value=today();
  const wi=document.getElementById('w-ingreso');
  if(wi) wi.value=today();
  const sf=document.getElementById('si-fecha');
  if(sf) sf.value=today();
  const fhm=document.getElementById('fh-mes');
  if(fhm) fhm.value=today().slice(0,7);
  const editEnt=document.getElementById('edit-asis-entrada');
  if(editEnt) editEnt.oninput=actualizarPreviewAsistencia;
  const editSal=document.getElementById('edit-asis-salida');
  if(editSal) editSal.oninput=actualizarPreviewAsistencia;
});


// ── MI PAGO (vista trabajador) ──
function renderMiPago(){
  const wid=S.user?.wid;
  if(!wid){
    document.getElementById('mipago-semanas').innerHTML='<div class="alert al-info">Tu usuario no está vinculado a un trabajador. Contacta al administrador.</div>';
    return;
  }
  const w=S.workers.find(x=>x.id==wid)||{nombre:'?',tarifa:15,contrato:'Por hora'};
  const mes=document.getElementById('mipago-mes')?.value||today().slice(0,7);
  const registros=S.asistencia.filter(a=>a.wid==wid&&a.salida&&a.fecha.startsWith(mes))
    .slice().sort((a,b)=>a.fecha.localeCompare(b.fecha));

  if(!registros.length){
    document.getElementById('mipago-resumen').innerHTML='';
    document.getElementById('mipago-semanas').innerHTML='<div class="alert al-info">Sin registros de asistencia para este mes.</div>';
    document.getElementById('mipago-detalle').innerHTML='<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:1rem">Sin registros</td></tr>';
    return;
  }

  const tarifa=w.tarifa||15;
  const tarifaExtra=+(tarifa*1.25).toFixed(2);
  const DIAS_ES=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  // ── Calcular por semana (Jue→Mié) ──
  const semMap={};
  const fmtD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  registros.forEach(a=>{
    const {n,e}=calcH(a.entrada,a.salida);
    const d=new Date(a.fecha+'T12:00:00');
    const dow=d.getDay();
    const daysToThu=((dow-4)+7)%7;
    const thu=new Date(d);thu.setDate(d.getDate()-daysToThu);
    const wed=new Date(thu);wed.setDate(thu.getDate()+6);
    const key=fmtD(thu);
    if(!semMap[key])semMap[key]={inicio:fmtD(thu),fin:fmtD(wed),dias:[],hn:0,he:0};
    semMap[key].hn+=n;semMap[key].he+=e;
    semMap[key].dias.push({fecha:a.fecha,dia:DIAS_ES[dow],entrada:a.entrada,salida:a.salida,n,e});
  });

  const semanas=Object.values(semMap).sort((a,b)=>a.inicio.localeCompare(b.inicio));
  let totDias=0,totHN=0,totHE=0,totPago=0;
  semanas.forEach(s=>{totDias+=s.dias.length;totHN+=s.hn;totHE+=s.he;totPago+=+(s.hn*tarifa+s.he*tarifaExtra);});

  // ── Resumen ──
  document.getElementById('mipago-resumen').innerHTML=`
    <div class="sc"><div class="sc-lbl">Días trabajados</div><div class="sc-val c-blue">${totDias}</div></div>
    <div class="sc"><div class="sc-lbl">Total a cobrar</div><div class="sc-val c-green">S/ ${totPago.toFixed(2)}</div></div>
    <div class="sc"><div class="sc-lbl">H. normales × S/${tarifa}</div><div class="sc-val c-blue">${totHN}h = S/ ${(totHN*tarifa).toFixed(2)}</div></div>
    <div class="sc"><div class="sc-lbl">H. extras × S/${tarifaExtra}</div><div class="sc-val c-gold">${totHE}h = S/ ${(totHE*tarifaExtra).toFixed(2)}</div></div>`;

  // ── Semanas ──
  document.getElementById('mipago-semanas').innerHTML=semanas.map((s,si)=>{
    const pago=+(s.hn*tarifa+s.he*tarifaExtra).toFixed(2);
    const esEstaSemana=today()>=s.inicio&&today()<=s.fin;
    return`<div class="card" style="margin-bottom:.8rem;border:1px solid ${esEstaSemana?'var(--gold)':'var(--border)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:.6rem">
        <div>
          <div style="font-size:.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">
            Semana ${si+1} ${esEstaSemana?'<span class="b b-gold" style="margin-left:4px">Esta semana</span>':''}
          </div>
          <div style="font-size:.85rem;font-weight:600;color:var(--text);margin-top:2px">
            📅 ${s.inicio} → ${s.fin}
            <span style="font-size:.72rem;color:var(--muted);margin-left:6px">(${s.dias.length} días)</span>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.3rem;font-weight:800;color:var(--green)">S/ ${pago.toFixed(2)}</div>
          <div style="font-size:.68rem;color:var(--muted)">${s.hn}h normal + ${s.he}h extra</div>
        </div>
      </div>
      <!-- Mini barra de días -->
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:.3rem">
        ${s.dias.map(d=>`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:.7rem;text-align:center;min-width:52px">
          <div style="color:var(--muted);font-size:.62rem">${d.dia}</div>
          <div style="font-weight:600;color:var(--text)">${d.n+d.e}h</div>
          ${d.e>0?`<div style="color:var(--gold);font-size:.6rem">+${d.e} extra</div>`:''}
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');

  // ── Detalle diario ──
  document.getElementById('mipago-detalle').innerHTML=registros.map((a,i)=>{
    const {n,e}=calcH(a.entrada,a.salida);
    const monto=+(n*tarifa+e*tarifaExtra).toFixed(2);
    const dow=new Date(a.fecha+'T12:00:00').getDay();
    return`<tr>
      <td style="color:var(--muted);font-size:.75rem;text-align:center">${i+1}</td>
      <td>${a.fecha}</td>
      <td style="color:var(--muted)">${DIAS_ES[dow]}</td>
      <td style="color:var(--green)">${a.entrada||'--'}</td>
      <td style="color:var(--red)">${a.salida||'--'}</td>
      <td style="text-align:center;color:var(--blue)">${n}h</td>
      <td style="text-align:center;color:${e>0?'var(--gold)':'var(--muted)'};font-weight:${e>0?700:400}">${e>0?e+'h':'—'}</td>
      <td style="font-weight:700;color:var(--green)">S/ ${monto.toFixed(2)}</td>
    </tr>`;
  }).join('');
}
