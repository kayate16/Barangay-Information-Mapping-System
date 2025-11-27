// Map configuration and management
let map;
let mapLayers = {
    households: null,
    facilities: null,
    roads: null,
    boundary: null,
    baseLayers: {}
};

// Color scheme
const COLORS = {
    households: {
        normal: '#3388ff',
        vulnerable: '#ff4444'
    },
    facilities: {
        barangay: '#e74c3c',
        health: '#27ae60',
        education: '#f39c12',
        evacuation: '#9b59b6',
        community: '#3498db',
        religious: '#8e44ad',
        security: '#c0392b'
    },
    roads: '#7f8c8d',
    boundary: '#ff7800'
};

// Initialize map
function initializeMap() {
    console.log('🔄 Initializing Barangay Cagpile Map...');
    
    // Create map instance centered on Barangay Cagpile
    map = L.map('map').setView([12.2392, 125.3185], 16);
    
    // Add base layers
    mapLayers.baseLayers.osm = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }
    ).addTo(map);
    
    mapLayers.baseLayers.satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: '&copy; Esri'
        }
    );
    
    // Load GeoJSON layers
    loadGeoJSONLayers();
    
    // Setup layer controls
    setupLayerControls();
    
    console.log('✅ Map initialized successfully');
    
    // Remove loading message
    setTimeout(() => {
        const loadingElement = document.querySelector('.map-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }, 1500);
}

// Load GeoJSON layers with CIRCLE MARKERS for households
function loadGeoJSONLayers() {
    // Households layer - USING CIRCLE MARKERS
    fetch('/api/households')
        .then(response => response.json())
        .then(data => {
            console.log('🏠 Households data loaded:', data.features.length, 'features');
            
            mapLayers.households = L.geoJSON(data, {
                pointToLayer: function(feature, latlng) {
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    // Create circle marker for point features
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: isVulnerable ? COLORS.households.vulnerable : COLORS.households.normal,
                        color: '#000',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.7
                    });
                },
                style: function(feature) {
                    // For polygon features (if any), keep the original styling
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    return {
                        fillColor: isVulnerable ? COLORS.households.vulnerable : COLORS.households.normal,
                        color: '#000',
                        weight: 1,
                        opacity: 0.8,
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    const popupContent = `
                        <div class="popup-content">
                            <h4>Household ${props.id}</h4>
                            <div class="popup-details">
                                <p><strong>Owner:</strong> ${props.Owner || 'N/A'}</p>
                                <p><strong>Family:</strong> ${props['Family nm'] || 'N/A'}</p>
                                <p><strong>Residents:</strong> ${props.Residents || '0'}</p>
                                <p><strong>Senior/PWD:</strong> ${props['senior/PWD'] || 'No'}</p>
                                ${props['Contact no'] ? `<p><strong>Contact:</strong> ${props['Contact no']}</p>` : ''}
                            </div>
                            ${isVulnerable ? '<div class="vulnerable-badge">Vulnerable Household</div>' : ''}
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                    
                    // Add hover effects for circle markers
                    if (layer instanceof L.CircleMarker) {
                        layer.on('mouseover', function() {
                            layer.setStyle({
                                weight: 3,
                                fillOpacity: 0.9,
                                radius: 10
                            });
                        });
                        
                        layer.on('mouseout', function() {
                            layer.setStyle({
                                weight: 2,
                                fillOpacity: 0.7,
                                radius: 8
                            });
                        });
                    } else {
                        // For polygon features
                        layer.on('mouseover', function() {
                            layer.setStyle({
                                weight: 3,
                                fillOpacity: 0.9
                            });
                        });
                        
                        layer.on('mouseout', function() {
                            layer.setStyle({
                                weight: 1,
                                fillOpacity: 0.7
                            });
                        });
                    }
                    
                    // Add click event to zoom to feature
                    layer.on('click', function() {
                        if (layer instanceof L.CircleMarker) {
                            map.setView(layer.getLatLng(), 18);
                        } else {
                            map.fitBounds(layer.getBounds());
                        }
                    });
                }
            }).addTo(map);
            
            console.log(`✅ Households layer added with ${data.features.length} features (circle markers)`);
            
            // Update legend to reflect circle markers
            updateLegendForCircleMarkers();
        })
        .catch(error => console.error('❌ Error loading households:', error));

    // Facilities layer
    fetch('/api/facilities')
        .then(response => response.json())
        .then(data => {
            console.log('🏢 Facilities data loaded:', data.features.length, 'features');
            
            mapLayers.facilities = L.geoJSON(data, {
                style: function(feature) {
                    const props = feature.properties;
                    const facilityName = props.Facility || '';
                    let color = COLORS.facilities.community;
                    
                    if (facilityName.includes('School')) color = COLORS.facilities.education;
                    else if (facilityName.includes('Chapel')) color = COLORS.facilities.religious;
                    else if (facilityName.includes('Barangay')) color = COLORS.facilities.barangay;
                    else if (facilityName.includes('Plaza')) color = COLORS.facilities.community;
                    else if (facilityName.includes('Post')) color = COLORS.facilities.security;
                    
                    return {
                        fillColor: color,
                        color: '#000',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    };
                },
                onEachFeature: function(feature, layer) {
                    const props = feature.properties;
                    
                    const popupContent = `
                        <div class="popup-content">
                            <h4>${props.Facility || 'Facility'}</h4>
                            <div class="popup-details">
                                <p><strong>Type:</strong> ${props.Facility || 'Community Facility'}</p>
                                ${props.id ? `<p><strong>ID:</strong> ${props.id}</p>` : ''}
                            </div>
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                    
                    // Add hover effects
                    layer.on('mouseover', function() {
                        layer.setStyle({
                            weight: 4,
                            fillOpacity: 0.9
                        });
                    });
                    
                    layer.on('mouseout', function() {
                        layer.setStyle({
                            weight: 2,
                            fillOpacity: 0.8
                        });
                    });
                }
            }).addTo(map);
        })
        .catch(error => console.error('❌ Error loading facilities:', error));

    // Roads layer
    fetch('/api/roads')
        .then(response => response.json())
        .then(data => {
            mapLayers.roads = L.geoJSON(data, {
                style: {
                    color: COLORS.roads,
                    weight: 3,
                    opacity: 0.7
                },
                onEachFeature: function(feature, layer) {
                    layer.on('mouseover', function() {
                        layer.setStyle({ weight: 5, opacity: 0.9 });
                    });
                    layer.on('mouseout', function() {
                        layer.setStyle({ weight: 3, opacity: 0.7 });
                    });
                }
            }).addTo(map);
        })
        .catch(error => console.error('Error loading roads:', error));

    // Boundary layer
    fetch('/api/boundary')
        .then(response => response.json())
        .then(data => {
            mapLayers.boundary = L.geoJSON(data, {
                style: {
                    color: COLORS.boundary,
                    weight: 3,
                    opacity: 0.8,
                    fillColor: COLORS.boundary,
                    fillOpacity: 0.1
                },
                onEachFeature: function(feature, layer) {
                    layer.bindPopup('<strong>Barangay Cagpile Boundary</strong>');
                    
                    layer.on('mouseover', function() {
                        layer.setStyle({ weight: 4, opacity: 1, fillOpacity: 0.2 });
                    });
                    layer.on('mouseout', function() {
                        layer.setStyle({ weight: 3, opacity: 0.8, fillOpacity: 0.1 });
                    });
                }
            }).addTo(map);
            
            // Fit map to boundary
            if (mapLayers.boundary.getBounds().isValid()) {
                map.fitBounds(mapLayers.boundary.getBounds(), { padding: [20, 20] });
            }
        })
        .catch(error => console.error('Error loading boundary:', error));
}

// Update legend to show circle markers instead of squares
function updateLegendForCircleMarkers() {
    const householdLegendItems = document.querySelectorAll('.legend-item');
    
    householdLegendItems.forEach(item => {
        const colorElement = item.querySelector('.legend-color');
        if (colorElement && (colorElement.classList.contains('household-color') || colorElement.classList.contains('household-vulnerable-color'))) {
            // Replace square with circle
            colorElement.style.borderRadius = '50%';
            colorElement.style.width = '20px';
            colorElement.style.height = '20px';
        }
    });
}

// Setup layer controls
function setupLayerControls() {
    // Base layer controls
    document.querySelectorAll('input[name="base-layer"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.checked) {
                Object.values(mapLayers.baseLayers).forEach(layer => {
                    if (map.hasLayer(layer)) {
                        map.removeLayer(layer);
                    }
                });
                mapLayers.baseLayers[this.value].addTo(map);
            }
        });
    });
    
    // Overlay layer controls
    const overlayLayers = {
        'households': 'households-layer',
        'facilities': 'facilities-layer',
        'roads': 'roads-layer',
        'boundary': 'boundary-layer'
    };
    
    Object.entries(overlayLayers).forEach(([layerName, checkboxId]) => {
        const checkbox = document.getElementById(checkboxId);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                const layer = mapLayers[layerName];
                if (layer) {
                    if (this.checked) {
                        map.addLayer(layer);
                    } else {
                        map.removeLayer(layer);
                    }
                }
            });
        }
    });
}

