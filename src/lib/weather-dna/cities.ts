export type City = {
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** Approximate typical daily-high temperature (C), used only as an Open-Meteo fallback. */
  typicalJulyC: number;
  typicalJanC: number;
};

export const CITIES: City[] = [
  { name: 'Reykjavik', country: 'IS', lat: 64.15, lon: -21.94, typicalJulyC: 13, typicalJanC: 2 },
  { name: 'Bergen', country: 'NO', lat: 60.39, lon: 5.32, typicalJulyC: 16, typicalJanC: 2 },
  { name: 'Oslo', country: 'NO', lat: 59.91, lon: 10.75, typicalJulyC: 21, typicalJanC: -4 },
  { name: 'Stockholm', country: 'SE', lat: 59.33, lon: 18.06, typicalJulyC: 22, typicalJanC: -1 },
  { name: 'Helsinki', country: 'FI', lat: 60.17, lon: 24.94, typicalJulyC: 21, typicalJanC: -3 },
  { name: 'Copenhagen', country: 'DK', lat: 55.68, lon: 12.57, typicalJulyC: 20, typicalJanC: 2 },
  { name: 'Edinburgh', country: 'GB', lat: 55.95, lon: -3.19, typicalJulyC: 18, typicalJanC: 6 },
  { name: 'Dublin', country: 'IE', lat: 53.35, lon: -6.26, typicalJulyC: 18, typicalJanC: 6 },
  { name: 'London', country: 'GB', lat: 51.51, lon: -0.13, typicalJulyC: 23, typicalJanC: 8 },
  { name: 'Amsterdam', country: 'NL', lat: 52.37, lon: 4.9, typicalJulyC: 21, typicalJanC: 5 },
  { name: 'Brussels', country: 'BE', lat: 50.85, lon: 4.35, typicalJulyC: 22, typicalJanC: 5 },
  { name: 'Paris', country: 'FR', lat: 48.86, lon: 2.35, typicalJulyC: 25, typicalJanC: 6 },
  { name: 'Hamburg', country: 'DE', lat: 53.55, lon: 9.99, typicalJulyC: 22, typicalJanC: 3 },
  { name: 'Berlin', country: 'DE', lat: 52.52, lon: 13.4, typicalJulyC: 24, typicalJanC: 2 },
  { name: 'Cologne', country: 'DE', lat: 50.94, lon: 6.96, typicalJulyC: 23, typicalJanC: 4 },
  { name: 'Frankfurt', country: 'DE', lat: 50.11, lon: 8.68, typicalJulyC: 24, typicalJanC: 3 },
  { name: 'Munich', country: 'DE', lat: 48.14, lon: 11.58, typicalJulyC: 23, typicalJanC: 1 },
  { name: 'Vienna', country: 'AT', lat: 48.21, lon: 16.37, typicalJulyC: 25, typicalJanC: 1 },
  { name: 'Zurich', country: 'CH', lat: 47.38, lon: 8.54, typicalJulyC: 24, typicalJanC: 1 },
  { name: 'Geneva', country: 'CH', lat: 46.2, lon: 6.14, typicalJulyC: 25, typicalJanC: 3 },
  { name: 'Prague', country: 'CZ', lat: 50.08, lon: 14.44, typicalJulyC: 23, typicalJanC: 0 },
  { name: 'Warsaw', country: 'PL', lat: 52.23, lon: 21.01, typicalJulyC: 23, typicalJanC: -2 },
  { name: 'Krakow', country: 'PL', lat: 50.06, lon: 19.94, typicalJulyC: 23, typicalJanC: -2 },
  { name: 'Budapest', country: 'HU', lat: 47.5, lon: 19.04, typicalJulyC: 27, typicalJanC: 1 },
  { name: 'Bratislava', country: 'SK', lat: 48.15, lon: 17.11, typicalJulyC: 26, typicalJanC: 0 },
  { name: 'Ljubljana', country: 'SI', lat: 46.06, lon: 14.51, typicalJulyC: 26, typicalJanC: 2 },
  { name: 'Zagreb', country: 'HR', lat: 45.81, lon: 15.98, typicalJulyC: 27, typicalJanC: 2 },
  { name: 'Belgrade', country: 'RS', lat: 44.79, lon: 20.45, typicalJulyC: 28, typicalJanC: 3 },
  { name: 'Bucharest', country: 'RO', lat: 44.43, lon: 26.1, typicalJulyC: 29, typicalJanC: 0 },
  { name: 'Sofia', country: 'BG', lat: 42.7, lon: 23.32, typicalJulyC: 27, typicalJanC: 1 },
  { name: 'Vilnius', country: 'LT', lat: 54.69, lon: 25.28, typicalJulyC: 22, typicalJanC: -4 },
  { name: 'Riga', country: 'LV', lat: 56.95, lon: 24.11, typicalJulyC: 21, typicalJanC: -3 },
  { name: 'Tallinn', country: 'EE', lat: 59.44, lon: 24.75, typicalJulyC: 20, typicalJanC: -4 },
  { name: 'Kyiv', country: 'UA', lat: 50.45, lon: 30.52, typicalJulyC: 24, typicalJanC: -3 },
  { name: 'Minsk', country: 'BY', lat: 53.9, lon: 27.57, typicalJulyC: 22, typicalJanC: -5 },
  { name: 'Milan', country: 'IT', lat: 45.46, lon: 9.19, typicalJulyC: 29, typicalJanC: 4 },
  { name: 'Venice', country: 'IT', lat: 45.44, lon: 12.32, typicalJulyC: 27, typicalJanC: 5 },
  { name: 'Florence', country: 'IT', lat: 43.77, lon: 11.26, typicalJulyC: 30, typicalJanC: 7 },
  { name: 'Rome', country: 'IT', lat: 41.9, lon: 12.5, typicalJulyC: 30, typicalJanC: 8 },
  { name: 'Naples', country: 'IT', lat: 40.85, lon: 14.27, typicalJulyC: 29, typicalJanC: 9 },
  { name: 'Palermo', country: 'IT', lat: 38.12, lon: 13.36, typicalJulyC: 30, typicalJanC: 11 },
  { name: 'Madrid', country: 'ES', lat: 40.42, lon: -3.7, typicalJulyC: 33, typicalJanC: 6 },
  { name: 'Barcelona', country: 'ES', lat: 41.39, lon: 2.16, typicalJulyC: 28, typicalJanC: 8 },
  { name: 'Valencia', country: 'ES', lat: 39.47, lon: -0.38, typicalJulyC: 30, typicalJanC: 9 },
  { name: 'Seville', country: 'ES', lat: 37.39, lon: -5.99, typicalJulyC: 36, typicalJanC: 9 },
  { name: 'Lisbon', country: 'PT', lat: 38.72, lon: -9.14, typicalJulyC: 28, typicalJanC: 9 },
  { name: 'Porto', country: 'PT', lat: 41.15, lon: -8.61, typicalJulyC: 25, typicalJanC: 7 },
  { name: 'Athens', country: 'GR', lat: 37.98, lon: 23.73, typicalJulyC: 33, typicalJanC: 9 },
  { name: 'Thessaloniki', country: 'GR', lat: 40.64, lon: 22.94, typicalJulyC: 32, typicalJanC: 5 },
  { name: 'Istanbul', country: 'TR', lat: 41.01, lon: 28.98, typicalJulyC: 28, typicalJanC: 6 },
  { name: 'Nice', country: 'FR', lat: 43.7, lon: 7.27, typicalJulyC: 27, typicalJanC: 6 },
  { name: 'Marseille', country: 'FR', lat: 43.3, lon: 5.37, typicalJulyC: 29, typicalJanC: 5 },
];
