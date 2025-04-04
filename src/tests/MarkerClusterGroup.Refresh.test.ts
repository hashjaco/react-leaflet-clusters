import '../leaflet/MarkerClusterGroup'; // Ensure the core MarkerClusterGroup is loaded
import '../leaflet/MarkerClusterGroup.Refresh';
import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
// Import the plugin extension so that it augments Leaflet’s classes.

describe('MarkerClusterGroup.Refresh', () => {
    it('should refresh marker icon options and trigger parent cluster refresh when directlyRefreshClusters is true', () => {
        // Create a dummy marker with an initial icon.
        const initialIcon = new L.Icon({ iconUrl: 'old-icon.png' });
        const marker = new L.Marker(new L.LatLng(51.5, -0.09), { icon: initialIcon });

        // Create a dummy parent cluster with a _group that has refreshClusters as a spy.
        const dummyGroup = {
            refreshClusters: vi.fn(),
        };
        // Attach a fake __parent with _group.
        marker.__parent = { _group: dummyGroup };

        // Update the icon options.
        const newOptions = { iconUrl: 'new-icon.png' } as L.IconOptions;
        marker.refreshIconOptions(newOptions, true);

        // The marker's icon options should be updated.
        expect(marker.options.icon?.options.iconUrl).toBe('new-icon.png');

        // The parent's refreshClusters method should be called with the marker.
        expect(dummyGroup.refreshClusters).toHaveBeenCalledWith(marker);
    });
});