// Search functionality for household data page
function searchHouseholds() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const rows = document.querySelectorAll('#households-table tbody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update results count
    const resultsElement = document.getElementById('search-results');
    if (resultsElement) {
        resultsElement.textContent = `Showing ${visibleCount} of ${rows.length} households`;
    }
}

// Refresh map layers (useful after adding new households)
function refreshMapLayers() {
    console.log('🔄 Refreshing map layers...');
    
    // Remove existing layers
    if (mapLayers.households) {
        map.removeLayer(mapLayers.households);
        mapLayers.households = null;
    }
    
    // Reload households layer
    fetch('/api/households')
        .then(response => response.json())
        .then(data => {
            console.log('🏠 Refreshed households data:', data.features.length, 'features');
            
            mapLayers.households = L.geoJSON(data, {
                pointToLayer: function(feature, latlng) {
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: isVulnerable ? COLORS.households.vulnerable : COLORS.households.normal,
                        color: '#000',
                        weight: 2,
                        opacity: 0.8,
                        fillOpacity: 0.7
                    });
                },
                style: function(feature) {
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    return {
                        fillColor: isVulnerable ? COLORS.households.vulnerable : COLORS.households.normal,
                        color: '#000',
                        weight: 1,
                        opacity: 0.8,
                        fillOpacity: 0.7
                    };
                },
                onEachFeature: function(feature, layer) {
                    const props = feature.properties;
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    
                    const popupContent = `
                        <div class="popup-content">
                            <h4>Household ${props.id}</h4>
                            <div class="popup-details">
                                <p><strong>Owner:</strong> ${props.Owner || 'N/A'}</p>
                                <p><strong>Family:</strong> ${props['Family nm'] || 'N/A'}</p>
                                <p><strong>Residents:</strong> ${props.Residents || '0'}</p>
                                <p><strong>Senior/PWD:</strong> ${props['senior/PWD'] || 'No'}</p>
                                ${props['Contact no'] ? `<p><strong>Contact:</strong> ${props['Contact no']}</p>` : ''}
                            </div>
                            ${isVulnerable ? '<div class="vulnerable-badge">Vulnerable Household</div>' : ''}
                        </div>
                    `;
                    layer.bindPopup(popupContent);
                    
                    // Add hover effects
                    if (layer instanceof L.CircleMarker) {
                        layer.on('mouseover', function() {
                            layer.setStyle({
                                weight: 3,
                                fillOpacity: 0.9,
                                radius: 10
                            });
                        });
                        
                        layer.on('mouseout', function() {
                            layer.setStyle({
                                weight: 2,
                                fillOpacity: 0.7,
                                radius: 8
                            });
                        });
                    }
                    
                    // Add click event to zoom to feature
                    layer.on('click', function() {
                        if (layer instanceof L.CircleMarker) {
                            map.setView(layer.getLatLng(), 18);
                        }
                    });
                }
            }).addTo(map);
            
            console.log('✅ Households layer refreshed');
        })
        .catch(error => console.error('❌ Error refreshing households:', error));
}

