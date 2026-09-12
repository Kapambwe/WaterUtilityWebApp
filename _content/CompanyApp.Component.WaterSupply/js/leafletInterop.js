// Leaflet Map Interop for Water Distribution Network Visualization
// Store multiple maps and their layers by elementId
let maps = {};
let mapLayers = {};
let currentMapId = null; // Track which map is currently being worked on

// Check if Leaflet is loaded
if (typeof L === 'undefined') {
    console.error('Leaflet library not loaded. Please include Leaflet JS and CSS in your HTML.');
    throw new Error('Leaflet not loaded');
}

// Initialize map
export function createMap(elementId, lat, lng, zoom) {
    // Remove existing map for this element if it exists
    if (maps[elementId]) {
        maps[elementId].remove();
        delete maps[elementId];
        delete mapLayers[elementId];
    }

    // Create new map instance
    const map = L.map(elementId).setView([lat, lng], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Create layers specific to this map
    const layers = {
        pipes: L.layerGroup(),
        pumps: L.layerGroup(),
        valves: L.layerGroup(),
        connectors: L.layerGroup(),
        other: L.layerGroup()
    };

    // Add all layers to map
    Object.values(layers).forEach(layer => layer.addTo(map));

    // Store map instance and its layers by elementId
    maps[elementId] = map;
    mapLayers[elementId] = layers;
    currentMapId = elementId; // Set as current map

    return map;
}

// Invalidate map size - force recalculation of container dimensions
// Call this when the map container visibility changes (e.g., tab switching)
export function invalidateMapSize(elementId) {
    const map = maps[elementId];
    if (map) {
        // Use requestAnimationFrame to ensure DOM has fully rendered
        requestAnimationFrame(() => {
            // Additional delay to ensure container is visible and has dimensions
            setTimeout(() => {
                try {
                    // Force map to recalculate its size
                    map.invalidateSize({ pan: false });
                    
                    // Get the map center and zoom to ensure proper rendering
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    map.setView(center, zoom);
                    
                    console.log(`Map size invalidated for: ${elementId}`);
                } catch (error) {
                    console.error(`Error invalidating map size for ${elementId}:`, error);
                }
            }, 250);
        });
    } else {
        console.warn(`Map not found for element: ${elementId}`);
    }
}

// Add a simple marker
export function addMarker(lat, lng, popupText = null, iconType = null) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;
    
    const marker = L.marker([lat, lng]);
    
    if (popupText) {
        marker.bindPopup(popupText);
    }
    
    marker.addTo(mapLayers[currentMapId].other);
    return marker;
}

