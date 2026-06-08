import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, AtSign, Camera } from 'lucide-react';
import ChromeButton from './ChromeButton';
import Avatar from './Avatar';
import ImageCropperModal from './ImageCropperModal';
import { getCroppedImg } from '../utils/image';
import imageCompression from 'browser-image-compression';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface MyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        name: string;
        username: string;
        email?: string;
        avatar?: string;
    };
    token: string;
    onUpdateProfile: (updates: any) => void;
}

const MyDetailsModal: React.FC<MyDetailsModalProps> = ({ isOpen, onClose, user, token, onUpdateProfile }) => {
    const [isCropperOpen, setIsCropperOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [cropPixels, setCropPixels] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => {
                setImageSrc(reader.result as string);
                setIsCropperOpen(true);
            });
            reader.readAsDataURL(file);
        }
    };

    const handleSaveAvatar = async () => {
        if (!imageSrc || !cropPixels) return;

        try {
            setIsUploading(true);
            const croppedImageBlob = await getCroppedImg(imageSrc, cropPixels);

            if (!croppedImageBlob) {
                console.error("Failed to crop image");
                return;
            }

            // Optimize image
            const compressedFile = await imageCompression(croppedImageBlob as File, {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 500,
                useWebWorker: true
            });

            // Upload
            const formData = new FormData();
            formData.append('file', compressedFile, 'avatar.jpg');

            const uploadResponse = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`
                }
            });

            const avatarUrl = uploadResponse.data.url;

            // Update Profile
            await axios.put(`${API_URL}/auth/profile`, { avatar_url: avatarUrl }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onUpdateProfile({ avatar: avatarUrl });
            setIsCropperOpen(false);
            setImageSrc(null);

        } catch (error) {
            console.error('Failed to update avatar:', error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-md bg-mono-bg border border-mono-glass-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-mono-glass-border">
                            <h2 className="text-lg font-semibold text-mono-text">My Details</h2>
                            <button
                                onClick={onClose}
                                className="p-2 text-mono-muted hover:text-mono-text transition-colors rounded-full hover:bg-mono-surface"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                    <Avatar src={user.avatar} name={user.name} size="xl" className="mb-4 transition-opacity group-hover:opacity-75" />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pb-4">
                                        <div className="bg-black/50 p-2 rounded-full backdrop-blur-sm">
                                            <Camera className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                                <h3 className="text-xl font-bold text-mono-text">{user.name}</h3>
                                <p className="text-mono-muted">@{user.username}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">Display Name</label>
                                    <div className="flex items-center gap-3 p-3 bg-mono-surface rounded-xl border border-mono-glass-border text-mono-text">
                                        <User className="w-5 h-5 text-mono-muted" />
                                        <span>{user.name}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">Username</label>
                                    <div className="flex items-center gap-3 p-3 bg-mono-surface rounded-xl border border-mono-glass-border text-mono-text">
                                        <AtSign className="w-5 h-5 text-mono-muted" />
                                        <span>{user.username}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-mono-muted uppercase tracking-wider">Email Address</label>
                                    <div className="flex items-center gap-3 p-3 bg-mono-surface rounded-xl border border-mono-glass-border text-mono-text">
                                        <Mail className="w-5 h-5 text-mono-muted" />
                                        <span>{user.email || 'No email provided'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-mono-surface/30 border-t border-mono-glass-border">
                            <ChromeButton onClick={onClose} className="w-full">
                                Close
                            </ChromeButton>
                        </div>
                    </motion.div>
                </div>
            )}

            <ImageCropperModal
                isOpen={isCropperOpen}
                imageSrc={imageSrc}
                onClose={() => setIsCropperOpen(false)}
                onCropComplete={setCropPixels}
                onSave={handleSaveAvatar}
                isLoading={isUploading}
            />
        </AnimatePresence>
    );
};

export default MyDetailsModal;
