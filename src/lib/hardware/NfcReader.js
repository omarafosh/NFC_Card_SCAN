
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
        try {
            // Priority 1: WebHID (Recommended for Mac/Windows)
            if ('hid' in navigator) {
                try {
                    console.log('Requesting WebHID device...');
                    const devices = await navigator.hid.requestDevice({
                        filters: [{ vendorId: this.vendorId, productId: this.productId }]
                    });

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

            // WebUSB Temporarily Disabled to force HID debugging
            /*
            if ('usb' in navigator) {
                try {
                    const device = await navigator.usb.requestDevice({
                        filters: [{ vendorId: this.vendorId, productId: this.productId }]
                    });
                    if (device) {
                        this.device = device;
                        this.type = 'usb';
                        await this.setupUsb();
                        return true;
                    }
                } catch (e) {
                    console.log('WebUSB failed (likely protected interface):', e.message);
                    if (this.onStatusChange && e.message.includes('polic')) {
                        this.onStatusChange('error', 'Browser Blocked USB mode. Please try using Chrome/Edge on Windows or use HID mode.');
                        return false;
                    }
                }
            }
            */

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
        const getUidCmd = new Uint8Array([0x6f, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xca, 0x00, 0x00, 0x00]);
        let lastUid = null;
        let sameCount = 0;

        this.pollingInterval = setInterval(async () => {
            if (!this.device || this._isProcessing) return;
            this._isProcessing = true;

            try {
                await this.device.transferOut(2, getUidCmd);
                const res = await this.device.transferIn(1, 64);

                if (res.data.byteLength > 10) {
                    const data = new Uint8Array(res.data.buffer);
                    const uid = Array.from(data.slice(10, data.length - 2))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('')
                        .toUpperCase();

                    if (uid && uid.length >= 8 && uid !== '9000') {
                        // Prevent duplicate rapid scans
                        if (uid !== lastUid) {
                            lastUid = uid;
                            if (this.onScan) this.onScan(uid);
                            // Debounce for 3 seconds
                            setTimeout(() => { if (lastUid === uid) lastUid = null; }, 3000);
                        }
                    } else {
                        lastUid = null; // Card removed
                    }
                }
            } catch (e) {
                lastUid = null;
            } finally {
                this._isProcessing = false;
            }
        }, 500);
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