// Add infrastructure marker with custom styling
export function addInfrastructureMarker(lat, lng, infrastructureType, name, status, details) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;
    
    const icon = getInfrastructureIcon(infrastructureType, status);
    const marker = L.marker([lat, lng], { icon: icon });
    
    const popupContent = `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
                ${name}
            </h4>
            <div style="font-size: 12px; color: #4b5563;">
                ${details}
            </div>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Add to appropriate layer
    const layers = mapLayers[currentMapId];
    const layerKey = infrastructureType.toLowerCase();
    if (layers[layerKey]) {
        marker.addTo(layers[layerKey]);
    } else {
        marker.addTo(layers.other);
    }
    
    return marker;
}

// Get icon for infrastructure type
function getInfrastructureIcon(type, status) {
    const color = getStatusColor(status);
    const iconHtml = getInfrastructureIconHtml(type, color);
    
    return L.divIcon({
        html: iconHtml,
        className: 'custom-infrastructure-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

// Get HTML for infrastructure icon
function getInfrastructureIconHtml(type, color) {
    const icons = {
        pump: `<svg viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <path d="M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z"/>
        </svg>`,
        valve: `<svg viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7Z"/>
        </svg>`,
        connector: `<svg viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <path d="M7,15L12,10L17,15H7M12,1A11,11 0 0,0 1,12A11,11 0 0,0 12,23A11,11 0 0,0 23,12A11,11 0 0,0 12,1M12,3A9,9 0 0,1 21,12A9,9 0 0,1 12,21A9,9 0 0,1 3,12A9,9 0 0,1 12,3Z"/>
        </svg>`,
        default: `<svg viewBox="0 0 24 24" fill="${color}" width="32" height="32">
            <circle cx="12" cy="12" r="8"/>
        </svg>`
    };
    
    return icons[type] || icons.default;
}

// Get color based on status
function getStatusColor(status) {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('operational') || statusLower.includes('running')) {
        return '#10b981'; // Green
    } else if (statusLower.includes('maintenance') || statusLower.includes('standby')) {
        return '#f59e0b'; // Orange
    } else if (statusLower.includes('faulty') || statusLower.includes('leaking') || statusLower.includes('emergency')) {
        return '#ef4444'; // Red
    } else if (statusLower.includes('stopped')) {
        return '#6b7280'; // Gray
    }
    return '#3b82f6'; // Blue (default)
}

// Add a pipe (polyline)
export function addPipe(latLngs, options) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;
    
    const polyline = L.polyline(latLngs, {
        color: options.color || '#3b82f6',
        weight: options.weight || 3,
        opacity: options.opacity || 0.8
    });
    
    const popupContent = `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
                ${options.pipeName || 'Pipe'}
            </h4>
            <div style="font-size: 12px; color: #4b5563;">
                <strong>Material:</strong> ${options.material}<br/>
                <strong>Diameter:</strong> ${options.diameter} mm<br/>
                <strong>Status:</strong> ${options.status}
            </div>
        </div>
    `;
    
    polyline.bindPopup(popupContent);
    polyline.addTo(mapLayers[currentMapId].pipes);
    
    return polyline;
}

// Add a circle
export function addCircle(lat, lng, radius, options = {}) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;
    
    const circle = L.circle([lat, lng], {
        radius: radius,
        ...options
    });
    
    circle.addTo(mapLayers[currentMapId].other);
    return circle;
}

// Add a polygon
export function addPolygon(latLngs, options = {}) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;
    
    const polygon = L.polygon(latLngs, options);
    polygon.addTo(mapLayers[currentMapId].other);
    return polygon;
}

// Clear map layers
export function clearMap() {
    if (!currentMapId || !mapLayers[currentMapId]) return;
    
    Object.values(mapLayers[currentMapId]).forEach(layer => layer.clearLayers());
}

// Set view
export function setView(lat, lng, zoom) {
    if (currentMapId && maps[currentMapId]) {
        maps[currentMapId].setView([lat, lng], zoom);
    }
}

// Fit bounds
export function fitBounds(bounds) {
    if (currentMapId && maps[currentMapId]) {
        maps[currentMapId].fitBounds(bounds);
    }
}

// Toggle layer visibility
export function toggleLayer(layerName, visible) {
    if (!currentMapId || !maps[currentMapId] || !mapLayers[currentMapId]) return;
    
    const map = maps[currentMapId];
    const layer = mapLayers[currentMapId][layerName];
    if (layer) {
        if (visible) {
            if (!map.hasLayer(layer)) {
                layer.addTo(map);
            }
        } else {
            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
            }
        }
    }
}

// ===================== MULTIPLE LAYER MANAGEMENT =====================

// Create a new custom layer
export function createLayer(layerName, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return null;

    if (!mapLayers[currentMapId]) {
        mapLayers[currentMapId] = {};
    }

    // Check if layer already exists
    if (mapLayers[currentMapId][layerName]) {
        console.warn(`Layer '${layerName}' already exists`);
        return mapLayers[currentMapId][layerName];
    }

    // Create new layer group
    const layer = L.layerGroup();
    mapLayers[currentMapId][layerName] = layer;

    // Add to map if visible by default (default is true)
    const visible = options.visible !== undefined ? options.visible : true;
    if (visible) {
        layer.addTo(maps[currentMapId]);
    }

    return layer;
}

// Remove a custom layer
export function removeLayer(layerName) {
    if (!currentMapId || !maps[currentMapId] || !mapLayers[currentMapId]) return false;

    const layer = mapLayers[currentMapId][layerName];
    if (!layer) {
        console.warn(`Layer '${layerName}' not found`);
        return false;
    }

    // Remove from map
    if (maps[currentMapId].hasLayer(layer)) {
        maps[currentMapId].removeLayer(layer);
    }

    // Remove from storage
    delete mapLayers[currentMapId][layerName];
    return true;
}

// Get all layer names
export function getLayerNames() {
    if (!currentMapId || !mapLayers[currentMapId]) return [];

    return Object.keys(mapLayers[currentMapId]);
}

// Add marker to specific layer
export function addMarkerToLayer(lat, lng, layerName, popupText = null, iconType = null) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;

    // Ensure layer exists
    if (!mapLayers[currentMapId][layerName]) {
        createLayer(layerName);
    }

    const layer = mapLayers[currentMapId][layerName];
    const marker = L.marker([lat, lng]);

    if (popupText) {
        marker.bindPopup(popupText);
    }

    marker.addTo(layer);
    return marker;
}

// Add infrastructure marker to specific layer
export function addInfrastructureMarkerToLayer(lat, lng, layerName, infrastructureType, name, status, details) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;

    // Ensure layer exists
    if (!mapLayers[currentMapId][layerName]) {
        createLayer(layerName);
    }

    const icon = getInfrastructureIcon(infrastructureType, status);
    const marker = L.marker([lat, lng], { icon: icon });

    const popupContent = `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
                ${name}
            </h4>
            <div style="font-size: 12px; color: #4b5563;">
                ${details}
            </div>
        </div>
    `;

    marker.bindPopup(popupContent);
    marker.addTo(mapLayers[currentMapId][layerName]);

    return marker;
}

// Add pipe to specific layer
export function addPipeToLayer(latLngs, layerName, options) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;

    // Ensure layer exists
    if (!mapLayers[currentMapId][layerName]) {
        createLayer(layerName);
    }

    const polyline = L.polyline(latLngs, {
        color: options.color || '#3b82f6',
        weight: options.weight || 3,
        opacity: options.opacity || 0.8
    });

    const popupContent = `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 10px 0; color: #1f2937; font-size: 14px; font-weight: 600;">
                ${options.pipeName || 'Pipe'}
            </h4>
            <div style="font-size: 12px; color: #4b5563;">
                <strong>Material:</strong> ${options.material}<br/>
                <strong>Diameter:</strong> ${options.diameter} mm<br/>
                <strong>Status:</strong> ${options.status}
            </div>
        </div>
    `;

    polyline.bindPopup(popupContent);
    polyline.addTo(mapLayers[currentMapId][layerName]);

    return polyline;
}

// Add circle to specific layer
export function addCircleToLayer(lat, lng, radius, layerName, options = {}) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;

    // Ensure layer exists
    if (!mapLayers[currentMapId][layerName]) {
        createLayer(layerName);
    }

    const circle = L.circle([lat, lng], {
        radius: radius,
        ...options
    });

    circle.addTo(mapLayers[currentMapId][layerName]);
    return circle;
}

// Add polygon to specific layer
export function addPolygonToLayer(latLngs, layerName, options = {}) {
    if (!currentMapId || !mapLayers[currentMapId]) return null;

    // Ensure layer exists
    if (!mapLayers[currentMapId][layerName]) {
        createLayer(layerName);
    }

    const polygon = L.polygon(latLngs, options);
    polygon.addTo(mapLayers[currentMapId][layerName]);
    return polygon;
}

// Clear a specific layer
export function clearLayer(layerName) {
    if (!currentMapId || !mapLayers[currentMapId]) return false;

    const layer = mapLayers[currentMapId][layerName];
    if (!layer) {
        console.warn(`Layer '${layerName}' not found`);
        return false;
    }

    layer.clearLayers();
    return true;
}

// Show/hide a layer (alias for toggleLayer but more explicit)
export function showLayer(layerName) {
    toggleLayer(layerName, true);
}

export function hideLayer(layerName) {
    toggleLayer(layerName, false);
}

// Check if layer is visible
export function isLayerVisible(layerName) {
    if (!currentMapId || !maps[currentMapId] || !mapLayers[currentMapId]) return false;

    const layer = mapLayers[currentMapId][layerName];
    if (!layer) return false;

    return maps[currentMapId].hasLayer(layer);
}

// Add legend
export function addLegend() {
    if (!currentMapId || !maps[currentMapId]) return;
    
    const map = maps[currentMapId];
    const legend = L.control({ position: 'bottomright' });
    
    legend.onAdd = function() {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.background = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        
        div.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Infrastructure Status</h4>
            <div style="font-size: 12px;">
                <div style="margin-bottom: 5px;">
                    <span style="display: inline-block; width: 20px; height: 3px; background-color: #10b981; margin-right: 5px;"></span>
                    Operational
                </div>
                <div style="margin-bottom: 5px;">
                    <span style="display: inline-block; width: 20px; height: 3px; background-color: #f59e0b; margin-right: 5px;"></span>
                    Maintenance
                </div>
                <div style="margin-bottom: 5px;">
                    <span style="display: inline-block; width: 20px; height: 3px; background-color: #ef4444; margin-right: 5px;"></span>
                    Faulty/Leaking
                </div>
                <div>
                    <span style="display: inline-block; width: 20px; height: 3px; background-color: #6b7280; margin-right: 5px;"></span>
                    Stopped
                </div>
            </div>
        `;
        
        return div;
    };

    legend.addTo(map);
}

