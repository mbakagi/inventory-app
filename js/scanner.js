// Barcode scanner module using QuaggaJS
const Scanner = {
  _scanning: false,
  _onDetect: null,

  init(onDetect) {
    this._onDetect = onDetect;
  },

  async start() {
    if (this._scanning) return;
    const view = document.getElementById('scannerView');
    view.classList.add('active');
    view.innerHTML = '';

    try {
      await Quagga.init({
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: view,
          constraints: {
            facingMode: 'environment',
            width: { min: 640 },
            height: { min: 480 }
          }
        },
        decoder: {
          readers: [
            'code_128_reader', 'ean_reader', 'ean_8_reader',
            'code_39_reader', 'code_39_vin_reader', 'codabar_reader',
            'upc_reader', 'upc_e_reader', 'i2of5_reader'
          ]
        },
        locate: true,
        numOfWorkers: 2,
        frequency: 10
      });

      Quagga.onDetected((result) => {
        if (result && result.codeResult && result.codeResult.code) {
          const code = result.codeResult.code;
          if (this._onDetect) this._onDetect(code);
        }
      });

      Quagga.start();
      this._scanning = true;
    } catch (e) {
      console.error('Scanner init error:', e);
      this.stop();
      throw e;
    }
  },

  stop() {
    if (!this._scanning) return;
    try {
      Quagga.stop();
    } catch (e) { /* ignore */ }
    this._scanning = false;
    const view = document.getElementById('scannerView');
    view.classList.remove('active');
    view.innerHTML = '';
  },

  isScanning() {
    return this._scanning;
  }
};