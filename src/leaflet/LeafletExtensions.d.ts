import 'leaflet';

declare module 'leaflet' {
    interface Marker {
        __parent?: any;
    }
    interface MarkerCluster {
        __parent?: any;
    }
}
