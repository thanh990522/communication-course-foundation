#!/usr/bin/env python3
"""Chuyển syllabus (bản xuất Markdown của Google Doc) thành dữ liệu cho website.

Nguồn:  content/syllabus.md
Đích:   data/course.js   (gán vào window.COURSE, mở được cả khi chạy file:// )

Script chỉ tách và sắp xếp lại nội dung có sẵn trong tài liệu, không thêm nội dung mới.
Chạy lại mỗi khi cập nhật syllabus:  python3 scripts/build_data.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "syllabus.md"
OUT = ROOT / "data" / "course.js"


def clean(text):
    """Bỏ ký tự escape của Markdown và khoảng trắng thừa."""
    text = re.sub(r"\\+([!.\-*])", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_bold(text):
    return clean(text).replace("**", "").strip()


def split_cells(line):
    line = line.strip()
    return [c.strip() for c in line.strip("|").split("|")]


def split_top_level(text, seps=",;"):
    """Tách theo dấu phẩy / chấm phẩy nằm ngoài ngoặc đơn."""
    parts, depth, buf = [], 0, ""
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            parts.append(buf)
            buf = ""
        else:
            buf += ch
    parts.append(buf)
    return [p.strip().rstrip(".").strip() for p in parts if p.strip().rstrip(".").strip()]


def parse_word_list(text):
    """'flu (cúm), cold (cảm), runny nose' -> [{term, meaning}]"""
    items = []
    for part in split_top_level(text):
        m = re.match(r"^(.*?)\s*\((.*)\)\s*$", part)
        if m:
            items.append({"term": m.group(1).strip(), "meaning": m.group(2).strip()})
        else:
            items.append({"term": part, "meaning": ""})
    return items


def parse_blocks(lines):
    """Gom tài liệu thành các khối: table / para."""
    blocks, i = [], 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(lines[i])
                i += 1
            # dòng 1 là header rỗng, dòng 2 là căn lề (:-:)
            body = [split_cells(r) for r in rows if not re.match(r"^\|\s*:?-", r)]
            if body and all(c == "" for c in body[0]):
                body = body[1:]
            blocks.append({"type": "table", "rows": body})
            continue
        if line.strip():
            blocks.append({"type": "para", "text": line.rstrip("\n")})
        i += 1
    return blocks


def table_to_dicts(rows):
    header = [strip_bold(c) for c in rows[0]]
    return header, [[strip_bold(c) for c in r] for r in rows[1:]]


def parse_dialogue(cell):
    cell = clean(cell)
    parts = re.split(r"\*\*([A-Z]):\*\*", cell)
    lines = []
    for idx in range(1, len(parts), 2):
        text = parts[idx + 1].strip()
        note = ""
        # chú thích tiếng Việt trong ngoặc, ví dụ "(với người bán)", "(số điện thoại minh họa)"
        notes = re.findall(r"\(([^)]*)\)", text)
        speak = re.sub(r"\s*\([^)]*\)\s*", " ", text).strip()
        if notes:
            note = "; ".join(notes)
        lines.append({"speaker": parts[idx], "text": text, "speak": speak, "note": note})
    return lines


def parse_homework(text):
    parts = re.split(r"(Đọc|Viết|Ghi âm):", text)
    tasks = []
    for idx in range(1, len(parts), 2):
        tasks.append({"kind": parts[idx], "text": parts[idx + 1].strip()})
    return tasks


def main():
    raw = SRC.read_text(encoding="utf-8")
    blocks = parse_blocks(raw.splitlines())

    course = {
        "source": {
            "title": "Syllabus-Tieng-Anh-Giao-Tiep-Foundation-A1-B1",
            "url": "https://docs.google.com/document/d/1sOJGAQ0H4NRIQUA9W-xjWOg8zljwTRYsPWfqhFYWu_I/edit",
        },
        "info": [],
        "overview": {},
        "phases": [],
        "lessons": [],
    }

    # ---------- Phần đầu tài liệu ----------
    tables = [b for b in blocks if b["type"] == "table"]
    hero_cell = clean(tables[0]["rows"][0][0])
    hero_parts = [p for p in hero_cell.split("**") if p.strip()]
    # ['SYLLABUS KHÓA HỌC', 'Tiếng Anh Giao Tiếp', 'Foundation', 'Lộ trình A1+ → B1 · 36 buổi theo chủ đềTừ vựng – ...']
    tail = hero_parts[3]
    m = re.match(r"(.*?chủ đề)(.*)", tail)
    course["hero"] = {
        "kicker": hero_parts[0],
        "title": hero_parts[1],
        "subtitle": hero_parts[2],
        "route": m.group(1).strip() if m else tail,
        "tagline": m.group(2).strip() if m else "",
    }
    course["info"] = [{"label": strip_bold(r[0]), "value": strip_bold(r[1])} for r in tables[1]["rows"]]

    # Tìm vị trí các mục bằng tiêu đề số
    def index_of(pred):
        for k, b in enumerate(blocks):
            if pred(b):
                return k
        raise SystemExit("Không tìm thấy khối cần thiết")

    i1 = index_of(lambda b: b["type"] == "para" and "Tổng quan khóa học" in b["text"])
    i2 = index_of(lambda b: b["type"] == "para" and "Cấu trúc một buổi học" in b["text"])
    i3 = index_of(lambda b: b["type"] == "para" and "Bảng tổng quan 36 chủ đề" in b["text"])
    i8 = index_of(lambda b: b["type"] == "para" and "Kiểm tra đánh giá" in b["text"] and b["text"].startswith("**8**"))

    sec1 = blocks[i1 + 1:i2]
    paras1 = [clean(b["text"]) for b in sec1 if b["type"] == "para"]
    tables1 = [b for b in sec1 if b["type"] == "table"]
    _, details = table_to_dicts(tables1[0]["rows"])
    oh, orows = table_to_dicts(tables1[1]["rows"])
    course["overview"] = {
        "summary": paras1[0],
        "details": [{"label": r[0], "value": r[1]} for r in details],
        "outcomesTitle": strip_bold(paras1[1]),
        "outcomes": [
            {"phase": r[0], "lessons": r[1], "level": r[2], "canDo": r[3]} for r in orows
        ],
        "outcomesNote": strip_bold(paras1[2].strip("*")),
    }

    sec2 = blocks[i2 + 1:i3]
    paras2 = [clean(b["text"]) for b in sec2 if b["type"] == "para"]
    _, srows = table_to_dicts([b for b in sec2 if b["type"] == "table"][0]["rows"])
    course["structure"] = {
        "intro": paras2[0],
        "steps": [{"minutes": r[0], "activity": r[1], "purpose": r[2]} for r in srows],
        "notes": [re.sub(r"^-\s*", "", p) for p in paras2[1:]],
    }

    sec3 = blocks[i3 + 1:]
    course["topicsIntro"] = clean(sec3[0]["text"])
    _, trows = table_to_dicts(sec3[1]["rows"])
    topics = {
        int(r[0]): {"title": r[1], "grammarFocus": r[2], "speakingProduct": r[3]} for r in trows
    }

    # ---------- Giai đoạn và buổi học ----------
    phase = None
    lesson = None
    k = i3 + 2
    while k < i8:
        b = blocks[k]
        if b["type"] == "table" and len(b["rows"]) == 1 and len(b["rows"][0]) == 1 and "GIAI ĐOẠN" in b["rows"][0][0]:
            cell = clean(b["rows"][0][0])
            pm = re.match(r"\*\*GIAI ĐOẠN (\d+)\s*·\s*(.+?)\s*·\s*BUỔI (\d+)–(\d+)\*\*\*\*(.+?)\*\*", cell)
            phase = {
                "number": int(pm.group(1)),
                "level": pm.group(2).strip(),
                "from": int(pm.group(3)),
                "to": int(pm.group(4)),
                "title": pm.group(5).strip(),
                "goal": clean(blocks[k + 1]["text"]),
            }
            course["phases"].append(phase)
            k += 2
            continue

        if b["type"] == "para" and re.match(r"^\s*\*\*BUỔI \d+\*\*", b["text"]):
            lm = re.match(r"^\s*\*\*BUỔI (\d+)\*\*\s+\*\*(.+?)\*\*\s+(.+)$", b["text"])
            num = int(lm.group(1))
            lesson = {
                "number": num,
                "phase": phase["number"],
                "level": phase["level"],
                "title": clean(lm.group(2)),
                "titleVi": clean(lm.group(3)),
                **topics[num],
                "rows": [],
                "extraVocab": [],
                "table": None,
                "dialogue": [],
                "homework": [],
            }
            course["lessons"].append(lesson)
            k += 1
            continue

        if lesson is None:
            k += 1
            continue

        if b["type"] == "table" and not lesson["rows"] and len(b["rows"][0]) == 2:
            for r in b["rows"]:
                label = strip_bold(r[0])
                value = clean(r[1])
                emphasis = value.startswith("**")
                lesson["rows"].append({"label": label, "value": value.replace("**", "").strip(), "emphasis": emphasis})
        elif b["type"] == "para" and "TỪ VỰNG MỞ RỘNG" in b["text"]:
            text = clean(b["text"].split("**TỪ VỰNG MỞ RỘNG**", 1)[1])
            lesson["extraVocabText"] = text
            lesson["extraVocab"] = parse_word_list(text)
        elif b["type"] == "para" and "HỘI THOẠI MẪU" in b["text"]:
            lesson["dialogue"] = parse_dialogue(blocks[k + 1]["rows"][0][0])
            k += 2
            continue
        elif b["type"] == "para" and "BÀI TẬP VỀ NHÀ" in b["text"]:
            text = clean(b["text"].split("**BÀI TẬP VỀ NHÀ**", 1)[1])
            lesson["homework"] = parse_homework(text)
        elif b["type"] == "table" and lesson["rows"] and lesson["table"] is None and len(b["rows"][0]) >= 3:
            header, rows = table_to_dicts(b["rows"])
            lesson["table"] = {"header": header, "rows": rows}
        k += 1

    # Danh sách từ vựng dùng cho thẻ ghi nhớ:
    # buổi 1–27 lấy từ "TỪ VỰNG MỞ RỘNG"; buổi 28–35 phần "Từ vựng" đã kèm nghĩa tiếng Việt.
    for ls in course["lessons"]:
        vocab_row = next((r for r in ls["rows"] if r["label"] == "Từ vựng"), None)
        if not ls["extraVocab"] and vocab_row and "(" in vocab_row["value"]:
            ls["coreVocabList"] = parse_word_list(vocab_row["value"])
        pattern_row = next((r for r in ls["rows"] if r["label"] == "Mẫu câu"), None)
        if pattern_row:
            ls["patterns"] = [p.strip() for p in pattern_row["value"].split(" · ") if p.strip()]

    # ---------- Mục 8: Kiểm tra đánh giá ----------
    sec8 = blocks[i8 + 1:]
    paras8 = [clean(b["text"]) for b in sec8 if b["type"] == "para"]
    tables8 = [b for b in sec8 if b["type"] == "table"]
    _, arows = table_to_dicts(tables8[0]["rows"])
    rh, rrows = table_to_dicts(tables8[1]["rows"])
    course["assessment"] = {
        "intro": paras8[0],
        "tests": [{"number": int(r[0]), "when": r[1], "format": r[2], "content": r[3]} for r in arows],
        "rubricTitle": strip_bold(paras8[1]),
        "rubricHeader": rh,
        "rubric": [{"criterion": r[0], "minimum": r[1]} for r in rrows],
    }

    validate(course)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(course, ensure_ascii=False, indent=1)
    OUT.write_text(
        "// Tự động tạo bởi scripts/build_data.py từ content/syllabus.md — không sửa tay.\n"
        f"window.COURSE = {payload};\n",
        encoding="utf-8",
    )
    print(f"OK: {len(course['lessons'])} buổi, {len(course['phases'])} giai đoạn -> {OUT.relative_to(ROOT)}")


def validate(course):
    errors = []
    lessons = course["lessons"]
    if [l["number"] for l in lessons] != list(range(1, 37)):
        errors.append("Số buổi không đủ 1–36")
    if len(course["phases"]) != 4:
        errors.append("Phải có 4 giai đoạn")
    for l in lessons:
        n = l["number"]
        if not l["rows"]:
            errors.append(f"Buổi {n}: thiếu bảng thông tin")
        if n != 36:
            for key in ("dialogue", "homework"):
                if not l[key]:
                    errors.append(f"Buổi {n}: thiếu {key}")
            if not l["table"]:
                errors.append(f"Buổi {n}: thiếu bảng cấu trúc")
            if len(l["homework"]) != 3:
                errors.append(f"Buổi {n}: bài tập về nhà cần đủ Đọc/Viết/Ghi âm")
        if n <= 27 and not l["extraVocab"]:
            errors.append(f"Buổi {n}: thiếu từ vựng mở rộng")
        ph = course["phases"][l["phase"] - 1]
        if not ph["from"] <= n <= ph["to"]:
            errors.append(f"Buổi {n}: sai giai đoạn")
    if len(course["assessment"]["tests"]) != 4 or len(course["assessment"]["rubric"]) != 5:
        errors.append("Mục 8 không đủ 4 lần kiểm tra / 5 tiêu chí")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
