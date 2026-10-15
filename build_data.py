# -*- coding: utf-8 -*-
"""
把采集到的原始 JSON 装配为前端数据模块 prototype/js/data.js
- 规范化 city / category / batch / year
- 去重、补 id
- 生成统计口径（官方数字与收录数字分开标注）
- 校验失败项打印告警，不静默丢弃
"""
import json, os, re, sys, hashlib

ROOT = r"C:\Users\wqy\Documents\deepseek-harness\default-workspace\shumei-2026"
RAW = os.path.join(ROOT, "research", "gansu_ich_raw.json")
OUT = os.path.join(ROOT, "prototype", "js", "data.js")

CITIES = ['兰州市','嘉峪关市','金昌市','白银市','天水市','武威市','张掖市',
          '平凉市','酒泉市','庆阳市','定西市','陇南市','临夏回族自治州','甘南藏族自治州']

CATS = ['民间文学','传统音乐','传统舞蹈','传统戏剧','曲艺',
        '传统体育、游艺与杂技','传统美术','传统技艺','传统医药','民俗']

CITY_ALIAS = {
    '兰州':'兰州市','嘉峪关':'嘉峪关市','金昌':'金昌市','白银':'白银市','天水':'天水市',
    '武威':'武威市','张掖':'张掖市','平凉':'平凉市','酒泉':'酒泉市','庆阳':'庆阳市',
    '定西':'定西市','陇南':'陇南市','临夏':'临夏回族自治州','临夏州':'临夏回族自治州',
    '临夏回族自治州':'临夏回族自治州','甘南':'甘南藏族自治州','甘南州':'甘南藏族自治州',
    '甘南藏族自治州':'甘南藏族自治州','省直':'兰州市','甘肃省':'兰州市',
}

CAT_ALIAS = {
    '传统体育游艺与杂技':'传统体育、游艺与杂技',
    '传统体育、游艺与杂技':'传统体育、游艺与杂技',
    '传统体育':'传统体育、游艺与杂技',
    '传统手工技艺':'传统技艺',
    '民间美术':'传统美术',
    '民间音乐':'传统音乐',
    '民间舞蹈':'传统舞蹈',
    '戏曲':'传统戏剧',
    '杂技与竞技':'传统体育、游艺与杂技',
}

BATCH_YEAR = {'第一批':2006,'第二批':2008,'第三批':2011,'第四批':2014,'第五批':2021,
              '第一批扩展项目':2006,'第二批扩展项目':2008,'第三批扩展项目':2011,
              '第四批扩展项目':2014,'第五批扩展项目':2021}

BATCH_ORDER = ['第一批','第二批','第三批','第四批','第五批']

