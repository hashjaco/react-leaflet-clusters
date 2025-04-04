import L, {IconOptions} from 'leaflet';
import {DistanceGrid} from './DistanceGrid';
import {MarkerCluster} from './MarkerCluster';

export interface MarkerClusterGroupOptions {
    maxClusterRadius?: number | ((zoom: number) => number);
    iconCreateFunction?: (cluster: MarkerCluster) => L.Icon;
    clusterPane?: string;
    spiderfyOnEveryZoom?: boolean;
    spiderfyOnMaxZoom?: boolean;
    showCoverageOnHover?: boolean;
    zoomToBoundsOnClick?: boolean;
    singleMarkerMode?: boolean;
    disableClusteringAtZoom?: number | null;
    removeOutsideVisibleBounds?: boolean;
    animate?: boolean;
    animateAddingMarkers?: boolean;
    spiderfyShapePositions?: (childCount: number, center: L.Point) => L.Point[];
    spiderfyDistanceMultiplier?: number;
    spiderLegPolylineOptions?: L.PolylineOptions;
    chunkedLoading?: boolean;
    chunkInterval?: number;
    chunkDelay?: number;
    chunkProgress?: ((processed: number, total: number, elapsed: number) => void) | null;
    polygonOptions?: L.PolylineOptions;
    beforeAddToMap?: (clusterGroup: MarkerClusterGroup) => void;
    prerenderFunction?: (clusters: MarkerCluster[], group: MarkerClusterGroup) => void;
}

export class MarkerClusterGroup extends L.FeatureGroup {
    _options: MarkerClusterGroupOptions;
    _featureGroup: L.FeatureGroup;
    _nonPointGroup: L.FeatureGroup;
    _inZoomAnimation: number;
    _needsClustering: any[];
    _needsRemoving: any[];
    _currentShownBounds: L.LatLngBounds | null;
    _queue: Array<() => void>;
    _childMarkerEventHandlers: { [event: string]: (e: any) => void };
    _topClusterLevel!: MarkerCluster; // Will be set during initialization.
    _gridClusters!: Record<number, DistanceGrid>;
    _gridUnclustered!: Record<number, DistanceGrid>;
    _maxZoom!: number;
    _maxLat: number = 0;
    _zoom!: number;
    _spiderfied?: MarkerCluster;
    _ignoreMove?: boolean;
    // _map: L.Map | undefined;

    constructor(options: MarkerClusterGroupOptions = {}) {
        super();
        this._options = {
            maxClusterRadius: 80,
            spiderfyOnEveryZoom: false,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
            singleMarkerMode: false,
            removeOutsideVisibleBounds: true,
            animate: true,
            animateAddingMarkers: false,
            spiderfyDistanceMultiplier: 1,
            spiderLegPolylineOptions: {weight: 1.5, color: '#222', opacity: 0.5},
            chunkedLoading: false,
            chunkInterval: 200,
            chunkDelay: 50,
            chunkProgress: null,
            polygonOptions: {},
            disableClusteringAtZoom: null,
            ...options,
        };
        L.Util.setOptions(this, this._options);
        this._featureGroup = L.featureGroup();
        this._featureGroup.addEventParent(this);
        this._nonPointGroup = L.featureGroup();
        this._nonPointGroup.addEventParent(this);
        this._inZoomAnimation = 0;
        this._needsClustering = [];
        this._needsRemoving = [];
        this._currentShownBounds = null;
        this._queue = [];
        // Bind child marker event handlers
        this._childMarkerEventHandlers = {
            dragstart: this._childMarkerDragStart.bind(this),
            move: this._childMarkerMoved.bind(this),
            dragend: this._childMarkerDragEnd.bind(this),
        };

        // Animation support: if animations are enabled and supported, assign animated methods.
        const animate = L.DomUtil.TRANSITION && this._options.animate;
        if (animate) {
            Object.assign(this, this._withAnimation);
        } else {
            Object.assign(this, this._noAnimation);
        }

        this.onAdd = this.onAdd.bind(this);
        this.onRemove = this.onRemove.bind(this);

        // Initialization of grids and top cluster level will be done when the group is added to the map.
    }

