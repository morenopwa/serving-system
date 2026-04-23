function getHorasRows(fW,fM){
  let rows=S.asistencia.filter(a=>a.salida);
  if(fW)rows=rows.filter(a=>a.wid==fW);
  if(fM)rows=rows.filter(a=>a.fecha.startsWith(fM));
  return rows;
}

function renderHoras(){
  const fW=document.getElementById('fh-trab')?.value||'';
  const fM=document.getElementById('fh-mes')?.value||'';
  const rows=getHorasRows(fW,fM);
  let tN=0,tE=0,tP=0;
  const tbody=rows.map(a=>{
    const w=S.workers.find(x=>x.id==a.wid)||{nombre:'?',tarifa:15,contrato:'Por hora'};
    const{n,e}=calcH(a.entrada,a.salida);
    const te=+(w.tarifa*1.25).toFixed(2);
    const pagar=+(n*w.tarifa+e*te).toFixed(2);
    tN+=n;tE+=e;tP+=pagar;
    return`<tr><td>${w.nombre}</td><td>${a.fecha}</td><td><span class="b b-gray">${w.contrato}</span></td><td>${n}</td><td style="color:var(--gold)">${e}</td><td>S/ ${w.tarifa}</td><td>S/ ${te}</td><td style="color:var(--green);font-weight:700">S/ ${pagar.toFixed(2)}</td></tr>`;
  }).join('')||'<tr><td colspan="8" style="color:var(--muted);text-align:center;padding:1rem">Sin registros para el período</td></tr>';
  document.getElementById('t-horas').innerHTML=tbody;
  renderPagoSabados();
  document.getElementById('horas-stats').innerHTML=`
    <div class="sc"><div class="sc-lbl">Horas normales</div><div class="sc-val c-blue">${tN}</div></div>
    <div class="sc"><div class="sc-lbl">Horas extras</div><div class="sc-val c-gold">${tE}</div></div>
    <div class="sc"><div class="sc-lbl">Horas hombre total</div><div class="sc-val c-purple">${tN+tE}</div></div>
    <div class="sc"><div class="sc-lbl">Total a pagar</div><div class="sc-val c-green">S/ ${tP.toFixed(2)}</div></div>`;

  // Horas hombre por trabajador
  const hhMap={};
  rows.forEach(a=>{
    const{n,e}=calcH(a.entrada,a.salida);
    if(!hhMap[a.wid])hhMap[a.wid]={n:0,e:0,dias:0};
    hhMap[a.wid].n+=n;hhMap[a.wid].e+=e;hhMap[a.wid].dias++;
  });
  const hhDiv=document.getElementById('hh-resumen');
  if(Object.keys(hhMap).length){
    hhDiv.style.display='block';
    document.getElementById('hh-periodo-label').textContent=fW?(S.workers.find(w=>w.id==fW)?.nombre||''):fM?('Mes '+fM):'Período seleccionado';
    document.getElementById('hh-content').innerHTML=`<table><thead><tr><th>Trabajador</th><th>Días trabajados</th><th>H. normales</th><th>H. extras</th><th>Total H-H</th><th>Barra</th></tr></thead><tbody>${
      Object.keys(hhMap).map(wid=>{
        const w=S.workers.find(x=>x.id==wid)||{nombre:'?'};const m=hhMap[wid];const tot=m.n+m.e;const maxHH=Math.max(...Object.values(hhMap).map(x=>x.n+x.e));
        return`<tr><td>${w.nombre}</td><td style="text-align:center">${m.dias}</td><td>${m.n}</td><td style="color:var(--gold)">${m.e}</td><td style="font-weight:700;color:var(--purple)">${tot}</td><td style="width:140px"><div class="pbar-wrap"><div class="pbar" style="width:${Math.round(tot/maxHH*100)}%;background:var(--blue)"></div></div></td></tr>`;
      }).join('')
    }</tbody></table>`;
  } else {hhDiv.style.display='none';}
}

