"""Parse a Mavo Lumicurve log file into brews (dev tool; the integration uses the same parser).

usage: python3 tools/parse.py data/scale_log_YYYYMMDD_HHMMSS.txt [out.json] [--synced "YYYY-MM-DD HH:MM:SS"]
Rules can be overridden in <repo>/settings.json (keys of brews.DEFAULT_SETTINGS, see docs/CONFIG.md).
"""
import importlib.util, json, os, re, sys
from datetime import datetime, timedelta

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def load(name):  # the component package imports Home Assistant, so load the pure modules by file path
    spec = importlib.util.spec_from_file_location(name, os.path.join(ROOT, "custom_components", "mavo_lumicurve", name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault(name, mod)
    spec.loader.exec_module(mod)
    return mod


parser = load("parser")
parse = parser.parse

if __name__ == "__main__":
    args, synced = sys.argv[1:], None
    rules = dict(parser.DEFAULT_RULES)
    cfg = os.path.join(ROOT, "settings.json")
    if os.path.exists(cfg):
        rules.update(json.load(open(cfg)))
    if "--synced" in args:
        i = args.index("--synced")
        synced = datetime.strptime(args[i + 1], "%Y-%m-%d %H:%M:%S")
        del args[i:i + 2]
    else:  # sync.py names the file after the moment the sync started; the connection follows ~10 s later
        f = re.search(r"scale_log_(\d{8})_(\d{6})", args[0])
        if f:
            synced = datetime.strptime(f[1] + f[2], "%Y%m%d%H%M%S") + timedelta(seconds=rules.get("sync_delay_s", 10))
    out = parse(open(args[0], errors="replace").read(), synced, rules)
    json.dump(out, open(args[1], "w") if len(args) > 1 else sys.stdout, indent=1)
    print(len(out), "brews", file=sys.stderr)
