import json, os
root = r"C:\Users\wqy\Documents\deepseek-harness\default-workspace\shumei-2026"
src = os.path.join(root, "prototype", "data", "gansu_cities.json")
d = json.load(open(src, encoding="utf-8"))

def rings(geom):
    if geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            for r in poly:
                yield r
    else:
        for r in geom["coordinates"]:
            yield r

def area_centroid(ring):
    a = cx = cy = 0.0
    n = len(ring)
    for i in range(n - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    if a == 0:
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        return [sum(xs) / len(xs), sum(ys) / len(ys)]
    a *= 0.5
    return [round(cx / (6 * a), 4), round(cy / (6 * a), 4)]

def simplify(ring, tol=0.012):
    # radial-distance + collinearity simplification (keeps shape, shrinks file)
    if len(ring) < 8:
        return ring
    keep = [ring[0]]
    for p in ring[1:-1]:
        px, py = keep[-1][0], keep[-1][1]
        if abs(p[0] - px) + abs(p[1] - py) >= tol:
            keep.append(p)
    keep.append(ring[-1])
    return keep

feats, mins = [], [999, 999]
maxs = [-999, -999]
for f in d["features"]:
    pr = f["properties"]; g = f["geometry"]
    polys = []
    if g["type"] == "MultiPolygon":
        for poly in g["coordinates"]:
            polys.append([simplify(r) for r in poly])
    else:
        polys.append([simplify(r) for r in g["coordinates"]])
    for r in rings(g):
        for x, y in r:
            mins[0] = min(mins[0], x); mins[1] = min(mins[1], y)
            maxs[0] = max(maxs[0], x); maxs[1] = max(maxs[1], y)
    big = max(rings(g), key=len)
    feats.append({
        "type": "Feature",
        "properties": {
            "name": pr["name"],
            "adcode": pr["adcode"],
            "center": [round(c, 4) for c in (pr.get("center") or area_centroid(big))],
            "centroid": area_centroid(big),
        },
        "geometry": {"type": "MultiPolygon", "coordinates": polys},
    })

out = {"bbox": [round(mins[0], 4), round(mins[1], 4), round(maxs[0], 4), round(maxs[1], 4)], "features": feats}
dst = os.path.join(root, "prototype", "js", "geo.js")
os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, "w", encoding="utf-8") as fh:
    fh.write("/* 甘肃省 14 市州行政区划边界（简化）· 数据来源：DataV.GeoAtlas 公开边界数据 */\n")
    fh.write("window.GEO_DATA = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
print("geo.js bytes:", os.path.getsize(dst))
print("bbox:", out["bbox"])
for f in feats:
    print(f["properties"]["name"], f["properties"]["adcode"], f["properties"]["center"], f["properties"]["centroid"])
