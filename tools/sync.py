"""Dev tool: pull the log from the scale over THIS computer's Bluetooth and save it to data/ (the HA integration does the same over HA's adapter)."""
import asyncio, json, os, time
from bleak import BleakClient, BleakScanner
from parse import load

protocol = load("protocol")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
OUT = os.path.join(ROOT, "data", "scale_log_%s.txt" % time.strftime("%Y%m%d_%H%M%S"))
try: SAVED = json.load(open(os.path.join(ROOT, "data", "lumicurve.json")))  # written by discover.py
except OSError: SAVED = None


async def main():
    print("scanning for the scale (wake it now) ...")
    if SAVED: d = await BleakScanner.find_device_by_address(SAVED["address"], timeout=40)
    else: d = await BleakScanner.find_device_by_filter(lambda d, a: (d.name or a.local_name or "").upper().startswith("MAVO") or protocol.SERVICE_UUID in a.service_uuids, timeout=40)
    if not d: return print("scale not found")
    async with BleakClient(d, timeout=30) as c:
        text = await protocol.download_log(c, on_progress=lambda n, t: print("\r%d / %d bytes" % (n, t), end="", flush=True))
    open(OUT, "w").write(text)
    print("\nsaved:", OUT)

asyncio.run(main())
