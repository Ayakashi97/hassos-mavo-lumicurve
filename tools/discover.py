"""Find Lefu/Mavo Lumicurve scales nearby and remember the one you pick.

usage: python3 discover.py            list candidates, save the only/selected one to data/lumicurve.json
       python3 discover.py --all      list every BLE device (to find a differently named scale)
Wake the scale first (tap it). Nothing is written to the scale."""
import asyncio, json, os, sys
from bleak import BleakScanner

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CFG = os.path.join(ROOT, "data", "lumicurve.json")
SVC = "0000fff0"  # shared with other cheap modules, so a name match is the main signal


def is_scale(d, a):
    n = (d.name or a.local_name or "").upper()
    return n.startswith(("MAVO", "LUMICURVE", "LEFU")) or any(u.startswith(SVC) for u in a.service_uuids)


async def main():
    show_all = "--all" in sys.argv
    seen = {}
    def cb(d, a):
        if show_all or is_scale(d, a):
            seen[d.address] = (a.rssi, d.name or a.local_name or "?")
    async with BleakScanner(cb):
        await asyncio.sleep(12)
    found = sorted(seen.items(), key=lambda x: -x[1][0])
    for i, (addr, (rssi, name)) in enumerate(found):
        print(f"[{i}] {name:20} {rssi:4} dBm  {addr}")
    if show_all or not found:
        return print("nothing saved" if not found else "")
    pick = 0 if len(found) == 1 else int(input("which one? ") or 0)
    addr, (_, name) = found[pick]
    os.makedirs(os.path.dirname(CFG), exist_ok=True)
    json.dump({"address": addr, "name": name}, open(CFG, "w"), indent=1)
    print("saved", CFG)

asyncio.run(main())
