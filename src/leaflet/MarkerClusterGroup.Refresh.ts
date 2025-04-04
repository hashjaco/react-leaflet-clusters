import L from 'leaflet';
import '../leaflet/MarkerClusterGroup.Refresh';

declare module 'leaflet' {
    interface MarkerClusterGroup {
        /**
         * Updates the icon of all clusters which are parents of the given marker(s).
         * In singleMarkerMode, also updates the given marker(s) icon.
         */
        refreshClusters(
            layers?: L.Marker | L.MarkerCluster | L.LayerGroup | Array<L.Marker>
        ): this;

        // Internal helper methods
        _flagParentsIconsNeedUpdate(layers: any): void;

        _refreshClustersIcons(): void;

        _refreshSingleMarkerModeMarkers(layers: any): void;
    }

    interface Marker {
        /**
         * Updates the given options in the marker's icon and refreshes the marker.
         */
        refreshIconOptions(options: L.IconOptions, directlyRefreshClusters?: boolean): this;
    }
}

L.MarkerClusterGroup.include({
    refreshClusters: function (layers?: any): L.MarkerClusterGroup {
        if (!layers) {
            layers = this._topClusterLevel.getAllChildMarkers();
        } else if (layers instanceof L.MarkerClusterGroup) {
            layers = layers._topClusterLevel.getAllChildMarkers();
        } else if (layers instanceof L.LayerGroup) {
            layers = layers.getLayers();
        } else if (layers instanceof L.MarkerCluster) {
            layers = layers.getAllChildMarkers();
        } else if (layers instanceof L.Marker) {
            layers = [layers];
        }
        this._flagParentsIconsNeedUpdate(layers);
        this._refreshClustersIcons();

        // In case of singleMarkerMode, also re-draw the markers.
        if (this.options.singleMarkerMode) {
            this._refreshSingleMarkerModeMarkers(layers);
        }
        return this;
    },

    _flagParentsIconsNeedUpdate: function (layers: any): void {
        for (const id in layers) {
            let parent = layers[id].__parent;
            while (parent) {
                parent._iconNeedsUpdate = true;
                parent = parent.__parent;
            }
        }
    },

    _refreshClustersIcons: function (): void {
        // Iterate over each layer in the feature group and update if needed.
        this._featureGroup.eachLayer((c: any) => {
            if (c instanceof L.MarkerCluster && c._iconNeedsUpdate) {
                c._updateIcon();
            }
        });
    },

    _refreshSingleMarkerModeMarkers: function (layers: any): void {
        for (const id in layers) {
            const layer = layers[id];
            if (this.hasLayer(layer)) {
                // Re-create the icon and update the marker.
                layer.setIcon(this._overrideMarkerIcon(layer));
            }
        }
    }
});

L.Marker.include({
    refreshIconOptions: function (
        options: L.IconOptions,
        directlyRefreshClusters?: boolean
    ): L.Marker {
        const icon = this.options.icon;
        L.setOptions(icon, options);
        this.setIcon(icon);
        // If directly refreshing, update the parent cluster immediately.
        if (directlyRefreshClusters && this.__parent) {
            this.__parent._group.refreshClusters(this);
        }
        return this;
    }
});