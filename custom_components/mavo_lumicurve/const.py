"""Constants."""
DOMAIN = "mavo_lumicurve"
STORE_VERSION = 1
EVENT_SYNCED = f"{DOMAIN}_synced"  # fired on the HA bus after every sync that found new brews (card refreshes on it)
CARD_URL = f"/{DOMAIN}/mavo-lumicurve-card.js"
RAW_KEEP_CHARS = 2_000_000  # raw logs kept in .storage/<domain>.<entry>.raw (newest first to survive)
