class BarangayCagpileGISEditor {
    constructor() {
        this.map = null;
        this.drawnItems = null;
        this.drawControl = null;
        this.currentTool = 'select';
        this.currentLayer = 'households';
        this.selectedFeature = null;
        this.mapLayers = {};
        this.isDrawing = false;
        
        // Your actual GeoJSON file paths
        this.geojsonFiles = {
            households: '/api/households',
            facilities: '/api/facilities', 
            roads: '/api/roads',
            boundary: '/api/boundary'
        };
        
        this.colors = {
            households: '#3388ff',
            facilities: '#27ae60',
            roads: '#7f8c8d',
            boundary: '#ff7800'
        };
        
        this.init();
    }

    init() {
        console.log('🛠️ Initializing Barangay Cagpile GIS Editor...');
        this.initializeMap();
        this.initializeLayers();
        this.initializeDrawControls();
        this.setupEventListeners();
        this.loadAllGeoJSONData();
        console.log('✅ GIS Editor initialized successfully');
    }

    initializeMap() {
        // Create map instance
        this.map = L.map('editor-map').setView([12.2392, 125.3185], 16);
        
        // Add base layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        // Initialize feature group for drawn items
        this.drawnItems = new L.FeatureGroup();
        this.map.addLayer(this.drawnItems);
    }

    initializeLayers() {
        // Create layer groups for each type
        this.mapLayers = {
            households: L.layerGroup(),
            facilities: L.layerGroup(),
            roads: L.layerGroup(),
            boundary: L.layerGroup(),
            drawn: this.drawnItems
        };
        
        // Add all layers to map initially
        Object.values(this.mapLayers).forEach(layer => {
            this.map.addLayer(layer);
        });
    }

