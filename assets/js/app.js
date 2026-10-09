(function () {
  'use strict';

  var C = window.COURSE;
  var main = document.getElementById('main');
  var LESSONS = C.lessons;
  var PHASES = C.phases;

  /* ---------- Tiện ích ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua khi trình duyệt chặn lưu trữ */ }
    }
  };

  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  var VI_CHARS = /[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;
  function isEnglish(s) { return s && s !== '—' && !VI_CHARS.test(s); }

  function normChar(ch) {
    return ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
  }
  function norm(s) { return Array.prototype.map.call(String(s), normChar).join(''); }

  /* ---------- Tiến độ ---------- */
  function doneSet() { return store.get('cf.done', []); }
  function isDone(n) { return doneSet().indexOf(n) !== -1; }
  function toggleDone(n) {
    var d = doneSet(), i = d.indexOf(n);
    if (i === -1) d.push(n); else d.splice(i, 1);
    store.set('cf.done', d);
    return i === -1;
  }
  function phaseOf(n) { return PHASES.filter(function (p) { return n >= p.from && n <= p.to; })[0]; }
  function nextLesson() {
    var d = doneSet();
    var l = LESSONS.filter(function (x) { return d.indexOf(x.number) === -1; })[0];
    return l ? l.number : 1;
  }

  /* ---------- Đọc mẫu (Web Speech API) ---------- */
  var TTS = { ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window, voice: null, rate: store.get('cf.rate', 0.9) };
  if (!TTS.ok) document.documentElement.classList.add('no-tts');
  function pickVoice() {
    if (!TTS.ok) return;
    var vs = speechSynthesis.getVoices();
    TTS.voice = vs.filter(function (v) { return /^en[-_]US/i.test(v.lang); })[0] ||
      vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  if (TTS.ok) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  function sayable(text) {
    return String(text)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/…/g, ' ')
      .replace(/\s*→\s*/g, ', ')
      .replace(/\s+\/\s+/g, ', ')
      .replace(/["“”]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function speak(text, opts) {
    if (!TTS.ok) return;
    opts = opts || {};
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(sayable(text));
    u.lang = 'en-US';
    if (TTS.voice) u.voice = TTS.voice;
    u.rate = TTS.rate;
    if (opts.btn) {
      opts.btn.classList.add('playing');
      u.onend = u.onerror = function () { opts.btn.classList.remove('playing'); if (opts.onend) opts.onend(); };
    } else if (opts.onend) {
      u.onend = u.onerror = opts.onend;
    }
    speechSynthesis.speak(u);
  }
  function speakBtn(text, label) {
    return '<button type="button" class="speak" data-say="' + esc(text) + '" aria-label="Nghe: ' + esc(label || text) + '" title="Nghe phát âm">▶</button>';
  }
  function rateControl() {
    return '<label class="tts-only muted" style="display:inline-flex;gap:6px;align-items:center;font-size:.88rem">Tốc độ đọc ' +
      '<select data-rate>' + [0.7, 0.85, 0.9, 1].map(function (r) {
        return '<option value="' + r + '"' + (Math.abs(r - TTS.rate) < .001 ? ' selected' : '') + '>' + (r === 1 ? 'Bình thường' : r + '×') + '</option>';
      }).join('') + '</select></label>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-say]');
    if (b) { e.preventDefault(); speak(b.getAttribute('data-say'), { btn: b }); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.matches('[data-rate]')) { TTS.rate = parseFloat(e.target.value); store.set('cf.rate', TTS.rate); }
  });

  /* ---------- Thành phần dùng chung ---------- */
  function phaseChip(p) { return '<span class="chip chip-p' + p.number + '">Giai đoạn ' + p.number + ' · ' + esc(p.level) + '</span>'; }

  function lessonCard(l) {
    var p = phaseOf(l.number);
    return '<a class="card lesson-card p' + p.number + '" href="#/lesson/' + l.number + '">' +
      (isDone(l.number) ? '<span class="chip chip-done done-badge">✓ Đã học</span>' : '') +
      '<span class="num">BUỔI ' + l.number + '</span>' +
      '<h3>' + esc(l.title) + '</h3><div class="vi">' + esc(l.titleVi) + '</div>' +
      '<dl><dt>Ngữ pháp trọng tâm</dt><dd>' + esc(l.grammarFocus) + '</dd>' +
      '<dt>Sản phẩm speaking</dt><dd>' + esc(l.speakingProduct) + '</dd></dl></a>';
  }

  function progressBar(done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="progress-row"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total +
      '" aria-valuenow="' + done + '"><span style="width:' + pct + '%"></span></div><span class="muted">' + done + '/' + total + '</span></div>';
  }

  function linkRefs(htmlText) {
    return htmlText.replace(/xem mục 8/g, '<a href="#/assessment">xem mục 8</a>');
  }

  var TL_COLORS = 6;
  function structureBlock() {
    var s = C.structure;
    var bar = s.steps.map(function (st, i) {
      var m = st.minutes.match(/(\d+)\D+(\d+)/);
      var w = m ? (parseInt(m[2], 10) - parseInt(m[1], 10)) : 10;
      return '<span class="tl-' + (i % TL_COLORS) + '" style="flex:' + w + '" title="' + esc(st.minutes + ' phút: ' + st.activity) + '">' + esc(st.minutes) + '</span>';
    }).join('');
    var list = s.steps.map(function (st, i) {
      return '<li><span class="min tl-' + (i % TL_COLORS) + '">' + esc(st.minutes) + '</span><div><div>' + esc(st.activity) +
        '</div><div class="purpose">Mục đích: ' + esc(st.purpose) + '</div></div></li>';
    }).join('');
    return '<p>' + esc(s.intro) + '</p><div class="timeline-bar" aria-hidden="true">' + bar + '</div><ol class="timeline-list">' + list + '</ol>' +
      '<ul style="margin:16px 0 0;padding-left:20px">' + s.notes.map(function (n) {
        var parts = n.split(/:\s(.+)/);
        return '<li>' + (parts.length > 1 ? '<strong>' + esc(parts[0]) + ':</strong> ' + esc(parts[1]) : esc(n)) + '</li>';
      }).join('') + '</ul>';
  }

  /* ---------- Trang chủ ---------- */
  function renderHome() {
    var h = C.hero, d = doneSet().length, nl = nextLesson();
    var info = C.info.map(function (i) {
      return '<div class="info-item"><dt>' + esc(i.label) + '</dt><dd>' + esc(i.value) + '</dd></div>';
    }).join('');

    var details = C.overview.details.map(function (r) {
      return '<tr><th scope="row">' + esc(r.label) + '</th><td>' + esc(r.value) + '</td></tr>';
    }).join('');

    var phases = C.overview.outcomes.map(function (o, i) {
      var p = PHASES[i];
      var doneIn = LESSONS.filter(function (l) { return l.number >= p.from && l.number <= p.to && isDone(l.number); }).length;
      return '<article class="card phase-card p' + p.number + '">' + phaseChip(p) +
        '<h3>' + esc(o.phase.replace(/^\d+\.\s*/, '')) + '</h3>' +
        '<div class="muted">Buổi ' + esc(o.lessons) + '</div>' +
        '<p class="can-do"><strong>Học viên nói được:</strong> ' + esc(o.canDo) + '</p>' +
        progressBar(doneIn, p.to - p.from + 1) +
        '<a class="btn btn-sm" href="#/lessons?phase=' + p.number + '">Xem các buổi →</a></article>';
    }).join('');

    main.innerHTML =
      '<section class="hero"><div class="container">' +
        '<div class="hero-kicker">' + esc(h.kicker) + '</div>' +
        '<h1>' + esc(h.title) + ' <span>' + esc(h.subtitle) + '</span></h1>' +
        '<div class="hero-route">' + esc(h.route) + '</div>' +
        '<p class="hero-tagline">' + esc(h.tagline) + '</p>' +
        '<div class="hero-actions">' +
          '<a class="btn btn-primary" href="#/lesson/' + nl + '">' + (d ? 'Học tiếp buổi ' + nl : 'Bắt đầu buổi 1') + ' →</a>' +
          '<a class="btn" href="#/lessons">Xem lộ trình 36 buổi</a>' +
        '</div>' +
        '<dl class="info-grid">' + info + '</dl>' +
        '<div class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px"><strong>Tiến độ của bạn</strong><span class="muted">' +
          Math.round(d / LESSONS.length * 100) + '%</span></div>' + progressBar(d, LESSONS.length) + '</div>' +
      '</div></section>' +

      '<section class="section"><div class="container">' +
        '<div class="section-head"><h2>Tổng quan khóa học</h2></div>' +
        '<p>' + esc(C.overview.summary) + '</p>' +
        '<div class="table-wrap"><table><tbody>' + details + '</tbody></table></div>' +
      '</div></section>' +

      '<section class="section" style="padding-top:0"><div class="container">' +
        '<div class="section-head"><h2>' + esc(C.overview.outcomesTitle) + '</h2></div>' +
        '<div class="grid grid-4">' + phases + '</div>' +
        '<p class="muted" style="margin-top:12px;font-size:.9rem"><em>' + esc(C.overview.outcomesNote) + '</em></p>' +
      '</div></section>' +

      '<section class="section" style="padding-top:0"><div class="container">' +
        '<div class="section-head"><h2>Cấu trúc một buổi học 90 phút</h2></div>' +
        '<div class="card">' + structureBlock() + '</div>' +
      '</div></section>';
  }

  /* ---------- Lộ trình ---------- */
  function renderLessons(params) {
    var phaseFilter = params.phase ? parseInt(params.phase, 10) : 0;
    var view = params.view === 'table' ? 'table' : 'cards';
    var filterBtns = '<a class="btn btn-sm" aria-pressed="' + (!phaseFilter) + '" href="#/lessons' + (view === 'table' ? '?view=table' : '') + '">Tất cả</a>' +
      PHASES.map(function (p) {
        return '<a class="btn btn-sm" aria-pressed="' + (phaseFilter === p.number) + '" href="#/lessons?phase=' + p.number + (view === 'table' ? '&view=table' : '') + '">GĐ ' + p.number + ' · ' + esc(p.level) + '</a>';
      }).join('');
    var base = '#/lessons' + (phaseFilter ? '?phase=' + phaseFilter + '&' : '?');
    var viewBtns = '<a class="btn btn-sm" aria-pressed="' + (view === 'cards') + '" href="' + base.replace(/[?&]$/, '') + '">Dạng thẻ</a>' +
      '<a class="btn btn-sm" aria-pressed="' + (view === 'table') + '" href="' + base + 'view=table">Dạng bảng</a>';

    var phases = PHASES.filter(function (p) { return !phaseFilter || p.number === phaseFilter; });
    var body = phases.map(function (p) {
      var ls = LESSONS.filter(function (l) { return l.number >= p.from && l.number <= p.to; });
      var inner;
      if (view === 'table') {
        inner = '<div class="table-wrap"><table><thead><tr><th>Buổi</th><th>Chủ đề</th><th>Ngữ pháp trọng tâm</th><th>Sản phẩm speaking</th></tr></thead><tbody>' +
          ls.map(function (l) {
            return '<tr data-lesson="' + l.number + '"><td><strong>' + l.number + '</strong>' + (isDone(l.number) ? ' <span class="chip chip-done">✓</span>' : '') +
              '</td><td><a href="#/lesson/' + l.number + '">' + esc(l.title) + '</a><div class="muted" style="font-size:.85rem">' + esc(l.titleVi) + '</div></td><td>' +
              esc(l.grammarFocus) + '</td><td>' + esc(l.speakingProduct) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        inner = '<div class="grid grid-3">' + ls.map(function (l) { return '<div data-lesson="' + l.number + '">' + lessonCard(l) + '</div>'; }).join('') + '</div>';
      }
      return '<div class="phase-block p' + p.number + '"><div class="phase-banner"><div class="eyebrow">GIAI ĐOẠN ' + p.number + ' · ' + esc(p.level) + ' · BUỔI ' + p.from + '–' + p.to + '</div>' +
        '<h2>' + esc(p.title) + '</h2><p>' + esc(p.goal) + '</p></div>' + inner + '</div>';
    }).join('');

    main.innerHTML = '<section class="section"><div class="container">' +
      '<div class="section-head"><div><h1>Lộ trình 36 buổi</h1><p class="muted">' + esc(C.topicsIntro) + '</p></div></div>' +
      '<div class="filters" style="margin-bottom:10px">' + filterBtns + '</div>' +
      '<div class="filters"><input type="search" id="lesson-filter" placeholder="Lọc theo chủ đề, ngữ pháp…" aria-label="Lọc buổi học">' + viewBtns + '</div>' +
      body + '<p id="no-match" class="muted" hidden>Không có buổi nào khớp.</p></div></section>';

    var input = $('#lesson-filter');
    input.addEventListener('input', function () {
      var q = norm(input.value.trim());
      var any = false;
      $all('[data-lesson]').forEach(function (el) {
        var l = LESSONS[parseInt(el.getAttribute('data-lesson'), 10) - 1];
        var hay = norm([l.number, l.title, l.titleVi, l.grammarFocus, l.speakingProduct].join(' '));
        var show = !q || hay.indexOf(q) !== -1;
        el.hidden = !show; if (show) any = true;
      });
      $all('.phase-block').forEach(function (b) { b.hidden = !$all('[data-lesson]', b).some(function (x) { return !x.hidden; }); });
      $('#no-match').hidden = any;
    });
  }

  /* ---------- Trang bài học ---------- */
  var ICONS = { outcome: '◎', content: '☰', patterns: '❝', table: '⚙', vocab: 'Aa', dialogue: '💬', homework: '✎', flow: '⏱', test: '★' };

  function vocabItems(l) { return (l.extraVocab && l.extraVocab.length ? l.extraVocab : (l.coreVocabList || [])); }

  function renderLesson(n) {
    var l = LESSONS[n - 1];
    if (!l) { renderNotFound(); return; }
    var p = phaseOf(n);
    var sections = [];

    var outcomes = l.rows.filter(function (r) { return /^Đầu ra/.test(r.label); });
    if (outcomes.length) {
      sections.push({ id: 'muc-tieu', title: 'Mục tiêu đầu ra', icon: ICONS.outcome, html: outcomes.map(function (o) {
        return '<div class="card outcome"><div class="label">' + esc(o.label) + '</div><p>' + linkRefs(esc(o.value)) + '</p></div>';
      }).join('') });
    }

    var useCoreList = !!(l.coreVocabList && l.coreVocabList.length);
    var content = l.rows.filter(function (r) {
      return !/^Đầu ra/.test(r.label) && r.label !== 'Mẫu câu' && !(useCoreList && r.label === 'Từ vựng');
    });
    if (content.length) {
      sections.push({ id: 'noi-dung', title: 'Nội dung trọng tâm', icon: ICONS.content, html: '<div class="card"><dl class="def-list">' + content.map(function (r) {
        return '<div class="def-item"><dt>' + esc(r.label) + '</dt><dd>' + linkRefs(esc(r.value)) + '</dd></div>';
      }).join('') + '</dl></div>' });
    }

    if (l.patterns && l.patterns.length) {
      sections.push({ id: 'mau-cau', title: 'Mẫu câu', icon: ICONS.patterns, html: '<div class="card"><ul class="phrase-list">' + l.patterns.map(function (s) {
        return '<li>' + speakBtn(s) + '<span>' + esc(s) + '</span></li>';
      }).join('') + '</ul></div>' });
    }

    if (l.table) {
      var hdr = l.table.header;
      var last = hdr.length - 1;
      var exCols = hdr.map(function (h, i) { return /^(Ví dụ|Cặp luyện|Mẫu câu)$/.test(h) ? i : -1; }).filter(function (i) { return i >= 0; });
      var rows = l.table.rows.map(function (r) {
        return '<tr>' + r.map(function (c, i) {
          if (i === last && c !== '—') return '<td class="mistake">' + esc(c) + '</td>';
          if (exCols.indexOf(i) !== -1 && isEnglish(c)) return '<td><div class="cell-flex">' + speakBtn(c) + '<span>' + esc(c) + '</span></div></td>';
          return '<td>' + (i === 0 ? '<strong>' + esc(c) + '</strong>' : esc(c)) + '</td>';
        }).join('') + '</tr>';
      }).join('');
      var tTitle = hdr[0] === 'Nhóm âm' ? 'Ngữ âm & lỗi thường gặp' : (hdr[0] === 'Chức năng' ? 'Chức năng giao tiếp & lỗi thường gặp' : 'Cấu trúc & lỗi thường gặp');
      sections.push({ id: 'cau-truc', title: tTitle, icon: ICONS.table, html: '<div class="table-wrap"><table><thead><tr>' +
        hdr.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' });
    }

    var vItems = vocabItems(l);
    if (vItems.length) {
      var withMeaning = vItems.filter(function (v) { return v.meaning; }).length;
      sections.push({ id: 'tu-vung', title: useCoreList ? 'Từ vựng' : 'Từ vựng mở rộng', icon: ICONS.vocab,
        html: '<div class="card"><div class="dialog-tools">' +
          (withMeaning ? '<button type="button" class="btn btn-sm btn-primary" id="open-flash">Luyện thẻ ghi nhớ (' + withMeaning + ' từ có nghĩa)</button>' : '') +
          rateControl() + '</div><div class="word-grid">' + vItems.map(function (v) {
            return '<div class="word">' + speakBtn(v.term) + '<div><b>' + esc(v.term) + '</b>' + (v.meaning ? '<small>' + esc(v.meaning) + '</small>' : '') + '</div></div>';
          }).join('') + '</div></div>' });
    }

    if (l.dialogue && l.dialogue.length) {
      sections.push({ id: 'hoi-thoai', title: 'Hội thoại mẫu', icon: ICONS.dialogue,
        html: '<div class="card"><div class="dialog-tools">' +
          '<button type="button" class="btn btn-sm btn-primary tts-only" id="play-dialog">▶ Nghe cả đoạn</button>' +
          '<span class="muted" style="font-size:.88rem">Luyện nói – tôi đóng vai:</span>' +
          '<button type="button" class="btn btn-sm" data-role="A" aria-pressed="false">A</button>' +
          '<button type="button" class="btn btn-sm" data-role="B" aria-pressed="false">B</button>' +
          rateControl() + '</div>' +
          '<p class="muted" id="role-hint" style="font-size:.88rem" hidden>Câu của vai bạn chọn được ẩn đi. Khi bấm “Nghe cả đoạn”, máy đọc vai còn lại và dừng ở lượt của bạn để bạn tự nói; bấm vào ô ẩn để xem câu gốc.</p>' +
          '<div class="dialogue" id="dialogue"></div></div>' });
    }

    if (l.homework && l.homework.length) {
      var hw = store.get('cf.hw', {})[n] || {};
      sections.push({ id: 'bai-tap', title: 'Bài tập về nhà', icon: ICONS.homework,
        html: '<div class="card"><ul class="hw-list">' + l.homework.map(function (t) {
          return '<li><label><input type="checkbox" data-hw="' + esc(t.kind) + '"' + (hw[t.kind] ? ' checked' : '') + '><span><span class="kind">' + esc(t.kind) + ':</span>' + esc(t.text) + '</span></label></li>';
        }).join('') + '</ul>' + recorderHtml(n) + '</div>' });
    } else if (n === 36) {
      var t4 = C.assessment.tests[3];
      sections.push({ id: 'kiem-tra', title: 'Kiểm tra nói cuối khóa', icon: ICONS.test,
        html: '<div class="card"><dl class="def-list">' +
          '<div class="def-item"><dt>Hình thức</dt><dd>' + esc(t4.format) + '</dd></div>' +
          '<div class="def-item"><dt>Nội dung</dt><dd>' + esc(t4.content) + '</dd></div></dl>' +
          '<p style="margin-top:12px"><a class="btn btn-sm" href="#/assessment">Xem tiêu chí chấm và tự đánh giá →</a></p>' + recorderHtml(n) + '</div>' });
    }

    if (n !== 36) {
      sections.push({ id: 'tien-trinh', title: 'Tiến trình buổi học 90 phút', icon: ICONS.flow,
        html: '<details class="card"><summary>Xem cách một buổi 90 phút được tổ chức</summary>' + structureBlock() + '</details>' });
    }

    var prev = LESSONS[n - 2], next = LESSONS[n];
    var done = isDone(n);

    main.innerHTML =
      '<section class="lesson-hero p' + p.number + '"><div class="container">' +
        '<div class="crumbs"><a href="#/lessons">Lộ trình</a> › <a href="#/lessons?phase=' + p.number + '">Giai đoạn ' + p.number + ': ' + esc(p.title) + '</a></div>' +
        '<div class="chips">' + phaseChip(p) + '<span class="chip">Buổi ' + n + '/36</span></div>' +
        '<h1>' + esc(l.title) + '</h1><div class="vi">' + esc(l.titleVi) + '</div>' +
        '<dl class="lesson-summary"><div><dt>Ngữ pháp trọng tâm</dt><dd>' + esc(l.grammarFocus) + '</dd></div>' +
        '<div><dt>Sản phẩm speaking</dt><dd>' + esc(l.speakingProduct) + '</dd></div></dl>' +
        '<div class="lesson-actions"><button type="button" class="btn ' + (done ? 'btn-good' : 'btn-primary') + '" id="done-btn" aria-pressed="' + done + '">' +
          (done ? '✓ Đã hoàn thành' : 'Đánh dấu đã học xong') + '</button>' +
          '<button type="button" class="btn" onclick="window.print()">In / lưu PDF</button></div>' +
      '</div></section>' +
      '<div class="container lesson-layout p' + p.number + '">' +
        '<nav class="toc" aria-label="Mục lục buổi học"><div class="toc-title">Trong buổi này</div><ol>' +
          sections.map(function (s) { return '<li><a href="#/lesson/' + n + '" data-jump="' + s.id + '">' + esc(s.title) + '</a></li>'; }).join('') +
        '</ol></nav>' +
        '<div class="lesson-body">' +
          sections.map(function (s) {
            return '<section id="' + s.id + '"><h2><span class="ic" aria-hidden="true">' + s.icon + '</span>' + esc(s.title) + '</h2>' + s.html + '</section>';
          }).join('') +
          '<nav class="pager" aria-label="Chuyển buổi">' +
            (prev ? '<a class="card prev" href="#/lesson/' + prev.number + '"><small>← Buổi ' + prev.number + '</small>' + esc(prev.title) + '</a>' : '<span></span>') +
            (next ? '<a class="card next" href="#/lesson/' + next.number + '"><small>Buổi ' + next.number + ' →</small>' + esc(next.title) + '</a>' : '') +
          '</nav>' +
        '</div>' +
      '</div>';

    // Mục lục: cuộn tới phần tương ứng
    $all('[data-jump]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = document.getElementById(a.getAttribute('data-jump'));
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            $all('.toc a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-jump') === en.target.id); });
          }
        });
      }, { rootMargin: '-80px 0px -60% 0px' });
      $all('.lesson-body > section').forEach(function (s) { io.observe(s); });
    }

    $('#done-btn').addEventListener('click', function () {
      var nowDone = toggleDone(n);
      toast(nowDone ? 'Đã đánh dấu hoàn thành buổi ' + n : 'Đã bỏ đánh dấu buổi ' + n);
      renderLesson(n);
    });

    $all('[data-hw]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var all = store.get('cf.hw', {});
        all[n] = all[n] || {};
        all[n][cb.getAttribute('data-hw')] = cb.checked;
        store.set('cf.hw', all);
      });
    });

    var fb = $('#open-flash');
    if (fb) fb.addEventListener('click', function () {
      openModal('<h2 id="modal-title">Thẻ ghi nhớ – Buổi ' + n + '</h2><div id="flash-host"></div>');
      mountFlashcards($('#flash-host'), vItems.filter(function (v) { return v.meaning; }).map(function (v) { return { term: v.term, meaning: v.meaning, lesson: n }; }));
    });

    if (l.dialogue && l.dialogue.length) setupDialogue(l);
    setupRecorder(n);
  }

  /* ---------- Hội thoại & luyện nói theo vai ---------- */
  function setupDialogue(l) {
    var host = $('#dialogue');
    var role = null, playing = false, timer = null, revealed = {};

    function draw(activeIdx) {
      host.innerHTML = l.dialogue.map(function (d, i) {
        var hide = role === d.speaker && !revealed[i];
        var inner = hide
          ? '<span>Lượt của bạn — bấm để xem câu gốc</span>'
          : speakBtn(d.speak, d.speak) + '<span>' + (d.note ? '<span class="note">(' + esc(d.note) + ')</span>' : '') + esc(d.speak) + '</span>';
        return '<div class="bubble-row ' + d.speaker + '"><span class="avatar" aria-hidden="true">' + d.speaker + '</span>' +
          '<div class="bubble' + (hide ? ' hidden-line' : '') + (i === activeIdx ? ' active' : '') + '" data-line="' + i + '"' + (hide ? ' role="button" tabindex="0"' : '') + '>' + inner + '</div></div>';
      }).join('');
    }
    draw(-1);

    host.addEventListener('click', function (e) {
      var b = e.target.closest('.hidden-line');
      if (b) { revealed[b.getAttribute('data-line')] = true; draw(-1); }
    });
    host.addEventListener('keydown', function (e) {
      var b = e.target.closest('.hidden-line');
      if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); revealed[b.getAttribute('data-line')] = true; draw(-1); }
    });

    $all('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var r = btn.getAttribute('data-role');
        role = role === r ? null : r;
        revealed = {};
        $all('[data-role]').forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-role') === role)); });
        $('#role-hint').hidden = !role;
        stop(); draw(-1);
      });
    });

    var playBtn = $('#play-dialog');
    function stop() {
      playing = false; clearTimeout(timer);
      if (TTS.ok) speechSynthesis.cancel();
      if (playBtn) playBtn.textContent = '▶ Nghe cả đoạn';
    }
    function step(i) {
      if (!playing) return;
      if (i >= l.dialogue.length) { stop(); draw(-1); return; }
      draw(i);
      var d = l.dialogue[i];
      if (role === d.speaker) {
        // Dừng để học viên tự nói lượt của mình (thời gian ước theo độ dài câu)
        var words = d.speak.split(/\s+/).length;
        timer = setTimeout(function () { step(i + 1); }, 1500 + words * 500);
      } else {
        speak(d.speak, { onend: function () { timer = setTimeout(function () { step(i + 1); }, 350); } });
      }
    }
    if (playBtn) playBtn.addEventListener('click', function () {
      if (playing) { stop(); draw(-1); return; }
      playing = true; playBtn.textContent = '■ Dừng'; step(0);
    });
    window.addEventListener('hashchange', stop, { once: true });
  }

  /* ---------- Ghi âm bài nói (chỉ lưu trên máy) ---------- */
  function recorderHtml(n) {
    return '<div class="recorder" id="recorder" data-lesson="' + n + '"><strong>Ghi âm phần nói</strong>' +
      '<p class="muted" style="margin:0;font-size:.9rem">Thu âm ngay trên trình duyệt, nghe lại và tải file về để gửi giáo viên. Bản ghi không được tải lên đâu cả.</p>' +
      '<div class="recorder-row"><button type="button" class="btn btn-sm btn-primary" id="rec-btn">● Bắt đầu ghi</button>' +
      '<span class="rec-time" id="rec-time">0:00</span><span id="rec-status" class="muted" style="font-size:.88rem"></span></div>' +
      '<div id="rec-output"></div></div>';
  }
  function setupRecorder(n) {
    var btn = $('#rec-btn');
    if (!btn) return;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) {
      btn.disabled = true;
      $('#rec-status').textContent = 'Trình duyệt này không hỗ trợ ghi âm. Bạn có thể dùng ứng dụng ghi âm của điện thoại.';
      return;
    }
    var rec = null, chunks = [], start = 0, tick = null, stream = null;
    function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function stopAll() {
      clearInterval(tick);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    }
    btn.addEventListener('click', function () {
      if (rec && rec.state === 'recording') { rec.stop(); return; }
      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
        stream = s; chunks = [];
        var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        var type = types.filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0];
        rec = type ? new MediaRecorder(s, { mimeType: type }) : new MediaRecorder(s);
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          stopAll();
          var mime = rec.mimeType || 'audio/webm';
          var blob = new Blob(chunks, { type: mime });
          var url = URL.createObjectURL(blob);
          var ext = /mp4/.test(mime) ? 'm4a' : (/ogg/.test(mime) ? 'ogg' : 'webm');
          $('#rec-output').innerHTML = '<div class="recorder-row"><audio controls src="' + url + '"></audio>' +
            '<a class="btn btn-sm" download="buoi-' + n + '-ghi-am.' + ext + '" href="' + url + '">Tải file ghi âm</a></div>';
          btn.textContent = '● Ghi lại'; $('#rec-status').textContent = 'Đã ghi ' + fmt(Date.now() - start);
        };
        rec.start();
        start = Date.now();
        btn.textContent = '■ Dừng ghi';
        $('#rec-status').innerHTML = '<span class="rec-dot" style="display:inline-block"></span> Đang ghi…';
        tick = setInterval(function () { $('#rec-time').textContent = fmt(Date.now() - start); }, 250);
        window.addEventListener('hashchange', function () { if (rec && rec.state === 'recording') rec.stop(); stopAll(); }, { once: true });
      }).catch(function () {
        $('#rec-status').textContent = 'Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt.';
      });
    });
  }

  /* ---------- Thẻ ghi nhớ ---------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function mountFlashcards(host, items, opts) {
    opts = opts || {};
    var dir = opts.dir || 'en';
    var deck = shuffle(items), idx = 0, known = 0, again = [];
    function draw() {
      if (!deck.length) { host.innerHTML = '<p class="muted">Không có từ nào trong phạm vi này.</p>'; return; }
      if (idx >= deck.length) {
        host.innerHTML = '<div class="card" style="text-align:center"><h3>Xong một lượt!</h3><p>Đã nhớ ' + known + '/' + deck.length + ' từ.</p>' +
          '<div class="flash-controls">' + (again.length ? '<button type="button" class="btn btn-primary" id="fl-again">Ôn lại ' + again.length + ' từ chưa nhớ</button>' : '') +
          '<button type="button" class="btn" id="fl-restart">Trộn và làm lại</button></div></div>';
        var a = $('#fl-again', host); if (a) a.onclick = function () { deck = shuffle(again); idx = 0; known = 0; again = []; draw(); };
        $('#fl-restart', host).onclick = function () { deck = shuffle(items); idx = 0; known = 0; again = []; draw(); };
        return;
      }
      var it = deck[idx];
      var front = dir === 'en' ? it.term : it.meaning;
      var back = dir === 'en' ? it.meaning : it.term;
      host.innerHTML =
        '<div class="flashcard" id="fl-card" tabindex="0" role="button" aria-label="Lật thẻ">' +
          '<div class="flashcard-inner">' +
            '<div class="flash-face flash-front"><div><div class="big">' + esc(front) + '</div><div class="hint">Buổi ' + it.lesson + ' · bấm để lật thẻ</div></div></div>' +
            '<div class="flash-face flash-back"><div><div class="big">' + esc(back) + '</div><div class="hint">' + esc(front) + '</div></div></div>' +
          '</div></div>' +
        '<div class="flash-controls">' + speakBtn(it.term) +
          '<button type="button" class="btn" id="fl-no">Chưa nhớ</button>' +
          '<button type="button" class="btn btn-good" id="fl-yes">Đã nhớ ✓</button></div>' +
        '<div class="flash-stats">Thẻ ' + (idx + 1) + '/' + deck.length + ' · đã nhớ ' + known + '</div>';
      var card = $('#fl-card', host);
      function flip() { card.classList.toggle('flipped'); }
      card.onclick = flip;
      card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } };
      $('#fl-yes', host).onclick = function () { known++; idx++; draw(); };
      $('#fl-no', host).onclick = function () { again.push(it); idx++; draw(); };
    }
    draw();
  }

  function allVocab() {
    var out = [];
    LESSONS.forEach(function (l) {
      vocabItems(l).forEach(function (v) { if (v.meaning) out.push({ term: v.term, meaning: v.meaning, lesson: l.number }); });
    });
    return out;
  }

  function renderReview(params) {
    var scope = params.scope || 'all';
    var dir = params.dir === 'vi' ? 'vi' : 'en';
    var all = allVocab();
    var items = all.filter(function (v) {
      if (scope === 'all') return true;
      if (/^p\d$/.test(scope)) { var p = PHASES[parseInt(scope.slice(1), 10) - 1]; return v.lesson >= p.from && v.lesson <= p.to; }
      return String(v.lesson) === scope;
    });
    var lessonsWithVocab = LESSONS.filter(function (l) { return vocabItems(l).some(function (v) { return v.meaning; }); });
    main.innerHTML = '<section class="section"><div class="container">' +
      '<div class="section-head"><div><h1>Ôn từ vựng</h1><p class="muted">Thẻ ghi nhớ lấy từ các mục “Từ vựng mở rộng” (buổi 1–27) và “Từ vựng” (buổi 28–35), chỉ gồm những từ có nghĩa tiếng Việt trong syllabus. Tổng cộng ' + all.length + ' thẻ.</p></div></div>' +
      '<div class="card" style="margin-bottom:20px"><form class="flash-setup" id="flash-form">' +
        '<label>Phạm vi<select name="scope"><option value="all">Toàn khóa</option>' +
          PHASES.map(function (p) { return '<option value="p' + p.number + '"' + (scope === 'p' + p.number ? ' selected' : '') + '>Giai đoạn ' + p.number + ' (buổi ' + p.from + '–' + p.to + ')</option>'; }).join('') +
          lessonsWithVocab.map(function (l) { return '<option value="' + l.number + '"' + (scope === String(l.number) ? ' selected' : '') + '>Buổi ' + l.number + ': ' + esc(l.title) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>Chiều luyện<select name="dir"><option value="en">Anh → Việt</option><option value="vi"' + (dir === 'vi' ? ' selected' : '') + '>Việt → Anh</option></select></label>' +
        rateControl() +
      '</form></div><div id="flash-host"></div></div></section>';
    var form = $('#flash-form');
    form.addEventListener('change', function (e) {
      if (e.target.name === 'scope' || e.target.name === 'dir') location.hash = '#/review?scope=' + form.scope.value + '&dir=' + form.dir.value;
    });
    mountFlashcards($('#flash-host'), items, { dir: dir });
  }

  /* ---------- Kiểm tra đánh giá ---------- */
  function renderAssessment() {
    var A = C.assessment;
    var lessonFor = [9, 18, 27, 36];
    var self = store.get('cf.self', {});
    var tests = A.tests.map(function (t, i) {
      var n = lessonFor[i];
      return '<article class="card test-card p' + (i + 1) + '"><span class="n">' + t.number + '</span><strong>' + esc(t.when) + '</strong>' +
        '<div><span class="muted">Hình thức:</span> ' + esc(t.format) + '</div><div><span class="muted">Nội dung:</span> ' + esc(t.content) + '</div>' +
        '<a class="btn btn-sm" style="margin-top:auto;align-self:flex-start" href="#/lesson/' + n + '">Đến buổi ' + n + ' →</a></article>';
    }).join('');
    var rubric = A.rubric.map(function (r) { return '<tr><th scope="row">' + esc(r.criterion) + '</th><td>' + esc(r.minimum) + '</td></tr>'; }).join('');

    var selfTabs = A.tests.map(function (t) {
      return '<option value="' + t.number + '">Lần ' + t.number + ' – ' + esc(t.when) + '</option>';
    }).join('');

    main.innerHTML = '<section class="section"><div class="container">' +
      '<div class="section-head"><div><h1>Kiểm tra đánh giá</h1><p class="muted">' + esc(A.intro) + '</p></div></div>' +
      '<div class="grid grid-4">' + tests + '</div>' +
      '<h2 style="margin-top:32px">' + esc(A.rubricTitle) + '</h2>' +
      '<div class="table-wrap"><table><thead><tr>' + A.rubricHeader.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + rubric + '</tbody></table></div>' +
      '<h2 style="margin-top:32px">Tự đánh giá trước khi kiểm tra</h2>' +
      '<div class="card"><p class="muted" style="font-size:.92rem">Kéo thanh để tự chấm mình theo 5 tiêu chí ở trên (1–5 điểm). Đây chỉ là công cụ tự theo dõi, lưu trên trình duyệt của bạn; điểm chính thức do giáo viên chấm trong buổi kiểm tra.</p>' +
        '<label style="display:inline-grid;gap:4px;margin-bottom:14px;font-size:.88rem" class="muted">Lần kiểm tra<select id="self-test" style="padding:8px 10px;border-radius:10px;border:1px solid var(--border);background:var(--surface)">' + selfTabs + '</select></label>' +
        '<div class="self-eval" id="self-eval"></div>' +
        '<p class="self-total" id="self-total" style="margin-top:14px"></p></div>' +
    '</div></section>';

    var sel = $('#self-test'), host = $('#self-eval');
    function draw() {
      var key = sel.value, vals = self[key] || {};
      host.innerHTML = A.rubric.map(function (r, i) {
        var v = vals[i] || 0;
        return '<div class="self-row"><span class="crit">' + esc(r.criterion) + '</span>' +
          '<input type="range" min="0" max="5" step="1" value="' + v + '" data-i="' + i + '" aria-label="' + esc(r.criterion) + '">' +
          '<output>' + (v || '–') + '</output></div>';
      }).join('');
      total();
    }
    function total() {
      var vals = self[sel.value] || {};
      var scored = A.rubric.filter(function (_, i) { return vals[i]; }).length;
      var sum = A.rubric.reduce(function (s, _, i) { return s + (vals[i] || 0); }, 0);
      $('#self-total').textContent = scored ? 'Tổng tự chấm: ' + sum + '/' + (A.rubric.length * 5) + (scored < A.rubric.length ? ' (mới chấm ' + scored + '/' + A.rubric.length + ' tiêu chí)' : '') : 'Chưa tự chấm lần này.';
    }
    host.addEventListener('input', function (e) {
      if (!e.target.matches('input[type=range]')) return;
      var key = sel.value, i = e.target.getAttribute('data-i'), v = parseInt(e.target.value, 10);
      self[key] = self[key] || {};
      self[key][i] = v;
      store.set('cf.self', self);
      e.target.nextElementSibling.textContent = v || '–';
      total();
    });
    sel.addEventListener('change', draw);
    draw();
  }

  /* ---------- Tìm kiếm ---------- */
  function highlight(text, q) {
    var nq = norm(q);
    var map = [], ns = '';
    for (var i = 0; i < text.length; i++) { var c = normChar(text[i]); for (var k = 0; k < c.length; k++) map.push(i); ns += c; }
    var out = '', last = 0, from = 0, pos;
    while (nq && (pos = ns.indexOf(nq, from)) !== -1) {
      var s = map[pos], e = map[pos + nq.length - 1] + 1;
      out += esc(text.slice(last, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
      last = e; from = pos + nq.length;
    }
    return out + esc(text.slice(last));
  }
  function searchFields(l) {
    var f = [
      ['Chủ đề', l.title + ' – ' + l.titleVi],
      ['Ngữ pháp trọng tâm', l.grammarFocus],
      ['Sản phẩm speaking', l.speakingProduct]
    ];
    l.rows.forEach(function (r) { f.push([r.label, r.value]); });
    if (l.extraVocabText) f.push(['Từ vựng mở rộng', l.extraVocabText]);
    if (l.table) l.table.rows.forEach(function (r) { f.push([l.table.header[0], r.join(' · ')]); });
    l.dialogue.forEach(function (d) { f.push(['Hội thoại ' + d.speaker, d.speak]); });
    l.homework.forEach(function (h) { f.push(['Bài tập – ' + h.kind, h.text]); });
    return f;
  }
  function renderSearch(params) {
    var q = (params.q || '').trim();
    $('#search-input').value = q;
    var results = [];
    if (q) {
      var nq = norm(q);
      LESSONS.forEach(function (l) {
        var hits = searchFields(l).filter(function (f) { return norm(f[1]).indexOf(nq) !== -1; });
        if (hits.length) results.push({ l: l, hits: hits });
      });
    }
    main.innerHTML = '<section class="section"><div class="container">' +
      '<h1>Tìm kiếm</h1><p class="muted">' + (q ? 'Có ' + results.length + ' buổi khớp với “' + esc(q) + '”.' : 'Nhập từ khóa vào ô tìm kiếm phía trên.') + '</p>' +
      '<div class="grid">' + results.map(function (r) {
        var p = phaseOf(r.l.number);
        return '<a class="card result lesson-card p' + p.number + '" href="#/lesson/' + r.l.number + '"><span class="num">BUỔI ' + r.l.number + '</span><h3>' + esc(r.l.title) +
          ' <span class="muted" style="font-weight:400">– ' + esc(r.l.titleVi) + '</span></h3><ul>' +
          r.hits.slice(0, 4).map(function (h) { return '<li><strong>' + esc(h[0]) + ':</strong> ' + highlight(h[1], q) + '</li>'; }).join('') +
          (r.hits.length > 4 ? '<li>… và ' + (r.hits.length - 4) + ' chỗ khác</li>' : '') + '</ul></a>';
      }).join('') + '</div></div></section>';
  }

  function renderNotFound() {
    main.innerHTML = '<section class="section"><div class="container"><h1>Không tìm thấy trang</h1><p><a href="#/">Về trang chủ</a></p></div></section>';
  }

  /* ---------- Modal ---------- */
  var modal = $('#modal'), lastFocus = null;
  function openModal(html) {
    lastFocus = document.activeElement;
    $('#modal-body').innerHTML = html;
    modal.hidden = false;
    $('.modal-close', modal).focus();
  }
  function closeModal() {
    modal.hidden = true; $('#modal-body').innerHTML = '';
    if (TTS.ok) speechSynthesis.cancel();
    if (lastFocus) lastFocus.focus();
  }
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  /* ---------- Router ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?');
    var path = qi === -1 ? h : h.slice(0, qi);
    var params = {};
    if (qi !== -1) h.slice(qi + 1).split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    return { path: path, params: params };
  }
  function route() {
    if (TTS.ok) speechSynthesis.cancel();
    if (!modal.hidden) closeModal();
    var r = parseHash(), seg = r.path.split('/').filter(Boolean);
    var nav = seg[0] || 'home';
    if (nav === 'lesson') nav = 'lessons';
    $all('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-nav') === nav); });

    if (!seg.length) renderHome();
    else if (seg[0] === 'lessons') renderLessons(r.params);
    else if (seg[0] === 'lesson') renderLesson(parseInt(seg[1], 10));
    else if (seg[0] === 'review') renderReview(r.params);
    else if (seg[0] === 'assessment') renderAssessment();
    else if (seg[0] === 'search') renderSearch(r.params);
    else renderNotFound();

    var titles = { lesson: function () { var l = LESSONS[parseInt(seg[1], 10) - 1]; return l ? 'Buổi ' + l.number + ': ' + l.title : ''; },
      lessons: function () { return 'Lộ trình 36 buổi'; }, review: function () { return 'Ôn từ vựng'; },
      assessment: function () { return 'Kiểm tra đánh giá'; }, search: function () { return 'Tìm kiếm'; } };
    var t = seg[0] && titles[seg[0]] ? titles[seg[0]]() : '';
    document.title = (t ? t + ' · ' : '') + 'Tiếng Anh Giao Tiếp Foundation';
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  /* ---------- Khởi động ---------- */
  $('#source-link').href = C.source.url;
  $('#search-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var q = $('#search-input').value.trim();
    if (q) location.hash = '#/search?q=' + encodeURIComponent(q);
  });
  $('#theme-toggle').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('cf.theme', next); } catch (e) {}
  });
  window.addEventListener('hashchange', route);
  route();
})();
