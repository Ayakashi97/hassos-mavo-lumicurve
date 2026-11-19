import asyncio
from bleak import BleakScanner
async def main():
    seen={}
    def cb(d,a):seen[d.address]=(a.rssi,d.name or a.local_name,list(a.service_uuids),{hex(k):v.hex(" ") for k,v in a.manufacturer_data.items()})
    async with BleakScanner(cb):await asyncio.sleep(15)
    for k,v in sorted(seen.items(),key=lambda x:-x[1][0]):print(v[0],k,v[1],v[2],v[3])
    print(len(seen),"devices")
asyncio.run(main())
