"""Reproduce the coarse 2011 shoreline ranges from the archived B8 image.

Run with a local copy of the exact Landsat product documented in the method.
The GeoTIFF is not distributed with the project. An offset here is measured
from an archived profile locator, never from a verified shoreline station.
"""
import argparse
from hashlib import sha256
import json
from math import atan2, degrees
from pathlib import Path

import numpy as np
from pyproj import Geod, Transformer
import rasterio

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("band8", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
audit = json.loads((root / "docs/qa/hunucma-yobain-audit.json").read_text(encoding="utf-8"))
model = json.loads((root / "public/data/municipalities/hunucma/scenario.json").read_text(encoding="utf-8"))
pending = {r["id"] for r in next(s for s in audit["scopes"] if s["slug"] == "hunucma")["reference_gaps"]}
geod = Geod(ellps="WGS84")
offsets = np.arange(-90, 106, 5)
rows = []

with rasterio.open(args.band8) as src:
    assert src.res == (15., 15.) and src.crs.to_epsg() == 32616
    project = Transformer.from_crs(4326, src.crs, always_xy=True)
    for target in model["targets"]:
        pid = target["id"]
        if pid not in pending:
            continue
        segment, order = pid.split("-")[1], int(pid.split("-")[-1])
        # Keep open beach only. The visual review excluded the inlet,
        # breakwaters and a bright salient which may include exposed foam.
        if segment == "31" or (segment == "4" and (order <= 7 or 56 <= order <= 60)) or (segment == "5" and order <= 3):
            continue
        lon, lat = target["p"]
        azimuth = degrees(atan2(*target["v"]))
        points = [project.transform(*geod.fwd(lon, lat, azimuth, int(d))[:2]) for d in offsets]
        dn = np.array([int(v[0]) for v in src.sample(points)])
        candidates = []
        for i in range(11, 29):
            # Reject corridors with any SLC-off/no-data pixel. No gap filling.
            if not np.all(dn[i-7:i+10] > 0):
                continue
            contrast = np.median(dn[i-5:i-1]) - np.median(dn[i+2:i+7])
            if contrast >= 17:
                candidates.append((contrast, int(offsets[i])))
        if candidates:
            _, d = max(candidates)
            rows.append({"municipality": "hunucma", "id": pid, "source": "LANDSAT7-20110817-B8",
                         "origin": target["p"], "azimuth": azimuth, "interval_m": [d-35, d+35]})

args.output.write_text(json.dumps({
    "band8_sha256": sha256(args.band8.read_bytes()).hexdigest(),
    "references": sorted(rows, key=lambda row: row["id"]),
}, indent=2) + "\n", encoding="utf-8")
