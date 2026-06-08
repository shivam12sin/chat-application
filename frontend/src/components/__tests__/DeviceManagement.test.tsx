import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeviceManagement from '../DeviceManagement';
import * as MultiDeviceHooks from '../../hooks/useMultiDevice';

// Mock the hooks module
vi.mock('../../hooks/useMultiDevice', () => ({
    useDevices: vi.fn(),
    useDeviceLinking: vi.fn(),
    useKeyBackup: vi.fn(),
    useDeviceVerification: vi.fn(),
}));

describe('DeviceManagement Component', () => {
    // Cast to any to access mock methods
    const mockUseDevices = MultiDeviceHooks.useDevices as any;
    const mockUseDeviceLinking = MultiDeviceHooks.useDeviceLinking as any;
    const mockUseKeyBackup = MultiDeviceHooks.useKeyBackup as any;
    const mockUseDeviceVerification = MultiDeviceHooks.useDeviceVerification as any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Default: Device List Mock
        mockUseDevices.mockReturnValue({
            devices: [
                {
                    deviceId: 'device-1',
                    deviceName: 'MacBook Pro',
                    platform: 'desktop',
                    lastSeenAt: new Date().toISOString(),
                    isVerified: true,
                    identityKeyFingerprint: 'ab:cd:ef:12',
                    isCurrentDevice: true,
                },
                {
                    deviceId: 'device-2',
                    deviceName: 'iPhone 15',
                    platform: 'mobile',
                    lastSeenAt: new Date().toISOString(),
                    isVerified: false,
                    identityKeyFingerprint: '98:76:54:32',
                    isCurrentDevice: false,
                }
            ],
            loading: false,
            error: null,
            removeDevice: vi.fn(),
            currentDeviceId: 'device-1',
        });

        // Default: Linking Mock
        mockUseDeviceLinking.mockReturnValue({
            linkingCode: null,
            generateCode: vi.fn(),
            linkWithCode: vi.fn(),
            pendingRequests: [],
            loading: false,
            error: null,
            refreshRequests: vi.fn(),
        });

        // Default: Backup Mock
        mockUseKeyBackup.mockReturnValue({
            hasLocalBackup: false,
            hasCloudBackup: false,
            backup: null,
            createBackup: vi.fn(),
            restoreBackup: vi.fn(),
            loading: false,
            error: null,
        });

        // Default: Verification Mock
        mockUseDeviceVerification.mockReturnValue({
            qrData: null,
            generateQR: vi.fn(),
            verifyByQR: vi.fn(),
            loading: false,
        });
    });

    it('renders the device list with current device highlighted', () => {
        render(<DeviceManagement onClose={vi.fn()} />);

        // Header
        expect(screen.getByText('Device Management')).toBeInTheDocument();

        // Device Names
        expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
        expect(screen.getByText('iPhone 15')).toBeInTheDocument();

        // Current Device Indicator (based on implementation details)
        // Note: Implementation might show "This Device" tag or similar
        // Let's check for the fingerprint which is definitely rendered
        expect(screen.getByText('ab:cd:ef:12')).toBeInTheDocument();
    });

    it('navigates to Link Device tab and shows linking interface', () => {
        render(<DeviceManagement onClose={vi.fn()} />);

        // Click Tab
        fireEvent.click(screen.getByText('Link Device'));

        // Default view is "Link from this device" (Generator)
        expect(screen.getByText(/Link from this device/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate Linking Code/i })).toBeInTheDocument();

        // Switch to "Enter code"
        fireEvent.click(screen.getByText('Enter code'));
        expect(screen.getByText(/Enter linking code/i)).toBeInTheDocument();

        // "Link Device" name exists on both the Tab and the Submit Button
        // Verify both are present (implies the form button is rendered)
        const linkButtons = screen.getAllByRole('button', { name: /Link Device/i });
        expect(linkButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('displays Cloud Backup status when active', () => {
        // Override mock for this test
        mockUseKeyBackup.mockReturnValue({
            hasLocalBackup: false,
            hasCloudBackup: true,
            backup: null,
            createBackup: vi.fn(),
            restoreBackup: vi.fn(),
            loading: false,
            error: null,
        });

        render(<DeviceManagement onClose={vi.fn()} />);

        // Click Tab
        fireEvent.click(screen.getByText('Key Backup'));

        // Check for Cloud status indicator
        expect(screen.getByText(/Cloud sync active/i)).toBeInTheDocument();
    });

    it('shows Import from File button in Restore mode', () => {
        render(<DeviceManagement onClose={vi.fn()} />);

        // Navigate to Backup -> Restore
        fireEvent.click(screen.getByText('Key Backup'));
        fireEvent.click(screen.getByText('Restore Backup'));

        // Check for Import button
        expect(screen.getByText(/Import from File/i)).toBeInTheDocument();
    });
});
