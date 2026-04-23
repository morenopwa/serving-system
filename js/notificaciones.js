// ══════════════════════════════════════════════════════
//  SERVING — Módulo de Notificaciones
//  Usa Service Worker para notificar aunque la app esté
//  cerrada o el teléfono en segundo plano.
// ══════════════════════════════════════════════════════

const _notif = {
  swRegistration:    null,
  yaPreguntoSalida:  false,
  fechaUltimaInit:   null,
  _fallbackTimers:   [],
  _entradaTimer:     null,
};

// ══════════════════════════════════════════════════════
//  REGISTRO DEL SERVICE WORKER
// ══════════════════════════════════════════════════════
async function registrarSW() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    _notif.swRegistration = reg;

    // Escuchar mensajes DEL SW (ej: usuario tocó "Sí, marcar salida" en la notificación)
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data?.tipo === 'CONFIRMAR_SALIDA_DESDE_SW') {
        _ejecutarMarcadoSalida();
      }
    });

    return reg;
  } catch (err) {
    console.warn('SW no disponible:', err);
    return null;
  }
}

function _swPost(data) {
  if (!navigator.serviceWorker?.controller) return false;
  navigator.serviceWorker.controller.postMessage(data);
  return true;
}

// ══════════════════════════════════════════════════════
//  PERMISO DE NOTIFICACIONES
// ══════════════════════════════════════════════════════
async function solicitarPermisoNotificaciones() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const r = await Notification.requestPermission();
  return r === 'granted';
}

// ══════════════════════════════════════════════════════
//  ENTRADA AUTOMÁTICA 08:00
// ══════════════════════════════════════════════════════
function programarEntradaAutomatica() {
  const hoy = today();
  const wid = S.user?.wid;
  if (!wid) return;

  const rec = S.asistencia.find(a => a.fecha === hoy && a.wid == wid);
  if (rec) return;

  const ms = _msHasta(8, 0);
  if (ms <= 0) return;

  // Notificación via SW (funciona con app cerrada)
  _swPost({ tipo: 'PROGRAMAR_ENTRADA', payload: { msHasta: ms, wid, fecha: hoy } });

  // Timer local para ejecutar el marcado cuando la app esté abierta
  if (_notif._entradaTimer) clearTimeout(_notif._entradaTimer);
  _notif._entradaTimer = setTimeout(() => {
    const hoyCheck = today();
    const widCheck = S.user?.wid;
    if (!widCheck) return;
    const recCheck = S.asistencia.find(a => a.fecha === hoyCheck && a.wid == widCheck);
    if (recCheck) return;

    const ahora = nowT();
    const nuevo = { id: nids.asis++, wid: widCheck, fecha: hoyCheck, entrada: ahora, salida: null, _isNew: true };
    S.asistencia.push(nuevo);
    if (typeof DB_MODE !== 'undefined' && DB_MODE && typeof syncAsistencia === 'function') syncAsistencia(nuevo);
    if (typeof renderMiAsistencia === 'function') renderMiAsistencia();
    if (typeof updateRegBtn === 'function') updateRegBtn();
    if (typeof incrementAsisBadge === 'function') incrementAsisBadge();
    showToast('▶ Entrada registrada automáticamente: ' + ahora);
    programarPreguntasSalida();
  }, ms);
}

// ══════════════════════════════════════════════════════
//  PREGUNTAS DE SALIDA 17h / 18h / 19h
// ══════════════════════════════════════════════════════
function programarPreguntasSalida() {
  _notif.yaPreguntoSalida = false;
  const hoy = today();
  const wid = S.user?.wid;
  if (!wid) return;

  const horasRestantes = [17, 18, 19].filter(hh => _msHasta(hh, 0) > 0);
  if (horasRestantes.length === 0) return;

  // Delegar al SW → funciona con app cerrada en Android
  _swPost({ tipo: 'PROGRAMAR_SALIDA', payload: { horas: horasRestantes, wid, fecha: hoy } });

  // Timers de respaldo para cuando la app está abierta
  _notif._fallbackTimers.forEach(t => clearTimeout(t));
  _notif._fallbackTimers = [];

  horasRestantes.forEach(hh => {
    const ms = _msHasta(hh, 0);
    const t = setTimeout(() => {
      if (_notif.yaPreguntoSalida) return;
      const recActual = S.asistencia.find(a => a.fecha === today() && a.wid == S.user?.wid);
      if (!recActual?.entrada || recActual?.salida) { _notif.yaPreguntoSalida = true; return; }
      _mostrarToastSalida(hh + ':00');
    }, ms);
    _notif._fallbackTimers.push(t);
  });
}

