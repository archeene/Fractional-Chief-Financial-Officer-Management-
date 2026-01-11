// Test script to diagnose local server API response
// Run with: node test-server-api.js
// Make sure server is running first (npm start)

const FLIGHT_NUMBER = 'AA100';

async function testServerAPI() {
  console.log('='.repeat(60));
  console.log('LOCAL SERVER API DIAGNOSTIC TEST');
  console.log('='.repeat(60));
  console.log(`\nTesting flight: ${FLIGHT_NUMBER}`);
  console.log('Server URL: http://localhost:3001/api/flight/' + FLIGHT_NUMBER);

  try {
    const response = await fetch(`http://localhost:3001/api/flight/${FLIGHT_NUMBER}`);
    const data = await response.json();

    console.log('\n' + '='.repeat(60));
    console.log('SERVER RESPONSE:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.flight) {
      console.log('\n' + '='.repeat(60));
      console.log('FLIGHT TIMES FROM SERVER:');
      console.log('='.repeat(60));
      console.log('   departureTime:', data.flight.departureTime);
      console.log('   arrivalTime:', data.flight.arrivalTime);
      console.log('   status:', data.flight.status);
      console.log('   airline:', data.flight.airline);

      if (!data.flight.departureTime) {
        console.log('\n❌ WARNING: departureTime is null/undefined!');
      }
      if (!data.flight.arrivalTime) {
        console.log('❌ WARNING: arrivalTime is null/undefined!');
      }
    } else {
      console.log('\n❌ Server returned success=false or no flight object');
    }
  } catch (error) {
    console.error('\n❌ FETCH ERROR:', error.message);
    console.log('\nMake sure the server is running: npm start');
  }
}

testServerAPI();
