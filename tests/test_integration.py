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

    def test_every_brew_gets_a_time_and_upgrades_only_to_better(self):
        mk = lambda ts, src=None, rt=None: {"ts": ts, "real_ts": rt, "ts_src": src, "yield_g": 36.0, "time_s": 20, "dose_g": None}
        stored, _ = brews.merge([], [mk("? 01:00:00")], "n", seen="2026-11-22 12:00:00")
        self.assertEqual((stored[0]["real_ts"], stored[0]["ts_src"]), ("2026-11-22 12:00:00", "seen"))
        s, _ = brews.merge(stored, [mk("? 01:00:00", "latest", "2026-11-22 10:00:00")], "n")
        self.assertEqual((s[0]["real_ts"], s[0]["ts_src"]), ("2026-11-22 10:00:00", "latest"))
        s, _ = brews.merge(s, [mk("? 01:00:00", "exact", "2026-11-22 09:55:00")], "n")
        self.assertEqual(s[0]["ts_src"], "exact")
        s, _ = brews.merge(s, [mk("? 01:00:00", "latest", "2026-11-22 08:00:00")], "n")  # worse never wins
        self.assertEqual(s[0]["real_ts"], "2026-11-22 09:55:00")

    def test_backfill_stamps_old_brews(self):
        old = [{"real_ts": "2026-11-19 10:00:00"}, {"real_ts": None, "added": "A"}, {"real_ts": None}]
        self.assertEqual(brews.backfill(old, lambda iso: "2026-11-20 08:00:00"), 2)
        self.assertEqual([(b.get("ts_src"), b["real_ts"]) for b in old], [("exact", "2026-11-19 10:00:00"), ("seen", "2026-11-20 08:00:00"), (None, None)])

    def test_import_history_goes_first_and_skips_duplicates(self):
        mk = lambda ts, y, t: {"ts": ts, "real_ts": None, "yield_g": y, "time_s": t, "dose_g": None}
        stored, _ = brews.merge([], [mk("2026-11-20 09:00:00", 40.0, 21)], "n")
        merged, added = brews.import_history(stored, [mk("2022-03-01 20:08:39", 36.0, 18), mk("2026-11-20 09:00:00", 40.0, 21)], "n")
        self.assertEqual([b["yield_g"] for b in merged], [36.0, 40.0])
        self.assertEqual(len(added), 1)
        self.assertEqual(len({b["id"] for b in merged}), 2)

    def test_public_seq_follows_list_order(self):
        mk = lambda ts, y: {"ts": ts, "real_ts": None, "yield_g": y, "time_s": 20, "dose_g": None}
        stored, _ = brews.merge([], [mk("a", 40.0)], "n")
        merged, _ = brews.import_history(stored, [mk("b", 36.0)], "n")
        out = brews.public(merged, brews.DEFAULT_SETTINGS, {})
        self.assertEqual([b["yield_g"] for b in out], [36.0, 40.0])
        self.assertEqual([b["seq"] for b in out], [0, 1])

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
