// src/scripts/weather-dna-card.ts
import { toPng } from 'html-to-image';

// The archetype description must always render in full, in every language
// -- never truncated with an ellipsis. Rather than clamp/cut the text, we
// shrink its font size just enough that it (plus the name above it) fits
// the card's fixed middle section.
function autofitDescription() {
  const middle = document.getElementById('wdna-hero-middle');
  const desc = document.getElementById('wdna-archetype-description');
  if (!middle || !desc) return;

  const maxFontSize = 0.72;
  const minFontSize = 0.4;
  const step = 0.02;

  let fontSize = maxFontSize;
  desc.style.fontSize = `${fontSize}rem`;
  while (middle.scrollHeight > middle.clientHeight && fontSize > minFontSize) {
    fontSize = Math.round((fontSize - step) * 100) / 100;
    desc.style.fontSize = `${fontSize}rem`;
  }
}

function init() {
  const card = document.getElementById('wdna-hero-card');
  if (!card) return; // not-found state, nothing to wire up

  autofitDescription();
  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(autofitDescription, 150);
  });

  document.querySelectorAll<HTMLButtonElement>('.wdna-bg-swatches button').forEach((btn) => {
    btn.addEventListener('click', () => {
      card.dataset.bg = btn.dataset.bg ?? 'lime';
    });
  });

  async function renderPng(): Promise<string> {
    return toPng(card, { pixelRatio: 2 });
  }

  document.getElementById('wdna-download-btn')?.addEventListener('click', async () => {
    try {
      const dataUrl = await renderPng();
      const link = document.createElement('a');
      link.download = 'weather-dna.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('weather-dna-card: download failed', err);
    }
  });

  document.getElementById('wdna-share-btn')?.addEventListener('click', async () => {
    try {
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
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the native share sheet — not a failure, ignore silently.
        return;
      }
      console.error('weather-dna-card: share failed', err);
    }
  });
}

init();
