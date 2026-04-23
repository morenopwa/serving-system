// ── UTILS ──
const W=id=>S.workers.find(w=>w.id==id)||{nombre:'Desconocido'};
const A=id=>S.activos.find(a=>a.id==id)||{desc:'Desconocido',codigo:'?'};
// Use local date (not UTC) to avoid date-shift issues with Peru timezone
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const nowT=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
const localISO=()=>{const d=new Date();return today()+'T'+nowT();};

// Horas: solo cuenta horas COMPLETAS
function calcH(ent,sal){
  if(!ent||!sal)return{n:0,e:0};
  const p=t=>{const[h,m]=t.split(':').map(Number);return h+m/60;};
  const ei=p(ent),so=p(sal);
  let tot=so-ei;
  // Descuenta almuerzo 13:00-14:00
  if(ei<13&&so>14)tot-=1;
  else if(ei<13&&so>13&&so<=14)tot-=(so-13);
  else if(ei>=13&&ei<14&&so>14)tot-=(14-ei);
  tot=Math.max(0,tot);
  // Solo horas completas (floor)
  const totalInt=Math.floor(tot);
  const norm=Math.min(totalInt,8);
  const extra=Math.max(0,totalInt-8);
  return{n:norm,e:extra};
}

function daysBetween(d){return Math.floor((new Date()-new Date(d))/86400000);}
function diasHastaCumple(s){
  if(!s)return 999;
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const[y,m,d]=s.split('-').map(Number);
  let p=new Date(hoy.getFullYear(),m-1,d);
  if(p<hoy)p=new Date(hoy.getFullYear()+1,m-1,d);
  return Math.round((p-hoy)/86400000);
}
function formatCumple(s){
  if(!s)return'--';
  const[y,m,d]=s.split('-');
  return`${parseInt(d)} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m)-1]}`;
}

function showToast(msg,ok=true){
  const t=document.getElementById('toast');
  t.textContent=msg;t.style.borderColor=ok?'var(--green)':'var(--red)';
  t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);
}
function openModal(id){
  document.getElementById(id).classList.add('open');
  fillSelects();
  if(id==='m-prestamo'){
    document.getElementById('p-activo').value='';
    document.getElementById('p-trab').value='';
    document.getElementById('p-obs').value='';
    document.getElementById('p-resp').value=S.user?.nombre||'';
    document.getElementById('p-fecha').value=localISO();
  }
}
function closeModal(id){document.getElementById(id).classList.remove('open');}

function fillSelects(){
  const ps=document.getElementById('p-activo');
  if(ps){
    const prestables=S.activos.filter(a=>
      (a.tipo==='maquinaria'&&a.estado!=='Dado de baja')||
      (a.tipo==='herramienta'&&(a.disponible||0)>0)||
      (a.tipo==='epp-s'&&(a.stock||0)>0)
    );
    ps.innerHTML='<option value="">— Selecciona un activo —</option>'+
      prestables.map(a=>`<option value="${a.id}">[${a.tipo==='maquinaria'?'Máq':a.tipo==='herramienta'?'Herr':'EPP'}] ${a.codigo} – ${a.desc||a.tipoepp||''} ${a.tipo==='maquinaria'?'('+a.estado+')':a.tipo==='herramienta'?'('+a.disponible+' disp.)':'(stock:'+a.stock+')'}</option>`).join('');
  }
  ['cu-item','cc-item'].forEach(sid=>{const el=document.getElementById(sid);if(el)el.innerHTML=S.activos.filter(a=>a.tipo==='consumible').map(a=>`<option value="${a.id}">${a.codigo} – ${a.desc}</option>`).join('');});
  const mn=document.getElementById('mn-activo');
  if(mn)mn.innerHTML=S.activos.filter(a=>a.tipo==='maquinaria'||a.tipo==='herramienta').map(a=>`<option value="${a.id}">${a.codigo} – ${a.desc}</option>`).join('');
  ['p-trab','cu-trab','ea-trab'].forEach(sid=>{
    const el=document.getElementById(sid);if(!el)return;
    el.innerHTML=S.workers.map(w=>`<option value="${w.id}">${w.nombre}</option>`).join('');
  });
  const uwl=document.getElementById('u-wlink');
  if(uwl)uwl.innerHTML='<option value="">-- ninguno (solo acceso al sistema) --</option>'+S.workers.map(w=>`<option value="${w.id}">${w.nombre} — ${w.cargo}</option>`).join('');
  const fht=document.getElementById('fh-trab');
  if(fht)fht.innerHTML='<option value="">Todos</option>'+S.workers.map(w=>`<option value="${w.id}">${w.nombre}</option>`).join('');
}

function switchTab(g,t,btn){
  document.querySelectorAll(`[id^="${g}-"]`).forEach(el=>el.style.display='none');
  const el=document.getElementById(`${g}-${t}`);if(el)el.style.display='block';
  btn.closest('.tabs').querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Auto-render activos tabs
  if(g==='act'&&typeof renderActivos==='function')renderActivos(t);
}
function switchModalTab(g,t,btn){
  document.querySelectorAll(`[id^="${g}-"]`).forEach(el=>el.style.display='none');
  const el=document.getElementById(`${g}-${t}`);if(el)el.style.display='block';
  btn.closest('.tabs').querySelectorAll('.tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}


// ── FOTO TRABAJADOR ──
function previewFotoTrab(input){
  if(!input.files||!input.files[0])return;
  const file=input.files[0];
  if(file.size>2*1024*1024){showToast('La foto no debe superar 2MB',false);return;}
  const reader=new FileReader();
  reader.onload=e=>{
    const data=e.target.result;
    document.getElementById('w-foto-data').value=data;
    const prev=document.getElementById('w-foto-preview');
    if(prev)prev.innerHTML=`<img src="${data}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  };
  reader.readAsDataURL(file);
}

function getFotoTrab(wid){
  const w=S.workers.find(x=>x.id==wid);
  if(w&&w.foto)return`<img src="${w.foto}" style="width:32px;height:32px;border-radius:50%;object-fit:cover"/>`;
  const ini=(S.workers.find(x=>x.id==wid)?.nombre||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  return`<div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700">${ini}</div>`;
}

// ── HIGHLIGHT ──
function highlightRow(el){
  if(typeof el==='string')el=document.getElementById(el);
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.transition='background .3s';
  el.style.background='rgba(240,165,0,.28)';
  setTimeout(()=>{el.style.background='';},2200);
}

function highlightRow(elOrId){
  const el=typeof elOrId==='string'?document.getElementById(elOrId):elOrId;
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.transition='background 0.4s';
  el.style.background='rgba(240,165,0,.35)';
  setTimeout(()=>{el.style.transition='background 1s';el.style.background='';},2200);
}
