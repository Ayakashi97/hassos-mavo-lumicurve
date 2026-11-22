"""Sensors: last brew, battery, brew count, last sync."""
from __future__ import annotations

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import PERCENTAGE, UnitOfMass, UnitOfTime
from homeassistant.helpers.entity import EntityCategory

from .entity import MavoEntity

# key, unit, device class, field of the newest valid brew
BREW = (
    ("last_yield", UnitOfMass.GRAMS, SensorDeviceClass.WEIGHT, "yield_g"),
    ("last_time", UnitOfTime.SECONDS, SensorDeviceClass.DURATION, "time_s"),
    ("last_flow", "g/s", None, "flow_gs"),
    ("last_ratio", None, None, "ratio"),
)


async def async_setup_entry(hass, entry, async_add_entities) -> None:
    c = entry.runtime_data
    async_add_entities([*(BrewSensor(c, *b) for b in BREW), CountSensor(c), BatterySensor(c), SyncSensor(c)])


class BrewSensor(MavoEntity, SensorEntity):
    def __init__(self, c, key, unit, dclass, field) -> None:
        super().__init__(c, key)
        self._field, self._attr_native_unit_of_measurement, self._attr_device_class = field, unit, dclass
        self._attr_state_class = SensorStateClass.MEASUREMENT  # Home Assistant then keeps hourly long-term statistics of it

    @property
    def native_value(self):
        v = self.coordinator.valid_brews()
        return v[-1][self._field] if v else None

    @property
    def extra_state_attributes(self):
        v = self.coordinator.valid_brews()
        return {"mode": v[-1]["mode"], "brewed": v[-1].get("real_ts") or v[-1]["ts"], "brewed_src": v[-1].get("ts_src"), "dose_g": v[-1].get("dose_g")} if v else {}


class CountSensor(MavoEntity, SensorEntity):
    _attr_state_class = SensorStateClass.TOTAL_INCREASING
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, c) -> None:
        super().__init__(c, "brew_count")

    @property
    def native_value(self):
        return len(self.coordinator.valid_brews())


class BatterySensor(MavoEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.BATTERY
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, c) -> None:
        super().__init__(c, "battery")

    @property
    def native_value(self):
        return self.coordinator.battery


class SyncSensor(MavoEntity, SensorEntity):
    _attr_device_class = SensorDeviceClass.TIMESTAMP
    _attr_entity_category = EntityCategory.DIAGNOSTIC

    def __init__(self, c) -> None:
        super().__init__(c, "last_sync")

    @property
    def native_value(self):
        return self.coordinator.last_sync