    getMap(): L.Map {
        return this._map;
    }

    // Called when the group is added to the map.
    onAdd(map: L.Map): this {
        this._map = map;
        if (!isFinite(map.getMaxZoom())) {
            throw new Error("Map has no maxZoom specified");
        }
        this._featureGroup.addTo(map);
        this._nonPointGroup.addTo(map);
        if (!this._gridClusters) {
            this._generateInitialClusters();
        }
        this._maxLat = Number(map.options.crs?.getProjectedBounds(this._zoom).max?.x);
        // Handle any markers waiting to be added before map was available.
        const l = this._needsClustering.length;
        if (l) {
            this.addLayers(this._needsClustering, true);
            this._needsClustering = [];
        }
        // Bind necessary events.
        map.on('zoomend', this._zoomEnd, this);
        map.on('moveend', this._moveEnd, this);
        // Call any custom pre-add function if provided.
        if (this._options.beforeAddToMap) {
            this._options.beforeAddToMap(this);
        }
        return this;
    }

    // Called when the group is removed from the map.
    onRemove(map: L.Map): this {
        map.off('zoomend', this._zoomEnd, this);
        map.off('moveend', this._moveEnd, this);
        this._unbindEvents();
        this._featureGroup.remove();
        this._nonPointGroup.remove();
        this._featureGroup.clearLayers();
        // this._map = undefined;
        return this;
    }

    // Adds a single layer (marker) to the cluster group.
    addLayer(layer: L.Layer): this {
        if (layer instanceof L.LayerGroup) {
            return this.addLayers([layer]);
        }
        if (!(layer as any).getLatLng) {
            this._nonPointGroup.addLayer(layer);
            this.fire('layeradd', {layer});
            return this;
        }
        if (!this._map) {
            this._needsClustering.push(layer);
            this.fire('layeradd', {layer});
            return this;
        }
        if (this.hasLayer(layer)) {
            return this;
        }
        if ((this as any)._unspiderfy) {
            (this as any)._unspiderfy();
        }
        this._addLayer(layer as L.Marker, this._maxZoom);
        this.fire('layeradd', {layer});
        this._topClusterLevel._recalculateBounds();
        this._refreshClustersIcons();
        if (
            this._currentShownBounds &&
            this._currentShownBounds.contains((layer as any).getLatLng())
        ) {
            if (this._options.animateAddingMarkers) {
                // Animation for adding marker can be implemented here.
            } else {
                // Non-animated add.
            }
        }
        return this;
    }

