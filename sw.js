// ══════════════════════════════════════════════════════
//  SERVING — Service Worker
//  Maneja notificaciones en background (pantalla apagada,
//  app en segundo plano, pestaña cerrada)
// ══════════════════════════════════════════════════════

const SW_VERSION = 'serving-sw-v1';

// ── INSTALL / ACTIVATE ──
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// ── RECIBIR MENSAJES DESDE LA APP ──
// La app envía { tipo, payload } para programar alarmas
self.addEventListener('message', e => {
  const { tipo, payload } = e.data || {};

  if (tipo === 'PROGRAMAR_SALIDA') {
    // payload: { horas: [17,18,19], wid, fecha }
    programarAlarmasSalida(payload);
  }

  if (tipo === 'CANCELAR_SALIDA') {
    cancelarAlarmasSalida();
  }

  if (tipo === 'PROGRAMAR_ENTRADA') {
    // payload: { msHasta, wid, fecha }
    programarAlarmaEntrada(payload);
  }

  if (tipo === 'MARCAR_SALIDA_CONFIRMADA') {
    cancelarAlarmasSalida();
  }
});

// ── ALMACÉN INTERNO DE TIMERS ──
let _timersSalida = [];
let _timerEntrada = null;
let _salidaYaConfirmada = false;

function cancelarAlarmasSalida() {
  _timersSalida.forEach(t => clearTimeout(t));
  _timersSalida = [];
  _salidaYaConfirmada = true;
}

function programarAlarmasSalida({ horas, wid, fecha }) {
  cancelarAlarmasSalida();
  _salidaYaConfirmada = false;

  horas.forEach(hh => {
    const ms = _msHasta(hh, 0);
    if (ms <= 0) return;

    const t = setTimeout(async () => {
      if (_salidaYaConfirmada) return;

      // Notificar
      await self.registration.showNotification('⚓ SERVING — ¿Marcas salida?', {
        body: `Son las ${hh}:00. Toca para registrar tu salida ahora.`,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'serving-salida-' + hh,
        requireInteraction: true,
        actions: [
          { action: 'marcar_salida', title: '✓ Sí, marcar salida' },
          { action: 'descartar',     title: 'Ahora no' }
        ],
        data: { tipo: 'salida', wid, fecha, hh }
      });
    }, ms);

    _timersSalida.push(t);
  });
}

function programarAlarmaEntrada({ msHasta, wid, fecha }) {
  if (_timerEntrada) clearTimeout(_timerEntrada);
  if (msHasta <= 0) return;

  _timerEntrada = setTimeout(async () => {
    await self.registration.showNotification('⚓ SERVING — Entrada automática', {
      body: 'Tu entrada fue registrada automáticamente a las 08:00.',
      icon: '/icon-192.png',
      tag: 'serving-entrada',
      requireInteraction: false,
      data: { tipo: 'entrada', wid, fecha }
    });
  }, msHasta);
}

// ── CLICK EN NOTIFICACIÓN ──
self.addEventListener('notificationclick', async e => {
  e.notification.close();
  const { action } = e;
  const { tipo, wid, fecha, hh } = e.notification.data || {};

  if (tipo === 'salida') {
    if (action === 'marcar_salida' || action === '') {
      // Acción principal → abrir app y marcar salida
      _salidaYaConfirmada = true;
      cancelarAlarmasSalida();

      e.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
          // Si la app ya está abierta, mandarle mensaje
          if (clients.length > 0) {
            clients[0].postMessage({ tipo: 'CONFIRMAR_SALIDA_DESDE_SW', wid, fecha });
            clients[0].focus();
          } else {
            // Abrir la app
            const client = await self.clients.openWindow('/');
            // Dar tiempo a que cargue y mandar el mensaje
            setTimeout(() => {
              if (client) client.postMessage({ tipo: 'CONFIRMAR_SALIDA_DESDE_SW', wid, fecha });
            }, 2000);
          }
        })
      );
    } else if (action === 'descartar') {
      // "Ahora no" → no hace nada, el siguiente timer (18h o 19h) seguirá activo
    }
  }

  if (tipo === 'entrada') {
    // Solo abrir la app al tocar
    e.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        if (clients.length > 0) { clients[0].focus(); return; }
        return self.clients.openWindow('/');
      })
    );
  }
});

// ── UTILIDAD ──
function _msHasta(hh, mm) {
  const ahora = new Date();
  const obj = new Date(ahora);
  obj.setHours(hh, mm, 0, 0);
  return obj - ahora;
}
