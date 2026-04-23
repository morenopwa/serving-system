function xyToLatLng(px,py,W,H,centerLat,centerLng,zoom){
  const scale=256*Math.pow(2,zoom);
  const wrad=centerLng*Math.PI/180;
  const x0=scale*(0.5+wrad/(2*Math.PI));
  const sinLat=Math.sin(centerLat*Math.PI/180);
  const y0=scale*(0.5-Math.log((1+sinLat)/(1-sinLat))/(4*Math.PI));
  const nx=x0+(px-W/2);
  const ny=y0+(py-H/2);
  const lng=(nx/scale-0.5)*360;
  const latR=2*Math.atan(Math.exp((0.5-ny/scale)*2*Math.PI))-Math.PI/2;
  return{lat:latR*180/Math.PI,lng};
}

function latLngToXY(lat,lng,W,H,centerLat,centerLng,zoom){
  const scale=256*Math.pow(2,zoom);
  function wx(ln){return scale*(0.5+ln*Math.PI/180/(2*Math.PI));}
  function wy(la){const s=Math.sin(la*Math.PI/180);return scale*(0.5-Math.log((1+s)/(1-s))/(4*Math.PI));}
  return{x:W/2+(wx(lng)-wx(centerLng)),y:H/2+(wy(lat)-wy(centerLat))};
}

function drawMap(){
  const canvas=document.getElementById('map-canvas');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  const zoom=Math.round(mapState.zoom);

  // Draw tiles
  const tileSize=256;
  const {x:tx0,y:ty0}=latLngToTile(mapState.lat,mapState.lng,zoom);
  const tilesX=Math.ceil(W/tileSize)+2;
  const tilesY=Math.ceil(H/tileSize)+2;

  for(let dx=-Math.floor(tilesX/2);dx<=Math.floor(tilesX/2);dx++){
    for(let dy=-Math.floor(tilesY/2);dy<=Math.floor(tilesY/2);dy++){
      const tx=tx0+dx, ty=ty0+dy;
      const n=Math.pow(2,zoom);
      if(tx<0||ty<0||tx>=n||ty>=n)continue;
      const tileLat=tileToLatLng(tx,ty,zoom).lat;
      const tileLng=tileToLatLng(tx,ty,zoom).lng;
      const {x,y}=latLngToXY(tileLat,tileLng,W,H,mapState.lat,mapState.lng,zoom);
      const key=`${zoom}/${tx}/${ty}`;
      if(tileCache[key] instanceof HTMLImageElement && tileCache[key].complete){
        ctx.drawImage(tileCache[key],Math.round(x),Math.round(y),tileSize,tileSize);
      } else if(!tileCache[key]){
        const img=new Image();
        img.crossOrigin='anonymous';
        tileCache[key]=img;
        img.onload=()=>drawMap();
        img.onerror=()=>{tileCache[key]='error';drawMapFallback(ctx,W,H);};
        const subs=['a','b','c'];
        const s=subs[(tx+ty)%3];
        try{ img.src=`https://${s}.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`; }
        catch(e){ tileCache[key]='error'; }
        // Draw placeholder while loading
        ctx.fillStyle='#ddd8cc';ctx.fillRect(Math.round(x),Math.round(y),tileSize,tileSize);
        ctx.strokeStyle='#bbb';ctx.strokeRect(Math.round(x),Math.round(y),tileSize,tileSize);
      } else if(tileCache[key]==='error'){
        // Fallback tile - draw grid square
        ctx.fillStyle='#ddd8cc';ctx.fillRect(Math.round(x),Math.round(y),tileSize,tileSize);
        ctx.strokeStyle='#bbb';ctx.strokeRect(Math.round(x),Math.round(y),tileSize,tileSize);
      }
    }
  }

  // Draw selected pin
  if(mapaSelectedLat!==null){
    const {x,y}=latLngToXY(mapaSelectedLat,mapaSelectedLng,W,H,mapState.lat,mapState.lng,zoom);
    ctx.fillStyle='#f0a500';
    ctx.beginPath();ctx.arc(x,y-2,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='white';
    ctx.beginPath();ctx.arc(x,y-2,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f0a500';
    ctx.beginPath();ctx.moveTo(x,y+8);ctx.lineTo(x-6,y-5);ctx.lineTo(x+6,y-5);ctx.closePath();ctx.fill();
    // Crosshair circle
    ctx.strokeStyle='rgba(240,165,0,.4)';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(x,y-2,20,0,Math.PI*2);ctx.stroke();
  }

  // Hide loading overlay
  const ld=document.getElementById('map-loading');
  if(ld)ld.style.display='none';

  // Update zoom buttons if exist
  const zl=document.getElementById('map-zoom-label');
  if(zl)zl.textContent='Zoom: '+zoom;
}

function drawMapFallback(ctx,W,H){
  // Draw a simple coordinate grid when tiles can't load (file:// mode)
  ctx.fillStyle='#e8e4d8';
  ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#ccc';
  for(let x=0;x<W;x+=50){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
  for(let y=0;y<H;y+=50){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  ctx.fillStyle='#888';ctx.font='13px sans-serif';ctx.textAlign='center';
  ctx.fillText('Los tiles del mapa requieren conexión a internet.',W/2,H/2-16);
  ctx.fillText('Puedes escribir las coordenadas manualmente o usar "Mi ubicación".',W/2,H/2+8);
  ctx.fillText(`Centro actual: ${mapState.lat.toFixed(5)}, ${mapState.lng.toFixed(5)}`,W/2,H/2+32);
  const ld=document.getElementById('map-loading');if(ld)ld.style.display='none';
}

function mapZoom(delta){
  mapState.zoom=Math.max(3,Math.min(19,mapState.zoom+delta));
  const zl=document.getElementById('map-zoom-label');
  if(zl)zl.textContent='Z:'+Math.round(mapState.zoom);
  drawMap();
}

function setMapPoint(lat,lng){
  mapaSelectedLat=lat;mapaSelectedLng=lng;
  mapState.lat=lat;mapState.lng=lng;
  const lbl=document.getElementById('mapa-coords-label');
  if(lbl)lbl.textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const btn=document.getElementById('btn-confirmar-mapa');
  if(btn)btn.disabled=false;
}

function confirmarPuntoMapa(){
  if(mapaSelectedLat===null)return;
  document.getElementById('cfg-lat').value=mapaSelectedLat.toFixed(6);
  document.getElementById('cfg-lng').value=mapaSelectedLng.toFixed(6);
  showToast(`Punto establecido: ${mapaSelectedLat.toFixed(5)}, ${mapaSelectedLng.toFixed(5)}`);
  cerrarMapa();
}

function cerrarMapa(){
  document.getElementById('mapa-container').style.display='none';
}

// ── RELOJ ──
function startClock(){
  const tick=()=>{
    const n=new Date();
    const r=document.getElementById('reloj');if(r)r.textContent=n.toTimeString().slice(0,8);
    const f=document.getElementById('rfecha');if(f)f.textContent=n.toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  };tick();setInterval(tick,1000);
}


