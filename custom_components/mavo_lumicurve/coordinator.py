"""Syncs the scale over Home Assistant's own Bluetooth stack (local adapter or ESPHome proxy) and keeps the brew history."""
from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime

from bleak import BleakClient
from bleak.exc import BleakError
from bleak_retry_connector import BleakClientWithServiceCache, establish_connection
from homeassistant.components import bluetooth
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from . import brews as brewlib
from . import parser
from .const import DOMAIN, EVENT_SYNCED, STORE_VERSION
from .protocol import BATTERY_CHAR, LogDownloadError, download_log

_LOGGER = logging.getLogger(__name__)


class MavoCoordinator:
    """Push-style coordinator: the scale only advertises while awake, so a sync starts when HA sees it."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass, self.entry = hass, entry
        self.address: str = entry.unique_id or entry.data["address"]
        self.store: Store = Store(hass, STORE_VERSION, f"{DOMAIN}.{entry.entry_id}")
        self.brews: list[dict] = []
        self.notes: dict[str, dict] = {}
        self.last_sync: datetime | None = None
        self.battery: int | None = None
        self.syncing = False
        self._lock = asyncio.Lock()
        self._listeners: list[CALLBACK_TYPE] = []
        self._last_attempt = float("-inf")

    @property
    def settings(self) -> dict:
        return brewlib.settings_from_options(self.entry.options)

    async def async_start(self) -> None:
        data = await self.store.async_load() or {}
        self.brews, self.notes = data.get("brews", []), data.get("notes", {})
        if data.get("last_sync"):
            self.last_sync = dt_util.parse_datetime(data["last_sync"])
        self.entry.async_on_unload(
            bluetooth.async_register_callback(
                self.hass,
                self._on_advertisement,
                bluetooth.BluetoothCallbackMatcher(address=self.address, connectable=True),
                bluetooth.BluetoothScanningMode.ACTIVE,
            )
        )

    @callback
    def async_add_listener(self, update: CALLBACK_TYPE) -> Callable[[], None]:
        self._listeners.append(update)
        return lambda: self._listeners.remove(update)

    @callback
    def _notify(self) -> None:
        for update in list(self._listeners):
            update()

    @callback
    def _on_advertisement(self, _info, _change) -> None:
        interval = self.settings["min_sync_interval_min"] * 60
        if not self.syncing and self.hass.loop.time() - self._last_attempt >= interval:
            self.entry.async_create_background_task(self.hass, self.async_sync(), f"{DOMAIN} sync")

    async def async_sync(self) -> None:
        """Connect, download the log, merge new brews. Safe to call at any time; only one sync runs."""
        if self._lock.locked():
            return
        async with self._lock:
            self.syncing, self._last_attempt = True, self.hass.loop.time()
            self._notify()
            try:
                await self._sync()
            except (LogDownloadError, BleakError, TimeoutError) as err:
                _LOGGER.warning("Sync with %s failed: %s", self.address, err)
            except Exception:  # keep the background task from dying silently
                _LOGGER.exception("Unexpected error while syncing %s", self.address)
            finally:
                self.syncing = False
                self._notify()

    async def _sync(self) -> None:
        device = bluetooth.async_ble_device_from_address(self.hass, self.address, connectable=True)
        if device is None:
            raise BleakError("scale is not in range of any Bluetooth adapter or proxy")
        client: BleakClient = await establish_connection(BleakClientWithServiceCache, device, self.entry.title, max_attempts=3)
        try:
            synced_at = dt_util.now().replace(tzinfo=None)  # the log's last line is this very connection
            try:
                self.battery = (await client.read_gatt_char(BATTERY_CHAR))[0]
            except (BleakError, IndexError):
                pass  # battery is optional
            text = await download_log(client)
        finally:
            await client.disconnect()
        parsed = await self.hass.async_add_executor_job(parser.parse, text, synced_at, self.settings)
        self.brews, added = brewlib.merge(self.brews, parsed, dt_util.utcnow().isoformat())
        brewlib.prune_curves(self.brews, self.settings)
        self.last_sync = dt_util.utcnow()
        await self._save()
        _LOGGER.info("Synced %s: %d log brews, %d new", self.address, len(parsed), len(added))
        if added:
            self.hass.bus.async_fire(EVENT_SYNCED, {"entry_id": self.entry.entry_id, "new": len(added)})

    async def _save(self) -> None:
        await self.store.async_save({"brews": self.brews, "notes": self.notes, "last_sync": self.last_sync.isoformat() if self.last_sync else None})

    async def async_set_note(self, brew_id: str, stars: int, bean: str, note: str) -> None:
        if stars or bean or note:
            self.notes[brew_id] = {"stars": stars, "bean": bean, "note": note}
        else:
            self.notes.pop(brew_id, None)
        await self._save()
        self.hass.bus.async_fire(EVENT_SYNCED, {"entry_id": self.entry.entry_id, "new": 0})

    def payload(self) -> dict:
        s = self.settings
        return {
            "brews": brewlib.public(self.brews, s, self.notes),
            "settings": s,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "battery": self.battery,
        }

    def valid_brews(self) -> list[dict]:
        s = self.settings
        return [d for d in (brewlib.derive(b, s) for b in self.brews) if d["valid"]]
