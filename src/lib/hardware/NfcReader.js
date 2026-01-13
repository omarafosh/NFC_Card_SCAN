
/**
 * Professional NFC Driver for ACR122U (WebUSB/WebHID)
 * Designed for direct browser integration.
 */
export class NfcReader {
    constructor() {
        this.device = null;
        this.type = null;
        this.onScan = null;
        this.onStatusChange = null;
        this.vendorId = 0x072f;
        this.productId = 0x2200;
        this.pollingInterval = null;
        this._isProcessing = false;
    }

    async isSupported() {
        return ('usb' in navigator) || ('hid' in navigator);
    }

    async connect() {
        console.log("NFC Reader Driver v3.2: Noise Filter Enabled");
        // Visual indicator to confirm new code is loaded
        if (typeof window !== 'undefined' && window.toast) { // specific check if toast is globally available or handled in component
            // actually toast is not here, it is in component. 
            // We can return a specific error that the component shows.
        }

        try {
            // Priority 1: WebHID (Recommended for Mac/Windows)
            if ('hid' in navigator) {
                try {
                    console.log('Requesting WebHID device...');
                    // Remove filters to allow ALL HID devices to appear (user selects manually)
                    const devices = await navigator.hid.requestDevice({ filters: [] });

                    if (devices.length > 0) {
                        this.device = devices[0];
                        this.type = 'hid';
                        await this.setupHid();
                        return true;
                    } else {
                        throw new Error("No device selected.");
                    }
                } catch (e) {
                    console.log('WebHID Error:', e);
                    // If HID fails, do NOT fallback to WebUSB automatically, to avoid the crash loop.
                    if (this.onStatusChange) this.onStatusChange('error', `HID Connection Failed: ${e.message}`);
                    return false;
                }
            }

            // WebUSB Removed completely to prevent Protected Interface error
            if (!('hid' in navigator)) {
                if (this.onStatusChange) this.onStatusChange('error', 'WebHID API not supported in this browser.');
            }

            return false;
        } catch (error) {
            console.error('NFC Connection failed:', error);
            if (this.onStatusChange) this.onStatusChange('error', error.message);
            return false;
        }
    }

    async setupHid() {
        await this.device.open();
        this.device.oninputreport = (e) => this.handleInputReport(e);
        if (this.onStatusChange) this.onStatusChange('connected', `HID: ${this.device.productName}`);
        this.startPolling();
    }

    handleInputReport(event) {
        const { data } = event;
        const hex = Array.from(new Uint8Array(data.buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();

        // Filter noise: UIDs are typically 8-20 chars (4-10 bytes). 
        // The garbage string causing "Card not registered" was very long (~XXX chars).
        // We strictly filter for standard UID lengths (Mifare Classic is 8 chars, Ultralight/NTAG is 14 chars).
        // We allow 4 bytes (8 chars) to 10 bytes (20 chars)
        if (hex.length >= 8 && hex.length <= 20) {
            if (this.onScan) this.onScan(hex);
        } else {
            // console.log('Ignored HID Noise:', hex); // Commented out to reduce console noise
        }
    }

    async setupUsb() {
        await this.device.open();
        await this.device.selectConfiguration(1);
        await this.device.claimInterface(0);

        // Command to enable Automatic PICC Polling (Standard for ACR122U)
        // This is a professional touch to ensure the reader is "awake"
        const enableAutoPoll = new Uint8Array([0x6b, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x51, 0x7f, 0x00]);
        try { await this.device.transferOut(2, enableAutoPoll); } catch (e) { }

        if (this.onStatusChange) this.onStatusChange('connected', `USB: ${this.device.productName}`);
        this.startPolling();
    }

    startPolling() {
        // APDU: FF CA 00 00 00 (Get UID)
        const getUidCmd = new Uint8Array([0xff, 0xca, 0x00, 0x00, 0x00]); // Standard APDU for HID wrap
        let lastUid = null;

        this.pollingInterval = setInterval(async () => {
            if (!this.device || this._isProcessing) return;
            this._isProcessing = true;

            try {
                if (this.type === 'hid') {
                    // HID Polling
                    try {
                        // Some readers need Report ID 0, others need a specific one. 0 is common default.
                        await this.device.sendReport(0, getUidCmd);
                    } catch (e) {
                        // console.log("HID Poll Error:", e); // Silent fail is common for some endpoints
                    }
                } else {
                    // WebUSB Polling (Wrapped APDU for USB Mode)
                    const usbCmd = new Uint8Array([0x6f, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xca, 0x00, 0x00, 0x00]);
                    await this.device.transferOut(2, usbCmd);
                    const res = await this.device.transferIn(1, 64);

                    if (res.data.byteLength > 10) {
                        const data = new Uint8Array(res.data.buffer);
                        // Extract UID from wrapper response (ACR122U USB wrapper)
                        const uid = Array.from(data.slice(10, data.length - 2))
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join('')
                            .toUpperCase();

                        this.handleUid(uid, lastUid, (newUid) => lastUid = newUid);
                    }
                }
            } catch (e) {
                // Ignore transient polling errors
            } finally {
                this._isProcessing = false;
            }
        }, 300); // Poll faster (300ms)
    }

    handleUid(uid, lastUid, updateLastUid) {
        // Helper to validate and debounce UID
        if (uid && uid.length >= 8 && uid !== '9000') {
            if (uid !== lastUid) {
                updateLastUid(uid);
                if (this.onScan) this.onScan(uid);
                setTimeout(() => { if (lastUid === uid) updateLastUid(null); }, 3000);
            }
        }
    }

    async disconnect() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        if (this.device) {
            try { await this.device.close(); } catch (e) { }
            this.device = null;
            if (this.onStatusChange) this.onStatusChange('disconnected');
        }
    }
}
