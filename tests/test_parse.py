import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
from parse import parse, load

class T(unittest.TestCase):
    def test_real_espresso(self):  # excerpt of a real scale log: one 34.0 g / 21 s shot
        b = parse(open(os.path.join(os.path.dirname(__file__), "fixture.txt")).read())
        self.assertEqual(len(b), 1)
        self.assertEqual((b[0]["yield_g"], b[0]["time_s"], b[0]["mode"], b[0]["valid"]), (34.0, 21, "espresso", True))
        self.assertEqual(b[0]["flow_gs"], 1.62)  # 34.0 g / 21 s
        self.assertTrue(b[0]["ts"].startswith("2022-03-04"))

    def test_curve(self):
        t = "[ 1: 0: 0]D [SW] lock=100-50-0,1-1-0\n[ 1: 0:10]D [SW] lock=2000-1000-0,1-1-0\n[ 1: 0:20]D [SW] lock=4000-2000-0,1-1-0\n[ 1: 0:30]I [MP] weight num 5 time 30\n"
        c = parse(t)[0]["curve"]
        self.assertEqual(c[0], [0, 0.0])
        self.assertEqual(c[-1], [30, 200.0])
        self.assertIn([10, 100.0], c)

    def test_negative_and_noise(self):  # negative weights never count; short shots are flagged invalid
        t = "[ 1: 0: 0]D [SW] lock=100-50-1,1-1-0\n[ 1: 0: 1]I [MP] weight num 5 time 3\n"
        self.assertEqual(parse(t), [])
        t = "[ 1: 0: 0]D [SW] lock=100-50-0,1-1-0\n[ 1: 0: 1]I [MP] weight num 5 time 3\n"
        self.assertFalse(parse(t)[0]["valid"])

    def test_long_pour_is_pourover(self):
        t = "[ 1: 0: 0]D [SW] lock=4000-2000-0,1-1-0\n[ 1: 0: 1]I [MP] weight num 5 time 180\n"
        self.assertEqual(parse(t)[0]["mode"], "pourover")

    def test_real_ts_without_date_line(self):  # no "Date:" line in the log (ts shows "?"): distance to the sync still gives the real time
        from datetime import datetime
        t = "[ 1: 0: 0]D [SW] lock=4000-2000-0,1-1-0\n[ 1: 0:30]I [MP] weight num 5 time 30\n[ 1:10: 0]I [BLE] connected\n"
        b = parse(t, synced_at=datetime(2026, 11, 22, 12, 0, 0))[0]
        self.assertTrue(b["ts"].startswith("?"))
        self.assertEqual(b["real_ts"], "2026-11-22 11:50:30")

    def test_earlier_runs_get_an_upper_bound(self):  # run 0 (no date line) | cold boot | run 1 (date line): real_ts for all, only the last run is exact
        from datetime import datetime
        b = ("[ 5: 0: 0]D [SW] lock=4000-2000-0,1-1-0\n[ 5: 0:30]I [MP] weight num 5 time 30\n[ 5:10: 0]D [SYS] wakeup\n"
             "[ 2:30: 0]D [SYS] reboot reason = 0\n[ 2:30: 1]D [SYS] Date:22-2-2\n[ 2:31: 0]D [SW] lock=4000-2000-0,1-1-0\n"
             "[ 2:31:30]I [MP] weight num 5 time 30\n[ 3:30: 0]I [BLE] connected\n")
        a, c = parse(b, synced_at=datetime(2026, 11, 22, 12, 0, 0))
        self.assertEqual((a["run"], a["ts_src"], c["run"], c["ts_src"]), (0, "latest", 1, "exact"))
        self.assertEqual(c["real_ts"], "2026-11-22 11:01:30")
        # run 1 starts 1:00:00 before the sync (02:30:00 .. 03:30:00); run 0 ended at 5:10:00 and its brew was 9:30 earlier
        self.assertEqual(a["real_ts"], "2026-11-22 10:50:30")
        self.assertEqual(parse(b)[0]["real_ts"], None)  # no sync time, no guess

    def test_lines_before_the_date_line_use_it_as_anchor(self):
        from datetime import datetime
        t = ("[ 2:30: 0]D [SYS] reboot reason = 0\n[ 2:31: 0]D [SW] lock=4000-2000-0,1-1-0\n[ 2:31:30]I [MP] weight num 5 time 30\n"
             "[ 2:40: 0]D [SYS] Date:22-2-2\n[ 3:10: 0]I [BLE] connected\n")
        b = parse(t, synced_at=datetime(2026, 11, 22, 12, 0, 0))[0]
        self.assertEqual(b["real_ts"], "2026-11-22 11:21:30")

if __name__ == "__main__":
    unittest.main()
