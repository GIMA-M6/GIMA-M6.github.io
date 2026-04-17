// 1. Initialiseer de kaart gecentreerd op Utrecht
const map = L.map('map').setView([52.0907, 5.1214], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// 1b. Utrecht Bounding Box

async function drawUtrechtMask() {
    try {
        // 1. Haal jouw lokale bestand op (zorg dat dit precies zo heet als je bestand)
        const response = await fetch('JSONUTRECHT.geojson');
        const data = await response.json();

        let utrechtCoords = [];

        // 2. Zoek de geometrie in het standaard GeoJSON formaat
        // Meestal zit dit verborgen in de eerste "Feature" van de "FeatureCollection"
        const geometry = data.features ? data.features[0].geometry : data.geometry;

        if (!geometry) {
            console.error("Kon geen geometry vinden in JSONUTRECHT.geojson");
            return;
        }

        // 3. GeoJSON gebruikt [Lengtegraad, Breedtegraad], Leaflet wil [Breedtegraad, Lengtegraad].
        if (geometry.type === 'Polygon') {
            utrechtCoords = geometry.coordinates[0].map(c => [c[1], c[0]]);
        } else if (geometry.type === 'MultiPolygon') {
            // Als de grens uit meerdere stukken bestaat (bijv. eilandjes), pakken we het grootste stuk
            utrechtCoords = geometry.coordinates[0][0].map(c => [c[1], c[0]]);
        }

        // 4. Maak een rechthoek die de hele wereld bedekt
        const outerWorld = [
            [90, -180],
            [90, 180],
            [-90, 180],
            [-90, -180]
        ];

        // 5. Teken het masker met het 'gat' in de vorm van jouw bestand
        L.polygon([outerWorld, utrechtCoords], {
            color: '#333',       // Randkleur van Utrecht
            weight: 2,           // Dikte van de rand
            fillColor: '#000',   // Zwarte invulling
            fillOpacity: 0.3     // 30% transparant
        }).addTo(map);

    } catch (error) {
        console.error("Fout bij het laden van JSONUTRECHT.geojson:", error);
    }
}

// Roep de functie aan zodra de pagina laadt
drawUtrechtMask();
// -----------------------------------------------------------

// 2. Variabelen om de status op te slaan
let startCoords = null;
let endCoords = null;
let routeLine = null;
let markers = [];
let timeoutId; // Voor de typ-vertraging (debouncing)

// --- DEEL 1: AUTOCOMPLETE & ZOEKEN TERWIJL JE TYPT ---
async function fetchSuggestions(query, boxId, isStart) {
    const box = document.getElementById(boxId);
    
    // Pas zoeken als er 3 of meer letters zijn getypt
    if (query.length < 3) {
        box.style.display = 'none';
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Utrecht')}&limit=5`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        box.innerHTML = ''; 
        
        if (data.length > 0) {
            data.forEach(item => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                
                const shortName = item.display_name.split(',').slice(0, 2).join(',');
                div.innerText = shortName;
                
                // Wat er gebeurt als je op een suggestie klikt
                div.onclick = () => {
                    const inputId = isStart ? 'start-input' : 'end-input';
                    document.getElementById(inputId).value = item.display_name.split(',')[0];
                    box.style.display = 'none'; 
                    geocodeExactLocation(item, isStart);
                };
                
                box.appendChild(div);
            });
            box.style.display = 'block'; 
        } else {
            box.style.display = 'none';
        }
    } catch (error) {
        console.error("Suggestion Error:", error);
    }
}

// Hulpfunctie: Verwerkt de klik op een suggestie uit het menu
function geocodeExactLocation(data, isStart) {
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lon);
    const coords = { lat: lat, lng: lng };
    
    if (isStart) startCoords = coords;
    else endCoords = coords;

    const marker = L.marker([lat, lng]).addTo(map);
    markers.push(marker);
    map.setView([lat, lng], 15);
    document.getElementById('status-text').innerText = "Location selected!";
}

