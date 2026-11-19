"""Websocket commands the card uses to read the brews and save ratings."""
from __future__ import annotations

import voluptuous as vol
from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN


def _coordinator(hass: HomeAssistant, entry_id: str | None):
    entries = [e for e in hass.config_entries.async_entries(DOMAIN) if getattr(e, "runtime_data", None) and (not entry_id or e.entry_id == entry_id)]
    return entries[0].runtime_data if entries else None


@callback
def async_register(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_brews)
    websocket_api.async_register_command(hass, ws_note)


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/brews", vol.Optional("entry_id"): str})
@callback
def ws_brews(hass: HomeAssistant, connection, msg) -> None:
    c = _coordinator(hass, msg.get("entry_id"))
    if c is None:
        connection.send_error(msg["id"], "not_found", "Mavo Lumicurve is not set up")
    else:
        connection.send_result(msg["id"], c.payload())


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/note",
        vol.Optional("entry_id"): str,
        vol.Required("id"): str,
        vol.Optional("stars", default=0): vol.All(int, vol.Range(min=0, max=5)),
        vol.Optional("bean", default=""): vol.All(str, vol.Length(max=100)),
        vol.Optional("note", default=""): vol.All(str, vol.Length(max=500)),
    }
)
@websocket_api.async_response
async def ws_note(hass: HomeAssistant, connection, msg) -> None:
    c = _coordinator(hass, msg.get("entry_id"))
    if c is None:
        connection.send_error(msg["id"], "not_found", "Mavo Lumicurve is not set up")
        return
    await c.async_set_note(msg["id"], msg["stars"], msg["bean"], msg["note"])
    connection.send_result(msg["id"])
