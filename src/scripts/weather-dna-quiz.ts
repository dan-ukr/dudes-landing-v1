// src/scripts/weather-dna-quiz.ts

type PhotonFeature = {
  properties: { name?: string; city?: string; country?: string };
  geometry: { coordinates: [number, number] }; // [lon, lat]
};

const state = {
  homeCity: null as { name: string; lat: number; lon: number } | null,
  pastCities: [] as { name: string; lat: number; lon: number }[],
};

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

  document.querySelector('[data-action="next-from-pastClimates"]')?.addEventListener('click', () => showStep('swipe'));
}

init();

export { state };
