import json, urllib.request, sys, os
url = "https://geo.datav.aliyun.com/areas_v3/bound/620000_full.json"
out = r"C:\Users\wqy\Documents\deepseek-harness\default-workspace\shumei-2026\prototype\data\gansu_cities.json"
try:
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0"})
    raw = urllib.request.urlopen(req, timeout=30).read()
    d = json.loads(raw.decode("utf-8"))
    feats = d.get("features", [])
    simp = {"type":"FeatureCollection","features":[]}
    for f in feats:
        p = f.get("properties", {})
        simp["features"].append({
            "type":"Feature",
            "properties":{"name":p.get("name"),"adcode":p.get("adcode"),"center":p.get("center"),"centroid":p.get("centroid")},
            "geometry":f.get("geometry")
        })
    open(out,"w",encoding="utf-8").write(json.dumps(simp,ensure_ascii=False))
    print("OK features:",len(feats),"bytes:",os.path.getsize(out))
    print("names:", [f["properties"]["name"] for f in simp["features"]])
except Exception as e:
    print("FAIL", type(e).__name__, e); sys.exit(1)
