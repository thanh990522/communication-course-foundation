# Tiếng Anh Giao Tiếp Foundation (A1+ → B1)

Website học tập cho toàn bộ khóa **Tiếng Anh Giao Tiếp Foundation** – 36 buổi theo chủ đề, Thầy Hà Chí Thanh.
Toàn bộ nội dung lấy từ [syllabus gốc trên Google Docs](https://docs.google.com/document/d/1sOJGAQ0H4NRIQUA9W-xjWOg8zljwTRYsPWfqhFYWu_I/edit).

## Tính năng

- **Trang chủ**: tổng quan khóa học, thông tin lớp, chuẩn đầu ra theo 4 giai đoạn, cấu trúc buổi học 90 phút.
- **Lộ trình 36 buổi**: xem dạng thẻ hoặc dạng bảng, lọc theo giai đoạn và từ khóa.
- **Trang từng buổi** (`#/lesson/1` … `#/lesson/36`):
  - mục tiêu đầu ra, nội dung trọng tâm (từ vựng, ngữ pháp, thực hành nói);
  - mẫu câu, ví dụ và từ vựng có nút **nghe phát âm** (dùng giọng đọc có sẵn của trình duyệt);
  - bảng cấu trúc kèm **lỗi thường gặp**;
  - **hội thoại mẫu**: nghe cả đoạn, hoặc **luyện nói theo vai A/B** (máy đọc vai kia và dừng ở lượt của bạn);
  - **bài tập về nhà** dạng checklist và **ghi âm ngay trên trình duyệt** (nghe lại và tải file về gửi giáo viên);
  - đánh dấu đã học xong, in / lưu PDF.
- **Ôn từ vựng**: 449 thẻ ghi nhớ (chỉ những từ có nghĩa tiếng Việt trong syllabus), luyện theo buổi, theo giai đoạn hoặc toàn khóa, chiều Anh → Việt hoặc Việt → Anh.
- **Kiểm tra đánh giá**: 4 lần kiểm tra nói, tiêu chí chấm, công cụ tự đánh giá 1–5 điểm.
- **Tìm kiếm** toàn khóa, gõ có dấu hay không dấu đều được (ví dụ `phan nan`).
- Giao diện sáng / tối, dùng tốt trên điện thoại.

Tiến độ, checklist và điểm tự đánh giá chỉ lưu trong trình duyệt (localStorage). Bản ghi âm không được tải lên đâu cả.

## Cấu trúc thư mục

```
index.html            Trang web (single-page, điều hướng bằng #hash)
assets/css/style.css  Giao diện
assets/js/app.js      Logic: router, trang bài học, phát âm, ghi âm, thẻ ghi nhớ, tìm kiếm
data/course.js        Dữ liệu khóa học (tự sinh, không sửa tay)
content/syllabus.md   Bản xuất nội dung syllabus từ Google Docs
scripts/build_data.py Chuyển syllabus.md -> data/course.js, có kiểm tra đủ 36 buổi
```

## Chạy thử

Mở trực tiếp `index.html` bằng trình duyệt, hoặc chạy một server tĩnh:

```bash
python3 -m http.server 8000
# mở http://localhost:8000
```

Tính năng ghi âm cần chạy qua `http://localhost` hoặc `https://` (trình duyệt không cho dùng micro khi mở bằng `file://`).

## Cập nhật nội dung

1. Xuất lại nội dung Google Doc ra Markdown, ghi đè `content/syllabus.md`.
2. Chạy `python3 scripts/build_data.py`. Script báo lỗi nếu thiếu buổi, hội thoại, bài tập…
3. Commit cả `content/syllabus.md` và `data/course.js`.

## Bản đã đăng

Website đã được đăng dạng Artifact trên claude.ai: https://claude.ai/artifact/YCffoLDtetug7nBMXRJ2cE
(mặc định riêng tư; chia sẻ cho học viên qua menu **Share** của trang).

Bản Artifact được đóng gói thành một file bằng `python3 scripts/build_artifact.py` (ra `dist/artifact.html`).
Khung Artifact không cho dùng micro và không in được, nên bản này ẩn nút in và thay phần ghi âm bằng lời nhắc dùng app ghi âm của điện thoại.
Có thể mở thẳng một mục bằng link: `#lessons`, `#review`, `#assessment`, `#lesson-12`.

## Đưa lên mạng (GitHub Pages)

Website hoàn toàn tĩnh, không cần build. Vào **Settings → Pages**, chọn *Deploy from a branch*, chọn nhánh và thư mục `/ (root)`.
