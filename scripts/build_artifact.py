#!/usr/bin/env python3
"""Đóng gói website thành một file HTML duy nhất để đăng dạng Artifact trên claude.ai.

Đích: dist/artifact.html (CSS, dữ liệu và JS được nhúng thẳng vào trang).
Artifact tự bọc <!doctype>/<html>/<head>/<body>, nên file này chỉ chứa phần nội dung.
Chạy:  python3 scripts/build_artifact.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "artifact.html"


def inline_script(code):
    # tránh đóng thẻ <script> sớm nếu nội dung có chuỗi "</script"
    return "<script>\n" + re.sub(r"</(script)", r"<\\/\1", code, flags=re.I) + "\n</script>"


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    css = (ROOT / "assets/css/style.css").read_text(encoding="utf-8")
    data = (ROOT / "data/course.js").read_text(encoding="utf-8")
    app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")

    title = re.search(r"<title>.*?</title>", html, re.S).group(0)
    fonts = re.findall(r'<link rel="preconnect"[^>]*>|<link href="https://fonts\.googleapis\.com[^>]*>', html)
    theme_init = re.search(r"<script>\s*try \{.*?</script>", html, re.S).group(0)
    body = re.search(r"<body>(.*?)<script src=", html, re.S).group(1)

    # Khung Artifact không cho dùng micro: bỏ câu nói về bản ghi âm ở chân trang.
    body = body.replace(" Bản ghi âm không được tải lên đâu cả.", "")

    page = "\n".join([
        title,
        *fonts,
        "<style>\n" + css + "\n</style>",
        theme_init,
        body.strip(),
        "<script>window.CF_ARTIFACT = true;</script>",
        inline_script(data),
        inline_script(app),
    ]) + "\n"

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    print(f"OK: {OUT.relative_to(ROOT)} ({len(page.encode('utf-8')) // 1024} KB)")


if __name__ == "__main__":
    main()