// ── EXPORTAR HORAS ──
function exportarHoras(periodo){
  const fW=document.getElementById('fh-trab')?.value||'';
  const fM=document.getElementById('fh-mes')?.value||'';
  let rows=getHorasRows(fW,fM);
  if(periodo==='semana'){
    const hoy=new Date();const lunes=new Date(hoy.setDate(hoy.getDate()-hoy.getDay()+1));
    rows=rows.filter(a=>new Date(a.fecha)>=lunes);
  }
  let texto=`SERVING — Reporte de Horas (${periodo.toUpperCase()})\nGenerado: ${new Date().toLocaleString('es-PE')}\n\n`;
  texto+=`Trabajador\tFecha\tEntrada\tSalida\tH. Normal\tH. Extra\tTotal\n`;
  rows.forEach(a=>{
    const{n,e}=calcH(a.entrada,a.salida);const w=W(a.wid);
    texto+=`${w.nombre}\t${a.fecha}\t${a.entrada||'--'}\t${a.salida||'--'}\t${n}\t${e}\t${n+e}\n`;
  });
  const blob=new Blob([texto],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`horas_${periodo}_serving.txt`;a.click();URL.revokeObjectURL(url);
  showToast(`Reporte ${periodo} exportado`);
}
function exportarExcel(){
  const fW=document.getElementById('fh-trab')?.value||'';
  const fM=document.getElementById('fh-mes')?.value||'';
  const rows=getHorasRows(fW,fM);
  const periodo=fM||today();

  // Build data array for SheetJS
  const headers=['Trabajador','Apellidos','Cargo','Contrato','Fecha','Entrada','Salida','H. Normales','H. Extras','Total H-H','Tarifa S/','Tarifa Extra S/','Total a Pagar S/'];
  const data=[headers];
  let totN=0,totE=0,totP=0;

  rows.forEach(a=>{
    const w=S.workers.find(x=>x.id==a.wid)||{nombre:'?',apellidos:'?',cargo:'?',contrato:'?',tarifa:15};
    const{n,e}=calcH(a.entrada,a.salida);
    const te=+(w.tarifa*1.25).toFixed(2);
    const pagar=+(n*w.tarifa+e*te).toFixed(2);
    totN+=n; totE+=e; totP+=pagar;
    data.push([w.nombre,w.apellidos||'',w.cargo||'',w.contrato,a.fecha,a.entrada||'',a.salida||'',n,e,n+e,w.tarifa,te,pagar]);
  });

  // Totals row
  data.push(['','','','','','','TOTALES',totN,totE,totN+totE,'','',+totP.toFixed(2)]);

  // Use SheetJS if available, otherwise fallback to CSV-as-xlsx
  if(window.XLSX){
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(data);
    // Column widths
    ws['!cols']=[{wch:28},{wch:24},{wch:16},{wch:12},{wch:12},{wch:8},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12},{wch:14}];
    // Style header row bold (basic)
    XLSX.utils.book_append_sheet(wb,ws,'Horas '+periodo);
    // Add summary sheet
    const wkrs={};
    rows.forEach(a=>{
      if(!wkrs[a.wid])wkrs[a.wid]={nombre:'',apellidos:'',dias:0,n:0,e:0,pagar:0,tarifa:15};
      const w2=S.workers.find(x=>x.id==a.wid);
      if(w2){wkrs[a.wid].nombre=w2.nombre;wkrs[a.wid].apellidos=w2.apellidos||'';wkrs[a.wid].tarifa=w2.tarifa;}
      const{n,e}=calcH(a.entrada,a.salida);
      wkrs[a.wid].dias++;wkrs[a.wid].n+=n;wkrs[a.wid].e+=e;
      wkrs[a.wid].pagar+=n*wkrs[a.wid].tarifa+e*wkrs[a.wid].tarifa*1.25;
    });
    const sumHeaders=['Trabajador','Apellidos','Días','H. Normales','H. Extras','Total H-H','Total a Pagar S/'];
    const sumData=[sumHeaders,...Object.values(wkrs).map(x=>[x.nombre,x.apellidos,x.dias,+x.n.toFixed(1),+x.e.toFixed(1),+(x.n+x.e).toFixed(1),+x.pagar.toFixed(2)])];
    const ws2=XLSX.utils.aoa_to_sheet(sumData);
    ws2['!cols']=[{wch:28},{wch:24},{wch:8},{wch:12},{wch:12},{wch:12},{wch:16}];
    XLSX.utils.book_append_sheet(wb,ws2,'Resumen');
    XLSX.writeFile(wb,`SERVING_Horas_${periodo}.xlsx`);
    showToast('✓ Excel exportado: SERVING_Horas_'+periodo+'.xlsx');
  } else {
    // Fallback: load SheetJS dynamically then retry
    showToast('Cargando librería Excel...');
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=()=>{ showToast('Librería cargada, exportando...'); setTimeout(exportarExcel,300); };
    script.onerror=()=>{ exportarExcelFallback(data,periodo); };
    document.head.appendChild(script);
  }
}

function exportarExcelFallback(data,periodo){
  // Fallback: generate as tab-separated (opens in Excel)
  const tsv = data.map(row=>row.map(c=>String(c).replace(/\t/g,' ')).join('\t')).join('\n');
  const blob=new Blob(['\ufeff'+tsv],{type:'text/tab-separated-values;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`SERVING_Horas_${periodo}.xls`;a.click();
  URL.revokeObjectURL(url);
  showToast('Exportado como .xls (abre en Excel)');
}

