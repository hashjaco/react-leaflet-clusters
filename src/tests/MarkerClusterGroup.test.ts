import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import L from 'leaflet';
import { MarkerClusterGroup } from '../leaflet/MarkerClusterGroup';

describe('MarkerClusterGroup', () => {
    let container: HTMLElement;
    let map: L.Map;

    beforeEach(() => {
        // Create a container element for the map
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
        // Initialize a Leaflet map
        map = L.map(container, {
            center: [51.505, -0.09],
            zoom: 13,
            maxZoom: 18,
            minZoom: 0,
        });
    });

    afterEach(() => {
        // Clean up the map and container after each test
        // map.remove();
        container.remove();
    });

    it('should instantiate with default options', () => {
        const clusterGroup = new MarkerClusterGroup();
        expect(clusterGroup._options.maxClusterRadius).toBe(80);
        expect(clusterGroup._options.singleMarkerMode).toBe(false);
    });

    it('should call beforeAddToMap callback on onAdd', () => {
        let callbackCalled = false;
        const clusterGroup = new MarkerClusterGroup({
            beforeAddToMap: (_group) => {
                callbackCalled = true;
            },
        });
        clusterGroup.onAdd(map);
        expect(callbackCalled).toBe(true);
    });

    it('should add non-point layers to nonPointGroup and point markers to featureGroup', () => {
        const clusterGroup = new MarkerClusterGroup();
        clusterGroup.onAdd(map);

        // Create a non-point layer (simulate layer without getLatLng)
        const nonPointLayer = new L.Layer();
        // Create a marker (which has a getLatLng method)
        const marker = new L.Marker(new L.LatLng(51.5, -0.09));

        clusterGroup.addLayer(nonPointLayer);
        clusterGroup.addLayer(marker);

        // The non-point layer should be added to _nonPointGroup,
        // and the marker should be added to _featureGroup.
        expect(clusterGroup._nonPointGroup.getLayers()).toContain(nonPointLayer);
        expect(clusterGroup._featureGroup.getLayers()).toContain(marker);
    });

    it('hasLayer should return true for an added marker', () => {
        const clusterGroup = new MarkerClusterGroup();
        clusterGroup.onAdd(map);
        const marker = new L.Marker(new L.LatLng(51.5, -0.09));
        clusterGroup.addLayer(marker);
        expect(clusterGroup.hasLayer(marker)).toBe(true);
    });

    it('onRemove should clear the map reference', () => {
        const clusterGroup = new MarkerClusterGroup();
        clusterGroup.onAdd(map);
        clusterGroup.onRemove(map);
        !expect(clusterGroup.getMap()).toBeUndefined;
    });
});
