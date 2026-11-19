"""Config flow: Bluetooth discovery, manual pick, and an options form for all settings."""
from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.components.bluetooth import BluetoothServiceInfoBleak, async_discovered_service_info
from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers.selector import NumberSelector, NumberSelectorConfig, SelectSelector, SelectSelectorConfig

from . import brews as brewlib
from .const import DOMAIN
from .protocol import SERVICE_UUID


def _is_scale(info: BluetoothServiceInfoBleak) -> bool:
    return (info.name or "").upper().startswith("MAVO") or SERVICE_UUID in info.service_uuids


class MavoConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._info: BluetoothServiceInfoBleak | None = None

    async def async_step_bluetooth(self, discovery_info: BluetoothServiceInfoBleak) -> ConfigFlowResult:
        await self.async_set_unique_id(discovery_info.address)
        self._abort_if_unique_id_configured()
        self._info = discovery_info
        self.context["title_placeholders"] = {"name": discovery_info.name}
        return await self.async_step_confirm()

    async def async_step_confirm(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        assert self._info
        if user_input is not None:
            return self.async_create_entry(title=self._info.name or "Mavo Lumicurve", data={"address": self._info.address})
        self._set_confirm_only()
        return self.async_show_form(step_id="confirm", description_placeholders={"name": self._info.name})

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        current = self._async_current_ids()
        found = {i.address: i for i in async_discovered_service_info(self.hass, False) if i.address not in current and _is_scale(i)}
        if user_input is not None:
            self._info = found[user_input["address"]]
            await self.async_set_unique_id(self._info.address)
            return await self.async_step_confirm()
        if not found:
            return self.async_abort(reason="no_devices_found")
        return self.async_show_form(step_id="user", data_schema=vol.Schema({vol.Required("address"): vol.In({a: f"{i.name} ({a})" for a, i in found.items()})}))

    @staticmethod
    @callback
    def async_get_options_flow(config_entry) -> OptionsFlow:
        return MavoOptionsFlow()


def _num(lo: float, hi: float, step: float = 1, unit: str | None = None) -> NumberSelector:
    return NumberSelector(NumberSelectorConfig(min=lo, max=hi, step=step, unit_of_measurement=unit, mode="box"))


class MavoOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(data={k: v for k, v in user_input.items() if v not in (None, "")})
        cur = brewlib.options_from_settings(brewlib.settings_from_options(self.config_entry.options))
        schema: dict = {
            vol.Required("pourover_min_s", default=cur["pourover_min_s"]): _num(30, 600, 1, "s"),
            vol.Required("min_time_s", default=cur["min_time_s"]): _num(1, 60, 1, "s"),
            vol.Required("min_yield_g", default=cur["min_yield_g"]): _num(1, 100, 1, "g"),
            vol.Required("dose_min_g", default=cur["dose_min_g"]): _num(1, 50, 0.5, "g"),
            vol.Required("dose_max_g", default=cur["dose_max_g"]): _num(1, 50, 0.5, "g"),
            vol.Required("flow_value", default=cur["flow_value"]): SelectSelector(SelectSelectorConfig(options=["auto", "avg", "peak"], translation_key="flow_value")),
            vol.Required("min_sync_interval_min", default=cur["min_sync_interval_min"]): _num(1, 1440, 1, "min"),
            vol.Required("keep_curves", default=cur["keep_curves"]): _num(0, 2000, 10),
        }
        for mode in brewlib.MODES:
            for m in brewlib.METRICS:
                for end in ("min", "max"):
                    key = f"{mode}_{m}_{end}"
                    kw = {"description": {"suggested_value": cur.get(key)}}
                    schema[vol.Optional(key, **kw)] = _num(0, 1000, 0.1)
        return self.async_show_form(step_id="init", data_schema=vol.Schema(schema))
