"""Mavo Lumicurve: syncs the scale's brew log over Home Assistant's Bluetooth and serves the brew card."""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers.typing import ConfigType

from .const import CARD_URL, DOMAIN
from .coordinator import MavoCoordinator
from .websocket_api import async_register

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor", "button"]
type MavoConfigEntry = ConfigEntry[MavoCoordinator | None]


async def _register_resource(hass: HomeAssistant, url: str) -> bool:
    """Put the card into the dashboard resources (Settings → Dashboards → Resources) like any other custom card."""
    try:
        lovelace = hass.data.get("lovelace")
        res = lovelace.get("resources") if isinstance(lovelace, dict) else getattr(lovelace, "resources", None)
        if res is None or not hasattr(res, "async_create_item"):
            return False  # YAML mode
        if not getattr(res, "loaded", True):
            await res.async_load()
            res.loaded = True
        for item in res.async_items():
            if item["url"].split("?")[0] == CARD_URL:
                if item["url"] != url:
                    await res.async_update_item(item["id"], {"res_type": "module", "url": url})
                return True
        await res.async_create_item({"res_type": "module", "url": url})
        return True
    except Exception:  # noqa: BLE001 - never block the integration over the card
        _LOGGER.exception("Could not register the card as a dashboard resource")
        return False


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the card from the integration and load it on every dashboard (no resource to add by hand)."""
    www = Path(__file__).parent / "www" / "mavo-lumicurve-card.js"
    await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, str(www), False)])
    url = f"{CARD_URL}?v={int(www.stat().st_mtime)}"
    if not await _register_resource(hass, url):  # YAML-mode dashboards: load the card on every page instead
        frontend.add_extra_js_url(hass, url)
    async_register(hass)

    async def import_brews(call: ServiceCall) -> None:
        for e in hass.config_entries.async_entries(DOMAIN):
            if getattr(e, "runtime_data", None) is not None:
                _LOGGER.info("Imported %d brews", await e.runtime_data.async_import(call.data["brews"]))

    hass.services.async_register(DOMAIN, "import_brews", import_brews, vol.Schema({vol.Required("brews"): [dict]}))
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
