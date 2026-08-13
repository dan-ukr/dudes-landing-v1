// src/scripts/weather-dna-card.ts
import { toPng } from 'html-to-image';

function init() {
  const card = document.getElementById('wdna-hero-card');
  if (!card) return; // not-found state, nothing to wire up

  document.querySelectorAll<HTMLButtonElement>('.wdna-bg-swatches button').forEach((btn) => {
    btn.addEventListener('click', () => {
      card.dataset.bg = btn.dataset.bg ?? 'lime';
    });
  });

  async function renderPng(): Promise<string> {
    return toPng(card, { pixelRatio: 2 });
  }

  document.getElementById('wdna-download-btn')?.addEventListener('click', async () => {
    const dataUrl = await renderPng();
    const link = document.createElement('a');
    link.download = 'weather-dna.png';
    link.href = dataUrl;
    link.click();
  });

  document.getElementById('wdna-share-btn')?.addEventListener('click', async () => {
    const dataUrl = await renderPng();
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], 'weather-dna.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'My Weather DNA', url: window.location.href });
      return;
    }

    // Fallback: download the image and open a prefilled text+link share intent.
    const link = document.createElement('a');
    link.download = 'weather-dna.png';
    link.href = dataUrl;
    link.click();
    const shareText = encodeURIComponent(`My Weather DNA result: ${window.location.href}`);
    window.open(`https://twitter.com/intent/tweet?text=${shareText}`, '_blank', 'noopener');
  });
}

init();