# ── 临时最小数据集（仅用于渲染自检；真实数据由采集结果覆盖） ──
FALLBACK = [
    dict(name="花儿（河州花儿）", category="传统音乐", batch="第一批", year=2006, city="临夏回族自治州",
         county="临夏市", code="Ⅱ-20", tags=["多民族共创","口传民歌","联合国名录"],
         intro="花儿是流传于甘、青、宁等地的山歌，由汉、回、东乡、保安、撒拉、土、裕固等多民族共同创造，2006年入选第一批国家级非物质文化遗产名录，2009年入选联合国教科文组织人类非物质文化遗产代表作名录。"),
    dict(name="兰州鼓子", category="曲艺", batch="第一批", year=2006, city="兰州市", county="城关区",
         code="Ⅴ-29", tags=["坐唱","兰州方言"], intro="兰州鼓子是流行于兰州一带的曲艺形式，以兰州方言演唱，多为坐唱，曲牌丰富，是研究西北曲艺的重要样本。"),
    dict(name="凉州贤孝", category="曲艺", batch="第一批", year=2006, city="武威市", county="凉州区",
         code="Ⅴ-2", tags=["盲艺人","劝善"], intro="凉州贤孝又称凉州劝善书，是流行于武威一带的民间说唱，多由盲艺人操三弦自弹自唱，内容以劝善孝亲为主。"),
    dict(name="河西宝卷", category="民间文学", batch="第一批", year=2006, city="武威市", county="凉州区",
         code="Ⅰ-13", tags=["说唱文学","手抄本"], intro="河西宝卷是流行于河西走廊的民间说唱文学，以手抄卷本为载体，念唱结合，题材多取自民间故事与劝善内容。"),
    dict(name="环县道情皮影戏", category="传统戏剧", batch="第一批", year=2006, city="庆阳市", county="环县",
         code="Ⅳ-91", tags=["牛皮影","道情腔"], intro="环县道情皮影戏是陇东地区以道情腔演唱、以牛皮刻制影人表演的民间戏剧，雕刻刀法粗犷精细兼具。"),
    dict(name="庆阳香包绣制", category="传统技艺", batch="第一批", year=2006, city="庆阳市", county="西峰区",
         code="Ⅷ-77", tags=["刺绣","端午"], intro="庆阳香包又称绌绌，以丝绸布料缝制并绣以纹样，内装香料，端午佩戴，2002年庆阳被中国民俗学会命名为“中国香包刺绣之乡”。"),
    dict(name="洮砚制作技艺", category="传统技艺", batch="第二批", year=2008, city="甘南藏族自治州", county="卓尼县",
         code="Ⅷ-132", tags=["四大名砚","喇嘛崖"], intro="洮砚产于洮河流域，为中国四大名砚之一，石质细腻，以透雕、浮雕等技法见长，2008年入选第二批国家级非物质文化遗产名录。"),
    dict(name="天水雕漆技艺", category="传统技艺", batch="第二批", year=2008, city="天水市", county="秦州区",
         code="Ⅷ-131", tags=["漆器","镶嵌"], intro="天水雕漆以木胎髹漆、雕刻镶嵌为特色，融合雕填、镶嵌、彩绘等工艺，是甘肃代表性的传统手工艺。"),
    dict(name="保安族腰刀锻制技艺", category="传统技艺", batch="第一批", year=2006, city="临夏回族自治州", county="积石山保安族东乡族撒拉族自治县",
         code="Ⅷ-40", tags=["保安族","锻打"], intro="保安族腰刀锻制技艺是保安族传统手工技艺，经选料、锻打、淬火、抛光等数十道工序制成，刀刃锋利、刀柄装饰讲究。"),
    dict(name="裕固族服饰", category="民俗", batch="第二批", year=2008, city="张掖市", county="肃南裕固族自治县",
         code="Ⅹ-114", tags=["裕固族","头面"], intro="裕固族服饰是裕固族的传统民族服饰，女子头面与高领长袍形制独特，2008年入选第二批国家级非物质文化遗产名录。"),
    dict(name="秦腔", category="传统戏剧", batch="第一批", year=2006, city="兰州市", county="",
         code="Ⅳ-16", tags=["梆子腔","高亢"], intro="秦腔是起源于陕甘一带的古老戏曲声腔，以梆子击节，唱腔高亢激越，对西北诸多剧种有深远影响。"),
    dict(name="陇剧", category="传统戏剧", batch="第二批", year=2008, city="兰州市", county="",
         code="Ⅳ-100", tags=["陇东道情","甘肃独有"], intro="陇剧由陇东道情皮影戏发展而来，1959年正式定名，是甘肃独有的新兴戏曲剧种，唱腔吸收道情、民歌元素。"),
    dict(name="太昊伏羲祭典", category="民俗", batch="第一批", year=2006, city="天水市", county="",
         code="Ⅹ-38", tags=["祭祀","伏羲庙"], intro="太昊伏羲祭典是天水一带祭祀人文始祖伏羲的传统民俗活动，每年在伏羲庙举行，仪式庄重，传承历史悠久。"),
    dict(name="兰州黄河大水车制作技艺", category="传统技艺", batch="第一批", year=2006, city="兰州市", county="",
         code="Ⅷ-52", tags=["灌溉","水车"], intro="兰州黄河大水车制作技艺是黄河沿岸用于提水灌溉的传统技艺，水车形制巨大，是兰州黄河文化的重要标志。"),
    dict(name="崆峒派武术", category="传统体育、游艺与杂技", batch="第二批", year=2008, city="平凉市", county="崆峒区",
         code="Ⅵ-33", tags=["崆峒山","武术"], intro="崆峒派武术发源于平凉崆峒山，融养生与技击于一体，是甘肃代表性的传统武术流派。"),
]


def norm_city(v):
    if not v:
        return None
    v = str(v).strip()
    if v in CITIES:
        return v
    for k, val in CITY_ALIAS.items():
        if v.startswith(k) or k in v:
            return val
    return None


def norm_cat(v):
    if not v:
        return None
    v = str(v).strip()
    if v in CATS:
        return v
    if v in CAT_ALIAS:
        return CAT_ALIAS[v]
    for c in CATS:
        if c in v or v in c:
            return c
    return None


def norm_batch(v, year):
    if v:
        v = str(v).strip()
        if v in BATCH_YEAR:
            return v, BATCH_YEAR[v]
        for b in BATCH_ORDER:
            if b in v:
                return b, BATCH_YEAR[b]
    if year:
        for b, y in BATCH_YEAR.items():
            if y == int(year):
                return b, int(year)
    return None, year


