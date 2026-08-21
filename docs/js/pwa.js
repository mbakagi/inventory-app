// PWA controller - service worker registration, install prompt, online/offline status
const PWA = {
  _installPrompt: null,
  _installed: false,

  init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').catch((err) => console.warn('SW register failed', err));

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        if (localStorage.getItem('st3s_updated') === '1') {
          localStorage.removeItem('st3s_updated');
          location.reload();
        }
      });

      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              localStorage.setItem('st3s_updated', '1');
              if (typeof App !== 'undefined' && App._toast) App._toast('Update available — reloading…');
              setTimeout(() => worker.postMessage('SKIP_WAITING'), 1200);
            }
          });
        });
      });
    }

    // Install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this._installPrompt = e;
      this._updateInstallButtons(true);
    });
    window.addEventListener('appinstalled', () => {
      this._installPrompt = null;
      this._installed = true;
      this._updateInstallButtons(false);
      if (typeof App !== 'undefined' && App._toast) App._toast('App installed!');
    });

    // Online/offline status
    window.addEventListener('online', () => this._setOnline(true));
    window.addEventListener('offline', () => this._setOnline(false));
    this._setOnline(navigator.onLine);
  },

  // Returns true if a native install prompt was shown
  promptInstall() {
    if (this._installPrompt) {
      this._installPrompt.prompt();
      this._installPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          this._installPrompt = null;
          this._updateInstallButtons(false);
        }
      });
      return true;
    }
    return false;
  },

  _updateInstallButtons(show) {
    const btn = document.getElementById('installBtn');
    if (!btn) return;
    if (show && !this._installed) btn.classList.remove('hidden');
    else btn.classList.add('hidden');
  },

  _setOnline(online) {
    const banner = document.getElementById('offlineBanner');
    const dot = document.getElementById('onlineDot');
    if (banner) banner.classList.toggle('hidden', online);
    if (dot) dot.classList.toggle('offline', !online);
    if (typeof App !== 'undefined' && App._toast && !online) {
      // Only toast on transition to offline
      if (!this._wasOffline) App._toast('You are offline');
    }
    this._wasOffline = !online;
  }
};
