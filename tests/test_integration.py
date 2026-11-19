import asyncio, os, struct, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from parse import load, parse

brews, protocol = load("brews"), load("protocol")
HERE = os.path.dirname(__file__)
LOG = open(os.path.join(HERE, "fixture.txt")).read()


class FakeScale:
    """Replays a log the way the scale sends it: announce, then 2-byte sequence + up to 18 ASCII bytes, then the end marker."""
    def __init__(self, text, truncate=0):
        self.data, self.cut, self.cb = text.encode(), truncate, None

    async def start_notify(self, _c, cb): self.cb = cb
    async def stop_notify(self, _c): self.cb = None

    async def write_gatt_char(self, _c, d):
        if d == protocol.REQUEST:
            self.cb(None, b"\x01\x09\x01" + struct.pack("<I", len(self.data)) + b"\xaa\xbb\xcc\xdd")
        elif d.startswith(protocol.ACK):
            body = self.data[: len(self.data) - self.cut]
            for i in range(0, len(body), 18):
                self.cb(None, struct.pack(">H", i // 18) + body[i:i + 18])
            if not self.cut:
                self.cb(None, b"\x01\x02\x03")


class T(unittest.TestCase):
    def test_download_roundtrip(self):
        self.assertEqual(asyncio.run(protocol.download_log(FakeScale(LOG))), LOG)

    def test_download_incomplete(self):
        with self.assertRaises(protocol.LogDownloadError):
            asyncio.run(protocol.download_log(FakeScale(LOG, truncate=40), idle_timeout=1.5))

    def test_merge_is_idempotent_and_freezes_real_ts(self):
        from datetime import datetime
        p1 = parse(LOG, datetime(2026, 11, 19, 8, 0, 0))
        stored, added = brews.merge([], p1, "now")
        self.assertEqual(len(added), len(p1))
        again, added = brews.merge(stored, parse(LOG, datetime(2026, 11, 19, 9, 0, 0)), "later")
        self.assertEqual((len(again), added), (len(stored), []))
        self.assertEqual([b["real_ts"] for b in again], [b["real_ts"] for b in stored])  # first sync wins

    def test_derive_and_settings_roundtrip(self):
        s = brews.settings_from_options({"pourover_min_s": 60, "espresso_time_min": 22, "espresso_time_max": 30})
        self.assertEqual(s["targets"]["espresso"]["time"], [22, 30])
        d = brews.derive({"time_s": 70, "yield_g": 200.0, "dose_g": 12.0}, s)
        self.assertEqual((d["mode"], d["valid"], d["ratio"]), ("pourover", True, 16.67))
        self.assertEqual(brews.settings_from_options(brews.options_from_settings(s)), s)

    def test_parity_with_real_log(self):  # only when the developer has synced logs in data/
        import glob
        files = sorted(glob.glob(os.path.join(HERE, "..", "data", "scale_log_*.txt")))
        if not files:
            self.skipTest("no data/ logs")
        text = open(files[-1], errors="replace").read()
        s = brews.DEFAULT_SETTINGS
        valid = [b for b in parse(text) if brews.derive(b, s)["valid"]]
        self.assertGreater(len(valid), 0)


if __name__ == "__main__":
    unittest.main()