def main():
    warned = []
    if os.path.exists(RAW):
        raw = json.load(open(RAW, encoding="utf-8"))
        items_in = raw.get("items") or []
        stats_in = raw.get("stats") or {}
        sources = raw.get("sources") or []
        notes = raw.get("notes") or ""
        origin = "采集数据"
    else:
        items_in = FALLBACK
        stats_in = {}
        sources = []
        notes = "【临时数据】采集任务尚未完成，当前为渲染自检用最小数据集。"
        origin = "临时数据"
        warned.append("gansu_ich_raw.json 不存在，使用 FALLBACK 最小数据集")

    seen, items = set(), []
    for i, it in enumerate(items_in):
        name = (it.get("name") or "").strip()
        if not name:
            warned.append(f"#{i} 缺少 name，已跳过")
            continue
        if name in seen:
            warned.append(f"重复项目：{name}，已跳过")
            continue
        cat = norm_cat(it.get("category"))
        city = norm_city(it.get("city") or it.get("region"))
        if cat is None:
            warned.append(f"{name}：门类无法识别（{it.get('category')}）→ 归入 民俗")
            cat = "民俗"
        if city is None:
            warned.append(f"{name}：市州无法识别（{it.get('city')}）→ 未定位")
        batch, year = norm_batch(it.get("batch"), it.get("year"))
        if batch is None:
            warned.append(f"{name}：批次无法识别（{it.get('batch')}）")
        iid = it.get("id") or ("ich-" + hashlib.md5(name.encode("utf-8")).hexdigest()[:8])
        tags = [str(t) for t in (it.get("tags") or []) if t]
        items.append(dict(
            id=iid, name=name, category=cat, batch=batch or "", year=year or None,
            city=city or "", county=(it.get("county") or ""), code=(it.get("code") or ""),
            intro=(it.get("intro") or "").strip(), tags=tags, region=(it.get("region") or ""),
        ))
        seen.add(name)

    by_city = {c: 0 for c in CITIES}
    by_cat = {c: 0 for c in CATS}
    by_batch = {b: 0 for b in BATCH_ORDER}
    tag_count = {}
    for it in items:
        if it["city"]:
            by_city[it["city"]] += 1
        by_cat[it["category"]] += 1
        if it["batch"] in by_batch:
            by_batch[it["batch"]] += 1
        for t in it["tags"]:
            tag_count[t] = tag_count.get(t, 0) + 1

    stats = dict(stats_in)
    stats.setdefault("humanity_list", ["花儿", "皮影戏（环县道情皮影戏）", "格萨（斯）尔", "秦腔（与陕西等联合申报）"])
    stats["collected_total"] = len(items)
    stats["by_city_collected"] = by_city
    stats["by_category_collected"] = by_cat
    stats["by_batch_collected"] = by_batch
    stats["top_tags"] = sorted(tag_count.items(), key=lambda kv: -kv[1])[:12]
    stats["cutoff"] = "五批国家级名录（2006—2021）；统计口径采用甘肃省文旅厅 2024 年公开数据"

    # 来源去重与补充
    known = [
        {"title": "甘肃省文化和旅游厅 ·《甘肃省国家级非遗代表性项目、代表性传承人名录》（截至2024年12月31日）",
         "url": "https://wlt.gansu.gov.cn/wlt/c108639/202503/174111238.shtml",
         "note": "国家级项目与传承人数量口径"},
        {"title": "甘肃省文化和旅游厅 ·《甘肃省国家级、省级非遗名录》（截至2021年12月31日）",
         "url": "https://wlt.gansu.gov.cn/wlt/c108639/202201/1639898.shtml",
         "note": "分市州名录明细"},
        {"title": "中国非物质文化遗产网 · 中国非物质文化遗产数字博物馆",
         "url": "https://www.ihchina.cn/",
         "note": "项目类别、批次与编号"},
        {"title": "甘肃省人民政府 · 甘肃省非遗概况",
         "url": "http://www.gansu.gov.cn/gsszf/c119552/202510/174227323.shtml",
         "note": "全省非遗总体概况"},
        {"title": "DataV.GeoAtlas 地理小工具 · 甘肃省行政区划边界数据",
         "url": "https://geo.datav.aliyun.com/areas_v3/bound/620000_full.json",
         "note": "地图矢量边界（作品内已简化为静态数据）"},
        {"title": "全国大学生数字媒体科技作品及创意竞赛官网",
         "url": "https://www.cmit.cn/",
         "note": "赛事章程与赛道设置"},
    ]
    have = {s.get("url") for s in sources}
    for k in known:
        if k["url"] not in have:
            sources.append(k)

    note_text = (notes + " ").strip()
    note_text += ("本作品数据用于非商业性的学术展示与竞赛演示。项目点位依据申报地区（市州）质心做示意性散布，"
                  "不代表传承场所或项目的精确地理坐标；纹样再生模块为基于非遗形态基因的参数化再创作，非文物复制。"
                  "收录条目以官方名录为准，凡本作品整理过程中出现的疏漏，均以甘肃省文化和旅游厅、中国非物质文化遗产网公布信息为准。")
    if warned:
        note_text += " 数据装配告警：" + "；".join(warned[:12]) + ("…" if len(warned) > 12 else "")

    payload = {"items": items, "stats": stats, "sources": sources, "notes": note_text}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write("/* 《陇原非遗数字图谱》数据模块 · 由 build_data.py 自动装配，请勿手工编辑 */\n")
        fh.write("window.ICH_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n")

    print(f"[{origin}] 收录 {len(items)} 项，data.js {os.path.getsize(OUT)} 字节")
    print("市州分布：", {CITIES[i][:3]: by_city[CITIES[i]] for i in range(len(CITIES))})
    print("门类分布：", by_cat)
    print("批次分布：", by_batch)
    if warned:
        print("\n告警：")
        for w in warned:
            print("  -", w)


if __name__ == "__main__":
    main()
