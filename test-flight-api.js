// Test script to diagnose AviationStack API response
// Run with: node test-flight-api.js

const API_KEY = '9a7f98a99fd0d7e48ee11c74ac4b6cde';
const FLIGHT_NUMBER = 'AA100'; // American Airlines flight

async function testFlightAPI() {
  console.log('='.repeat(60));
  console.log('AVIATIONSTACK API DIAGNOSTIC TEST');
  console.log('='.repeat(60));
  console.log(`\nTesting flight: ${FLIGHT_NUMBER}`);
  console.log(`API Key: ${API_KEY.substring(0, 10)}...`);

  const url = `http://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${FLIGHT_NUMBER}`;
  console.log(`\nAPI URL: ${url}\n`);

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log('='.repeat(60));
    console.log('RAW API RESPONSE:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));

    if (data.error) {
      console.log('\n❌ API ERROR:', data.error);
      return;
    }

    if (data.data && data.data.length > 0) {
      const flight = data.data[0];
      console.log('\n' + '='.repeat(60));
      console.log('PARSED FLIGHT DATA:');
      console.log('='.repeat(60));
      console.log('\n📍 DEPARTURE:');
      console.log('   departure object:', JSON.stringify(flight.departure, null, 4));
      console.log('\n📍 ARRIVAL:');
      console.log('   arrival object:', JSON.stringify(flight.arrival, null, 4));
      console.log('\n✈️ FLIGHT INFO:');
      console.log('   flight object:', JSON.stringify(flight.flight, null, 4));
      console.log('   flight_status:', flight.flight_status);
      console.log('   airline:', JSON.stringify(flight.airline, null, 4));

      console.log('\n' + '='.repeat(60));
      console.log('KEY TIMES:');
      console.log('='.repeat(60));
      console.log('   departure.scheduled:', flight.departure?.scheduled);
      console.log('   departure.estimated:', flight.departure?.estimated);
      console.log('   departure.actual:', flight.departure?.actual);
      console.log('   arrival.scheduled:', flight.arrival?.scheduled);
      console.log('   arrival.estimated:', flight.arrival?.estimated);
      console.log('   arrival.actual:', flight.arrival?.actual);
    } else {
      console.log('\n⚠️ No flight data returned');
      console.log('Full response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message);
  }
}

testFlightAPI();
