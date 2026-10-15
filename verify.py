# -*- coding: utf-8 -*-
import json, sys, re
sys.stdout.reconfigure(encoding="utf-8")
p = r"C:\Users\wqy\Documents\deepseek-harness\default-workspace\shumei-2026\research\gansu_ich_raw.json"
d = json.load(open(p, encoding="utf-8"))
items = d["items"]
print("total items:", len(items))
required = ["兰州鼓子","凉州贤孝","河西宝卷","环县道情皮影戏","洮砚制作技艺","庆阳香包绣制","天水雕漆",
            "保安族腰刀锻制技艺","裕固族服饰","秦腔","陇剧","崆峒派武术","兰州黄河大水车制作技艺",
            "太昊伏羲祭典","女娲祭典","池哥昼","甘南藏医药"]
names = " || ".join(i["name"] for i in items)
for r in required:
    hit = [i["name"] for i in items if r in i["name"]]
    print(("OK  " if hit else "MISS"), r, "->", hit)
print()
print("intro len min/max:", min(len(i["intro"]) for i in items), max(len(i["intro"]) for i in items))
short = [(i["name"], len(i["intro"])) for i in items if len(i["intro"]) < 50 or len(i["intro"]) > 130]
print("out-of-range intros:", short)
print()
print("batch counts:")
from collections import Counter
print(Counter(i["batch"] for i in items))
print("year counts:", Counter(i["year"] for i in items))
print("no-code items:", [i["name"] for i in items if not i["code"]])
print()
print("stats:", json.dumps(d["stats"], ensure_ascii=False))
print("sources:", len(d["sources"]))
print("notes chars:", len(d["notes"]))
# strict validity check of raw text
raw = open(p, encoding="utf-8").read()
json.loads(raw)
print("raw JSON parse: OK; chars:", len(raw))
