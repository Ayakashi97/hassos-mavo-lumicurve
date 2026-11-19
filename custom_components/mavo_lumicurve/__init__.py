"""Mavo Lumicurve: syncs the scale's brew log over Home Assistant's Bluetooth and serves the brew card."""
from __future__ import annotations

from pathlib import Path

from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType

from .const import CARD_URL, DOMAIN
from .coordinator import MavoCoordinator
from .websocket_api import async_register

PLATFORMS = ["sensor", "button"]
type MavoConfigEntry = ConfigEntry[MavoCoordinator | None]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the card from the integration and load it on every dashboard (no resource to add by hand)."""
    www = Path(__file__).parent / "www" / "mavo-lumicurve-card.js"
    await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, str(www), False)])
    frontend.add_extra_js_url(hass, f"{CARD_URL}?v={int(www.stat().st_mtime)}")
    async_register(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: MavoConfigEntry) -> bool:
    if not entry.data.get("address"):  # placeholder entry: only serves the card (example data) until a scale is added
        entry.runtime_data = None
        return True
    for other in hass.config_entries.async_entries(DOMAIN):  # a real scale replaces the placeholder
        if not other.data.get("address"):
            hass.async_create_task(hass.config_entries.async_remove(other.entry_id))
    entry.runtime_data = coordinator = MavoCoordinator(hass, entry)
    await coordinator.async_start()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(lambda h, e: h.config_entries.async_schedule_reload(e.entry_id)))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: MavoConfigEntry) -> bool:
    if entry.runtime_data is None:
        return True
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
