package dev.signage.tv

/**
 * Pairing codes must match the DB check `^[0-9]{6}$` (see `devices_pairing_code_format` migration).
 * Codes are generated server-side by `register_or_restore_device`; this formatter is kept for the
 * shared six-digit contract and its tests.
 */
internal fun formatPairingCodeFromBucket(bucket: Int): String {
    require(bucket in 0 until 1_000_000) { "bucket must be in [0, 999999]" }
    return bucket.toString().padStart(6, '0')
}
