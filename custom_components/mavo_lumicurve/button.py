"""Button to sync right now (wake the scale first, it only advertises while awake)."""
from __future__ import annotations

from homeassistant.components.button import ButtonEntity

from .entity import MavoEntity


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    async_add_entities([SyncButton(entry.runtime_data)])


class SyncButton(MavoEntity, ButtonEntity):
    def __init__(self, c) -> None:
        super().__init__(c, "sync")

    async def async_press(self) -> None:
        await self.coordinator.async_sync()