    // Adds an array of layers.
    addLayers(layersArray: L.Layer[], skipLayerAddEvent?: boolean): this {
        if (!Array.isArray(layersArray)) {
            return this.addLayer(layersArray);
        }
        let fg = this._featureGroup,
            npg = this._nonPointGroup,
            chunked = this._options.chunkedLoading,
            chunkInterval = this._options.chunkInterval!,
            chunkProgress = this._options.chunkProgress,
            l = layersArray.length,
            offset = 0,
            originalArray = true,
            m: any;
        if (this._map) {
            const started = Date.now();
            const process = () => {
                const start = Date.now();
                if (this._map && (this as any)._unspiderfy) {
                    (this as any)._unspiderfy();
                }
                for (; offset < l; offset++) {
                    if (chunked && offset % 200 === 0) {
                        const elapsed = Date.now() - start;
                        if (elapsed > chunkInterval) break;
                    }
                    m = layersArray[offset];
                    if (m instanceof L.LayerGroup) {
                        if (originalArray) {
                            layersArray = layersArray.slice();
                            originalArray = false;
                        }
                        // Optionally extract layers from group.
                        l = layersArray.length;
                        continue;
                    }
                    if (!(m as any).getLatLng) {
                        npg.addLayer(m);
                        if (!skipLayerAddEvent) this.fire('layeradd', {layer: m});
                        continue;
                    }
                    if (this.hasLayer(m)) continue;
                    this._addLayer(m as L.Marker, this._maxZoom);
                    if (!skipLayerAddEvent) this.fire('layeradd', {layer: m});
                    // Handle conversion to cluster if needed.
                    if ((m as any).__parent && (m as any).__parent.getChildCount() === 2) {
                        const markers = (m as any).__parent.getAllChildMarkers();
                        const otherMarker = markers[0] === m ? markers[1] : markers[0];
                        fg.removeLayer(otherMarker);
                    }
                }
                if (chunkProgress) {
                    chunkProgress(offset, l, Date.now() - started);
                }
                if (offset === l) {
                    this._topClusterLevel._recalculateBounds();
                    this._refreshClustersIcons();
                    // Optionally update map with new clusters.
                } else {
                    setTimeout(process, this._options.chunkDelay);
                }
            };
            process();
        } else {
            for (; offset < l; offset++) {
                m = layersArray[offset];
                if (m instanceof L.LayerGroup) {
                    if (originalArray) {
                        layersArray = layersArray.slice();
                        originalArray = false;
                    }
                    l = layersArray.length;
                    continue;
                }
                if (!(m as any).getLatLng) {
                    npg.addLayer(m);
                    continue;
                }
                if (this.hasLayer(m)) continue;
                this._needsClustering.push(m);
            }
        }
        return this;
    }

    // Checks if a layer is present in this cluster group.
    hasLayer(layer: L.Layer): boolean {
        return (
            this._featureGroup.hasLayer(layer) || this._nonPointGroup.hasLayer(layer)
        );
    }

    // Refreshes cluster icons in the feature group.
    _refreshClustersIcons(): void {
        this._featureGroup.eachLayer((c: any) => {
            if (c instanceof MarkerCluster && c._iconNeedsUpdate) {
                c._updateIcon();
            }
        });
    }

    // Event handler for when the zoom ends.
    _zoomEnd(): void {
        if (!this._map) return;
        // Merge/split clusters as needed.
        // Simplified: recalc zoom level and bounds.
        this._zoom = Math.round(this._map.getZoom());
        this._currentShownBounds = this._getExpandedVisibleBounds();
    }

    // Event handler for when map movement ends.
    _moveEnd(): void {
        if (this._inZoomAnimation) return;
        const newBounds = this._getExpandedVisibleBounds();
        // Update clusters on map move.
        this._currentShownBounds = newBounds;
    }

    // Unbinds map events (placeholder).
    _unbindEvents(): void {
        if (this._map) {
            this._map.off('zoomend', this._zoomEnd, this);
            this._map.off('moveend', this._moveEnd, this);
        }
    }