// Event Listeners voor typen in de zoekbalken (met 500ms debounce)
document.getElementById('start-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'start-suggestions', true), 500);
});

document.getElementById('end-input').addEventListener('input', function(e) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fetchSuggestions(e.target.value, 'end-suggestions', false), 500);
});

// Verberg de drop-down menu's als je ergens anders op het scherm klikt
document.addEventListener('click', function(e) {
    if (!e.target.closest('.input-group')) {
        document.getElementById('start-suggestions').style.display = 'none';
        document.getElementById('end-suggestions').style.display = 'none';
    }
});


// --- DEEL 2: HANDMATIG ZOEKEN (Via de 🔍 knop of Enter) ---
async function geocodeLocation(query, isStart) {
    const statusText = document.getElementById('status-text');
    statusText.innerText = "Searching for location...";

    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Utrecht')}&limit=1`;

    try {
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (data.length > 0) {
            geocodeExactLocation(data[0], isStart);
            const placeName = data[0].display_name.split(',')[0];
            if (isStart) document.getElementById('start-input').value = placeName;
            else document.getElementById('end-input').value = placeName;
            
            statusText.innerText = "Location found!";
        } else {
            statusText.innerText = "Location not found in Utrecht.";
        }
    } catch (error) {
        statusText.innerText = "Search failed.";
    }
}

document.getElementById('search-start').addEventListener('click', () => {
    const query = document.getElementById('start-input').value;
    if (query.length > 2) geocodeLocation(query, true);
});
document.getElementById('search-end').addEventListener('click', () => {
    const query = document.getElementById('end-input').value;
    if (query.length > 2) geocodeLocation(query, false);
});
document.getElementById('start-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('search-start').click();
});
document.getElementById('end-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('search-end').click();
});


// --- DEEL 3: KLIKKEN OP DE KAART ---
map.on('click', function(e) {
    if (!startCoords) {
        startCoords = e.latlng;
        document.getElementById('start-input').value = `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
        markers.push(L.marker(e.latlng).addTo(map));
    } else if (!endCoords) {
        endCoords = e.latlng;
        document.getElementById('end-input').value = `Lat: ${e.latlng.lat.toFixed(4)}, Lon: ${e.latlng.lng.toFixed(4)}`;
        markers.push(L.marker(e.latlng).addTo(map));
    }
});


// --- DEEL 4: DE BACKEND AANROEPEN (Route Berekenen) ---
document.getElementById('calc-btn').addEventListener('click', async function() {
    if (!startCoords || !endCoords) {
        alert("Please select both an Origin and a Destination first!");
        return;
    }

    const statusText = document.getElementById('status-text');
    statusText.innerText = "Calculating route... (waking up server if asleep, max 60s)";

    // Let op: Dit is de live Render API link
    const apiUrl = `https://olegbergs-route-backend-api.hf.space/get-route?start_lat=${startCoords.lat}&start_lon=${startCoords.lng}&end_lat=${endCoords.lat}&end_lon=${endCoords.lng}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Server error or sleep timeout");
        
        const data = await response.json();
        
        if (data.status === "success") {
            if (routeLine) map.removeLayer(routeLine);
            
            routeLine = L.polyline(data.route, {color: '#e32400', weight: 6, opacity: 0.8}).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
            statusText.innerText = "Route found!";
        } else {
            statusText.innerText = "Could not find a route.";
        }
    } catch (error) {
        console.error("API Error:", error);
        statusText.innerText = "Error connecting to server. Please try again.";
    }
});


// --- DEEL 5: RESET DE KAART ---
document.getElementById('reset-btn').addEventListener('click', function() {
    startCoords = null;
    endCoords = null;
    
    document.getElementById('start-input').value = "";
    document.getElementById('end-input').value = "";
    document.getElementById('status-text').innerText = "";
    
    if (routeLine) map.removeLayer(routeLine);
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
});
