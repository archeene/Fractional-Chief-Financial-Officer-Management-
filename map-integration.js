// Google Maps Integration for Flight Tracker
// Manual flight tracking with city name support

class MapIntegration {
  constructor() {
    this.map = null;
    this.markers = [];
    this.polylines = [];
    this.trackedFlights = [];
    this.flightTracker = window.FlightTracker ? new FlightTracker() : null;
    this.clientMarkers = [];
    this.employeeMarkers = [];
    this.flightInfoWindows = [];
    this.planeMarkers = [];
    this.STORAGE_KEY = 'tracked_flights';
    this.landedCheckInterval = null;
  }

  // Show styled warning modal (uses dashboard's showConfirmModal if available)
  async showWarning(title, message) {
    if (window.showConfirmModal) {
      await window.showConfirmModal({
        icon: '⚠️',
        title: title,
        message: message,
        confirmText: 'OK',
        cancelText: null,
        type: 'warning'
      });
    } else {
      alert(`${title}\n\n${message}`);
    }
  }

  // Save flights to localStorage
  saveFlights() {
    const flightsData = this.trackedFlights.map(flight => ({
      flightNumber: flight.flightNumber,
      originName: flight.origin.name,
      destName: flight.destination.name,
      originLat: flight.origin.lat,
      originLng: flight.origin.lng,
      destLat: flight.destination.lat,
      destLng: flight.destination.lng,
      departureTime: flight.departureTime || null,
      arrivalTime: flight.arrivalTime || null,
      status: flight.status || 'Scheduled'
    }));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(flightsData));
    console.log('Saved flights to storage:', flightsData);
  }

  // Load flights from localStorage
  async loadSavedFlights() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (!saved) return;

    try {
      const flightsData = JSON.parse(saved);
      console.log('Loading saved flights:', flightsData);

      for (const flightData of flightsData) {
        // Reconstruct flight from saved data
        const flight = {
          flightNumber: flightData.flightNumber,
          origin: { name: flightData.originName, lat: flightData.originLat, lng: flightData.originLng },
          destination: { name: flightData.destName, lat: flightData.destLat, lng: flightData.destLng },
          route: { origin: flightData.originName, destination: flightData.destName },
          departureTime: flightData.departureTime,
          arrivalTime: flightData.arrivalTime,
          status: flightData.status || 'Scheduled',
          timestamp: new Date()
        };

        // Check for duplicate
        const isDuplicate = this.trackedFlights.some(f =>
          f.origin.name === flight.origin.name && f.destination.name === flight.destination.name
        );

        if (!isDuplicate) {
          this.trackedFlights.push(flight);
        }
      }

      // Render all loaded flights
      this.sortFlightsByDeparture();
      this.trackedFlights.forEach(f => this.renderFlight(f));
      this.updateFlightsList();

    } catch (error) {
      console.error('Error loading saved flights:', error);
    }
  }

  // Initialize Google Map
  async initMap(mapElement) {
    console.log('Initializing Google Map...');

    const mapOptions = {
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      center: { lat: 20, lng: 0 },
      mapTypeId: 'terrain',
      restriction: {
        latLngBounds: { north: 85, south: -85, west: -180, east: 180 },
        strictBounds: true
      },
      styles: [
        { elementType: 'geometry', stylers: [{ color: '#0a0e27' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e27' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#00ff41' }] },
        { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#00ff41' }, { weight: 0.5 }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1834' }] },
        { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#00cc33' }] },
        { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f1834' }] },
        { featureType: 'road', stylers: [{ visibility: 'simplified' }, { color: '#1a2040' }] }
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: true,
      scaleControl: true,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true
    };

    this.map = new google.maps.Map(mapElement, mapOptions);
    console.log('Map initialized');

    // Load saved flights after a short delay
    setTimeout(() => {
      this.loadSavedFlights();
    }, 1000);

    // Start checking for landed flights every minute
    this.startLandedCheck();

    return this.map;
  }

  // Add flight manually with city data
  async addFlightWithCities({ flightNumber, origin, destination, departureTime, arrivalTime }) {
    if (!origin || !destination) {
      await this.showWarning('Missing Route', 'Please enter both departure and arrival cities.');
      return null;
    }

    // Check for duplicate
    const isDuplicate = this.trackedFlights.some(f =>
      f.origin.name === origin.name && f.destination.name === destination.name
    );
    if (isDuplicate) {
      console.log('Flight already tracked:', origin.name, '→', destination.name);
      return null;
    }

    // Calculate estimated arrival if not provided
    let estimatedArrival = arrivalTime;
    if (!estimatedArrival && departureTime && this.flightTracker) {
      const durationMinutes = this.flightTracker.estimateFlightDuration(origin, destination);
      if (durationMinutes) {
        const depDate = new Date(departureTime);
        estimatedArrival = new Date(depDate.getTime() + durationMinutes * 60 * 1000).toISOString();
      }
    }

    // Determine status based on times
    let status = 'Scheduled';
    const now = new Date();
    if (departureTime && estimatedArrival) {
      const depTime = new Date(departureTime);
      const arrTime = new Date(estimatedArrival);
      if (now >= arrTime) {
        status = 'Landed';
      } else if (now >= depTime) {
        status = 'In Flight';
      }
    }

    const flight = {
      flightNumber: flightNumber || `${origin.name} - ${destination.name}`,
      route: { origin: origin.name, destination: destination.name },
      origin: origin,
      destination: destination,
      departureTime: departureTime || null,
      arrivalTime: estimatedArrival || null,
      status: status,
      timestamp: new Date()
    };

    this.trackedFlights.push(flight);
    this.sortFlightsByDeparture();

    // Re-render all flights
    this.clearMapMarkers();
    this.trackedFlights.forEach(f => this.renderFlight(f));
    this.updateFlightsList();
    this.saveFlights();

    return flight;
  }

  // Add flight from calendar event (uses city names from notes)
  async addFlightFromCalendar(event) {
    if (!this.flightTracker) {
      await this.showWarning('Not Ready', 'Flight tracker not initialized. Please try again.');
      return null;
    }

    const route = this.flightTracker.extractRouteFromEvent(event);
    const flightNumbers = this.flightTracker.extractFlightNumber(event);

    if (!route) {
      await this.showWarning(
        'Route Not Found',
        'Could not detect flight route from event.\n\nIn the event notes, include cities like:\n• "New York to Los Angeles"\n• "Miami - Chicago"\n• "London → Paris"'
      );
      return null;
    }

    // Use event start/end times
    const departureTime = event.start ? new Date(event.start).toISOString() : null;
    const arrivalTime = event.end ? new Date(event.end).toISOString() : null;

    return this.addFlightWithCities({
      flightNumber: flightNumbers ? flightNumbers[0] : null,
      origin: route.origin,
      destination: route.destination,
      departureTime: departureTime,
      arrivalTime: arrivalTime
    });
  }

  // Add flight from manual input (route string like "New York to LA")
  async addFlightFromInput({ flightNumber, routeString, departureTime, arrivalTime }) {
    if (!this.flightTracker) {
      await this.showWarning('Not Ready', 'Flight tracker not initialized. Please try again.');
      return null;
    }

    if (!routeString) {
      await this.showWarning('Missing Route', 'Please enter a route (e.g., "New York to Los Angeles")');
      return null;
    }

    // Create a fake event to use extractRouteFromEvent
    const fakeEvent = {
      title: routeString,
      extendedProps: { notes: routeString }
    };

    const route = this.flightTracker.extractRouteFromEvent(fakeEvent);

    if (!route) {
      await this.showWarning(
        'Route Not Found',
        `Could not find cities in: "${routeString}"\n\nTry formats like:\n• "New York to Los Angeles"\n• "Miami - Chicago"\n• "London → Paris"\n• "JFK - LAX" (airport codes)`
      );
      return null;
    }

    return this.addFlightWithCities({
      flightNumber: flightNumber || null,
      origin: route.origin,
      destination: route.destination,
      departureTime: departureTime ? new Date(departureTime).toISOString() : null,
      arrivalTime: arrivalTime ? new Date(arrivalTime).toISOString() : null
    });
  }

  // Sort flights by departure time
  sortFlightsByDeparture() {
    this.trackedFlights.sort((a, b) => {
      if (!a.departureTime && !b.departureTime) return 0;
      if (!a.departureTime) return 1;
      if (!b.departureTime) return -1;
      return new Date(a.departureTime) - new Date(b.departureTime);
    });
  }

  // Clear map markers
  clearMapMarkers() {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    this.polylines.forEach(line => line.setMap(null));
    this.polylines = [];
    this.flightInfoWindows.forEach(infoWindow => infoWindow?.close());
    this.flightInfoWindows = [];
    this.planeMarkers = [];
  }

  // Render flight on map
  renderFlight(flight) {
    if (!this.map) return;

    console.log(`Rendering flight: ${flight.flightNumber}`);

    // Add origin marker
    const originMarker = new google.maps.Marker({
      position: { lat: flight.origin.lat, lng: flight.origin.lng },
      map: this.map,
      title: `${flight.origin.name} (Departure)`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#00ff41',
        fillOpacity: 1,
        strokeColor: '#00ff41',
        strokeWeight: 3
      },
      animation: google.maps.Animation.DROP
    });

    // Add plane icon
    const planeMarker = new google.maps.Marker({
      position: { lat: flight.origin.lat + 0.3, lng: flight.origin.lng + 0.3 },
      map: this.map,
      title: `Flight ${flight.flightNumber}`,
      icon: {
        url: 'Assets/plane.png',
        scaledSize: new google.maps.Size(50, 50),
        anchor: new google.maps.Point(25, 25)
      },
      animation: google.maps.Animation.DROP,
      zIndex: 1000
    });

    // Format times
    let departureDisplay = 'Not set';
    let arrivalDisplay = 'Not set';

    if (flight.departureTime) {
      const depTime = new Date(flight.departureTime);
      departureDisplay = depTime.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
      });
    }

    if (flight.arrivalTime) {
      const arrTime = new Date(flight.arrivalTime);
      arrivalDisplay = arrTime.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
      });
    }

    // Status info
    let statusColor = '#00cc00';
    let statusIcon = '✅';
    if (flight.status === 'In Flight') {
      statusColor = '#00ff41';
      statusIcon = '✈️';
    } else if (flight.status === 'Landed') {
      statusColor = '#888888';
      statusIcon = '🛬';
    }

    // Info window
    const infoWindow = new google.maps.InfoWindow({
      content: `
        <div style="color: #0a0e27; font-family: 'VT323', monospace; padding: 10px; min-width: 250px;">
          <div style="font-size: 20px; font-weight: bold; margin-bottom: 10px; border-bottom: 2px solid #00ff41; padding-bottom: 5px;">
            ✈️ ${flight.flightNumber}
          </div>
          <div style="line-height: 1.8;">
            <strong>FROM:</strong> ${flight.origin.name}<br>
            <strong>TO:</strong> ${flight.destination.name}<br>
            <strong>DEPARTS:</strong> ${departureDisplay}<br>
            <strong>ARRIVES:</strong> ${arrivalDisplay}<br>
            <div style="margin: 8px 0; padding: 8px; background: ${statusColor}20; border-left: 3px solid ${statusColor};">
              <strong>STATUS:</strong> <span style="color: ${statusColor};">${statusIcon} ${flight.status}</span>
            </div>
          </div>
        </div>
      `
    });

    planeMarker.addListener('click', () => {
      infoWindow.open(this.map, planeMarker);
    });

    // Store references
    const flightIndex = this.trackedFlights.indexOf(flight);
    if (flightIndex !== -1) {
      this.flightInfoWindows[flightIndex] = infoWindow;
      this.planeMarkers[flightIndex] = planeMarker;
    }

    // Add destination marker
    const destMarker = new google.maps.Marker({
      position: { lat: flight.destination.lat, lng: flight.destination.lng },
      map: this.map,
      title: `${flight.destination.name} (Arrival)`,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#ff0040',
        fillOpacity: 1,
        strokeColor: '#ff0040',
        strokeWeight: 3
      },
      animation: google.maps.Animation.DROP
    });

    this.markers.push(originMarker, planeMarker, destMarker);

    // Draw flight path
    const flightPath = new google.maps.Polyline({
      path: [
        { lat: flight.origin.lat, lng: flight.origin.lng },
        { lat: flight.destination.lat, lng: flight.destination.lng }
      ],
      geodesic: true,
      strokeColor: flight.status === 'In Flight' ? '#00ff41' : '#00cc33',
      strokeOpacity: 1.0,
      strokeWeight: 3,
      map: this.map
    });

    this.polylines.push(flightPath);

    // Fit map to show all markers
    const bounds = new google.maps.LatLngBounds();
    this.markers.forEach(marker => {
      bounds.extend(marker.getPosition());
    });
    this.map.fitBounds(bounds);
  }

  // Clear all flights
  clearAllFlights() {
    this.markers.forEach(marker => marker.setMap(null));
    this.markers = [];
    this.polylines.forEach(line => line.setMap(null));
    this.polylines = [];
    this.flightInfoWindows.forEach(infoWindow => infoWindow?.close());
    this.flightInfoWindows = [];
    this.planeMarkers = [];
    this.trackedFlights = [];
    this.updateFlightsList();
    this.saveFlights();

    if (this.map) {
      this.map.setCenter({ lat: 20, lng: 0 });
      this.map.setZoom(2);
    }
  }

  // Update flights list display
  updateFlightsList() {
    const listElement = document.getElementById('trackedFlightsList');
    if (!listElement) return;

    if (this.trackedFlights.length === 0) {
      listElement.innerHTML = '<div class="no-flights-message">No flights tracked. Add a flight using the form above or from a calendar event.</div>';
      return;
    }

    listElement.innerHTML = this.trackedFlights.map((flight, index) => {
      let departureDisplay = 'No time set';
      const now = new Date();

      if (flight.departureTime) {
        const depTime = new Date(flight.departureTime);
        const isToday = depTime.toDateString() === now.toDateString();
        const isTomorrow = depTime.toDateString() === new Date(now.getTime() + 86400000).toDateString();

        if (isToday) {
          departureDisplay = `Today ${depTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else if (isTomorrow) {
          departureDisplay = `Tomorrow ${depTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
        } else {
          departureDisplay = depTime.toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
          });
        }
      }

      // Status display
      let statusClass = 'status-scheduled';
      let statusText = '📅 Scheduled';

      if (flight.status === 'In Flight') {
        statusClass = 'status-live';
        statusText = '✈️ IN FLIGHT';
      } else if (flight.status === 'Landed') {
        statusClass = 'status-landed';
        statusText = '🛬 Landed';
      }

      return `
        <div class="tracked-flight-item" data-flight-index="${index}">
          <div class="tracked-flight-info" title="Click to focus on map">
            <div class="tracked-flight-number">${flight.flightNumber}</div>
            <div class="tracked-flight-route">${flight.origin.name} → ${flight.destination.name}</div>
            <div class="tracked-flight-time">🕐 ${departureDisplay}</div>
          </div>
          <div class="tracked-flight-actions">
            <div class="tracked-flight-status ${statusClass}">${statusText}</div>
            <button class="delete-flight-btn" data-delete-index="${index}" title="Remove flight">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    document.querySelectorAll('.tracked-flight-info').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.parentElement.dataset.flightIndex);
        this.openFlightInfo(index);
      });
    });

    document.querySelectorAll('.delete-flight-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.deleteIndex);
        this.removeFlight(index);
      });
    });
  }

  // Remove a flight
  removeFlight(index) {
    if (index >= 0 && index < this.trackedFlights.length) {
      const flight = this.trackedFlights[index];
      console.log(`Removing flight: ${flight.origin.name} → ${flight.destination.name}`);

      this.trackedFlights.splice(index, 1);
      this.clearMapMarkers();
      this.trackedFlights.forEach(f => this.renderFlight(f));
      this.updateFlightsList();
      this.saveFlights();
    }
  }

  // Focus on flight
  focusOnFlight(index) {
    const flight = this.trackedFlights[index];
    if (!flight || !this.map) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: flight.origin.lat, lng: flight.origin.lng });
    bounds.extend({ lat: flight.destination.lat, lng: flight.destination.lng });
    this.map.fitBounds(bounds);
  }

  // Open flight info popup
  openFlightInfo(index) {
    const infoWindow = this.flightInfoWindows[index];
    const planeMarker = this.planeMarkers[index];

    if (infoWindow && planeMarker && this.map) {
      this.focusOnFlight(index);
      infoWindow.open(this.map, planeMarker);
    }
  }

  // Check for landed flights and remove them
  checkLandedFlights() {
    const now = new Date();
    let hasChanges = false;

    this.trackedFlights = this.trackedFlights.filter(flight => {
      if (flight.arrivalTime) {
        const arrTime = new Date(flight.arrivalTime);
        // Remove if landed more than 30 minutes ago
        if (now > new Date(arrTime.getTime() + 30 * 60 * 1000)) {
          console.log(`Auto-removing landed flight: ${flight.flightNumber}`);
          hasChanges = true;
          return false;
        }
        // Update status to "Landed" if past arrival time
        if (now >= arrTime && flight.status !== 'Landed') {
          flight.status = 'Landed';
          hasChanges = true;
        }
      }

      // Update status to "In Flight" if between departure and arrival
      if (flight.departureTime && flight.arrivalTime) {
        const depTime = new Date(flight.departureTime);
        const arrTime = new Date(flight.arrivalTime);
        if (now >= depTime && now < arrTime && flight.status !== 'In Flight') {
          flight.status = 'In Flight';
          hasChanges = true;
        }
      }

      return true;
    });

    if (hasChanges) {
      this.clearMapMarkers();
      this.trackedFlights.forEach(f => this.renderFlight(f));
      this.updateFlightsList();
      this.saveFlights();
    }
  }

  // Start checking for landed flights
  startLandedCheck() {
    if (this.landedCheckInterval) return;
    this.landedCheckInterval = setInterval(() => {
      this.checkLandedFlights();
    }, 60000);
  }

  // Stop checking for landed flights
  stopLandedCheck() {
    if (this.landedCheckInterval) {
      clearInterval(this.landedCheckInterval);
      this.landedCheckInterval = null;
    }
  }

  // ==========================================
  // Client Markers
  // ==========================================

  async addClientMarkers(clients) {
    if (!this.map || !clients) return;
    console.log('Adding client markers to map...');

    this.clientMarkers.forEach(item => {
      if (item.marker) item.marker.setMap(null);
      if (item.label) item.label.setMap(null);
    });
    this.clientMarkers = [];

    for (const client of clients) {
      await this.addClientMarker(client);
    }
    console.log(`Added ${this.clientMarkers.length} client markers`);
  }

  async addClientMarker(client) {
    if (!this.map || !client.location) return;

    try {
      const coords = await this.geocodeLocation(client.location);
      if (!coords) {
        console.warn(`Could not geocode location for ${client.name}: ${client.location}`);
        return;
      }

      let icon;
      if (client.photo) {
        icon = { url: client.photo, scaledSize: new google.maps.Size(60, 60), anchor: new google.maps.Point(30, 60) };
      } else {
        icon = { url: 'Assets/Client.png', scaledSize: new google.maps.Size(60, 60), anchor: new google.maps.Point(30, 60) };
      }

      const marker = new google.maps.Marker({
        position: coords,
        map: this.map,
        title: client.name,
        icon: icon,
        zIndex: 1000
      });

      const labelOverlay = this.createClientLabel(client.name, coords);

      marker.addListener('click', () => {
        this.openClientHUD(client);
      });

      this.clientMarkers.push({ marker, label: labelOverlay });
    } catch (error) {
      console.error(`Error adding client marker for ${client.name}:`, error);
    }
  }

  createClientLabel(clientName, position) {
    const label = new google.maps.Marker({
      position: { lat: position.lat + 0.5, lng: position.lng },
      map: this.map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
      label: {
        text: clientName.toUpperCase(),
        color: '#ff8800',
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'VT323, monospace'
      },
      zIndex: 1001
    });
    return label;
  }

  async geocodeLocation(locationString) {
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      return new Promise((resolve) => {
        geocoder.geocode({ address: locationString }, (results, status) => {
          if (status === 'OK' && results[0]) {
            resolve({
              lat: results[0].geometry.location.lat(),
              lng: results[0].geometry.location.lng()
            });
          } else {
            resolve(null);
          }
        });
      });
    }
    return null;
  }

  openClientHUD(client) {
    if (window.showClientCard) {
      window.showClientCard(client);
    } else {
      window.dispatchEvent(new CustomEvent('openClientHUD', { detail: client }));
    }
  }

  async refreshClientMarkers() {
    const stored = localStorage.getItem('cfo_clients');
    if (stored) {
      try {
        const clients = JSON.parse(stored);
        await this.addClientMarkers(clients);
      } catch (e) {
        console.error('Failed to load clients for markers:', e);
      }
    }
  }

  // ==========================================
  // Employee Markers
  // ==========================================

  async addEmployeeMarkers(employees) {
    if (!this.map || !employees) return;
    console.log('Adding employee markers to map...');

    this.employeeMarkers.forEach(item => {
      if (item.marker) item.marker.setMap(null);
      if (item.label) item.label.setMap(null);
    });
    this.employeeMarkers = [];

    for (const employee of employees) {
      await this.addEmployeeMarker(employee);
    }
    console.log(`Added ${this.employeeMarkers.length} employee markers`);
  }

  async addEmployeeMarker(employee) {
    if (!this.map || !employee.location) return;

    try {
      const coords = await this.geocodeLocation(employee.location);
      if (!coords) {
        console.warn(`Could not geocode location for ${employee.name}: ${employee.location}`);
        return;
      }

      let icon;
      if (employee.photo) {
        icon = { url: employee.photo, scaledSize: new google.maps.Size(50, 50), anchor: new google.maps.Point(25, 50) };
      } else {
        icon = { url: 'Assets/Employee.png', scaledSize: new google.maps.Size(50, 50), anchor: new google.maps.Point(25, 50) };
      }

      const marker = new google.maps.Marker({
        position: coords,
        map: this.map,
        title: employee.name,
        icon: icon,
        zIndex: 900
      });

      const labelOverlay = this.createEmployeeLabel(employee.name, coords);

      marker.addListener('click', () => {
        this.openEmployeeCard(employee);
      });

      this.employeeMarkers.push({ marker, label: labelOverlay });
    } catch (error) {
      console.error(`Error adding employee marker for ${employee.name}:`, error);
    }
  }

  createEmployeeLabel(employeeName, position) {
    const label = new google.maps.Marker({
      position: { lat: position.lat + 0.4, lng: position.lng },
      map: this.map,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
      label: {
        text: employeeName.toUpperCase(),
        color: '#ffff00',
        fontWeight: 'bold',
        fontSize: '11px',
        fontFamily: 'Press Start 2P, monospace'
      },
      zIndex: 901
    });
    return label;
  }

  openEmployeeCard(employee) {
    if (window.showEmployeeCard) {
      window.showEmployeeCard(employee);
    } else {
      window.dispatchEvent(new CustomEvent('openEmployeeCard', { detail: employee }));
    }
  }

  async refreshEmployeeMarkers() {
    const stored = localStorage.getItem('cfo_employees');
    if (stored) {
      try {
        const employees = JSON.parse(stored);
        await this.addEmployeeMarkers(employees);
      } catch (e) {
        console.error('Failed to load employees for markers:', e);
      }
    }
  }
}

// Export
window.MapIntegration = MapIntegration;

// Global initMap callback for Google Maps API
window.initMap = function() {
  console.log('Google Maps API loaded (initMap callback)');
};
