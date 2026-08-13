import type { APIRoute } from 'astro';

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: { city?: string; town?: string; village?: string; country?: string };
};

// Proxies city search to Nominatim (OpenStreetMap) instead of calling it
// directly from the browser: Nominatim's usage policy requires a descriptive
// User-Agent header, which browser fetch() can't set (browsers own that
// header). Routing server-side also lets us honor `accept-language` for all
// 9 site languages, unlike Photon which only reliably supports en/de/fr.
export const GET: APIRoute = async ({ url }) => {
  const q = url.searchParams.get('q');
  const lang = url.searchParams.get('lang') || 'en';

  if (!q || q.trim().length < 2) {
    return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=${encodeURIComponent(lang)}&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'dudes-landing-v1 weather-dna quiz (https://github.com/dan-ukr/dudes-landing-v1)' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } });
    }

    const data = (await res.json()) as NominatimResult[];

    const results = data.map((r) => {
      const place = r.address?.city || r.address?.town || r.address?.village || r.display_name.split(',')[0];
      const country = r.address?.country || '';
      const label = country ? `${place}, ${country}` : place;
      return { label, lat: parseFloat(r.lat), lon: parseFloat(r.lon) };
    });

    return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ results: [] }), { headers: { 'Content-Type': 'application/json' } });
  }
};
