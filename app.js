/* ГЕОС · прототип маршрута 17а. Без сборки и без сервера: всё работает офлайн после первого открытия. */
(function () {
  'use strict';
  var KEY = 'geos.v3.17a';
  var app = document.getElementById('app');
  var R = null;               // маршрут
  var offlineReady = false;
  var wake = null;
  var cv = { seg: -1, qi: 0, badge: false };   // что открыто в карточке
  var ck = null;              // проверка через 7 дней
  var DAY = 864e5;

  var GOOSE = {
    hello: ['Га! Я гусь ГЕОС. Поехали смотреть в окно?', 'Окно автобуса — лучший экран в городе.', 'Новгород рассказывает о себе. Надо только заметить.'],
    ok: ['Га-га! Точно в цель.', 'Вот это наблюдательность!', 'Верно! Ты читаешь город как учёный.', 'Именно так. Записываю в дневник.', 'Отлично! Ещё немного — и в экспедицию.'],
    bad: ['Не страшно, учёные тоже ошибаются. Прочитай объяснение.', 'Почти! Посмотри, почему так.', 'Га… Запомни это — пригодится в финале.'],
    open: ['Интересная мысль. Тут нет одного верного ответа.', 'Хорошее наблюдение! Его можно обсудить в классе.'],
    seg: ['Профессия в коллекции! Смотри в окно дальше.', 'Ещё одна профессия твоя.', 'Новый значок! Едем к следующей остановке.'],
    fin: ['Ты прошёл маршрут целиком. Горжусь, га!', 'Весь маршрут! Город теперь знает тебя тоже.']
  };
  var EGG = ['Га?', 'Га-га?', 'Щекотно!', 'Ну хватит…', 'Ладно, секрет: в Новгороде гуси жили задолго до автобусов. 🪶'];

  // ---------- хранилище ----------
  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && typeof s === 'object') return s; } catch (e) {}
    return null;
  }
  var S = load() || { start: null, cur: null, ans: {}, done: [], fin: null, checks: [], egg: 0 };
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- утилиты ----------
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function seg(i) { return R.segments[i]; }
  function k(si, qi) { return si + '-' + qi; }
  function order(n, seed) {      // стабильное перемешивание вариантов
    var a = []; for (var i = 0; i < n; i++) a.push(i);
    var x = seed * 9301 + 49297;
    for (var j = n - 1; j > 0; j--) { x = (x * 9301 + 49297) % 233280; var r = Math.floor(x / 233280 * (j + 1)); var t = a[j]; a[j] = a[r]; a[r] = t; }
    return a;
  }
  function segDone(i) { return S.done.indexOf(i) >= 0; }
  function closedTotal() { var n = 0; R.segments.forEach(function (s) { s.qs.forEach(function (q) { if (q.c !== null) n++; }); }); return n; }
  function stats() {
    var ok = 0, closed = 0;
    Object.keys(S.ans).forEach(function (key) { var a = S.ans[key]; if (a.ok !== null) { closed++; if (a.ok) ok++; } });
    return { ok: ok, closed: closed, jobs: S.done.length };
  }
  function lastSeg() { return R.segments.length - 1; }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function top() { window.scrollTo(0, 0); }
  function toast(t) {
    var d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 2200);
  }
  function goose(text, cls) {
    return '<div class="goose ' + (cls || '') + '"><img src="goose.svg" alt="Гусь ГЕОС" data-goose><div class="say">' + esc(text) + '</div></div>';
  }
  function setSeg(c) { document.documentElement.style.setProperty('--seg', c); }
  function btn(label, act, cls, dis) { return '<button class="btn ' + (cls || '') + '" data-act="' + act + '"' + (dis ? ' disabled' : '') + '>' + label + '</button>'; }
  function line(upto) {
    var h = '<div class="line" aria-hidden="true">';
    R.segments.forEach(function (s, i) {
      h += '<b class="' + (segDone(i) ? 'on' : '') + '"></b><i class="' + (segDone(i) ? 'on' : '') + '" style="background:' + s.color + '"></i>';
    });
    return h + '<b></b></div>';
  }
  function collection() {
    var h = '<div class="grid">';
    R.segments.forEach(function (s, i) {
      var on = segDone(i);
      h += '<div class="gc' + (on ? '' : ' lock') + '"><div class="bi" style="background:' + s.color + '">' + (on ? s.icon : '?') + '</div>' + (on ? esc(s.job[0]) : 'ещё не открыта') + '</div>';
    });
    return h + '</div>';
  }
  function checkDue() { return S.fin && Date.now() - S.fin >= 7 * DAY && !S.checks.some(function (c) { return c.at > S.fin; }); }
  function inTrip() { return S.cur !== null && !S.fin; }

  // ---------- экраны ----------
  function home() {
    setSeg('#2EC4B6');
    var st = stats();
    var h = '<section class="screen">';
    h += '<div class="top"><div class="brand"><img class="gbox" src="goose.svg" alt="Гусь ГЕОС" data-goose><p class="u" style="font-size:20px;font-weight:700">ГЕОС</p></div><p class="eyebrow">Наука за окном</p></div>';
    h += '<h1 class="u h1">Поездка —<br>это лекция</h1>';
    h += '<p class="lead">Едешь на 17а? Смотри в окно, отвечай на вопросы и собирай профессии учёных, которые изучают город.</p>';
    if (checkDue()) h += '<button class="plaque" data-act="check"><p class="u" style="font-size:15px;font-weight:700">Проверь себя · 3 вопроса</p><p style="font-size:13px;font-weight:700">Прошла неделя. Что ты запомнил?</p></button>';
    h += '<div class="card"><div class="row"><span class="u num">' + esc(R.number) + '</span><div style="flex:1"><p style="font-size:15px;font-weight:800">' + esc(R.title) + '</p><p style="font-size:12px;color:var(--mu)">' + R.segments.length + ' участков · ' + closedTotal() + ' вопросов + 1 на размышление · ' + esc(R.duration) + '</p></div><span class="pill">ПИЛОТ</span></div>';
    h += '<p class="eyebrow" style="margin-top:14px">Сквозной вопрос</p><p style="font-size:16px;font-weight:700;margin-top:4px;line-height:1.35">' + esc(R.theme) + '</p>';
    h += line();
    h += '<div style="display:flex;justify-content:space-between;margin-top:12px"><p style="font-size:12px;font-weight:800;color:' + (offlineReady ? 'var(--te)' : 'var(--mu)') + '">' + (offlineReady ? '✓ Сохранён · работает без интернета' : '⟳ Сохраняется для офлайна…') + '</p><p style="font-size:12px;color:var(--mu)">' + S.done.length + ' / ' + R.segments.length + '</p></div></div>';
    h += '<div class="tiles"><div class="tile"><p class="u" style="font-size:12px;color:var(--te)">НАЙДИ</p><p>объект за окном</p></div><div class="tile"><p class="u" style="font-size:12px;color:var(--am)">ЗАМЕТЬ</p><p>как меняется город</p></div><div class="tile"><p class="u" style="font-size:12px;color:#C77DFF">ПОДУМАЙ</p><p>почему он такой</p></div></div>';
    h += '<p class="eyebrow" style="margin-top:20px">Коллекция профессий · ' + S.done.length + ' из ' + R.segments.length + '</p>' + collection();
    h += '<button class="bar dash" data-go="#/diary"><span style="font-size:13px;color:var(--mu)">Дневник · ' + Object.keys(S.ans).length + ' записей</span><span style="font-size:13px;font-weight:700">Открыть →</span></button>';
    h += '<button class="bar" data-go="#/about"><span style="font-size:13px;color:var(--mu)">О проекте и правилах</span><span style="font-size:13px;font-weight:700">→</span></button>';
    h += goose(S.done.length ? 'С возвращением! ' + (S.fin ? 'Можно пройти маршрут ещё раз.' : 'Продолжим с того места, где остановились?') : pick(GOOSE.hello));
    if (inTrip()) h += '<p style="text-align:center;margin-top:14px"><button class="link" data-act="reset">Начать маршрут заново</button></p>';
    h += btn(inTrip() ? 'Продолжить поездку' : (S.fin ? 'Пройти ещё раз' : 'Поехали'), inTrip() ? 'trip' : 'begin');
    return h + '</section>';
  }

  var chosen = null;
  function start() {
    setSeg('#FF6A3D');
    var h = '<section class="screen"><div class="top"><button class="link" data-go="#/">← Назад</button><p class="eyebrow">17А · ШАГ 1</p></div>';
    h += '<h1 class="u h1" style="font-size:24px">Где ты сел?</h1><p class="lead">Выбери остановку, с которой начинаешь. Маршрут подстроится.</p><div style="margin-top:12px">';
    for (var i = 0; i < lastSeg(); i++) {
      var s = seg(i);
      h += '<button class="stop' + (chosen === i ? ' sel' : '') + '" data-stop="' + i + '"><span class="dot" style="background:' + s.color + '"></span><span style="flex:1"><span style="display:block;font-weight:800;font-size:15px">' + esc(s.from) + '</span><span style="font-size:12px;color:var(--mu)">' + (R.segments.length - i) + ' участков до конца · ' + esc(s.title) + '</span></span>' + (i === 0 ? '<span class="pill" style="color:var(--te);border-color:var(--te)">НАЧАЛО</span>' : '') + '</button>';
    }
    h += '</div><p style="font-size:13px;color:var(--mu);margin-top:14px;text-align:center">Не гаси экран до конца поездки 🔆</p>';
    h += btn('Поехали', 'go', '', chosen === null);
    return h + '</section>';
  }

  function trip() {
    if (S.cur === null) { go('#/start'); return ''; }
    var c = S.cur, s = seg(c);
    setSeg(s.color);
    var n = R.segments.length - S.start, kk = c - S.start + 1;
    var h = '<section class="screen"><div class="top"><p class="eyebrow">17А · Участок ' + kk + ' из ' + n + '</p><button class="link" data-act="finish">Закончить</button></div>';
    h += '<div class="prog"><i style="width:' + Math.round((kk - (segDone(c) ? 0 : 1)) / n * 100) + '%"></i></div>';
    h += '<div class="hero"><span class="ic">' + s.icon + '</span><p class="eyebrow" style="color:rgba(14,22,38,.7)">' + esc(s.from) + (s.to !== s.from ? ' → ' + esc(s.to) : '') + '</p>';
    h += '<p class="u t">' + esc(s.title) + '</p><p class="look">👁 ' + esc(s.look) + '</p>';
    if (segDone(c)) h += '<div class="done">✓ Пройдено · ' + esc(s.job[0]) + ' в коллекции</div><button class="open" data-card="' + c + '" style="margin-top:8px;background:rgba(14,22,38,.85)">Открыть ещё раз</button>';
    else h += '<button class="open" data-card="' + c + '">Открыть карточку · ' + s.qs.length + ' ' + (s.qs.length > 1 ? 'вопроса' : 'вопрос') + '</button>';
    h += '</div><div class="tl">';
    for (var i = S.start; i < R.segments.length; i++) {
      var x = seg(i), d = segDone(i), cur = i === c, last = i === lastSeg();
      var nd = cur ? 'background:var(--pr)' : d ? 'background:' + x.color : 'background:var(--bg);border-color:var(--s2)';
      h += '<div class="tli">' + (last ? '' : '<div class="ln" style="background:' + (d ? x.color : 'var(--s2)') + '"></div>') + '<div class="nd ' + (cur ? 'pulse' : '') + '" style="' + nd + '"></div><div><p class="nm" style="' + (cur ? 'font-weight:800' : d ? '' : 'color:var(--mu)') + '">' + esc(x.from) + '</p>' + (d ? '<p class="sb">' + x.icon + ' ' + esc(x.title) + ' · ✓</p>' : cur ? '<p class="sb" style="color:var(--so)">ты здесь</p>' : '') + '</div></div>';
    }
    h += '</div>';
    if (!segDone(c)) h += goose(c === S.start ? 'Открой карточку, пока едем до следующей остановки.' : 'Новая остановка — новая загадка. Открывай!');
    var lastNow = c === lastSeg();
    h += btn(lastNow ? 'Завершить маршрут 🏁' : 'Следующая остановка →', 'next', segDone(c) ? '' : 'ghost');
    return h + '</section>';
  }

  function card(si) {
    var s = seg(si); if (!s) { go('#/trip'); return ''; }
    setSeg(s.color);
    if (cv.seg !== si) { cv = { seg: si, qi: 0, badge: false }; }
    var h = '<section class="screen"><div class="top"><button class="link" data-go="#/trip">← К поездке</button><p class="eyebrow" style="color:' + s.color + '">' + (si + 1) + ' / ' + R.segments.length + '</p></div>';
    if (cv.badge) {
      var st = stats();
      h += '<p class="eyebrow" style="margin-top:22px;text-align:center">Участок пройден</p>';
      h += '<div style="text-align:center;margin-top:14px"><div class="bi" style="width:96px;height:96px;font-size:48px;border-radius:30px;margin:0 auto;animation:pop .6s cubic-bezier(.2,1.6,.4,1) both">' + s.icon + '</div></div>';
      h += '<p class="u" style="font-size:22px;font-weight:700;text-align:center;margin-top:16px">' + esc(s.job[0]) + '</p>';
      h += '<p style="text-align:center;color:var(--so);font-size:15px;margin-top:6px">' + esc(s.job[1]) + '</p>';
      h += '<div class="card" style="text-align:center"><p class="eyebrow">Главное с этого участка</p><p style="font-weight:800;margin-top:4px">' + esc(s.takeaway) + '</p></div>';
      h += '<p class="eyebrow" style="margin-top:18px">Коллекция · ' + S.done.length + ' из ' + R.segments.length + '</p>' + collection();
      h += goose(pick(GOOSE.seg));
      h += btn(si === lastSeg() ? 'К итогам маршрута 🏁' : 'Вернуться к поездке', si === lastSeg() ? 'final' : 'back');
      return h + '</section>';
    }
    var qi = cv.qi, q = s.qs[qi], a = S.ans[k(si, qi)];
    var mc = { 'Найди': '#2EC4B6', 'Заметь': '#FFB547', 'Подумай': '#C77DFF' }[q.m] || s.color;
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px"><span class="tag" style="background:' + mc + '">' + esc(q.m.toUpperCase()) + '</span>' + (s.qs.length > 1 ? '<div class="qdots">' + s.qs.map(function (_, j) { return '<i class="' + (j <= qi ? 'on' : '') + '"></i>'; }).join('') + '</div>' : '') + '</div>';
    h += '<h1 class="u" style="font-size:24px;font-weight:700;line-height:1.15;margin-top:12px">' + esc(s.title) + '</h1>';
    if (qi === 0) h += '<p class="story">' + esc(s.text) + '</p>';
    h += '<div class="lookbox">👁 ' + esc(s.look) + '</div>';
    if (s.draft) h += '<p class="draft">● Рабочая версия: факт уточняется на контрольном проезде</p>';
    h += '<p class="q">' + esc(q.q) + '</p><div>';
    order(q.o.length, si * 10 + qi + 3).forEach(function (oi) {
      var cls = '', mk = '○';
      if (a) {
        if (q.c === null) { cls = a.c === oi ? 'pick' : 'dim'; mk = a.c === oi ? '●' : '○'; }
        else if (oi === q.c) { cls = 'ok'; mk = '✓'; }
        else if (oi === a.c) { cls = 'bad'; mk = '✕'; }
        else cls = 'dim';
      }
      h += '<button class="opt ' + cls + '" data-opt="' + oi + '"' + (a ? ' disabled' : '') + '><span class="m">' + mk + '</span><span>' + esc(q.o[oi]) + '</span></button>';
    });
    h += '</div>';
    if (a) {
      if (q.c === null) h += '<div class="expl" style="border-color:#C77DFF"><b style="color:#C77DFF">Твоё наблюдение.</b> ' + esc(q.e) + '</div>' + goose(pick(GOOSE.open));
      else if (a.ok) h += '<div class="expl"><b>Верно.</b> ' + esc(q.e) + '</div>' + goose(pick(GOOSE.ok), 'ok');
      else h += '<div class="expl bad"><b>Не совсем.</b> ' + esc(q.e) + '</div>' + goose(pick(GOOSE.bad));
      var more = qi < s.qs.length - 1;
      h += btn(more ? 'Следующий вопрос →' : 'Забрать профессию ' + s.icon, more ? 'nextq' : 'badge');
    }
    return h + '</section>';
  }

  function finalScr() {
    setSeg('#FF6A3D');
    var st = stats();
    var h = '<section class="screen"><div class="top"><button class="link" data-go="#/">← Главная</button><p class="eyebrow">17А · ИТОГ</p></div>';
    h += '<div style="display:flex;justify-content:center;margin-top:8px"><img src="goose.svg" alt="Гусь ГЕОС" data-goose style="width:104px;height:104px;background:var(--tx);border-radius:30px;padding:8px;animation:bob 2.4s ease-in-out infinite"></div>';
    h += '<h1 class="u" style="font-size:26px;font-weight:700;text-align:center;margin-top:14px">' + (S.done.length === R.segments.length - S.start ? 'Маршрут пройден' : 'Поездка окончена') + '</h1>';
    h += '<p style="text-align:center;color:var(--so);font-size:14px;margin-top:4px">' + esc(pick(GOOSE.fin)) + '</p>';
    h += '<div class="row" style="margin-top:18px;gap:10px"><div class="stat"><p class="u" style="color:var(--te)">' + st.ok + '/' + st.closed + '</p><p>верных ответов</p></div><div class="stat"><p class="u" style="color:var(--am)">' + st.jobs + '</p><p>профессий</p></div></div>';
    h += '<p class="eyebrow" style="margin-top:20px">Ответ на сквозной вопрос</p><p style="font-weight:800;margin-top:4px">' + esc(R.theme) + '</p>';
    var any = false;
    R.segments.forEach(function (s, i) { if (segDone(i)) { any = true; h += '<div class="chain"><i style="background:' + s.color + '"></i><span>' + esc(s.takeaway) + '</span></div>'; } });
    if (!any) h += '<p style="font-size:14px;color:var(--mu);margin-top:6px">Пройди хотя бы один участок, и здесь появится ответ.</p>';
    h += '<p class="eyebrow" style="margin-top:20px">Коллекция профессий</p>' + collection();
    h += '<div class="card" style="background:var(--s2)"><p style="font-size:14px;font-weight:800">🗓 Через 7 дней — «Проверь себя»</p><p style="font-size:13px;color:var(--mu);margin-top:3px">3 вопроса из этой поездки: проверим, что запомнилось. <button class="link" data-act="check" style="color:var(--te);padding:0">Попробовать сейчас (демо)</button></p></div>';
    h += '<div class="card"><p style="font-size:14px;font-weight:800">🎁 Мерч ГЕОС</p><p style="font-size:13px;color:var(--mu);margin-top:3px">В пилоте с классом за пройденный маршрут будет мерч. Сохрани этот экран.</p></div>';
    h += btn('Открыть дневник', 'diary');
    return h + '</section>';
  }

  function diary() {
    setSeg('#2EC4B6');
    var h = '<section class="screen"><div class="top"><button class="link" data-go="#/">← Главная</button><p class="eyebrow">Дневник</p></div>';
    h += '<h1 class="u h1" style="font-size:24px">Дневник наблюдений</h1>';
    var keys = Object.keys(S.ans);
    if (!keys.length) { h += goose('Тут пока пусто. Ответь на первый вопрос — и я всё запишу.'); }
    R.segments.forEach(function (s, si) {
      var rows = '';
      s.qs.forEach(function (q, qi) {
        var a = S.ans[k(si, qi)]; if (!a) return;
        var mark = a.ok === null ? '💭' : a.ok ? '✓' : '✕', col = a.ok === null ? '#C77DFF' : a.ok ? 'var(--te)' : 'var(--pr)';
        rows += '<div class="di" style="border-color:' + s.color + '"><small>' + esc(q.m) + '</small><p style="font-weight:700">' + esc(q.q) + '</p><p style="margin-top:4px"><b style="color:' + col + '">' + mark + '</b> ' + esc(q.o[a.c]) + '</p></div>';
      });
      if (rows) h += '<p class="eyebrow" style="margin-top:18px">' + s.icon + ' ' + esc(s.title) + '</p>' + rows;
    });
    if (S.checks.length) {
      h += '<p class="eyebrow" style="margin-top:22px">Проверь себя</p>';
      S.checks.forEach(function (c) { h += '<div class="di"><p style="font-weight:700">' + c.ok + ' из ' + c.n + ' верно</p><small>' + new Date(c.at).toLocaleDateString('ru-RU') + (c.demo ? ' · демо' : ' · повтор через 7 дней') + '</small></div>'; });
    }
    h += btn(inTrip() ? 'Вернуться к поездке' : 'На главную', inTrip() ? 'trip' : 'home', 'ghost');
    return h + '</section>';
  }

  function about() {
    setSeg('#5B8DEF');
    var h = '<section class="screen"><div class="top"><button class="link" data-go="#/">← Главная</button><p class="eyebrow">О проекте</p></div>';
    h += '<h1 class="u h1" style="font-size:24px">Что такое ГЕОС</h1>';
    h += '<p class="story">ГЕОС превращает обычную поездку на автобусе в короткое исследование города. Каждый участок между остановками — одна карточка: история на минуту, подсказка «смотри в окно» и вопрос. За каждый участок ты открываешь профессию учёного, который изучает такие вещи.</p>';
    h += '<div class="card"><p style="font-weight:800">Три типа заданий</p><p style="font-size:14px;color:var(--so);margin-top:6px"><b style="color:var(--te)">Найди</b> — увидеть объект за окном.<br><b style="color:var(--am)">Заметь</b> — сравнить, как меняется город.<br><b style="color:#C77DFF">Подумай</b> — объяснить, почему он такой.</p></div>';
    h += '<div class="card"><p style="font-weight:800">Для кого</p><p style="font-size:14px;color:var(--so);margin-top:6px">Школьники 8–11 классов. По нашему опросу (21 ответ) 86% считают время в автобусе потерянным, а 90% готовы послушать минутную историю или подумать об этом.</p></div>';
    h += '<div class="card"><p style="font-weight:800">Статус</p><p style="font-size:14px;color:var(--so);margin-top:6px">Маршрут 17а — пилот ГЕОС, позже появятся другие маршруты. ' + esc(R.status) + '.</p></div>';
    h += '<div class="card"><p style="font-weight:800">Без интернета</p><p style="font-size:14px;color:var(--so);margin-top:6px">Открой сайт один раз по Wi-Fi — дальше он работает даже в режиме «в самолёте». На iPhone: «Поделиться» → «На экран Домой». Ответы хранятся только на твоём телефоне.</p></div>';
    h += '<p style="text-align:center;margin-top:18px"><button class="link" data-act="check">Проверь себя (демо)</button> · <button class="link" data-act="wipe">Стереть прогресс</button></p>';
    h += '<p style="text-align:center;font-size:12px;color:var(--mu);margin-top:6px">ГЕОС · «Наука в движении» · НовГУ · прототип v3</p>';
    h += btn('На главную', 'home', 'ghost');
    return h + '</section>';
  }

  function check() {
    setSeg('#2EC4B6');
    if (!ck) {
      var pool = [];
      R.segments.forEach(function (s, si) { s.qs.forEach(function (q, qi) { if (q.c !== null && (S.ans[k(si, qi)] || !Object.keys(S.ans).length)) pool.push([si, qi]); }); });
      if (pool.length < 3) R.segments.forEach(function (s, si) { s.qs.forEach(function (q, qi) { if (q.c !== null && pool.length < 6) pool.push([si, qi]); }); });
      pool.sort(function () { return Math.random() - .5; });
      ck = { items: pool.slice(0, 3), i: 0, res: [], demo: !checkDue() };
    }
    var h = '<section class="screen"><div class="top"><button class="link" data-act="ckexit">← Выйти</button><p class="eyebrow">Проверь себя · ' + Math.min(ck.i + 1, 3) + ' / 3</p></div>';
    if (ck.i >= ck.items.length) {
      var ok = ck.res.filter(Boolean).length;
      h += '<h1 class="u h1" style="text-align:center">' + ok + ' из ' + ck.items.length + '</h1><p class="lead" style="text-align:center">' + (ok === ck.items.length ? 'Всё запомнилось. Это уже знание, а не просто поездка.' : 'Часть забылась — это нормально. Перечитай дневник.') + '</p>';
      h += goose(ok >= 2 ? pick(GOOSE.ok) : pick(GOOSE.bad));
      h += btn('Готово', 'ckdone');
      return h + '</section>';
    }
    var it = ck.items[ck.i], s = seg(it[0]), q = s.qs[it[1]], ans = ck.res.length > ck.i ? ck.cur : null;
    h += '<p class="eyebrow" style="margin-top:18px">' + s.icon + ' ' + esc(s.title) + '</p><p class="q" style="margin-top:6px">' + esc(q.q) + '</p><div>';
    order(q.o.length, it[0] * 10 + it[1] + 3).forEach(function (oi) {
      var cls = '', mk = '○';
      if (ans !== null) { if (oi === q.c) { cls = 'ok'; mk = '✓'; } else if (oi === ans) { cls = 'bad'; mk = '✕'; } else cls = 'dim'; }
      h += '<button class="opt ' + cls + '" data-ck="' + oi + '"' + (ans !== null ? ' disabled' : '') + '><span class="m">' + mk + '</span><span>' + esc(q.o[oi]) + '</span></button>';
    });
    h += '</div>';
    if (ans !== null) h += '<div class="expl' + (ans === q.c ? '' : ' bad') + '"><b>' + (ans === q.c ? 'Верно.' : 'Не совсем.') + '</b> ' + esc(q.e) + '</div>' + btn(ck.i < ck.items.length - 1 ? 'Дальше →' : 'Результат', 'cknext');
    return h + '</section>';
  }

  // ---------- роутер ----------
  function render() {
    if (!R) return;
    var h = location.hash.replace(/^#\/?/, ''), p = h.split('/'), out;
    if (p[0] !== 'card') cv.seg = -1;
    if (p[0] !== 'check') ck = null;
    switch (p[0]) {
      case 'start': out = start(); break;
      case 'trip': out = trip(); break;
      case 'card': out = card(parseInt(p[1], 10)); break;
      case 'final': out = finalScr(); break;
      case 'diary': out = diary(); break;
      case 'about': out = about(); break;
      case 'check': out = check(); break;
      default: out = home();
    }
    if (out) app.innerHTML = out;
    if (p[0] === 'trip') lockScreen(); else unlockScreen();
  }
  function rerender(scrollEnd) {
    render();
    if (scrollEnd) { var b = app.querySelector('.expl'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  function confetti() {
    var box = document.createElement('div'); box.className = 'conf';
    var cols = R.segments.map(function (s) { return s.color; });
    for (var i = 0; i < 70; i++) {
      var c = document.createElement('i');
      c.style.left = Math.random() * 100 + '%'; c.style.background = cols[i % cols.length];
      c.style.animationDuration = 1.8 + Math.random() * 1.8 + 's'; c.style.animationDelay = Math.random() * .6 + 's';
      box.appendChild(c);
    }
    document.body.appendChild(box); setTimeout(function () { box.remove(); }, 4500);
  }

  function lockScreen() {
    if (wake || !('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {});
  }
  function unlockScreen() { if (wake) { try { wake.release(); } catch (e) {} wake = null; } }

  // ---------- события ----------
  app.addEventListener('click', function (e) {
    var t = e.target.closest('[data-goose],[data-go],[data-act],[data-stop],[data-card],[data-opt],[data-ck]');
    if (!t) return;
    if (t.hasAttribute('data-goose')) {
      S.egg = (S.egg || 0) + 1; save();
      t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop');
      if (t.classList.contains('gbox') || S.egg % 3 === 0) toast(EGG[Math.min(Math.floor(S.egg / 3), EGG.length - 1)] || 'Га!');
      return;
    }
    if (t.dataset.go) { go(t.dataset.go); top(); return; }
    if (t.dataset.stop) { chosen = +t.dataset.stop; render(); return; }
    if (t.dataset.card) { cv = { seg: +t.dataset.card, qi: 0, badge: false };
      // если уже отвечал — открыть на первом неотвеченном
      var s0 = seg(cv.seg); for (var j = 0; j < s0.qs.length; j++) { if (!S.ans[k(cv.seg, j)]) { cv.qi = j; break; } cv.qi = j; }
      go('#/card/' + t.dataset.card); top(); return; }
    if (t.dataset.opt !== undefined && cv.seg >= 0) {
      var s = seg(cv.seg), q = s.qs[cv.qi], c = +t.dataset.opt;
      S.ans[k(cv.seg, cv.qi)] = { c: c, ok: q.c === null ? null : c === q.c, t: Date.now() };
      if (navigator.vibrate) { try { navigator.vibrate(q.c === null || c === q.c ? 30 : [40, 60, 40]); } catch (er) {} }
      save(); rerender(true); return;
    }
    if (t.dataset.ck !== undefined && ck) {
      var it = ck.items[ck.i], qq = seg(it[0]).qs[it[1]]; ck.cur = +t.dataset.ck; ck.res.push(ck.cur === qq.c); rerender(true); return;
    }
    switch (t.dataset.act) {
      case 'begin': if (S.fin) { S = { start: null, cur: null, ans: {}, done: [], fin: null, checks: S.checks, egg: S.egg }; save(); } chosen = 0; go('#/start'); top(); break;
      case 'go': if (chosen === null) return; S.start = chosen; S.cur = chosen; save(); go('#/trip'); top(); break;
      case 'trip': go('#/trip'); top(); break;
      case 'home': go('#/'); top(); break;
      case 'diary': go('#/diary'); top(); break;
      case 'nextq': cv.qi++; render(); top(); break;
      case 'badge':
        if (!segDone(cv.seg)) { S.done.push(cv.seg); save(); }
        cv.badge = true; render(); top(); break;
      case 'back':
        if (S.cur === cv.seg && S.cur < lastSeg()) toast('Жми «Следующая остановка», когда автобус её проедет');
        go('#/trip'); top(); break;
      case 'next':
        if (S.cur >= lastSeg()) { S.fin = Date.now(); save(); go('#/final'); confetti(); }
        else { S.cur++; save(); render(); }
        top(); break;
      case 'final': S.fin = Date.now(); save(); go('#/final'); top(); confetti(); break;
      case 'finish':
        if (S.done.length) { S.fin = Date.now(); save(); go('#/final'); confetti(); } else { S.cur = null; save(); go('#/'); }
        top(); break;
      case 'reset': if (confirmSoft(t, 'Точно заново? Нажми ещё раз')) { S = { start: null, cur: null, ans: {}, done: [], fin: null, checks: S.checks, egg: S.egg }; save(); render(); } break;
      case 'wipe': if (confirmSoft(t, 'Нажми ещё раз, чтобы стереть всё')) { S = { start: null, cur: null, ans: {}, done: [], fin: null, checks: [], egg: 0 }; save(); toast('Прогресс стёрт'); go('#/'); } break;
      case 'check': ck = null; go('#/check'); top(); break;
      case 'cknext': ck.i++; render(); top(); break;
      case 'ckdone': S.checks.push({ at: Date.now(), ok: ck.res.filter(Boolean).length, n: ck.items.length, demo: ck.demo }); save(); ck = null; go('#/diary'); top(); break;
      case 'ckexit': ck = null; go('#/'); top(); break;
    }
  });
  function confirmSoft(el, msg) {   // без системных диалогов: второе нажатие подтверждает
    if (el.dataset.armed) return true;
    el.dataset.armed = '1'; var old = el.textContent; el.textContent = msg; el.style.color = 'var(--pr)';
    setTimeout(function () { if (el.isConnected) { delete el.dataset.armed; el.textContent = old; el.style.color = ''; } }, 3000);
    return false;
  }
  window.addEventListener('hashchange', function () { render(); top(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && /trip/.test(location.hash)) lockScreen(); });

  // ---------- запуск ----------
  fetch('route/route-17a.json').then(function (r) { return r.json(); }).then(function (d) {
    R = d;
    if (S.cur !== null && S.cur > lastSeg()) S.cur = lastSeg();
    render();
  }).catch(function () {
    app.innerHTML = '<section class="screen">' + goose('Не получилось загрузить маршрут. Открой сайт один раз с интернетом — потом он будет работать и без сети.') + '</section>';
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(function () { return navigator.serviceWorker.ready; }).then(function () {
      offlineReady = true; if (!location.hash || location.hash === '#/') render();
    }).catch(function () {});
  }
})();
