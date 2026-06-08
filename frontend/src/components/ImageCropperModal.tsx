import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import ChromeButton from './ChromeButton';
import { cn } from '../utils/theme';

interface ImageCropperModalProps {
    isOpen: boolean;
    imageSrc: string | null;
    onClose: () => void;
    onCropComplete: (croppedAreaPixels: any) => void;
    onSave: () => void;
    isLoading?: boolean;
}

const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
    isOpen,
    imageSrc,
    onClose,
    onCropComplete,
    onSave,
    isLoading
}) => {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onZoomChange = (zoom: number) => {
        setZoom(zoom);
    };

    return (
        <AnimatePresence>
            {isOpen && imageSrc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                            "relative w-full max-w-lg bg-mono-bg border border-mono-glass-border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[500px]"
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-mono-glass-border">
                            <h3 className="text-lg font-medium text-mono-text">Adjust Profile Picture</h3>
                            <button onClick={onClose} className="text-mono-muted hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Cropper Area */}
                        <div className="relative flex-1 bg-black">
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={onCropChange}
                                onCropComplete={(_, croppedAreaPixels) => onCropComplete(croppedAreaPixels)}
                                onZoomChange={onZoomChange}
                                showGrid={false}
                                cropShape="round" // Round for profile picture
                            />
                        </div>

                        {/* Controls */}
                        <div className="p-4 border-t border-mono-glass-border space-y-4 bg-mono-surface">
                            <div className="flex items-center gap-4">
                                <span className="text-xs text-mono-muted">Zoom</span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    aria-labelledby="Zoom"
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1 h-1 bg-mono-glass-border rounded-lg appearance-none cursor-pointer accent-blue-500"
                                />
                            </div>

                            <div className="flex justify-end gap-3">
                                <ChromeButton
                                    onClick={onClose}
                                    className="bg-mono-glass-border/30 hover:bg-mono-glass-border/50 text-mono-text"
                                >
                                    Cancel
                                </ChromeButton>
                                <ChromeButton
                                    onClick={onSave}
                                    disabled={isLoading}
                                    className="bg-blue-600 hover:bg-blue-500 text-white min-w-[100px]"
                                >
                                    {isLoading ? 'Saving...' : 'Save'}
                                </ChromeButton>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ImageCropperModal;
