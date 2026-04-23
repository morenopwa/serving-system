// ── EARLY DEFS (needed before full script loads) ──
let darkMode=(()=>{try{const s=localStorage.getItem('serving_theme');return s?s==='dark':true;}catch(e){return true;}})();
function toggleTheme(){darkMode=!darkMode;try{localStorage.setItem('serving_theme',darkMode?'dark':'light');}catch(e){}if(typeof applyTheme==='function')applyTheme();}

// ═══ SUPABASE CONFIG ═══
window.SUPABASE_URL = "https://nnslxiotogekbjqoodrz.supabase.co";
window.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uc2x4aW90b2dla2JqcW9vZHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMjA1ODAsImV4cCI6MjA4OTc5NjU4MH0.DLbSlFLMhpMiazflxeqDTW13xkpW991u_6C5b3EcGUU";

let DATA_READY = false;
let _localWorkers = [];
let _localUsers   = [];
let _localActivos = [];

// Debug helper
window.addEventListener('error', e => {
  console.error('[SERVING DEBUG]', e.message, '\n  at:', e.filename, 'line', e.lineno, '\n  stack:', e.error?.stack?.split('\n').slice(0,4).join(' | '));
});

// ── Lightweight Supabase REST client (no SDK) ──
const SUPA_URL = window.SUPABASE_URL || '';
const SUPA_KEY = window.SUPABASE_KEY || '';
let supabase = null;
let DB_MODE = false;

const _sb = {
  async query(table, options={}){
    const params = new URLSearchParams();
    if(options.select) params.set('select', options.select);
    if(options.eq) Object.entries(options.eq).forEach(([k,v])=>params.set(k,'eq.'+v));
    if(options.order) params.set('order', options.order);
    if(options.limit) params.set('limit', options.limit);
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`,
      {headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}});
    if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
    return r.json();
  },
  async upsert(table, rows){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {method:'POST',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
               'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(Array.isArray(rows)?rows:[rows])});
    if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
    return true;
  },
  async insert(table, rows){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {method:'POST',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
               'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(Array.isArray(rows)?rows:[rows])});
    if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
    return true;
  },
  async update(table, data, match){
    const params = new URLSearchParams();
    Object.entries(match).forEach(([k,v])=>params.set(k,'eq.'+v));
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {method:'PATCH',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,
               'Content-Type':'application/json','Prefer':'return=minimal'},
      body:JSON.stringify(data)});
    if(!r.ok) throw new Error('HTTP '+r.status+' '+await r.text());
    return true;
  },
  async delete(table, match){
    const params = new URLSearchParams();
    Object.entries(match).forEach(([k,v])=>params.set(k,'eq.'+v));
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, {method:'DELETE',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}});
    if(!r.ok && r.status!==404) throw new Error('HTTP '+r.status);
    return true;
  },
  async deleteAll(table){
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?id=neq.-999999`, {method:'DELETE',
      headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}});
    if(!r.ok && r.status!==404) throw new Error('HTTP '+r.status);
    return true;
  }
};
supabase = _sb;

