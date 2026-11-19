"""Download the brew log from the scale over BLE. Pure asyncio, works with any client that has bleak's start_notify/write_gatt_char/stop_notify.

Protocol (Lefu "Torre" log sync, as seen on the CK850 and in Beanconqueror#1198), all on characteristic fff2:
  write 01 01 01                      request the log
  notify 01 09 01 + 8 bytes           the scale announces the size (first 4 bytes, little endian) and echoes a token
  write 01 09 02 + the 8 bytes        acknowledge
  notify 2-byte sequence + ASCII      the log text, in order
  notify 01 xx 03                     end marker
"""
from __future__ import annotations

import asyncio
import contextlib
import struct
from collections.abc import Callable

SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb"
LOG_CHAR = "0000fff2-0000-1000-8000-00805f9b34fb"
BATTERY_CHAR = "00002a19-0000-1000-8000-00805f9b34fb"
REQUEST = bytes.fromhex("010101")
ACK = bytes.fromhex("010902")


class LogDownloadError(Exception):
    """The scale did not deliver a complete log."""


async def download_log(
    client,
    *,
    announce_timeout: float = 10.0,
    idle_timeout: float = 20.0,
    total_timeout: float = 300.0,
    on_progress: Callable[[int, int], None] | None = None,
) -> str:
    """Request, receive and return the whole log as text. Raises LogDownloadError when it is incomplete."""
    loop = asyncio.get_running_loop()
    buf = bytearray()
    state = {"token": None, "total": 0, "last": loop.time()}
    announced, done = asyncio.Event(), asyncio.Event()

    def on_data(_sender, data) -> None:
        d = bytes(data)
        state["last"] = loop.time()
        if state["token"] is None:
            if d[:3] == b"\x01\x09\x01" and len(d) >= 11:  # data chunks start with 00 xx, so this cannot be data
                state["token"], state["total"] = d[3:11], struct.unpack("<I", d[3:7])[0]
                announced.set()
            return  # ignore anything before the announcement
        if len(d) <= 4 and d[:1] == b"\x01" and d[2:3] == b"\x03":
            done.set()
            return
        buf.extend(d[2:])
        if on_progress:
            on_progress(len(buf), state["total"])
        if state["total"] and len(buf) >= state["total"]:
            done.set()

    await client.start_notify(LOG_CHAR, on_data)
    try:
        await client.write_gatt_char(LOG_CHAR, REQUEST)
        try:
            await asyncio.wait_for(announced.wait(), announce_timeout)
        except asyncio.TimeoutError as err:
            raise LogDownloadError("the scale did not announce a log (empty log or not ready)") from err
        await client.write_gatt_char(LOG_CHAR, ACK + state["token"])
        start = loop.time()
        while not done.is_set():
            if loop.time() - state["last"] > idle_timeout:
                raise LogDownloadError(f"log stalled at {len(buf)} of {state['total']} bytes")
            if loop.time() - start > total_timeout:
                raise LogDownloadError("log download took too long")
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(done.wait(), 1.0)
        if len(buf) < state["total"]:
            raise LogDownloadError(f"log incomplete: {len(buf)} of {state['total']} bytes")
        return buf.decode("ascii", "replace")
    finally:
        with contextlib.suppress(Exception):
            await client.stop_notify(LOG_CHAR)
