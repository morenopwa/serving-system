function renderConfig(){
  const isAdmin=S.user?.nivel==='Admin';
  ['cfg-lat','cfg-lng','cfg-radio'].forEach(id=>{const e=document.getElementById(id);if(e)e.disabled=!isAdmin;});
  document.getElementById('cfg-lat').value=GPS.lat;
  document.getElementById('cfg-lng').value=GPS.lng;
  document.getElementById('cfg-radio').value=GPS.radio;
  const rr=document.getElementById('cfg-radio-range');if(rr)rr.value=GPS.radio;
  document.getElementById('cfg-radio-label').textContent=GPS.radio;
  document.getElementById('cfg-tema-lbl').textContent=darkMode?'Oscuro':'Claro';
  // Refresh Supabase status display
  if(DB_MODE) setSupaStatus('✓ Conectado','var(--green)');
  else setSupaStatus('✗ Sin conexión — presiona Subir para reintentar','var(--red)');
}
function guardarConfig(){
  if(S.user?.nivel!=='Admin'){showToast('Solo administradores pueden cambiar el GPS',false);return;}
  const lat=parseFloat(document.getElementById('cfg-lat').value);
  const lng=parseFloat(document.getElementById('cfg-lng').value);
  const radio=parseInt(document.getElementById('cfg-radio').value);
  if(isNaN(lat)||isNaN(lng)||isNaN(radio)){showToast('Valores inválidos',false);return;}
  GPS={lat,lng,radio};
  document.getElementById('cfg-radio-label').textContent=radio;
  // Save to localStorage (persists across sessions)
  try{localStorage.setItem('serving_gps',JSON.stringify(GPS));}catch(e){}
  // Save to Supabase config table if connected
  if(DB_MODE){
    _sb.upsert('config',[{key:'gps',value:JSON.stringify(GPS)}])
      .then(()=>showToast('GPS guardado ✓ (local + nube)'))
      .catch(()=>showToast('GPS guardado localmente ✓ (sin conexión a nube)'));
  } else {
    showToast('GPS guardado localmente ✓');
  }
}
function usarMiUbicacion(){
  if(!navigator.geolocation){showToast('GPS no disponible',false);return;}
  showToast('Obteniendo ubicación...');
  navigator.geolocation.getCurrentPosition(pos=>{
    document.getElementById('cfg-lat').value=pos.coords.latitude.toFixed(6);
    document.getElementById('cfg-lng').value=pos.coords.longitude.toFixed(6);
    showToast(`Ubicación obtenida: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
  },()=>showToast('No se pudo obtener la ubicación',false));
}
// ── MAPA CANVAS (sin dependencias externas) ──
let mapaSelectedLat=null,mapaSelectedLng=null;
let mapState={lat:0,lng:0,zoom:16,dragging:false,dragStartX:0,dragStartY:0,dragStartLat:0,dragStartLng:0};
let tileCache={};

function abrirMapa(){
  const lat=parseFloat(document.getElementById('cfg-lat').value)||GPS.lat;
  const lng=parseFloat(document.getElementById('cfg-lng').value)||GPS.lng;
  document.getElementById('mapa-container').style.display='block';
  mapState.lat=lat; mapState.lng=lng; mapState.zoom=16;
  setTimeout(()=>{ initMapCanvas(lat,lng); },100);
}

function initMapCanvas(lat,lng){
  const container=document.getElementById('map-container');
  const canvas=document.getElementById('map-canvas');
  if(!canvas)return;
  canvas.width=container.offsetWidth;
  canvas.height=container.offsetHeight;
  setMapPoint(lat,lng);
  drawMap();

  // Click to set point
  container.onclick=function(e){
    if(mapState.dragging)return;
    const rect=container.getBoundingClientRect();
    const x=e.clientX-rect.left, y=e.clientY-rect.top;
    const ll=xyToLatLng(x,y,canvas.width,canvas.height,mapState.lat,mapState.lng,mapState.zoom);
    setMapPoint(ll.lat,ll.lng);
    drawMap();
  };

  // Drag to pan
  container.onmousedown=function(e){
    mapState.dragging=false;
    mapState.dragStartX=e.clientX; mapState.dragStartY=e.clientY;
    mapState.dragStartLat=mapState.lat; mapState.dragStartLng=mapState.lng;
    container.onmousemove=function(ev){
      const dx=ev.clientX-mapState.dragStartX, dy=ev.clientY-mapState.dragStartY;
      if(Math.abs(dx)>5||Math.abs(dy)>5)mapState.dragging=true;
      if(!mapState.dragging)return;
      const scale=360/(256*Math.pow(2,mapState.zoom));
      mapState.lat=mapState.dragStartLat+dy*scale;
      mapState.lng=mapState.dragStartLng-dx*scale*(1/Math.cos(mapState.lat*Math.PI/180));
      drawMap();
    };
    container.onmouseup=function(){container.onmousemove=null;};
  };

  // Zoom
  container.onwheel=function(e){
    e.preventDefault();
    mapState.zoom=Math.max(3,Math.min(19,mapState.zoom+(e.deltaY<0?1:-1)));
    drawMap();
  };

  // Touch support
  let lastTouch=null;
  container.ontouchstart=function(e){lastTouch=e.touches[0];};
  container.ontouchmove=function(e){e.preventDefault();};
  container.ontouchend=function(e){
    if(e.changedTouches[0]&&lastTouch){
      const dx=e.changedTouches[0].clientX-lastTouch.clientX;
      const dy=e.changedTouches[0].clientY-lastTouch.clientY;
      if(Math.abs(dx)<10&&Math.abs(dy)<10){
        const rect=container.getBoundingClientRect();
        const x=e.changedTouches[0].clientX-rect.left, y=e.changedTouches[0].clientY-rect.top;
        const ll=xyToLatLng(x,y,canvas.width,canvas.height,mapState.lat,mapState.lng,mapState.zoom);
        setMapPoint(ll.lat,ll.lng);
        drawMap();
      }
    }
  };
}

function latLngToTile(lat,lng,zoom){
  const n=Math.pow(2,zoom);
  const x=Math.floor((lng+180)/360*n);
  const latR=lat*Math.PI/180;
  const y=Math.floor((1-Math.log(Math.tan(latR)+1/Math.cos(latR))/Math.PI)/2*n);
  return{x,y,n};
}

function tileToLatLng(tx,ty,zoom){
  const n=Math.pow(2,zoom);
  const lng=tx/n*360-180;
  const latR=Math.atan(Math.sinh(Math.PI*(1-2*ty/n)));
  return{lat:latR*180/Math.PI,lng};
}

