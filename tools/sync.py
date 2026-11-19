import asyncio,json,struct,time,os
from bleak import BleakScanner,BleakClient
F2="0000fff2-0000-1000-8000-00805f9b34fb"
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),"..")
os.makedirs(os.path.join(ROOT,"data"),exist_ok=True)
OUT=os.path.join(ROOT,"data","scale_log_%s.txt"%time.strftime("%Y%m%d_%H%M%S"))
try:SAVED=json.load(open(os.path.join(ROOT,"data","lumicurve.json")))  # written by discover.py
except OSError:SAVED=None
ann=[None];done=asyncio.Event();last=[time.time()];n=[0]
f=open(OUT,"wb")  # chunks are written as they arrive, so a crash keeps what was received
def on(_,d):
    d=bytes(d);last[0]=time.time()
    if d[:3]==b"\x01\x09\x01":ann[0]=d[3:11];return
    if len(d)<=4 and d[0]==1 and d[2]==3:done.set();return
    f.write(d[2:]);f.flush();n[0]+=len(d)-2
async def main():
    print("scanning for the scale (wake it now) ...")
    if SAVED:d=await BleakScanner.find_device_by_address(SAVED["address"],timeout=40)
    else:d=await BleakScanner.find_device_by_filter(lambda d,a:(d.name or a.local_name or"").upper().startswith("MAVO") or any(u.startswith("0000fff0") for u in a.service_uuids),timeout=40)
    if not d:return print("scale not found")
    async with BleakClient(d,timeout=30) as c:
        await c.start_notify(F2,on)
        await c.write_gatt_char(F2,bytes.fromhex("010101"))
        for _ in range(100):
            await asyncio.sleep(.1)
            if ann[0]:break
        if not ann[0]:return print("no length announce (empty log?)")
        total=struct.unpack("<I",ann[0][:4])[0];print("log size",total,"bytes -> receiving ...")
        await c.write_gatt_char(F2,bytes.fromhex("010902")+ann[0])
        last[0]=time.time()
        while not done.is_set() and time.time()-last[0]<20:
            await asyncio.sleep(1);print("\r%d / %d bytes"%(n[0],total),end="",flush=True)
    print("\nreceived",n[0],"bytes (expected %d)"%total)
try:asyncio.run(main())
finally:f.close();print("saved:",OUT)
