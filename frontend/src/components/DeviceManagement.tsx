/**
 * Device Management Component
 * 
 * Displays linked devices, allows adding/removing devices,
 * and manages device verification.
 */

import React, { useState, useRef } from 'react';
import { useDevices, useDeviceLinking, useKeyBackup } from '../hooks/useMultiDevice';
import { Smartphone, Link, Lock, Trash2 } from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DeviceManagementProps {
    onClose?: () => void;
}

// ============================================
// HELPERS
// ============================================

const CodeExpirationTimer: React.FC<{ expiresAt: Date }> = ({ expiresAt }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    React.useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const diff = expiresAt.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    return (
        <p className={`text-xs mt-2 font-mono ${timeLeft === 'Expired' ? 'text-red-400' : 'text-blue-400'}`}>
            Expires in: {timeLeft}
        </p>
    );
};

// ============================================
// DEVICE LIST COMPONENT
// ============================================

const DeviceList: React.FC = () => {
    const { devices, loading, error, removeDevice } = useDevices();
    const [removingId, setRemovingId] = useState<string | null>(null);

    const handleRemove = async (deviceId: string) => {
        if (!confirm('Are you sure you want to remove this device? It will need to be re-linked to use E2E encryption.')) {
            return;
        }

        setRemovingId(deviceId);
        try {
            await removeDevice(deviceId);
        } catch {
            // Error handled in hook
        } finally {
            setRemovingId(null);
        }
    };

    // Helper to safely format date
    const formatDate = (date: Date) => {
        try {
            if (!date || isNaN(date.getTime())) return 'Unknown';
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return 'Unknown';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 text-red-400 text-sm">
                Error: {error}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {devices.map(device => (
                <div
                    key={device.deviceId}
                    className={`
                        p-4 rounded-xl transition-all duration-200
                        ${device.isCurrentDevice
                            ? 'bg-blue-500/10 border border-blue-500/30'
                            : 'bg-white/5 border border-white/10 hover:border-white/20'
                        }
                    `}
                >
                    <div className="flex items-center justify-between"> {/* Changed items-start to items-center */}
                        <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                                {device.platform === 'web' && (
                                    <svg className="w-8 h-8 text-blue-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                    </svg>
                                )}
                                {device.platform === 'ios' && (
                                    <svg className="w-8 h-8 text-gray-400/80" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                                    </svg>
                                )}
                                {device.platform === 'android' && (
                                    <svg className="w-8 h-8 text-green-400/80" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M17.523 15.341c-.5 0-.915.416-.915.916s.415.916.915.916c.502 0 .916-.416.916-.916s-.414-.916-.916-.916zm-11.045 0c-.501 0-.916.416-.916.916s.415.916.916.916.915-.416.915-.916-.414-.916-.915-.916zm11.383-4.341l1.962-3.397c.11-.19.045-.433-.146-.543-.19-.11-.432-.045-.542.146l-1.986 3.438c-1.494-.696-3.168-1.082-4.949-1.082s-3.455.386-4.949 1.082l-1.986-3.438c-.11-.19-.352-.256-.542-.146-.19.11-.256.352-.146.543l1.962 3.397C3.212 12.397 1.023 15.293 1 18.75h22c-.023-3.457-2.212-6.353-5.139-7.75z" />
                                    </svg>
                                )}
                                {device.platform === 'desktop' && (
                                    <svg className="w-8 h-8 text-purple-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </div>

                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">
                                        {device.deviceName}
                                    </span>
                                    {device.isCurrentDevice && (
                                        <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-0.5 rounded border border-blue-500/20">
                                            This device
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-white/50 mt-0.5">
                                    Last seen: {formatDate(device.lastSeen)}
                                </div>
                                <div className="text-[10px] text-white/30 font-mono mt-1 w-32 truncate" title={device.identityKeyFingerprint}>
                                    <span className="opacity-50 select-none mr-1">Key:</span>
                                    {device.identityKeyFingerprint}
                                </div>
                            </div>
                        </div>

                        {!device.isCurrentDevice && (
                            <div className="flex items-center pl-4">
                                <button
                                    onClick={() => handleRemove(device.deviceId)}
                                    disabled={removingId === device.deviceId}
                                    title="Remove device"
                                    className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 border border-red-500/10"
                                >
                                    {removingId === device.deviceId ? (
                                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {devices.length === 0 && (
                <div className="text-center text-white/50 py-8">
                    No devices registered
                </div>
            )}
        </div>
    );
};

// ============================================
// DEVICE LINKING COMPONENT
// ============================================

const DeviceLinking: React.FC = () => {
    const {
        linkingCode,
        codeExpiresAt,
        generateCode,
        linkWithCode,
        pendingRequests,
        approveRequest,
        rejectRequest,
        loading,
        error,
    } = useDeviceLinking();

    const [inputCode, setInputCode] = useState('');
    const [mode, setMode] = useState<'generate' | 'enter'>('generate');

    const handleLinkWithCode = async () => {
        const success = await linkWithCode(inputCode);
        if (success) {
            setInputCode('');
            alert('Device linked successfully!');
        }
    };

    return (
        <div className="space-y-6">
            {/* Mode Selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setMode('generate')}
                    className={`
                        flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                        ${mode === 'generate'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }
                    `}
                >
                    Link from this device
                </button>
                <button
                    onClick={() => setMode('enter')}
                    className={`
                        flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                        ${mode === 'enter'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }
                    `}
                >
                    Enter code
                </button>
            </div>

            {mode === 'generate' ? (
                <div className="space-y-4">
                    {linkingCode ? (
                        <div className="text-center">
                            <p className="text-white/70 text-sm mb-2">
                                Enter this code on your new device:
                            </p>
                            <div className="text-3xl font-mono font-bold text-white tracking-wider">
                                {linkingCode}
                            </div>
                            {codeExpiresAt && (
                                <CodeExpirationTimer expiresAt={codeExpiresAt} />
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={generateCode}
                            disabled={loading}
                            className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Generating...' : 'Generate Linking Code'}
                        </button>
                    )}

                    {/* Pending Requests */}
                    {pendingRequests.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-white font-medium">Pending Requests</h4>
                            {pendingRequests.map(request => (
                                <div key={request.requestId} className="p-3 bg-white/5 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-white font-medium">
                                                {request.newDeviceName}
                                            </div>
                                            <div className="text-xs text-white/50 font-mono">
                                                {request.newDeviceFingerprint}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => approveRequest(request.requestId)}
                                                className="px-3 py-1 bg-green-500/20 text-green-300 rounded-lg text-sm hover:bg-green-500/30"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => rejectRequest(request.requestId)}
                                                className="px-3 py-1 bg-red-500/20 text-red-300 rounded-lg text-sm hover:bg-red-500/30"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-white/70 text-sm mb-2">
                            Enter linking code from your other device:
                        </label>
                        <input
                            type="text"
                            value={inputCode}
                            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                            placeholder="ABC123"
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-center text-xl font-mono tracking-widest placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                            maxLength={6}
                        />
                    </div>
                    <button
                        onClick={handleLinkWithCode}
                        disabled={loading || inputCode.length < 6}
                        className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Linking...' : 'Link Device'}
                    </button>
                </div>
            )}

            {error && (
                <div className="text-red-400 text-sm text-center">
                    {error}
                </div>
            )}
        </div>
    );
};

// ============================================
// KEY BACKUP COMPONENT
// ============================================

const KeyBackupSection: React.FC = () => {
    const { hasLocalBackup, hasCloudBackup, backup, createBackup, restoreBackup, loading, error } = useKeyBackup();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [mode, setMode] = useState<'create' | 'restore'>('create');

    // Import state
    const [importedBackup, setImportedBackup] = useState<any | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCreateBackup = async () => {
        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            alert('Password must be at least 8 characters');
            return;
        }

        try {
            await createBackup(password);
            setPassword('');
            setConfirmPassword('');
            alert('Backup created and synced to cloud successfully!');
        } catch {
            // Error handled in hook
        }
    };

    const handleDownloadBackup = () => {
        if (!backup) return;
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-key-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                // Basic validation
                if (json.encryptedIdentityKey && json.salt && json.iv) {
                    setImportedBackup(json);
                } else {
                    alert('Invalid backup file format');
                }
            } catch {
                alert('Failed to parse backup file');
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleRestoreBackup = async () => {
        // Use imported backup if available, otherwise undefined (triggers cloud fetch logic in hook)
        const targetBackup = importedBackup || undefined;

        const success = await restoreBackup(password, targetBackup);
        if (success) {
            setPassword('');
            setImportedBackup(null);
            alert('Backup restored successfully!');
        } else {
            alert('Failed to restore backup. Check your password.');
        }
    };

    return (
        <div className="space-y-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImport}
                className="hidden"
                accept=".json"
            />

            <div className="flex gap-2">
                <button
                    onClick={() => setMode('create')}
                    className={`
                        flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                        ${mode === 'create'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }
                    `}
                >
                    Create Backup
                </button>
                <button
                    onClick={() => setMode('restore')}
                    className={`
                        flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors
                        ${mode === 'restore'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-white/70 hover:bg-white/10'
                        }
                    `}
                >
                    Restore Backup
                </button>
            </div>

            {mode === 'create' ? (
                <div className="space-y-3">
                    {hasLocalBackup && (
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-300 flex justify-between items-center">
                            <span>✓ Local backup active</span>
                            <button onClick={handleDownloadBackup} className="text-xs underline hover:text-green-200">
                                Download
                            </button>
                        </div>
                    )}
                    {hasCloudBackup && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-blue-300">
                            ☁ Cloud sync active
                        </div>
                    )}

                    <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 mb-3">
                        <h4 className="text-blue-300 text-xs font-semibold uppercase tracking-wider mb-1">Why do I need this?</h4>
                        <p className="text-blue-100/80 text-xs leading-relaxed">
                            Your identity keys are now <strong>synced to the cloud (encrypted)</strong>.
                            Create a backup to enable restoration on new devices.
                        </p>
                    </div>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Backup password"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                    />

                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm password"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                    />

                    <button
                        onClick={handleCreateBackup}
                        disabled={loading || !password || !confirmPassword}
                        className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Creating & Syncing...' : 'Create Backup'}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <p className="text-white/70 text-sm">
                        Restore your E2E encryption keys from Cloud, Local backup, or File.
                    </p>

                    <div className="flex gap-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-white/70 transition-colors"
                        >
                            📂 Import from File
                        </button>
                    </div>

                    {importedBackup ? (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-300 flex justify-between items-center">
                            <div>
                                <div className="font-medium">File Loaded</div>
                                <div className="text-xs opacity-70">{importedBackup.timestamp ? new Date(importedBackup.timestamp).toLocaleString() : 'Unknown Date'}</div>
                            </div>
                            <button onClick={() => setImportedBackup(null)} className="text-xs hover:text-white">✕</button>
                        </div>
                    ) : (hasCloudBackup || hasLocalBackup) ? (
                        <div className="p-3 bg-white/5 rounded-lg space-y-2">
                            {hasCloudBackup && <div className="text-blue-300 text-sm">☁ Cloud Backup Available</div>}
                            {hasLocalBackup && <div className="text-green-300 text-sm">✓ Local Backup Available</div>}
                        </div>
                    ) : (
                        <div className="text-center text-white/50 py-4 text-xs">
                            No cloud/local backup found. Import a file?
                        </div>
                    )}

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Backup password"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-blue-500"
                    />

                    <button
                        onClick={handleRestoreBackup}
                        disabled={loading || !password}
                        className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Restoring...' : 'Restore Backup'}
                    </button>
                </div>
            )}

            {error && (
                <div className="text-red-400 text-sm text-center">
                    {error}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const DeviceManagement: React.FC<DeviceManagementProps> = ({ onClose }) => {
    const [activeTab, setActiveTab] = useState<'devices' | 'link' | 'backup'>('devices');

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a2e]/95 backdrop-blur-xl rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden border border-white/10">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <h2 className="text-xl font-semibold text-white">Device Management</h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {[
                        { id: 'devices' as const, label: 'Devices', icon: Smartphone },
                        { id: 'link' as const, label: 'Link Device', icon: Link },
                        { id: 'backup' as const, label: 'Key Backup', icon: Lock },
                    ].map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex-1 py-2 px-2 text-xs font-medium transition-colors flex flex-col items-center justify-center gap-1
                                    ${activeTab === tab.id
                                        ? 'text-blue-400 border-b-2 border-blue-400 bg-white/5'
                                        : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                    {activeTab === 'devices' && <DeviceList />}
                    {activeTab === 'link' && <DeviceLinking />}
                    {activeTab === 'backup' && <KeyBackupSection />}
                </div>
            </div>
        </div>
    );
};

export default DeviceManagement;
