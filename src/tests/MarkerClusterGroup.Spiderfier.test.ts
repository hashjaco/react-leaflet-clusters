import {describe, it, beforeEach, afterEach, expect} from 'vitest';
import L from 'leaflet';
import {MarkerCluster} from '../leaflet/MarkerCluster';
import '../leaflet/MarkerCluster.Spiderfier';
import {MarkerClusterGroup} from "../leaflet/MarkerClusterGroup.ts";

// DummyClusterGroup provides the minimal properties required for spiderfier testing.
class DummyClusterGroup extends (L.FeatureGroup && MarkerClusterGroup) {
    _map: L.Map;
    _featureGroup: L.FeatureGroup;
    options: any;
    _spiderfied?: MarkerCluster;
    inZoomAnimation: boolean;
    _ignoreMove: boolean;

    constructor(map: L.Map) {
        super();
        this._map = map;
        // Create a feature group for markers (this will hold our markers during spiderfying)
        this._featureGroup = L.featureGroup().addTo(map);
        // Set minimal options required by spiderfier.
        this.options = {
            spiderfyDistanceMultiplier: 1,
            spiderfyShapePositions: undefined
        };
        this._spiderfied = undefined;
        this.inZoomAnimation = false;
        this._ignoreMove = false;
    }
}

function initialize(map: L.Map) {
    const dummyGroup = new DummyClusterGroup(map);
    const initialMarker = new L.Marker(new L.LatLng(51.505, -0.09));
    const cluster = new MarkerCluster(dummyGroup, 12, initialMarker);
    const marker1 = new L.Marker(new L.LatLng(51.505, -0.09));
    const marker2 = new L.Marker(new L.LatLng(51.506, -0.091));
    cluster._addChild(marker1);
    cluster._addChild(marker2);
    // Save original positions.
    const origPos1 = marker1.getLatLng().clone();
    const origPos2 = marker2.getLatLng().clone();
    return {dummyGroup, cluster, marker1, marker2, origPos1, origPos2};
}

describe('MarkerCluster.Spiderfier', () => {
    let container: HTMLElement;
    let map: L.Map;

    beforeEach(() => {
        // Create a container for the map.
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);
        // Initialize the Leaflet map.
        map = L.map(container, {
            center: [51.505, -0.09],
            zoom: 13,
            maxZoom: 18,
            minZoom: 0
        });
    });

    afterEach(() => {
        map.remove();
        container.remove();
    });

    it('should spiderfy a cluster and reposition its child markers', () => {
        const {dummyGroup, cluster, marker1, marker2, origPos1, origPos2} = initialize(map);

        // Listen for the 'spiderfied' event.
        let eventFired = false;
        dummyGroup.on('spiderfied', (_e: any) => {
            eventFired = true;
        });

        // Call spiderfy.
        cluster.spiderfy();

        // Verify that the 'spiderfied' event was fired.
        expect(eventFired).toBe(true);
        // Verify that the markers' positions have changed.
        const newPos1 = marker1.getLatLng();
        const newPos2 = marker2.getLatLng();
        expect(newPos1.equals(origPos1)).toBe(false);
        expect(newPos2.equals(origPos2)).toBe(false);
    });

    it('should unspiderfy a cluster and restore child marker positions', () => {
        const {cluster, marker1, marker2, origPos1, origPos2} = initialize(map);

        // Spiderfy the cluster.
        cluster.spiderfy();
        // Then unspiderfy the cluster.
        cluster.unspiderfy();

        // After unspiderfying, markers should be restored to their original positions.
        const restoredPos1 = marker1.getLatLng();
        const restoredPos2 = marker2.getLatLng();
        expect(restoredPos1.equals(origPos1)).toBe(true);
        expect(restoredPos2.equals(origPos2)).toBe(true);
    });
});
