// Flight Tracker Module - Manual Entry Only
// Supports both airport codes and city names

class FlightTracker {
  constructor() {
    this.activeFlights = new Map();

    // Common city name mappings to coordinates
    this.cityDatabase = {
      // North America
      'new york': { name: 'New York', lat: 40.7128, lng: -74.0060 },
      'nyc': { name: 'New York', lat: 40.7128, lng: -74.0060 },
      'los angeles': { name: 'Los Angeles', lat: 33.9416, lng: -118.4085 },
      'la': { name: 'Los Angeles', lat: 33.9416, lng: -118.4085 },
      'chicago': { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
      'dallas': { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
      'san francisco': { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      'sf': { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
      'seattle': { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
      'las vegas': { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
      'vegas': { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
      'atlanta': { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
      'boston': { name: 'Boston', lat: 42.3601, lng: -71.0589 },
      'washington': { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
      'washington dc': { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
      'dc': { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
      'miami': { name: 'Miami', lat: 25.7617, lng: -80.1918 },
      'orlando': { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
      'phoenix': { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
      'denver': { name: 'Denver', lat: 39.7392, lng: -104.9903 },
      'maui': { name: 'Maui', lat: 20.7984, lng: -156.3319 },
      'honolulu': { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
      'hawaii': { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
      'toronto': { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
      'vancouver': { name: 'Vancouver', lat: 49.2827, lng: -123.1207 },
      'montreal': { name: 'Montreal', lat: 45.5017, lng: -73.5673 },
      'mexico city': { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
      'cancun': { name: 'Cancun', lat: 21.1619, lng: -86.8515 },

      // Europe
      'london': { name: 'London', lat: 51.5074, lng: -0.1278 },
      'paris': { name: 'Paris', lat: 48.8566, lng: 2.3522 },
      'frankfurt': { name: 'Frankfurt', lat: 50.1109, lng: 8.6821 },
      'amsterdam': { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
      'madrid': { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
      'barcelona': { name: 'Barcelona', lat: 41.3851, lng: 2.1734 },
      'rome': { name: 'Rome', lat: 41.9028, lng: 12.4964 },
      'milan': { name: 'Milan', lat: 45.4642, lng: 9.1900 },
      'munich': { name: 'Munich', lat: 48.1351, lng: 11.5820 },
      'zurich': { name: 'Zurich', lat: 47.3769, lng: 8.5417 },
      'vienna': { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
      'copenhagen': { name: 'Copenhagen', lat: 55.6761, lng: 12.5683 },
      'stockholm': { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
      'dublin': { name: 'Dublin', lat: 53.3498, lng: -6.2603 },
      'lisbon': { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },
      'athens': { name: 'Athens', lat: 37.9838, lng: 23.7275 },
      'berlin': { name: 'Berlin', lat: 52.5200, lng: 13.4050 },

      // Asia Pacific
      'tokyo': { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
      'singapore': { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
      'hong kong': { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
      'seoul': { name: 'Seoul', lat: 37.5665, lng: 126.9780 },
      'beijing': { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
      'shanghai': { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
      'mumbai': { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
      'delhi': { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
      'new delhi': { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
      'bangkok': { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
      'kuala lumpur': { name: 'Kuala Lumpur', lat: 3.1390, lng: 101.6869 },
      'sydney': { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
      'melbourne': { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
      'auckland': { name: 'Auckland', lat: -36.8509, lng: 174.7645 },
      'bali': { name: 'Bali', lat: -8.3405, lng: 115.0920 },
      'manila': { name: 'Manila', lat: 14.5995, lng: 120.9842 },
      'taipei': { name: 'Taipei', lat: 25.0330, lng: 121.5654 },
      'osaka': { name: 'Osaka', lat: 34.6937, lng: 135.5023 },

      // Middle East
      'dubai': { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
      'doha': { name: 'Doha', lat: 25.2854, lng: 51.5310 },
      'abu dhabi': { name: 'Abu Dhabi', lat: 24.4539, lng: 54.3773 },
      'istanbul': { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
      'tel aviv': { name: 'Tel Aviv', lat: 32.0853, lng: 34.7818 },
      'riyadh': { name: 'Riyadh', lat: 24.7136, lng: 46.6753 },

      // South America
      'sao paulo': { name: 'Sao Paulo', lat: -23.5505, lng: -46.6333 },
      'rio de janeiro': { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
      'rio': { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
      'buenos aires': { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
      'bogota': { name: 'Bogota', lat: 4.7110, lng: -74.0721 },
      'lima': { name: 'Lima', lat: -12.0464, lng: -77.0428 },
      'santiago': { name: 'Santiago', lat: -33.4489, lng: -70.6693 },

      // Africa
      'cairo': { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
      'johannesburg': { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
      'cape town': { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
      'nairobi': { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
      'lagos': { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
      'casablanca': { name: 'Casablanca', lat: 33.5731, lng: -7.5898 }
    };

    // Airport code to city mappings
    this.airportToCity = {
      'JFK': 'new york', 'LGA': 'new york', 'EWR': 'new york',
      'LAX': 'los angeles', 'SFO': 'san francisco', 'OAK': 'san francisco',
      'ORD': 'chicago', 'MDW': 'chicago',
      'DFW': 'dallas', 'DAL': 'dallas',
      'SEA': 'seattle', 'LAS': 'las vegas',
      'ATL': 'atlanta', 'BOS': 'boston',
      'IAD': 'washington dc', 'DCA': 'washington dc', 'BWI': 'washington dc',
      'MIA': 'miami', 'FLL': 'miami',
      'MCO': 'orlando', 'PHX': 'phoenix', 'DEN': 'denver',
      'OGG': 'maui', 'HNL': 'honolulu',
      'YYZ': 'toronto', 'YVR': 'vancouver', 'YUL': 'montreal',
      'MEX': 'mexico city', 'CUN': 'cancun',
      'LHR': 'london', 'LGW': 'london', 'STN': 'london',
      'CDG': 'paris', 'ORY': 'paris',
      'FRA': 'frankfurt', 'AMS': 'amsterdam',
      'MAD': 'madrid', 'BCN': 'barcelona',
      'FCO': 'rome', 'MXP': 'milan',
      'MUC': 'munich', 'ZRH': 'zurich', 'VIE': 'vienna',
      'CPH': 'copenhagen', 'ARN': 'stockholm',
      'DUB': 'dublin', 'LIS': 'lisbon', 'ATH': 'athens', 'BER': 'berlin',
      'HND': 'tokyo', 'NRT': 'tokyo',
      'SIN': 'singapore', 'HKG': 'hong kong',
      'ICN': 'seoul', 'PEK': 'beijing', 'PVG': 'shanghai',
      'BOM': 'mumbai', 'DEL': 'delhi',
      'BKK': 'bangkok', 'KUL': 'kuala lumpur',
      'SYD': 'sydney', 'MEL': 'melbourne',
      'DXB': 'dubai', 'DOH': 'doha', 'AUH': 'abu dhabi',
      'IST': 'istanbul', 'TLV': 'tel aviv',
      'GRU': 'sao paulo', 'GIG': 'rio de janeiro',
      'EZE': 'buenos aires', 'BOG': 'bogota', 'LIM': 'lima',
      'CAI': 'cairo', 'JNB': 'johannesburg', 'CPT': 'cape town', 'NBO': 'nairobi'
    };
  }

  // Get city by name (case-insensitive)
  getCity(cityName) {
    if (!cityName) return null;
    const normalized = cityName.toLowerCase().trim();
    return this.cityDatabase[normalized] || null;
  }

  // Get city from airport code
  getCityFromAirport(airportCode) {
    if (!airportCode) return null;
    const cityKey = this.airportToCity[airportCode.toUpperCase()];
    return cityKey ? this.cityDatabase[cityKey] : null;
  }

  // Extract route from event - looks for "City to City" or "City - City" patterns
  extractRouteFromEvent(event) {
    const title = event.title || '';
    const notes = event.extendedProps?.notes || event.extendedProps?.description || '';
    const location = event.extendedProps?.location || '';

    // Combine all text sources, prioritizing notes
    const combined = `${notes} ${title} ${location}`;

    console.log('Extracting route from:', combined);

    // Try different patterns

    // Pattern 1: "City to City" or "City - City" or "City → City"
    const routePatterns = [
      /(?:from\s+)?(.+?)\s+(?:to|->|→|–|—)\s+(.+?)(?:\s*$|\s*,|\s*\n)/i,
      /(.+?)\s*[-→>]\s*(.+?)(?:\s*$|\s*,|\s*\n)/i
    ];

    for (const pattern of routePatterns) {
      const match = combined.match(pattern);
      if (match) {
        const originName = match[1].trim();
        const destName = match[2].trim();

        // Try to find these cities
        let origin = this.getCity(originName) || this.getCityFromAirport(originName);
        let dest = this.getCity(destName) || this.getCityFromAirport(destName);

        if (origin && dest) {
          console.log('Found route:', origin.name, '→', dest.name);
          return { origin, destination: dest };
        }
      }
    }

    // Pattern 2: Look for two city names anywhere in the text
    const cityNames = Object.keys(this.cityDatabase);
    const foundCities = [];

    const lowerCombined = combined.toLowerCase();
    for (const cityName of cityNames) {
      if (lowerCombined.includes(cityName)) {
        const city = this.cityDatabase[cityName];
        // Avoid duplicates (same actual city)
        if (!foundCities.find(c => c.name === city.name)) {
          foundCities.push(city);
        }
      }
    }

    if (foundCities.length >= 2) {
      console.log('Found cities:', foundCities[0].name, '→', foundCities[1].name);
      return { origin: foundCities[0], destination: foundCities[1] };
    }

    // Pattern 3: Look for airport codes
    const airportPattern = /\b([A-Z]{3})\b/g;
    const codes = [...combined.toUpperCase().matchAll(airportPattern)].map(m => m[1]);
    const validCities = codes
      .map(code => this.getCityFromAirport(code))
      .filter(city => city !== null);

    // Remove duplicates
    const uniqueCities = [];
    for (const city of validCities) {
      if (!uniqueCities.find(c => c.name === city.name)) {
        uniqueCities.push(city);
      }
    }

    if (uniqueCities.length >= 2) {
      console.log('Found from airport codes:', uniqueCities[0].name, '→', uniqueCities[1].name);
      return { origin: uniqueCities[0], destination: uniqueCities[1] };
    }

    console.log('No route found');
    return null;
  }

  // Extract flight number from event
  extractFlightNumber(event) {
    const title = event.title || '';
    const notes = event.extendedProps?.notes || event.extendedProps?.description || '';
    const combined = `${title} ${notes}`.toUpperCase();

    // Match common flight number patterns: AA1234, UA 456, DL-789, etc.
    const flightPattern = /\b([A-Z]{2})\s*[-]?\s*(\d{1,4})\b/g;
    const matches = [...combined.matchAll(flightPattern)];

    if (matches.length > 0) {
      return matches.map(m => `${m[1]}${m[2]}`);
    }

    return null;
  }

  // Calculate distance between two points (Haversine formula)
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Estimate flight duration based on distance (avg 500 mph)
  estimateFlightDuration(origin, destination) {
    if (!origin || !destination) return null;
    const distance = this.calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const hours = distance / 500;
    return Math.round(hours * 60); // Return minutes
  }
}

// Export for use in dashboard.js
window.FlightTracker = FlightTracker;
