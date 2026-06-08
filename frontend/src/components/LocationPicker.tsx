import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ChromeButton from './ChromeButton';

// Fix Leaflet icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerProps {
    onLocationSelect: (location: { lat: number; lng: number; address?: string }) => void;
    onCancel: () => void;
}

const LocationPicker: React.FC<LocationPickerProps> = ({ onLocationSelect, onCancel }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [, setMap] = useState<L.Map | null>(null);
    const [marker, setMarker] = useState<L.Marker | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!mapRef.current) return;

        // Initialize map
        const mapInstance = L.map(mapRef.current).setView([51.505, -0.09], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);

        // Get user location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                mapInstance.setView([latitude, longitude], 15);

                const newMarker = L.marker([latitude, longitude]).addTo(mapInstance);
                setMarker(newMarker);
                setSelectedLocation({ lat: latitude, lng: longitude });
                setIsLoading(false);
            },
            (error) => {
                console.error('Error getting location', error);
                setIsLoading(false);
            }
        );

        // Map click handler
        mapInstance.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;

            if (marker) {
                marker.setLatLng([lat, lng]);
            } else {
                const newMarker = L.marker([lat, lng]).addTo(mapInstance);
                setMarker(newMarker);
            }

            setSelectedLocation({ lat, lng });
        });

        setMap(mapInstance);

        return () => {
            mapInstance.remove();
        };
    }, []);

    const handleConfirm = () => {
        if (selectedLocation) {
            onLocationSelect(selectedLocation);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-mono-surface w-full max-w-2xl rounded-glass border border-mono-glass-border shadow-2xl flex flex-col overflow-hidden animate-fade-up">
                <div className="p-4 border-b border-mono-glass-border flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-mono-text">Share Location</h3>
                    <ChromeButton onClick={onCancel} variant="circle" className="text-mono-muted hover:text-mono-text min-h-[36px] min-w-[36px]">✕</ChromeButton>
                </div>

                <div className="relative h-96 w-full bg-mono-surface-2">
                    <div ref={mapRef} className="h-full w-full z-0" />
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-mono-surface/50 z-10">
                            <div className="w-8 h-8 border-4 border-mono-glass-highlight border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-mono-glass-border flex justify-end gap-3">
                    <ChromeButton
                        onClick={onCancel}
                        className="px-4 py-2 text-sm"
                    >
                        Cancel
                    </ChromeButton>
                    <ChromeButton
                        onClick={handleConfirm}
                        disabled={!selectedLocation}
                        className="px-4 py-2 text-sm font-medium"
                    >
                        Share Selected Location
                    </ChromeButton>
                </div>
            </div>
        </div>
    );
};

export default LocationPicker;