// ===================== ANIMATION FUNCTIONS =====================

// Pan to location with smooth animation
export function panTo(lat, lng, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return;

    const map = maps[currentMapId];
    const defaultOptions = {
        duration: 1.0, // seconds
        easeLinearity: 0.25,
        animate: true
    };

    map.panTo([lat, lng], { ...defaultOptions, ...options });
}

// Zoom to level with animation
export function zoomTo(zoomLevel, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return;

    const map = maps[currentMapId];
    const defaultOptions = {
        animate: true,
        duration: 0.5
    };

    map.setZoom(zoomLevel, { ...defaultOptions, ...options });
}

// Fly to location with smooth animation
export function flyTo(lat, lng, zoom, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return;

    const map = maps[currentMapId];
    const defaultOptions = {
        duration: 1.5,
        easeLinearity: 0.25,
        animate: true
    };

    map.flyTo([lat, lng], zoom, { ...defaultOptions, ...options });
}

// Bounce marker animation
export function bounceMarker(lat, lng, duration = 1000) {
    if (!currentMapId || !maps[currentMapId]) return;

    const map = maps[currentMapId];
    const marker = L.marker([lat, lng], {
        bounceOnAdd: true,
        bounceOnAddOptions: {
            duration: duration,
            height: 20
        }
    });

    marker.addTo(map);
    // Remove after animation
    setTimeout(() => {
        map.removeLayer(marker);
    }, duration + 500);
}

