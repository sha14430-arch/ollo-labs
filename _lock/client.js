// Ollo Labs lock: answers the service worker's key requests from this tab's sessionStorage.
(() => { const SK = 'ollo_lab_k1'; if (!navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.t === 'need' && e.ports[0]) e.ports[0].postMessage({ k: sessionStorage.getItem(SK) }); });
  sessionStorage.removeItem('ollo_lab_try');
  const k = sessionStorage.getItem(SK); if (k && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ t: 'key', k });
  window.olloLock = () => { sessionStorage.removeItem(SK); navigator.serviceWorker.controller && navigator.serviceWorker.controller.postMessage({ t: 'lock' }); location.href = '/ollo-labs/'; };
})();
