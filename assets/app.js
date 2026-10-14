/* 专注时钟 · FocusFlow
 * 番茄工作法计时器 + 任务清单。全部逻辑在浏览器端，数据存 localStorage，无任何网络请求。
 */
(function () {
  'use strict';

  var LS = {
    tasks: 'ff.tasks',
    stats: 'ff.stats',
    cfg: 'ff.cfg',
    theme: 'ff.theme',
    current: 'ff.current'
  };

  var DEFAULT_CFG = { focus: 25, short: 5, long: 15, longEvery: 4 };

  var state = {
    mode: 'focus',
    running: false,
    remaining: DEFAULT_CFG.focus * 60,   // 秒
    endAt: 0,
    completedInCycle: 0,
    cfg: load(LS.cfg, DEFAULT_CFG),
    tasks: load(LS.tasks, []),
    stats: load(LS.stats, {}),
    currentTaskId: localStorage.getItem(LS.current) || null,
    raf: 0
  };

  var $ = function (s) { return document.querySelector(s); };

  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; }
    catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); flashSaved(); }
  var saveTimer = 0;
  function flashSaved() {
    var el = $('#saveHint'); if (!el) return;
    el.textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function todayKey(d) {
    var t = d || new Date();
    return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  }
  function dayStat(key) {
    if (!state.stats[key]) state.stats[key] = { seconds: 0, pomodoros: 0 };
    return state.stats[key];
  }

  function modeSeconds(mode) {
    var c = state.cfg;
    return (mode === 'focus' ? c.focus : mode === 'short' ? c.short : c.long) * 60;
  }
  function modeLabel(mode) {
    return mode === 'focus' ? '专注' : mode === 'short' ? '短休息' : '长休息';
  }

  var RING_R = 104;
  var RING_C = 2 * Math.PI * RING_R;

  function fmt(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function render() {
    var total = modeSeconds(state.mode);
    var left = Math.max(0, state.remaining);
    var progress = 1 - left / total;

    $('#timeText').textContent = fmt(left);
    $('#phaseText').textContent = modeLabel(state.mode) + (state.running ? '中' : '');
    $('#startBtn').textContent = state.running ? '暂停' : (left < total ? '继续' : '开始');

    var fg = $('#ringFg');
    fg.style.strokeDasharray = RING_C.toFixed(2);
    fg.style.strokeDashoffset = (RING_C * (1 - progress)).toFixed(2);
    fg.style.stroke = state.mode === 'focus' ? 'var(--accent)' : 'var(--rest)';

    var cur = state.tasks.find(function (t) { return t.id === state.currentTaskId; });
    $('#taskNow').textContent = cur ? cur.title : '未选择任务';

    document.title = (state.running ? fmt(left) + ' · ' : '') + modeLabel(state.mode) + ' · 专注时钟';
    document.querySelectorAll('.mode').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === state.mode);
    });
  }

  function tick() {
    if (!state.running) return;
    var left = (state.endAt - Date.now()) / 1000;
    state.remaining = left;
    if (left <= 0) { finish(); return; }
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function start() {
    if (state.running) { pause(); return; }
    state.running = true;
    state.endAt = Date.now() + state.remaining * 1000;
    state.raf = requestAnimationFrame(tick);
    render();
  }
  function pause() {
    state.running = false;
    cancelAnimationFrame(state.raf);
    render();
  }
  function reset() {
    pause();
    state.remaining = modeSeconds(state.mode);
    render();
  }
  function switchMode(mode, keepRunning) {
    pause();
    state.mode = mode;
    state.remaining = modeSeconds(mode);
    render();
    if (keepRunning) start();
  }
  function skip() {
    var next = state.mode === 'focus' ? nextBreak() : 'focus';
    switchMode(next, false);
  }

  function nextBreak() {
    var every = Math.max(2, state.cfg.longEvery || 4);
    return (state.completedInCycle % every === 0 && state.completedInCycle > 0) ? 'long' : 'short';
  }

  function finish() {
    pause();
    var doneMode = state.mode;
    var total = modeSeconds(doneMode);
    state.remaining = 0;
    render();

    if (doneMode === 'focus') {
      var key = todayKey();
      var st = dayStat(key);
      st.seconds += total;
      st.pomodoros += 1;
      state.completedInCycle += 1;
      if (state.currentTaskId) {
        var t = state.tasks.find(function (x) { return x.id === state.currentTaskId; });
        if (t) { t.seconds = (t.seconds || 0) + total; save(LS.tasks, state.tasks); }
      }
      save(LS.stats, state.stats);
      renderTasks(); renderStats();
      notify('专注结束', '休息一下吧：' + modeLabel(nextBreak()));
      beep(2);
      switchMode(nextBreak(), true);
    } else {
      notify('休息结束', '开始下一个专注吧');
      beep(1);
      switchMode('focus', true);
    }
  }

  function beep(times) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var now = ctx.currentTime;
      for (var i = 0; i < times; i++) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = i % 2 ? 660 : 880;
        g.gain.setValueAtTime(0.0001, now + i * 0.42);
        g.gain.exponentialRampToValueAtTime(0.28, now + i * 0.42 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.42 + 0.34);
        o.connect(g); g.connect(ctx.destination);
        o.start(now + i * 0.42); o.stop(now + i * 0.42 + 0.36);
      }
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1800);
    } catch (e) { /* 忽略 */ }
  }

  function notify(title, body) {
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(title, { body: body, icon: undefined });
      }
    } catch (e) { /* 忽略 */ }
  }

  // ---------- 任务 ----------
  function renderTasks() {
    var list = $('#taskList');
    var items = state.tasks;
    $('#taskMeta').textContent = items.length ? ('共 ' + items.length + ' 项，已完成 ' + items.filter(function (t) { return t.done; }).length + ' 项') : '';
    if (!items.length) {
      list.innerHTML = '<li class="empty">还没有任务，先在上面添加一个吧。</li>';
      return;
    }
    list.innerHTML = items.map(function (t) {
      var cls = 'task' + (t.id === state.currentTaskId ? ' current' : '') + (t.done ? ' done' : '');
      var mins = Math.round((t.seconds || 0) / 60);
      return '<li class="' + cls + '" data-id="' + t.id + '">'
        + '<span class="dot" title="设为当前任务"></span>'
        + '<span class="title">' + escapeHtml(t.title) + '</span>'
        + '<span class="mins">' + (mins ? mins + ' 分钟' : '') + '</span>'
        + '<button class="del" title="删除">✕</button>'
        + '</li>';
    }).join('');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function addTask(title) {
    var t = { id: 'T' + Date.now().toString(36), title: title, done: false, seconds: 0, created: Date.now() };
    state.tasks.unshift(t);
    if (!state.currentTaskId) { state.currentTaskId = t.id; localStorage.setItem(LS.current, t.id); }
    save(LS.tasks, state.tasks);
    renderTasks(); render();
  }

  // ---------- 统计 ----------
  function renderStats() {
    var k = todayKey();
    var st = dayStat(k);
    var totalMin = Math.round(st.seconds / 60);
    var allMin = Object.keys(state.stats).reduce(function (a, key) { return a + (state.stats[key].seconds || 0); }, 0) / 60;
    var days = Object.keys(state.stats).filter(function (key) { return state.stats[key].seconds > 0; });
    var streak = 0, d = new Date();
    while (true) {
      var key = todayKey(d);
      if (state.stats[key] && state.stats[key].seconds > 0) { streak++; d.setDate(d.getDate() - 1); } else break;
    }
    var cells = [
      ['今日专注', totalMin + ' 分钟'],
      ['今日番茄', st.pomodoros + ' 个'],
      ['累计专注', Math.round(allMin) + ' 分钟'],
      ['连续天数', streak + ' 天']
    ];
    $('#stats').innerHTML = cells.map(function (c) {
      return '<div class="stat"><div class="k">' + c[0] + '</div><div class="v">' + c[1] + '</div></div>';
    }).join('');

    var days7 = [];
    for (var i = 6; i >= 0; i--) {
      var dd = new Date(); dd.setDate(dd.getDate() - i);
      var key2 = todayKey(dd);
      days7.push({ key: key2, label: (dd.getMonth() + 1) + '/' + dd.getDate(), min: Math.round(((state.stats[key2] || {}).seconds || 0) / 60) });
    }
    var max = Math.max.apply(null, days7.map(function (x) { return x.min; }).concat([1]));
    $('#week').innerHTML = days7.map(function (x) {
      var h = Math.round(x.min / max * 88);
      return '<div class="bar"><span class="val">' + (x.min || '') + '</span>'
        + '<div class="fill" style="height:' + h + 'px"></div>'
        + '<span class="lbl">' + x.label + '</span></div>';
    }).join('');
  }

  // ---------- 事件 ----------
  $('#startBtn').addEventListener('click', start);
  $('#resetBtn').addEventListener('click', reset);
  $('#skipBtn').addEventListener('click', skip);
  document.querySelectorAll('.mode').forEach(function (b) {
    b.addEventListener('click', function () { switchMode(b.dataset.mode, false); });
  });

  $('#taskForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('#taskInput').value.trim();
    if (!v) return;
    addTask(v);
    $('#taskInput').value = '';
  });

  $('#taskList').addEventListener('click', function (e) {
    var li = e.target.closest('.task');
    if (!li) return;
    var id = li.dataset.id;
    var t = state.tasks.find(function (x) { return x.id === id; });
    if (!t) return;
    if (e.target.classList.contains('dot')) {
      if (state.currentTaskId === id && !t.done) {
        // 再次点击：标记完成
        t.done = true; state.currentTaskId = null;
        localStorage.removeItem(LS.current);
      } else {
        state.currentTaskId = id; t.done = false;
        localStorage.setItem(LS.current, id);
      }
      save(LS.tasks, state.tasks); renderTasks(); render(); return;
    }
    if (e.target.classList.contains('del')) {
      state.tasks = state.tasks.filter(function (x) { return x.id !== id; });
      if (state.currentTaskId === id) { state.currentTaskId = null; localStorage.removeItem(LS.current); }
      save(LS.tasks, state.tasks); renderTasks(); render(); return;
    }
    if (e.target.classList.contains('title')) {
      t.done = !t.done;
      if (t.done && state.currentTaskId === id) { state.currentTaskId = null; localStorage.removeItem(LS.current); }
      save(LS.tasks, state.tasks); renderTasks(); render();
    }
  });

  ['focusMin', 'shortMin', 'longMin', 'longEvery'].forEach(function (id) {
    var el = document.getElementById(id);
    el.value = state.cfg[{ focusMin: 'focus', shortMin: 'short', longMin: 'long', longEvery: 'longEvery' }[id]];
    el.addEventListener('change', function () {
      var key = { focusMin: 'focus', shortMin: 'short', longMin: 'long', longEvery: 'longEvery' }[id];
      var v = parseInt(el.value, 10);
      if (isNaN(v) || v < 1) v = DEFAULT_CFG[key];
      state.cfg[key] = v;
      save(LS.cfg, state.cfg);
      if (!state.running && state.mode) { state.remaining = modeSeconds(state.mode); }
      render();
    });
  });

  $('#themeBtn').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(LS.theme, next);
    $('#themeBtn').textContent = next === 'light' ? '☀️' : '🌙';
  });

  $('#notifyBtn').addEventListener('click', function () {
    if (!window.Notification) { alert('当前浏览器不支持桌面通知，结束时会有提示音。'); return; }
    Notification.requestPermission().then(function (p) {
      $('#notifyBtn').textContent = p === 'granted' ? '🔔 已开启' : '🔔 提醒';
    });
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (e.code === 'Space') { e.preventDefault(); start(); }
    if (e.key === 'r' || e.key === 'R') { reset(); }
  });

  // ---------- 初始化 ----------
  (function init() {
    var theme = localStorage.getItem(LS.theme) || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    $('#themeBtn').textContent = theme === 'light' ? '☀️' : '🌙';
    if (window.Notification && Notification.permission === 'granted') $('#notifyBtn').textContent = '🔔 已开启';
    state.remaining = modeSeconds(state.mode);
    renderTasks(); renderStats(); render();
  })();
})();
