import L from 'leaflet';
import { MarkerClusterGroup } from './MarkerClusterGroup';

export class MarkerCluster extends L.Marker {
    _group: MarkerClusterGroup;
    _zoom: number;
    _markers: L.Marker[];
    _childClusters: MarkerCluster[];
    _childCount: number;
    _iconNeedsUpdate: boolean;
    _boundsNeedUpdate: boolean;
    _bounds: L.LatLngBounds;
    _cLatLng?: L.LatLng; // Cluster center as determined by the first child.
    _wLatLng?: L.LatLng; // Weighted (average) center.
    _iconObj?: L.DivIcon;
    _icon?: L.Icon;
    _spiderfied: boolean;

    constructor(
        group: MarkerClusterGroup,
        zoom: number,
        a?: L.Marker,
        b?: L.Marker
    ) {
        // Determine initial position: if marker "a" exists, use its _cLatLng (if set) or its getLatLng(), else default to (0,0)
        const initialLatLng = a ? ((a as any)._cLatLng || a.getLatLng()) : new L.LatLng(0, 0);
        // Call the parent constructor. We pass an empty icon here; we’ll set it below.
        super(initialLatLng, { icon: undefined, pane: group._options.clusterPane });
        // Set our icon to ourselves (our createIcon method will be called by the map).
        this.setIcon(new L.DivIcon({
            html: `<div><span>${this.getChildCount()}<span aria-label="markers"></span></span></div>`,
            className: 'marker-cluster',
            iconSize: new L.Point(40, 40)
        }));

        this._group = group;
        this._zoom = zoom;
        this._markers = [];
        this._childClusters = [];
        this._childCount = 0;
        this._iconNeedsUpdate = true;
        this._boundsNeedUpdate = true;
        this._bounds = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
        this._spiderfied = false;

        if (a) {
            this._addChild(a);
        }
        if (b) {
            this._addChild(b);
        }
    }

    // Recursively retrieve all child markers.
    getAllChildMarkers(storageArray: L.Marker[] | null = [], ignoreDraggedMarker?: boolean): L.Marker[] {
        if (storageArray) {
            for (let i = this._childClusters.length - 1; i >= 0; i--) {
                this._childClusters[i].getAllChildMarkers(storageArray, ignoreDraggedMarker);
            }
            for (let j = this._markers.length - 1; j >= 0; j--) {
                if (ignoreDraggedMarker && (this._markers[j] as any).__dragStart) {
                    continue;
                }
                storageArray.push(this._markers[j]);
            }
            return storageArray;
        }

        return [];
    }

    // Returns the total count of child markers (including those in sub-clusters)
    getChildCount(): number {
        return this._childCount;
    }

    // Zoom to bounds that show all child markers, or use fitBounds as needed.
    zoomToBounds(fitBoundsOptions?: L.FitBoundsOptions): void {
        const childClusters = this._childClusters.slice();
        const map = childClusters[0]._map || this._map;
        const boundsZoom = map.getBoundsZoom(this._bounds);
        let zoom = this._zoom + 1;
        const mapZoom = map.getZoom();

        // Increase zoom until the bounds are visible.
        while (childClusters.length > 0 && boundsZoom > zoom) {
            zoom++;
            const newClusters: MarkerCluster[] = [];
            for (let i = 0; i < childClusters.length; i++) {
                newClusters.push(...childClusters[i]._childClusters);
            }
            childClusters.splice(0, childClusters.length, ...newClusters);
        }

        if (boundsZoom > zoom) {
            map.setView(this.getLatLng(), zoom);
        } else if (boundsZoom <= mapZoom) {
            map.setView(this.getLatLng(), mapZoom + 1);
        } else {
            map.fitBounds(this._bounds, fitBoundsOptions);
        }
    }

    // Return the cluster bounds.
    getBounds(): L.LatLngBounds {
        const bounds = new L.LatLngBounds(new L.LatLng(0, 0), new L.LatLng(0, 0));
        bounds.extend(this._bounds);
        return bounds;
    }