// ══════════════════════════════════════════════════════
//  TOAST INTERACTIVO (app abierta)
// ══════════════════════════════════════════════════════
function _mostrarToastSalida(hora) {
  document.getElementById('toast-salida-pregunta')?.remove();
  const div = document.createElement('div');
  div.id = 'toast-salida-pregunta';
  div.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg2,#1e1e2e);border:1px solid var(--gold,#c9a227);border-radius:14px;padding:14px 18px;z-index:9999;display:flex;flex-direction:column;gap:10px;min-width:260px;max-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.5);animation:slideUp .3s ease';
  div.innerHTML = `
    <div style="font-size:.85rem;color:var(--text,#fff);font-weight:600">⏰ Son las ${hora} — ¿Vas a marcar salida?</div>
    <div style="display:flex;gap:8px">
      <button onclick="confirmarSalidaDesdeNotif()" style="flex:1;padding:8px;background:var(--green,#22c55e);color:#000;border:none;border-radius:8px;font-weight:700;font-size:.82rem;cursor:pointer">✓ Sí, marcar salida</button>
      <button onclick="descartarToastSalida()" style="flex:1;padding:8px;background:var(--bg3,#2a2a3e);color:var(--muted,#888);border:1px solid var(--border,#444);border-radius:8px;font-size:.82rem;cursor:pointer">Ahora no</button>
    </div>`;
  document.body.appendChild(div);
}

function descartarToastSalida() {
  document.getElementById('toast-salida-pregunta')?.remove();
}

function confirmarSalidaDesdeNotif() {
  descartarToastSalida();
  _ejecutarMarcadoSalida();
}

function _ejecutarMarcadoSalida() {
  _notif.yaPreguntoSalida = true;
  _notif._fallbackTimers.forEach(t => clearTimeout(t));
  _notif._fallbackTimers = [];
  _swPost({ tipo: 'MARCAR_SALIDA_CONFIRMADA' });

  const hoy = today(), ahora = nowT(), wid = S.user?.wid;
  if (!wid) { showToast('No hay trabajador vinculado', false); return; }
  const rec = S.asistencia.find(a => a.fecha === hoy && a.wid == wid);
  if (!rec)       { showToast('No hay entrada activa hoy', false); return; }
  if (rec.salida) { showToast('Salida ya registrada: ' + rec.salida, false); return; }

  rec.salida = ahora;
  if (typeof DB_MODE !== 'undefined' && DB_MODE && typeof syncAsistencia === 'function') syncAsistencia(rec);
  if (typeof renderMiAsistencia === 'function') renderMiAsistencia();
  if (typeof updateRegBtn === 'function') updateRegBtn();
  if (typeof incrementAsisBadge === 'function') incrementAsisBadge();
  showToast('■ Salida registrada: ' + ahora);
}

// ══════════════════════════════════════════════════════
//  INICIALIZAR
// ══════════════════════════════════════════════════════
async function iniciarNotificaciones() {
  const hoy = today();
  if (_notif.fechaUltimaInit === hoy) return;
  _notif.fechaUltimaInit = hoy;
  _notif.yaPreguntoSalida = false;
  if (!S.user?.wid) return;

  const permiso = await solicitarPermisoNotificaciones();
  await registrarSW();

  if (!permiso) { _actualizarUINotifBlock(); return; }

  programarEntradaAutomatica();

  const rec = S.asistencia.find(a => a.fecha === hoy && a.wid == S.user.wid);
  if (rec?.entrada && !rec?.salida) programarPreguntasSalida();

  _actualizarUINotifBlock();
}

function resetearNotificacionesDiarias() {
  _notif._fallbackTimers.forEach(t => clearTimeout(t));
  _notif._fallbackTimers = [];
  if (_notif._entradaTimer) clearTimeout(_notif._entradaTimer);
  _notif.fechaUltimaInit = null;
  _notif.yaPreguntoSalida = false;
  iniciarNotificaciones();
}

(function _programarMedianoche() {
  const ahora = new Date(), manana = new Date(ahora);
  manana.setHours(24, 0, 30, 0);
  setTimeout(() => { resetearNotificacionesDiarias(); _programarMedianoche(); }, manana - ahora);
})();

// ══════════════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════════════
async function activarNotificacionesManual() {
  const ok = await solicitarPermisoNotificaciones();
  if (ok) {
    showToast('🔔 Notificaciones activadas ✓');
    await registrarSW();
    _notif.fechaUltimaInit = null;
    iniciarNotificaciones();
  } else {
    showToast('⚠ Permiso denegado — actívalo en Ajustes del navegador', false);
  }
  _actualizarUINotifBlock();
}

function _actualizarUINotifBlock() {
  const infoBlock = document.getElementById('notif-info-block');
  const btnWrap   = document.getElementById('notif-btn-wrap');
  if (!S.user?.wid || !('Notification' in window)) return;
  const permOk = Notification.permission === 'granted';
  const swOk   = 'serviceWorker' in navigator;
  if (permOk) {
    if (infoBlock) {
      infoBlock.style.display = 'block';
      const swNote = document.getElementById('notif-sw-note');
      if (swNote) swNote.innerHTML = swOk
        ? '<span style="color:var(--green)">✓ Funciona en segundo plano</span>'
        : '<span style="color:var(--gold)">⚠ Solo con la app abierta</span>';
    }
    if (btnWrap) btnWrap.style.display = 'none';
  } else {
    if (infoBlock) infoBlock.style.display = 'none';
    if (btnWrap)   btnWrap.style.display   = 'block';
  }
}

function onRenderAsistenciaNotif() { _actualizarUINotifBlock(); }

function _msHasta(hh, mm) {
  const ahora = new Date(), obj = new Date(ahora);
  obj.setHours(hh, mm, 0, 0);
  return obj - ahora;
}
