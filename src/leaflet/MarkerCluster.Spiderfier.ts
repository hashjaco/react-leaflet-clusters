import L from 'leaflet';
import { MarkerCluster } from './MarkerCluster';

// Augment the MarkerCluster interface with spiderfier properties and methods.
declare module './MarkerCluster' {
    interface MarkerCluster {
        _2PI: number;
        _circleFootSeparation: number;
        _circleStartAngle: number;
        _spiralFootSeparation: number;
        _spiralLengthStart: number;
        _spiralLengthFactor: number;
        _circleSpiralSwitchover: number;
        _spiderfied: boolean;
        _animationUnspiderfy?: (zoomDetails?: any) => void;
        _spiderLeg: L.Polyline | null;

        spiderfy(): void;
        unspiderfy(zoomDetails?: any): void;
        _generatePointsCircle(count: number, centerPt: L.Point): L.Point[];
        _generatePointsSpiral(count: number, centerPt: L.Point): L.Point[];
        _noanimationUnspiderfy(): void;
    }
}

MarkerCluster.include({
    _2PI: Math.PI * 2,
    _circleFootSeparation: 25,
    _circleStartAngle: 0,
    _spiralFootSeparation: 28,
    _spiralLengthStart: 11,
    _spiralLengthFactor: 5,
    _circleSpiralSwitchover: 9,
    _spiderfied: false,
    _spiderLeg: null,

    spiderfy: function (this: MarkerCluster): void {
        const group = this._group;
        // If this cluster is already spiderfied or a zoom animation is in progress, do nothing.
        if (group._spiderfied === this || group._inZoomAnimation) return;

        const childMarkers: L.Marker[] = this.getAllChildMarkers(null, true);
        const map = group.getMap();
        if (!map) return;
        const center = map.latLngToLayerPoint(this.getLatLng());
        let positions: L.Point[];

        // Unspiderfy any currently spiderfied cluster.
        if ((group as any)._unspiderfy) {
            (group as any)._unspiderfy();
        }
        group._spiderfied = this;
        this._spiderfied = true;

        if (group._options.spiderfyShapePositions) {
            positions = group._options.spiderfyShapePositions(childMarkers.length, center);
        } else if (childMarkers.length >= this._circleSpiralSwitchover) {
            positions = this._generatePointsSpiral(childMarkers.length, center);
        } else {
            // Adjust center for circle arrangement.
            center.y += 10;
            positions = this._generatePointsCircle(childMarkers.length, center);
        }

        // Non-animated spiderfy: reposition child markers.
        for (let i = 0; i < childMarkers.length; i++) {
            const marker = childMarkers[i];
            const newPos = map.layerPointToLatLng(positions[i]);
            // Save current position for later restoration.
            (marker as any)._preSpiderfyLatlng = marker.getLatLng();
            marker.setLatLng(newPos);
            if (marker.setZIndexOffset) marker.setZIndexOffset(1000000);
            group._featureGroup.addLayer(marker);
        }
        // Dim this cluster's icon.
        this.setOpacity(0.3);
        group.fire('spiderfied', { cluster: this, markers: childMarkers });
    },

    unspiderfy: function (this: MarkerCluster, zoomDetails?: any): void {
        const group = this._group;
        if (group._inZoomAnimation) return;
        if (this._animationUnspiderfy) {
            this._animationUnspiderfy(zoomDetails);
        } else {
            this._noanimationUnspiderfy();
        }
        group._spiderfied = undefined;
        this._spiderfied = false;
    },

    _generatePointsCircle: function (this: MarkerCluster, count: number, centerPt: L.Point): L.Point[] {
        const multiplier = this._group._options.spiderfyDistanceMultiplier || 1;
        const circumference =
            multiplier *
            this._circleFootSeparation *
            (2 + count);
        let legLength = circumference / this._2PI;
        const angleStep = this._2PI / count;
        const res: L.Point[] = [];
        legLength = Math.max(legLength, 35);
        for (let i = 0; i < count; i++) {
            const angle = this._circleStartAngle + i * angleStep;
            const pt = new L.Point(
                centerPt.x + legLength * Math.cos(angle),
                centerPt.y + legLength * Math.sin(angle)
            ).round();
            res.push(pt);
        }
        return res;
    },

    _generatePointsSpiral: function (this: MarkerCluster, count: number, centerPt: L.Point): L.Point[] {
        const multiplier = this._group._options.spiderfyDistanceMultiplier || 1;
        let legLength = multiplier * this._spiralLengthStart;
        const separation = multiplier * this._spiralFootSeparation;
        const lengthFactor = multiplier * this._spiralLengthFactor * this._2PI;
        let angle = 0;
        const res: L.Point[] = [];
        // Generate spiral positions; positions at higher indices get closer to the center.
        for (let i = count; i >= 0; i--) {
            if (i < count) {
                const pt = new L.Point(
                    centerPt.x + legLength * Math.cos(angle),
                    centerPt.y + legLength * Math.sin(angle)
                ).round();
                res[i] = pt;
            }
            angle += separation / legLength + i * 0.0005;
            legLength += lengthFactor / angle;
        }
        return res;
    },

    _noanimationUnspiderfy: function (this: MarkerCluster): void {
        const group = this._group;
        const map = group.getMap ? group.getMap() : undefined;
        if (!map) return;
        const fg = group._featureGroup;
        const childMarkers: L.Marker[] = this.getAllChildMarkers(null, true);
        group._ignoreMove = true;
        this.setOpacity(1);
        for (let i = childMarkers.length - 1; i >= 0; i--) {
            const marker = childMarkers[i];
            fg.removeLayer(marker);
            if ((marker as any)._preSpiderfyLatlng) {
                marker.setLatLng((marker as any)._preSpiderfyLatlng);
                delete (marker as any)._preSpiderfyLatlng;
            }
            if (marker.setZIndexOffset) {
                marker.setZIndexOffset(0);
            }
            if ((marker as any)._spiderLeg) {
                map.removeLayer((marker as any)._spiderLeg);
                delete (marker as any)._spiderLeg;
            }
        }
        group.fire('unspiderfied', { cluster: this, markers: childMarkers });
        group._ignoreMove = false;
        group._spiderfied = undefined;
    }
});
