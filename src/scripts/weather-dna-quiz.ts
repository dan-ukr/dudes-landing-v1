// src/scripts/weather-dna-quiz.ts

import { swipeToDiscomfort } from '../lib/weather-dna/scoring';

type PhotonFeature = {
  properties: { name?: string; city?: string; country?: string };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

const state = {
  homeCity: null as { name: string; lat: number; lon: number } | null,
  pastCities: [] as { name: string; lat: number; lon: number }[],
};

const discomfort: Record<'rain' | 'snow' | 'wind', number[]> = { rain: [], snow: [], wind: [] };

function wireSwipeDeck(onDeckComplete: () => void) {
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.wdna-swipe-card')).sort(
    (a, b) => Number(a.dataset.order) - Number(b.dataset.order)
  );
  let index = 0;

  function activate() {
    cards.forEach((c, i) => {
      c.style.zIndex = String(cards.length - i);
      c.dataset.done = i < index ? 'true' : 'false';
    });
    if (index >= cards.length) {
      onDeckComplete();
      return;
    }
    wireCardDrag(cards[index]);
  }

  function wireCardDrag(card: HTMLElement) {
    let startX = 0;
    let currentX = 0;
    let dragging = false;
    const maxDrag = 120;

    function onPointerDown(e: PointerEvent) {
      dragging = true;
      startX = e.clientX;
      card.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      if (!dragging) return;
      currentX = e.clientX - startX;
      card.style.transform = `translateX(${currentX}px) rotate(${currentX / 20}deg)`;
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      const ratio = Math.max(-1, Math.min(1, currentX / maxDrag));
      const dimension = card.dataset.dimension as 'rain' | 'snow' | 'wind';
      discomfort[dimension].push(swipeToDiscomfort(ratio));
      card.style.transition = 'transform 0.2s ease';
      card.style.transform = `translateX(${ratio > 0 ? 400 : -400}px) rotate(${ratio * 20}deg)`;
      setTimeout(() => {
        card.style.transition = '';
        card.style.transform = '';
        index += 1;
        activate();
      }, 200);
      currentX = 0;
    }

    card.addEventListener('pointerdown', onPointerDown);
    card.addEventListener('pointermove', onPointerMove);
    card.addEventListener('pointerup', onPointerUp);
  }

  activate();
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 3;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function submitQuiz(lang: string) {
  const sliderValue = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);

  const payload = {
    homeCity: state.homeCity?.name ?? null,
    pastClimateCityCount: state.pastCities.length,
    feelWinter1to5: sliderValue('wdna-slider-winter'),
    feelSummer1to5: sliderValue('wdna-slider-summer'),
    rainDiscomfort1to5: Math.round(avg(discomfort.rain)),
    snowDiscomfort1to5: Math.round(avg(discomfort.snow)),
    windDiscomfort1to5: Math.round(avg(discomfort.wind)),
    layering1to5: sliderValue('wdna-slider-layering'),
    fit1to5: sliderValue('wdna-slider-fit'),
    lang,
  };

  const submitBtn = document.querySelector<HTMLButtonElement>('[data-action="submit-quiz"]');
  const errorEl = document.getElementById('wdna-submit-error');

  function showError() {
    if (errorEl) {
      errorEl.textContent = errorEl.dataset.error || '';
      errorEl.style.display = 'block';
    }
    if (submitBtn) submitBtn.disabled = false;
  }

  if (errorEl) errorEl.style.display = 'none';
  if (submitBtn) submitBtn.disabled = true;

  let res: Response;
  try {
    res = await fetch('/api/weather-dna', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    showError();
    return;
  }

  if (!res.ok) {
    showError();
    return;
  }

  const data = (await res.json()) as { id?: string };
  if (data.id) {
    window.location.href = `/${lang}/weather-dna/r/${data.id}`;
  } else {
    showError();
  }
}

function $(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`weather-dna-quiz: missing element ${selector}`);
  return el as HTMLElement;
}

function showStep(step: string) {
  document.querySelectorAll<HTMLElement>('.wdna-step').forEach((el) => {
    el.dataset.active = el.dataset.step === step ? 'true' : 'false';
  });
}

async function searchCities(query: string): Promise<PhotonFeature[]> {
  if (query.trim().length < 2) return [];
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&osm_tag=place`);
  if (!res.ok) return [];
  const data = (await res.json()) as { features: PhotonFeature[] };
  return data.features ?? [];
}

function wireCityAutocomplete(inputId: string, resultsId: string, onPick: (city: { name: string; lat: number; lon: number }) => void) {
  const input = $(inputId) as HTMLInputElement;
  const results = $(resultsId);
  let debounceTimer: ReturnType<typeof setTimeout>;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const features = await searchCities(input.value);
      results.innerHTML = '';
      for (const f of features) {
        const label = [f.properties.name, f.properties.country].filter(Boolean).join(', ');
        if (!label) continue;
        const li = document.createElement('li');
        li.textContent = label;
        li.addEventListener('click', () => {
          const [lon, lat] = f.geometry.coordinates;
          onPick({ name: label, lat, lon });
          results.innerHTML = '';
          input.value = label;
        });
        results.appendChild(li);
      }
    }, 300);
  });
}

function init() {
  document.querySelector('[data-action="start"]')?.addEventListener('click', () => showStep('city'));

  const nextFromCityBtn = document.querySelector('[data-action="next-from-city"]') as HTMLButtonElement;
  const homeCityInput = $('#wdna-home-city-input') as HTMLInputElement;
  wireCityAutocomplete('#wdna-home-city-input', '#wdna-home-city-results', (city) => {
    state.homeCity = city;
    nextFromCityBtn.disabled = false;
  });
  // Home city is display-only (never used in scoring), so don't hard-block
  // progress on a successful geocoder pick — free-typed text is fine too.
  // This also means the quiz survives the geocoder API being unreachable.
  homeCityInput.addEventListener('input', () => {
    if (!state.homeCity && homeCityInput.value.trim().length >= 2) {
      nextFromCityBtn.disabled = false;
    }
    if (homeCityInput.value.trim().length === 0) {
      nextFromCityBtn.disabled = true;
    }
  });
  nextFromCityBtn.addEventListener('click', () => {
    if (!state.homeCity && homeCityInput.value.trim()) {
      state.homeCity = { name: homeCityInput.value.trim(), lat: 0, lon: 0 };
    }
    showStep('pastClimates');
  });

  const pickedList = $('#wdna-past-city-picked');
  wireCityAutocomplete('#wdna-past-city-input', '#wdna-past-city-results', (city) => {
    if (state.pastCities.length >= 3) return;
    state.pastCities.push(city);
    const li = document.createElement('li');
    li.textContent = city.name;
    pickedList.appendChild(li);
    (document.getElementById('wdna-past-city-input') as HTMLInputElement).value = '';
  });
  // Picking an autocomplete suggestion already adds the city and clears the
  // input, so "Add another city" just needs to refocus the search field.
  document.querySelector('[data-action="add-past-city"]')?.addEventListener('click', () => {
    (document.getElementById('wdna-past-city-input') as HTMLInputElement).focus();
  });

  document.querySelector('[data-action="next-from-pastClimates"]')?.addEventListener('click', () => {
    showStep('swipe');
    wireSwipeDeck(() => showStep('sliders'));
  });

  const lang = document.documentElement.lang || 'en';
  document.querySelector('[data-action="submit-quiz"]')?.addEventListener('click', () => submitQuiz(lang));
}

init();

export { state };
