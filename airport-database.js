// Comprehensive Airport Database Loader
// Uses OpenFlights open-source airport data (10,000+ airports worldwide)
// Data source: https://openflights.org/data

class AirportDatabase {
  constructor() {
    this.airports = new Map(); // IATA code -> airport object
    this.airportsByICAO = new Map(); // ICAO code -> airport object
    this.loaded = false;
    this.loading = false;
  }

  // Load airport data from OpenFlights GitHub
  async load() {
    if (this.loaded) return true;
    if (this.loading) {
      // Wait for existing load to complete
      while (this.loading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.loaded;
    }

    this.loading = true;
    console.log('🛫 Loading comprehensive airport database...');

    try {
      const response = await fetch('https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat');
      const text = await response.text();

      this.parseAirportData(text);

      this.loaded = true;
      this.loading = false;
      console.log(`✅ Loaded ${this.airports.size} airports from OpenFlights database`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load airport database:', error);
      this.loading = false;
      this.loadFallbackData();
      return false;
    }
  }

  // Parse OpenFlights CSV format
  parseAirportData(csvText) {
    const lines = csvText.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      // Parse CSV with proper quote handling
      const fields = this.parseCSVLine(line);

      if (fields.length < 14) continue;

      const airport = {
        id: fields[0],
        name: fields[1],
        city: fields[2],
        country: fields[3],
        iata: fields[4] === '\\N' ? null : fields[4],
        icao: fields[5] === '\\N' ? null : fields[5],
        lat: parseFloat(fields[6]),
        lng: parseFloat(fields[7]),
        altitude: parseInt(fields[8]),
        timezone: parseFloat(fields[9]),
        dst: fields[10],
        tzName: fields[11],
        type: fields[12],
        source: fields[13]
      };

      // Only store airports with valid IATA codes (for flight tracking)
      if (airport.iata && airport.iata.length === 3) {
        this.airports.set(airport.iata, airport);
      }

      // Also index by ICAO code
      if (airport.icao && airport.icao.length === 4) {
        this.airportsByICAO.set(airport.icao, airport);
      }
    }
  }

  // Parse CSV line with quote handling
  parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    fields.push(current);
    return fields;
  }

  // Load fallback data if online fetch fails
  loadFallbackData() {
    console.log('⚠️ Loading fallback airport data (major airports only)...');

    // Major airports from original flight-tracker.js
    const fallbackAirports = [
      { iata: 'JFK', name: 'John F Kennedy International', city: 'New York', country: 'United States', lat: 40.6413, lng: -73.7781 },
      { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', lat: 33.9416, lng: -118.4085 },
      { iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', lat: 51.4700, lng: -0.4543 },
      { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', lat: 49.0097, lng: 2.5479 },
      { iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', lat: 35.5494, lng: 139.7798 },
      { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates', lat: 25.2532, lng: 55.3657 },
      { iata: 'SIN', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', lat: 1.3644, lng: 103.9915 },
      { iata: 'ORD', name: 'O\'Hare International', city: 'Chicago', country: 'United States', lat: 41.9742, lng: -87.9073 },
      { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', lat: -33.9399, lng: 151.1753 },
      { iata: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', lat: 50.0379, lng: 8.5622 },
      { iata: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', country: 'United States', lat: 33.4352, lng: -112.0101 },
      { iata: 'OGG', name: 'Kahului Airport', city: 'Maui', country: 'United States', lat: 20.8986, lng: -156.4305 },
      { iata: 'HNL', name: 'Honolulu International', city: 'Honolulu', country: 'United States', lat: 21.3187, lng: -157.9225 }
    ];

    fallbackAirports.forEach(airport => {
      this.airports.set(airport.iata, airport);
    });

    this.loaded = true;
    console.log(`✅ Loaded ${this.airports.size} fallback airports`);
  }

  // Get airport by IATA code
  getAirport(iataCode) {
    if (!iataCode) return null;
    return this.airports.get(iataCode.toUpperCase()) || null;
  }

  // Get airport by ICAO code
  getAirportByICAO(icaoCode) {
    if (!icaoCode) return null;
    return this.airportsByICAO.get(icaoCode.toUpperCase()) || null;
  }

  // Search airports by name or city
  searchAirports(query) {
    if (!query || query.length < 2) return [];

    const searchTerm = query.toLowerCase();
    const results = [];

    for (const airport of this.airports.values()) {
      if (
        airport.name.toLowerCase().includes(searchTerm) ||
        airport.city.toLowerCase().includes(searchTerm) ||
        airport.iata.toLowerCase().includes(searchTerm)
      ) {
        results.push(airport);

        // Limit to 50 results for performance
        if (results.length >= 50) break;
      }
    }

    return results;
  }

  // Get all airports (for debugging/admin)
  getAllAirports() {
    return Array.from(this.airports.values());
  }

  // Check if database is ready
  isReady() {
    return this.loaded;
  }

  // Get database stats
  getStats() {
    return {
      totalAirports: this.airports.size,
      totalICAO: this.airportsByICAO.size,
      loaded: this.loaded,
      loading: this.loading
    };
  }
}

// Create global instance
window.airportDatabase = new AirportDatabase();

// Auto-load on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.airportDatabase.load();
  });
} else {
  window.airportDatabase.load();
}
