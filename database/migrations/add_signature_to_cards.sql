-- Add signature column to cards table for security verification
ALTER TABLE cards ADD COLUMN IF NOT EXISTS signature VARCHAR(64);
ALTER TABLE cards ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS enrolled_by UUID;

-- Add index for signature lookups
CREATE INDEX IF NOT EXISTS idx_cards_signature ON cards(signature);

COMMENT ON COLUMN cards.signature IS 'HMAC signature written to the physical card for verification';