// Create a pulsing circle animation
export function addPulsingCircle(lat, lng, radius, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return null;

    const defaultOptions = {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.3,
        weight: 2,
        pulseInterval: 1000
    };

    const circle = L.circle([lat, lng], radius, { ...defaultOptions, ...options });
    circle.addTo(maps[currentMapId]);

    // Pulsing animation
    let pulseState = 0;
    const pulseInterval = options.pulseInterval || 1000;
    const intervalId = setInterval(() => {
        pulseState = pulseState === 0 ? 1 : 0;
        const opacity = pulseState === 0 ? 0.3 : 0.7;
        circle.setStyle({ fillOpacity: opacity });
    }, pulseInterval);

    // Store interval ID on circle for cleanup
    circle._pulseIntervalId = intervalId;

    return circle;
}

// Stop pulsing animation on a circle
export function stopPulsingCircle(circle) {
    if (circle && circle._pulseIntervalId) {
        clearInterval(circle._pulseIntervalId);
        delete circle._pulseIntervalId;
        circle.setStyle({ fillOpacity: 0.3 });
    }
}

// Add animated flow along a pipe (polyline)
export function addFlowAnimation(polyline, options = {}) {
    if (!polyline) return;

    const defaultOptions = {
        color: '#3b82f6',
        weight: 3,
        dashArray: '10, 20',
        animate: true,
        animationDuration: 2000
    };

    const style = { ...defaultOptions, ...options };
    polyline.setStyle(style);

    // Create moving dash animation using CSS
    const path = polyline._path;
    if (path && style.animate) {
        path.style.animation = `flow ${style.animationDuration}ms linear infinite`;

        // Add CSS keyframes if not already present
        if (!document.getElementById('leaflet-flow-animation')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'leaflet-flow-animation';
            styleSheet.textContent = `
                @keyframes flow {
                    from {
                        stroke-dashoffset: 30;
                    }
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    return polyline;
}

// Highlight element with flash animation
export function flashHighlight(element, color = '#ffff00', duration = lodging? Actually, let me implement a simple flash. We'll do a color change and revert. Let me implement a flash function for markers/circles/polylines.
// Highlight element with flash animation
export function flashHighlight(element, flashColor = '#ffff00', duration = 1000) {
    if (!element) return;

    const originalColor = element.options.color || '#3b82f6';
    const originalFillColor = element.options.fillColor || '#3b82f6';

    // Flash to highlight color
    element.setStyle({ color: flashColor, fillColor: flashColor });

    // Revert after duration
    setTimeout(() => {
        element.setStyle({ color: originalColor, fillColor: originalFillColor });
    }, duration);
}

// Add popup with animation
export function openPopupWithAnimation(lat, lng, content, options = {}) {
    if (!currentMapId || !maps[currentMapId]) return;

    const map = maps[currentMapId];
    const popup = L.popup(options)
        .setLatLng([lat, lng])
        .setContent(content);

    popup.openOn(map);

    // Add bounce animation using existing function
    bounceMarker(lat, lng, 500);

    return popup;
}