    // Mark the icon as needing an update and re-set the icon if already rendered.
    _updateIcon(): void {
        this._iconNeedsUpdate = true;
        if (this._icon) {
            this.setIcon(new L.DivIcon({
                html: `<div><span>${this.getChildCount()}<span aria-label="markers"></span></span></div>`,
                className: 'marker-cluster',
                iconSize: new L.Point(40, 40)
            }));
        }
    }

    // Create the cluster icon by calling the iconCreateFunction if available.
    createIcon(): HTMLElement {
        if (this._iconNeedsUpdate) {
            this._iconObj = this._group._options.iconCreateFunction
                ? this._group._options.iconCreateFunction(this)
                : new L.DivIcon({
                    html: `<div><span>${this.getChildCount()}<span aria-label="markers"></span></span></div>`,
                    className: 'marker-cluster',
                    iconSize: new L.Point(40, 40)
                });
            this._iconNeedsUpdate = false;
        }
        return this._iconObj ? this._iconObj.createIcon() : document.createElement('div');    }

    createShadow(): HTMLElement | null {
        return this._iconObj ? this._iconObj.createShadow() : null;
    }

    // Recursively add a child marker or cluster to this cluster.
    _addChild(newChild: L.Marker | MarkerCluster, isNotificationFromChild?: boolean): void {
        this._iconNeedsUpdate = true;
        this._boundsNeedUpdate = true;
        this._setClusterCenter(newChild);

        if (newChild instanceof MarkerCluster) {
            if (!isNotificationFromChild) {
                this._childClusters.push(newChild);
                (newChild as any).__parent = this;
            }
            this._childCount += newChild.getChildCount();
        } else {
            if (!isNotificationFromChild) {
                this._markers.push(newChild);
            }
            this._childCount++;
        }

        // Propagate child addition up the hierarchy if a parent cluster exists.
        if ((this as any).__parent) {
            ((this as any).__parent as MarkerCluster)._addChild(newChild, true);
        }
    }

    // Establish the cluster center if it hasn’t been set yet.
    _setClusterCenter(child: L.Marker | MarkerCluster): void {
        if (!this._cLatLng) {
            this._cLatLng = (child as any)._cLatLng || child.getLatLng();
        }
    }

    // Reset bounds to extreme values so that subsequent extensions work correctly.
    _resetBounds(): void {
        const southWest = this._bounds.getSouthWest();
        const northEast = this._bounds.getNorthEast();

        if (southWest) {
            southWest.lat = Infinity;
            southWest.lng = Infinity;
        }
        if (northEast) {
            northEast.lat = -Infinity;
            northEast.lng = -Infinity;
        }
    }

    // Recalculate the bounds of the cluster based on its child markers and clusters.
    _recalculateBounds(): void {
        let latSum = 0, lngSum = 0;
        const totalCount = this._childCount;
        if (totalCount === 0) return;

        this._resetBounds();

        // Extend bounds for individual markers.
        for (let i = 0; i < this._markers.length; i++) {
            const childLatLng = this._markers[i].getLatLng();
            this._bounds.extend(childLatLng);
            latSum += childLatLng.lat;
            lngSum += childLatLng.lng;
        }

        // Extend bounds for child clusters.
        for (let i = 0; i < this._childClusters.length; i++) {
            const child = this._childClusters[i];
            if (child._boundsNeedUpdate) {
                child._recalculateBounds();
            }
            this._bounds.extend(child._bounds);
            const childLatLng = child._wLatLng;
            const childCount = child.getChildCount();
            latSum += (childLatLng ? childLatLng.lat : 0) * childCount;
            lngSum += (childLatLng ? childLatLng.lng : 0) * childCount;
        }

        const avgLatLng = new L.LatLng(latSum / totalCount, lngSum / totalCount);
        this.setLatLng(avgLatLng);
        this._wLatLng = this.getLatLng();
        this._boundsNeedUpdate = false;
    }

    // Returns true if this cluster is the only child of its parent.
    _isSingleParent(): boolean {
        return (
            this._childClusters.length > 0 &&
            this._childClusters[0].getChildCount() === this._childCount
        );
    }
}
