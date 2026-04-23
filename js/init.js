// Load GPS config from localStorage if saved, else use defaults
let GPS=(()=>{try{const s=localStorage.getItem('serving_gps');return s?JSON.parse(s):{lat:-12.046374,lng:-77.042793,radio:500};}catch(e){return{lat:-12.046374,lng:-77.042793,radio:500};}})();
// darkMode and toggleTheme defined at top of script
function setTheme(t){darkMode=t==='dark';applyTheme();}
function applyTheme(){
  document.body.classList.toggle('light',!darkMode);
  const lbl=darkMode?'☀ Claro':'🌙 Oscuro';
  const els=['login-theme-btn','theme-sb-btn'];
  els.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=lbl;});
  const ca=document.getElementById('cfg-tema-lbl');if(ca)ca.textContent=darkMode?'Oscuro':'Claro';
}

function actualizarPreviewAsistencia(){
  const entrada=document.getElementById('edit-asis-entrada')?.value||'';
  const salida=document.getElementById('edit-asis-salida')?.value||'';
  const preview=document.getElementById('edit-asis-preview');
  if(!preview)return;
  if(entrada&&salida){
    const [eh,em]=entrada.split(':').map(Number);
    const [sh,sm]=salida.split(':').map(Number);
    const totalMin=(sh*60+sm)-(eh*60+em);
    if(totalMin>0){
      const h=Math.floor(totalMin/60),m=totalMin%60;
      preview.innerHTML=`<span style="color:var(--muted)">Entrada:</span> <b>${entrada}</b> &nbsp;→&nbsp; <span style="color:var(--muted)">Salida:</span> <b>${salida}</b> &nbsp;·&nbsp; <span style="color:var(--green)">⏱ ${h}h ${m.toString().padStart(2,'0')}m trabajadas</span>`;
    } else {
      preview.innerHTML=`<span style="color:var(--red)">⚠ La hora de salida debe ser posterior a la entrada</span>`;
    }
  } else if(entrada){
    preview.innerHTML=`<span style="color:var(--muted)">Entrada:</span> <b>${entrada}</b> &nbsp;·&nbsp; <span style="color:var(--gold)">Sin salida registrada</span>`;
  } else {
    preview.innerHTML='';
  }
}