// Highlight a specific household on the map
function highlightHousehold(householdId) {
    if (!mapLayers.households) return;
    
    mapLayers.households.eachLayer(function(layer) {
        const props = layer.feature.properties;
        if (props.id == householdId) {
            // Zoom to the household
            if (layer instanceof L.CircleMarker) {
                map.setView(layer.getLatLng(), 18);
                // Highlight the circle
                layer.setStyle({
                    weight: 4,
                    fillOpacity: 1,
                    radius: 12,
                    color: '#ff0000'
                });
                // Open popup
                layer.openPopup();
                
                // Reset style after 5 seconds
                setTimeout(() => {
                    const isVulnerable = props['senior/PWD'] === 'YES';
                    layer.setStyle({
                        weight: 2,
                        fillOpacity: 0.7,
                        radius: 8,
                        fillColor: isVulnerable ? COLORS.households.vulnerable : COLORS.households.normal,
                        color: '#000'
                    });
                }, 5000);
            }
        }
    });
}

// Get household count for statistics
function getHouseholdCount() {
    if (mapLayers.households) {
        return mapLayers.households.getLayers().length;
    }
    return 0;
}

// Get vulnerable household count
function getVulnerableHouseholdCount() {
    let count = 0;
    if (mapLayers.households) {
        mapLayers.households.eachLayer(function(layer) {
            const props = layer.feature.properties;
            if (props['senior/PWD'] === 'YES') {
                count++;
            }
        });
    }
    return count;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize map if on map page
    if (document.getElementById('map')) {
        initializeMap();
        
        // Check if there's a household ID to highlight from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const highlightId = urlParams.get('highlight');
        if (highlightId) {
            // Wait for layers to load, then highlight
            setTimeout(() => {
                highlightHousehold(highlightId);
            }, 2000);
        }
    }
    
    // Initialize search if on household data page
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', searchHouseholds);
    }
    
    // Add loading states to buttons
    document.querySelectorAll('button, .btn').forEach(button => {
        button.addEventListener('click', function(e) {
            if (this.type === 'submit' || this.getAttribute('type') === 'submit') {
                this.classList.add('loading');
                setTimeout(() => {
                    this.classList.remove('loading');
                }, 1000);
            }
        });
    });
    
    // Initialize filter controls on household data page
    const vulnerabilityFilter = document.getElementById('vulnerability-filter');
    if (vulnerabilityFilter) {
        vulnerabilityFilter.addEventListener('change', filterHouseholdTable);
    }
});