    initializeDrawControls() {
        // Initialize draw control (hidden by default)
        this.drawControl = new L.Control.Draw({
            edit: {
                featureGroup: this.drawnItems,
                poly: {
                    allowIntersection: false
                }
            },
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: true
                },
                polyline: true,
                rectangle: true,
                circle: false,
                marker: true,
                circlemarker: false
            }
        });
        
        this.map.addControl(this.drawControl);
        
        // Set draw control to hidden initially
        this.hideDrawToolbar();
        
        // Handle draw events
        this.map.on(L.Draw.Event.CREATED, (e) => {
            this.handleDrawCreated(e);
        });
        
        this.map.on(L.Draw.Event.EDITED, (e) => {
            this.handleDrawEdited(e);
        });
        
        this.map.on(L.Draw.Event.DELETED, (e) => {
            this.handleDrawDeleted(e);
        });
    }

    setupEventListeners() {
        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.getAttribute('data-tool');
                this.setActiveTool(tool);
            });
        });

        // Layer controls
        document.getElementById('households-layer').addEventListener('change', (e) => {
            this.toggleLayer('households', e.target.checked);
        });

        document.getElementById('facilities-layer').addEventListener('change', (e) => {
            this.toggleLayer('facilities', e.target.checked);
        });

        document.getElementById('roads-layer').addEventListener('change', (e) => {
            this.toggleLayer('roads', e.target.checked);
        });

        document.getElementById('boundary-layer').addEventListener('change', (e) => {
            this.toggleLayer('boundary', e.target.checked);
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => {
            this.map.zoomIn();
        });

        document.getElementById('zoom-out').addEventListener('click', () => {
            this.map.zoomOut();
        });

        // Coordinate display
        this.map.on('mousemove', (e) => {
            document.getElementById('coordinates').textContent = 
                `${e.latlng.lng.toFixed(4)}, ${e.latlng.lat.toFixed(4)}`;
        });

        // Click on map to deselect
        this.map.on('click', (e) => {
            if (e.originalEvent.target._leaflet_id) return;
            this.deselectFeature();
        });
    }

    loadAllGeoJSONData() {
        Object.entries(this.geojsonFiles).forEach(([layerName, apiUrl]) => {
            this.loadGeoJSONLayer(layerName, apiUrl);
        });
    }

    loadGeoJSONLayer(layerName, apiUrl) {
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load ${layerName}`);
                return response.json();
            })
            .then(data => {
                this.addGeoJSONToMap(data, layerName);
                console.log(`✅ Loaded ${layerName}: ${data.features?.length || 0} features`);
            })
            .catch(error => {
                console.error(`❌ Error loading ${layerName}:`, error);
                this.showNotification(`Error loading ${layerName} data`, 'error');
                this.createSampleData(layerName);
            });
    }

    addGeoJSONToMap(geojsonData, layerName) {
        const geoJsonLayer = L.geoJSON(geojsonData, {
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: this.colors[layerName],
                    color: '#000',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            style: (feature) => {
                return {
                    fillColor: this.colors[layerName],
                    color: '#000',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.6
                };
            },
            onEachFeature: (feature, layer) => {
                // Make layer editable
                layer.options.editable = true;
                
                // Add popup
                const popupContent = this.createPopupContent(feature, layerName);
                layer.bindPopup(popupContent);
                
                // Add click event for selection
                layer.on('click', (e) => {
                    e.originalEvent.stopPropagation();
                    this.selectFeature(feature, layer, layerName);
                });
                
                // Add to the appropriate layer group
                this.mapLayers[layerName].addLayer(layer);
            }
        });
    }

    createPopupContent(feature, layerName) {
        const props = feature.properties || {};
        let content = `<div style="min-width: 200px"><strong>${layerName.charAt(0).toUpperCase() + layerName.slice(1)}</strong>`;
        
        if (layerName === 'households') {
            content += `
                <br><strong>Owner:</strong> ${props.Owner || 'N/A'}
                <br><strong>Family:</strong> ${props['Family nm'] || 'N/A'}
                <br><strong>Residents:</strong> ${props.Residents || '0'}
                <br><em>Click to edit</em>
            `;
        } else if (layerName === 'facilities') {
            content += `
                <br><strong>Facility:</strong> ${props.Facility || 'N/A'}
                <br><em>Click to edit</em>
            `;
        } else {
            content += `<br><em>Click to edit</em>`;
        }
        
        content += `</div>`;
        return content;
    }

    createSampleData(layerName) {
        console.log(`Creating sample data for ${layerName}`);
        
        if (layerName === 'households') {
            const sampleHouseholds = [
                { lat: 12.2390, lng: 125.3180, id: 101, name: "Cruz Family", owner: "Juan Cruz", residents: 4 },
                { lat: 12.2395, lng: 125.3190, id: 102, name: "Santos Family", owner: "Maria Santos", residents: 5 },
                { lat: 12.2400, lng: 125.3195, id: 103, name: "Reyes Family", owner: "Pedro Reyes", residents: 3 }
            ];

            sampleHouseholds.forEach(household => {
                const marker = L.circleMarker([household.lat, household.lng], {
                    radius: 8,
                    fillColor: this.colors[layerName],
                    color: '#000',
                    weight: 2,
                    fillOpacity: 0.8
                });

                const feature = {
                    type: 'Feature',
                    properties: {
                        id: household.id,
                        Owner: household.owner,
                        'Family nm': household.name,
                        Residents: household.residents
                    },
                    geometry: {
                        type: 'Point',
                        coordinates: [household.lng, household.lat]
                    }
                };

                marker.bindPopup(this.createPopupContent(feature, layerName));
                marker.on('click', (e) => {
                    e.originalEvent.stopPropagation();
                    this.selectFeature(feature, marker, layerName);
                });

                this.mapLayers[layerName].addLayer(marker);
            });
        }
    }

    setActiveTool(tool) {
        this.currentTool = tool;
        
        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
        document.getElementById('current-tool').textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
        
        // Update map banner
        document.getElementById('map-banner').innerHTML = 
            `Using: <strong>${tool.charAt(0).toUpperCase() + tool.slice(1)}</strong> Tool on <strong>${this.currentLayer}</strong> Layer`;

        // Enable the selected tool
        this.enableTool(tool);
    }

    enableTool(tool) {
        // Disable all drawing first
        this.hideDrawToolbar();
        this.isDrawing = false;

        switch(tool) {
            case 'select':
                // Selection mode - default
                break;
                
            case 'edit':
                // Enable edit mode
                if (this.drawnItems.getLayers().length > 0) {
                    new L.EditToolbar.Edit(this.map, {
                        featureGroup: this.drawnItems
                    }).enable();
                }
                break;
                
            case 'marker':
                this.startDrawing('marker');
                break;
                
            case 'polygon':
                this.startDrawing('polygon');
                break;
                
            case 'rectangle':
                this.startDrawing('rectangle');
                break;
                
            case 'polyline':
                this.startDrawing('polyline');
                break;
                
            case 'move':
                // Move mode would be implemented here
                break;
                
            case 'delete':
                if (this.selectedFeature) {
                    this.deleteSelectedFeature();
                }
                break;
        }
    }

    startDrawing(drawType) {
        this.isDrawing = true;
        
        // Show the draw toolbar and activate the specific tool
        this.showDrawToolbar();
        
        // Simulate click on the specific draw button
        setTimeout(() => {
            const drawButton = document.querySelector(`.leaflet-draw-draw-${drawType}`);
            if (drawButton) {
                drawButton.click();
            }
        }, 100);
    }

    showDrawToolbar() {
        const toolbar = document.querySelector('.leaflet-draw-toolbar-top');
        if (toolbar) {
            toolbar.style.display = 'block';
        }
    }

    hideDrawToolbar() {
        const toolbar = document.querySelector('.leaflet-draw-toolbar-top');
        if (toolbar) {
            toolbar.style.display = 'none';
        }
    }

    handleDrawCreated(e) {
        const layer = e.layer;
        const layerType = e.layerType;
        
        // Add to drawn items
        this.drawnItems.addLayer(layer);
        
        // Create new feature object
        const newFeature = {
            type: 'Feature',
            properties: this.getDefaultProperties(this.currentLayer),
            geometry: layer.toGeoJSON().geometry
        };
        
        // Add interaction
        layer.on('click', (clickEvent) => {
            clickEvent.originalEvent.stopPropagation();
            this.selectFeature(newFeature, layer, 'drawn');
        });
        
        layer.bindPopup(this.createPopupContent(newFeature, 'drawn'));
        
        // Select the new feature
        this.selectFeature(newFeature, layer, 'drawn', true);
        
        this.showNotification(`New ${layerType} created`, 'success');
        this.setActiveTool('select'); // Return to select mode after drawing
    }

    handleDrawEdited(e) {
        console.log('Features edited:', e.layers);
        this.showNotification('Features updated successfully', 'success');
    }

    handleDrawDeleted(e) {
        console.log('Features deleted:', e.layers);
        this.deselectFeature();
        this.showNotification('Features deleted successfully', 'success');
    }

    selectFeature(feature, layer, layerName, isNew = false) {
        // Deselect previous feature
        if (this.selectedFeature && this.selectedFeature.layer.setStyle) {
            this.selectedFeature.layer.setStyle({
                weight: 2,
                color: this.colors[this.selectedFeature.layerName] || '#3388ff'
            });
        }
        
        // Select new feature
        this.selectedFeature = { feature, layer, layerName };
        
        // Highlight selected feature
        if (layer.setStyle) {
            layer.setStyle({
                weight: 4,
                color: '#ff0000'
            });
        }
        
        // Show attribute editor
        this.showAttributeEditor(feature.properties, layerName, isNew);
        document.getElementById('selected-count').textContent = '1';
    }

    deselectFeature() {
        if (this.selectedFeature && this.selectedFeature.layer.setStyle) {
            this.selectedFeature.layer.setStyle({
                weight: 2,
                color: this.colors[this.selectedFeature.layerName] || '#3388ff'
            });
        }
        
        this.selectedFeature = null;
        document.getElementById('attribute-editor').innerHTML = this.getNoSelectionHTML();
        document.getElementById('selected-count').textContent = '0';
    }

    showAttributeEditor(properties, layerName, isNew = false) {
        const editor = document.getElementById('attribute-editor');
        editor.innerHTML = this.createAttributeForm(properties, layerName, isNew);
    }

    createAttributeForm(properties, layerName, isNew) {
        let html = `
            <div class="attribute-form">
                <h3>${layerName.charAt(0).toUpperCase() + layerName.slice(1)} ${isNew ? '(New)' : '#' + (properties.id || properties.ID || 'N/A')}</h3>
        `;
        
        if (layerName === 'households' || layerName === 'drawn') {
            html += `
                <div class="form-group">
                    <label class="form-label">Household ID</label>
                    <input type="text" class="form-input" id="attr-id" value="${properties.id || properties.ID || ''}" ${isNew ? '' : 'readonly'}>
                </div>
                <div class="form-group">
                    <label class="form-label">Owner Name</label>
                    <input type="text" class="form-input" id="attr-owner" value="${properties.Owner || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Family Name</label>
                    <input type="text" class="form-input" id="attr-family" value="${properties['Family nm'] || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label">Number of Residents</label>
                    <input type="number" class="form-input" id="attr-residents" value="${properties.Residents || ''}">
                </div>
            `;
        } else if (layerName === 'facilities') {
            html += `
                <div class="form-group">
                    <label class="form-label">Facility Name</label>
                    <input type="text" class="form-input" id="attr-facility" value="${properties.Facility || ''}">
                </div>
            `;
        } else {
            html += `
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-input" id="attr-name" value="${properties.name || properties.Name || ''}">
                </div>
            `;
        }
        
        html += `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="gisEditor.saveAttributes()">
                    <i class="fas fa-save"></i> ${isNew ? 'Create' : 'Save Changes'}
                </button>
                <button class="btn btn-danger" onclick="gisEditor.deleteSelectedFeature()">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`;
        
        return html;
    }

    saveAttributes() {
        if (!this.selectedFeature) return;
        
        const updatedProperties = {};
        const inputs = document.querySelectorAll('#attribute-editor .form-input');
        
        inputs.forEach(input => {
            const field = input.id.replace('attr-', '');
            updatedProperties[field] = input.value;
        });
        
        // Update the feature properties
        this.selectedFeature.feature.properties = { 
            ...this.selectedFeature.feature.properties, 
            ...updatedProperties 
        };
        
        // Update popup content
        const popupContent = this.createPopupContent(this.selectedFeature.feature, this.selectedFeature.layerName);
        this.selectedFeature.layer.setPopupContent(popupContent);
        
        this.showNotification('✅ Feature saved successfully!', 'success');
    }

    deleteSelectedFeature() {
        if (!this.selectedFeature || !confirm('Are you sure you want to delete this feature?')) return;
        
        const { layer, layerName } = this.selectedFeature;
        
        // Remove from map and layer groups
        if (this.map.hasLayer(layer)) {
            this.map.removeLayer(layer);
        }
        
        if (this.mapLayers[layerName] && this.mapLayers[layerName].hasLayer(layer)) {
            this.mapLayers[layerName].removeLayer(layer);
        }
        
        if (this.drawnItems.hasLayer(layer)) {
            this.drawnItems.removeLayer(layer);
        }
        
        this.deselectFeature();
        this.showNotification('✅ Feature deleted successfully!', 'success');
    }

    toggleLayer(layerName, visible) {
        if (this.mapLayers[layerName]) {
            if (visible) {
                this.map.addLayer(this.mapLayers[layerName]);
            } else {
                this.map.removeLayer(this.mapLayers[layerName]);
            }
        }
        
        if (visible) {
            this.currentLayer = layerName;
            document.getElementById('current-layer').textContent = layerName.charAt(0).toUpperCase() + layerName.slice(1);
        }
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
        document.getElementById(`${tabName}-panel`).classList.add('active');
    }

    getDefaultProperties(layerName) {
        const defaults = {
            households: {
                id: Date.now(),
                Owner: 'New Owner',
                'Family nm': 'New Family',
                Residents: 1
            },
            facilities: {
                id: Date.now(),
                Facility: 'New Facility'
            },
            drawn: {
                id: Date.now(),
                name: 'New Feature'
            }
        };
        
        return defaults[layerName] || { id: Date.now(), name: 'New Feature' };
    }

    getNoSelectionHTML() {
        return `
            <div class="no-selection">
                <i class="fas fa-info-circle"></i>
                <p>Select a feature on the map to view and edit its attributes.</p>
            </div>
        `;
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `flash-message ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#ef4444'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Initialize the GIS Editor when the page loads
let gisEditor;

document.addEventListener('DOMContentLoaded', function() {
    gisEditor = new BarangayCappileGISEditor();
});