    // Generates initial clustering grids and top cluster level.
    _generateInitialClusters(): void {
        const maxZoom = Math.ceil(this._map!.getMaxZoom());
        const minZoom = Math.floor(this._map!.getMinZoom());
        const radius = this._options.maxClusterRadius!;
        const radiusFn = (zoom: number) => (typeof radius === 'function' ? radius(zoom) : radius);
        if (this._options.disableClusteringAtZoom !== null) {
            this._maxZoom = this._options.disableClusteringAtZoom ? -1 : maxZoom;
        } else {
            this._maxZoom = maxZoom;
        }
        this._gridClusters = {};
        this._gridUnclustered = {};
        for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
            this._gridClusters[zoom] = new DistanceGrid(radiusFn(zoom));
            this._gridUnclustered[zoom] = new DistanceGrid(radiusFn(zoom));
        }
        // Initialize _topClusterLevel using MarkerCluster.
        this._topClusterLevel = new MarkerCluster(this, minZoom - 1);
    }

    // Adds a layer to the clustering grid.
    _addLayer(layer: L.Marker, _zoom: number): void {
        // Simplified placeholder for clustering logic.
        if (this._options.singleMarkerMode) {
            // Optionally override marker icon.
            const icon = this._overrideMarkerIcon(layer);
            if (icon) layer.setIcon(icon);
        }
        layer.on(this._childMarkerEventHandlers);
        // For now, simply add to the feature group.
        this._featureGroup.addLayer(layer);
        // In a complete implementation, search the distance grids, cluster markers,
        // and update __parent properties accordingly.
    }

    // Overrides the marker icon in singleMarkerMode.
    _overrideMarkerIcon(layer: L.Marker): L.Icon<IconOptions> | L.DivIcon | undefined {
        if (this._options.iconCreateFunction) {
            return this._options.iconCreateFunction(new MarkerCluster(this, this._maxZoom, layer));
        }
        // Fallback: return the marker's existing icon.
        return layer.options.icon;
    }

    // Gets expanded bounds for visible clusters.
    _getExpandedVisibleBounds(): L.LatLngBounds {
        if (!this._options.removeOutsideVisibleBounds) {
            return new L.LatLngBounds(
                new L.LatLng(-Infinity, -Infinity),
                new L.LatLng(Infinity, Infinity)
            );
        } else if (L.Browser.mobile) {
            return this._checkBoundsMaxLat(this._map!.getBounds());
        }
        return this._checkBoundsMaxLat(this._map!.getBounds().pad(1));
    }

    // Checks for maximum latitude issues.
    _checkBoundsMaxLat(bounds: L.LatLngBounds): L.LatLngBounds {
        if (this._maxLat !== undefined) {
            if (bounds.getNorth() >= this._maxLat) {
                (bounds as any)._northEast.lat = Infinity;
            }
            if (bounds.getSouth() <= -this._maxLat) {
                (bounds as any)._southWest.lat = -Infinity;
            }
        }
        return bounds;
    }

    // --- Animation Methods ---
    // Non-animated versions
    _noAnimation = {
        _animationStart: () => { /* no-op */
        },
        _animationZoomIn: (_previousZoomLevel: number, _newZoomLevel: number) => {
            // Simplified: remove old clusters and add children.
            this.fire('animationend');
        },
        _animationZoomOut: (_previousZoomLevel: number, _newZoomLevel: number) => {
            this.fire('animationend');
        },
        _animationAddLayer: (layer: L.Marker, _newCluster: any) => {
            this._featureGroup.addLayer(layer);
        }
    };

    // Animated versions (simplified)
    _withAnimation = {
        _animationStart: () => {
            if (this._map) {
                this._map.getContainer().classList.add('leaflet-cluster-anim');
            }
            this._inZoomAnimation++;
        },
        _animationZoomIn: (_previousZoomLevel: number, _newZoomLevel: number) => {
            this._inZoomAnimation--;
            this.fire('animationend');
        },
        _animationZoomOut: (_previousZoomLevel: number, _newZoomLevel: number) => {
            this._inZoomAnimation--;
            this.fire('animationend');
        },
        _animationAddLayer: (layer: L.Marker, _newCluster: any) => {
            this._featureGroup.addLayer(layer);
        }
    };

    // --- Child Marker Event Handlers ---
    _childMarkerDragStart(e: any): void {
        e.target.__dragStart = e.target._latlng;
    }

    _childMarkerMoved(e: any): void {
        if (!(this as any)._ignoreMove && !e.target.__dragStart) {
            const isPopupOpen = e.target._popup && e.target._popup.isOpen();
            this._moveChild(e.target, e.oldLatLng, e.latlng);
            if (isPopupOpen) {
                e.target.openPopup();
            }
        }
    }

    _childMarkerDragEnd(e: any): void {
        const dragStart = e.target.__dragStart;
        delete e.target.__dragStart;
        if (dragStart) {
            this._moveChild(e.target, dragStart, e.target._latlng);
        }
    }

    _moveChild(layer: L.Marker, from: L.LatLng, to: L.LatLng): void {
        layer.setLatLng(from);
        this.removeLayer(layer);
        layer.setLatLng(to);
        this.addLayer(layer);
    }
}