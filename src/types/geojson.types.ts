export interface GeoJSONFeature {
    type: "Feature";
    properties: Record<string, any>;
    geometry: {
        type: "Point";
        coordinates: [number, number];
    };
}

export interface GeoJSONCollection {
    type: "FeatureCollection";
    features: GeoJSONFeature[];
}
