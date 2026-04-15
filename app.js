// Initialize the map centered on Utrecht
const map = L.map('map').setView([52.0907, 5.1214], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let clicks = [];
let routeLine = null;

// Listen for clicks on the map
map.on('click', async function(e) {
    clicks.push(e.latlng);
    L.marker(e.latlng).addTo(map); // Drop a pin

    // When we have two clicks, ask the Python server for the route
    if (clicks.length === 2) {
        const start = clicks[0];
        const end = clicks[1];
        
        // Construct the URL to your Python API (change this to your actual server URL later)
        const apiUrl = `http://127.0.0.1:8000/get-route?start_lat=${start.lat}&start_lon=${start.lng}&end_lat=${end.lat}&end_lon=${end.lng}`;
        
        try {
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.status === "success") {
                // Draw the line on the map
                if (routeLine) map.removeLayer(routeLine); // Remove old route
                routeLine = L.polyline(data.route, {color: 'red', weight: 5}).addTo(map);
            } else {
                alert("Could not find a route!");
            }
        } catch (error) {
            console.error("API Error:", error);
        }
        
        clicks = []; // Reset for the next route
    }
});