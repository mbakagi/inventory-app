// OCR module using Tesseract.js
const OCR = {
  _worker: null,
  _ready: false,

  async init() {
    if (this._ready) return;
    document.getElementById('ocrDialog').classList.remove('hidden');
    document.getElementById('ocrStatus').textContent = 'Loading OCR engine...';
    try {
      this._worker = await Tesseract.createWorker('eng');
      this._ready = true;
    } catch (e) {
      console.error('OCR init error:', e);
      throw e;
    } finally {
      document.getElementById('ocrDialog').classList.add('hidden');
    }
  },

  async recognize(imageFile) {
    if (!this._ready) await this.init();
    const dialog = document.getElementById('ocrDialog');
    const status = document.getElementById('ocrStatus');
    const progress = document.getElementById('ocrProgress');
    dialog.classList.remove('hidden');
    status.textContent = 'Processing image...';
    progress.value = 0;

    try {
      const { data } = await this._worker.recognize(imageFile, {}, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            progress.value = Math.round(m.progress * 100);
          }
        }
      });
      return data.text || '';
    } finally {
      dialog.classList.add('hidden');
    }
  },

  async recognizeFromVideo(videoEl) {
    // Capture frame from video, run OCR
    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    return this.recognize(blob);
  }
};