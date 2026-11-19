import asyncio,time
from bleak import BleakScanner
# prints the scale's advertising data whenever it changes
async def main():
    last=None;t0=time.time()
    def cb(d,a):
        nonlocal last
        if (d.name or a.local_name or"")[:4].upper()!="MAVO":return
        m={hex(k):v.hex(" ") for k,v in a.manufacturer_data.items()}
        if m!=last:last=m;print(f"[{time.time()-t0:5.1f}s] rssi={a.rssi} {m} svc={dict((k,v.hex(' ')) for k,v in a.service_data.items())}")
    async with BleakScanner(cb):await asyncio.sleep(60)
asyncio.run(main())