// Filter household table
function filterHouseholdTable() {
    const vulnerabilityValue = document.getElementById('vulnerability-filter').value;
    const rows = document.querySelectorAll('#households-table tbody tr');
    
    rows.forEach(row => {
        const hasSeniorsPwd = row.cells[4].textContent.includes('Yes');
        
        let showRow = true;
        
        if (vulnerabilityValue === 'vulnerable' && !hasSeniorsPwd) {
            showRow = false;
        } else if (vulnerabilityValue === 'non-vulnerable' && hasSeniorsPwd) {
            showRow = false;
        }
        
        row.style.display = showRow ? '' : 'none';
    });
}

// Navigation function
function navigateToPage(page) {
    window.location.href = page;
}

// View household on map from data table
function viewOnMap(householdId) {
    window.location.href = `/map?highlight=${householdId}`;
}

// Confirm delete action
function confirmDelete() {
    return confirm('Are you sure you want to delete this household? This action cannot be undone.');
}

// Export map data (basic implementation)
function exportMapData() {
    const data = {
        households: getHouseholdCount(),
        vulnerable: getVulnerableHouseholdCount(),
        timestamp: new Date().toISOString(),
        center: map.getCenter(),
        zoom: map.getZoom()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barangay-map-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Map data exported successfully!');
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl + F to focus search (on household data page)
    if ((e.ctrlKey || e.metaKey) && e.key === 'f' && document.getElementById('search-input')) {
        e.preventDefault();
        document.getElementById('search-input').focus();
    }
    
    // Escape to clear search
    if (e.key === 'Escape' && document.getElementById('search-input')) {
        document.getElementById('search-input').value = '';
        searchHouseholds();
    }
});

// Utility function to format numbers
function formatNumber(number) {
    return new Intl.NumberFormat().format(number);
}

// Ensure the back button works in all pages
document.addEventListener('DOMContentLoaded', function() {
    const backButtons = document.querySelectorAll('.back-btn');
    backButtons.forEach(btn => {
        if (btn && btn.href.includes('index.html')) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                window.location.href = 'index.html';
            });
        }
    });
});

// Add responsive behavior for map
window.addEventListener('resize', function() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
});

// Debug function to show map info
function showMapInfo() {
    console.log('🗺️ Map Information:');
    console.log('Center:', map.getCenter());
    console.log('Zoom:', map.getZoom());
    console.log('Bounds:', map.getBounds());
    console.log('Households:', getHouseholdCount());
    console.log('Vulnerable Households:', getVulnerableHouseholdCount());
    
    if (mapLayers.households) {
        console.log('Household Layer Bounds:', mapLayers.households.getBounds());
    }
}

// Make functions globally available for debugging
window.refreshMapLayers = refreshMapLayers;
window.showMapInfo = showMapInfo;
window.highlightHousehold = highlightHousehold;
window.exportMapData = exportMapData;