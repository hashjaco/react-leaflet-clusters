import React from 'react';
import {MapContainer as LeafletMap, TileLayer} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const MapContainer: React.FC = () => {
    return (
        <LeafletMap center={[51.505, -0.09]} zoom={13} style={{height: '100vh', width: '100vw'}}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
        </LeafletMap>
    );
};

export default MapContainer;
