'use strict';

// ─────────────────────────────────────────────
// 日本の祝日データ（2024〜2027年）
// 出典: 内閣府「国民の祝日について」
// ─────────────────────────────────────────────
const HOLIDAYS = {
  // 2024
  "2024-01-01": "元日",
  "2024-01-08": "成人の日",
  "2024-02-11": "建国記念の日",
  "2024-02-12": "振替休日",
  "2024-02-23": "天皇誕生日",
  "2024-03-20": "春分の日",
  "2024-04-29": "昭和の日",
  "2024-05-03": "憲法記念日",
  "2024-05-04": "みどりの日",
  "2024-05-05": "こどもの日",
  "2024-05-06": "振替休日",
  "2024-07-15": "海の日",
  "2024-08-11": "山の日",
  "2024-08-12": "振替休日",
  "2024-09-16": "敬老の日",
  "2024-09-22": "秋分の日",
  "2024-09-23": "振替休日",
  "2024-10-14": "スポーツの日",
  "2024-11-03": "文化の日",
  "2024-11-04": "振替休日",
  "2024-11-23": "勤労感謝の日",
  // 2025
  "2025-01-01": "元日",
  "2025-01-13": "成人の日",
  "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日",
  "2025-02-24": "振替休日",
  "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日",
  "2025-05-03": "憲法記念日",
  "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日",
  "2025-05-06": "振替休日",
  "2025-07-21": "海の日",
  "2025-08-11": "山の日",
  "2025-09-15": "敬老の日",
  "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日",
  "2025-11-03": "文化の日",
  "2025-11-23": "勤労感謝の日",
  "2025-11-24": "振替休日",
  // 2026
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
  // 2027
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-03-22": "振替休日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日",
};

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────
function toKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function isHoliday(y, m, d) {
  return !!HOLIDAYS[toKey(y, m, d)];
}

function holidayName(y, m, d) {
  return HOLIDAYS[toKey(y, m, d)] || null;
}

function isWeekend(y, m, d) {
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

function isBusinessDay(y, m, d) {
  return !isWeekend(y, m, d) && !isHoliday(y, m, d);
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/**
 * 指定月の全営業日数
 */
function countTotalBizDays(y, m) {
  const last = daysInMonth(y, m);
  let count = 0;
  for (let d = 1; d <= last; d++) {
    if (isBusinessDay(y, m, d)) count++;
  }
  return count;
}

/**
 * 指定月の第何営業日か（1日〜today）
 * today が非営業日の場合は直前の営業日番号を返す。当月以外は null
 */
function currentBizDayNumber(y, m, today) {
  const last = daysInMonth(y, m);
  let count = 0;
  for (let d = 1; d <= Math.min(today, last); d++) {
    if (isBusinessDay(y, m, d)) count++;
  }
  return count;
}

// ─────────────────────────────────────────────
// アプリ状態
// ─────────────────────────────────────────────
const now = new Date();
let viewYear  = now.getFullYear();
let viewMonth = now.getMonth() + 1; // 1-based

// 選択日（デフォルト: 今日）
let selYear  = now.getFullYear();
let selMonth = now.getMonth() + 1;
let selDay   = now.getDate();

function isTodayDate(y, m, d) {
  return y === now.getFullYear() && m === now.getMonth() + 1 && d === now.getDate();
}

function isSelectedDate(y, m, d) {
  return y === selYear && m === selMonth && d === selDay;
}

// ─────────────────────────────────────────────
// 描画
// ─────────────────────────────────────────────
function render() {
  const y = viewYear;
  const m = viewMonth;

  // 選択日がこの表示月にあるか
  const selInView = selYear === y && selMonth === m;

  // ── タイトル
  document.getElementById('monthTitle').textContent = `${y}年${m}月`;

  // ── 集計
  const total   = countTotalBizDays(y, m);
  const current = selInView ? currentBizDayNumber(y, m, selDay) : 0;
  const rate    = total > 0 ? (current / total) : 0;

  // ── 統計カード（選択日に応じてラベル変更）
  const labelEl  = document.getElementById('currentBizDayLabel');
  const bizDayEl = document.getElementById('currentBizDay');
  const unitEl   = document.getElementById('currentBizDayUnit');

  if (selInView) {
    bizDayEl.textContent = current;
    unitEl.textContent   = '営業日目';
    if (isTodayDate(selYear, selMonth, selDay)) {
      labelEl.textContent = '今日の営業日';
    } else {
      labelEl.textContent = `${selDay}日の営業日`;
    }
  } else {
    bizDayEl.textContent = '-';
    labelEl.textContent  = '選択日の営業日';
    unitEl.textContent   = '（この月に未選択）';
  }
  document.getElementById('totalBizDays').textContent = total;

  // ── 進捗
  const pct = selInView ? Math.round(rate * 1000) / 10 : 0;
  document.getElementById('progressPercent').textContent = selInView ? `${pct}%` : '-';
  document.getElementById('progressBar').style.width     = selInView ? `${pct}%` : '0%';
  document.getElementById('progressDetail').textContent  = selInView
    ? `${current} / ${total} 営業日`
    : `全 ${total} 営業日`;

  // ── 今日に戻るボタン（今日が選択済み & 今月表示なら非表示）
  const atToday = isTodayDate(selYear, selMonth, selDay)
    && y === now.getFullYear() && m === now.getMonth() + 1;
  document.getElementById('todayBtn').classList.toggle('hidden', atToday);

  // ── カレンダー
  renderCalendar(y, m);
}

function renderCalendar(y, m) {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  const firstDow    = new Date(y, m - 1, 1).getDay();
  const startOffset = (firstDow + 6) % 7; // 月曜始まり
  const last        = daysInMonth(y, m);

  // 実際の今日（薄表示の基準として使用）
  const realTodayInView = y === now.getFullYear() && m === now.getMonth() + 1;
  const realTodayD = realTodayInView ? now.getDate() : null;

  // 空セル
  for (let i = 0; i < startOffset; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    grid.appendChild(cell);
  }

  for (let d = 1; d <= last; d++) {
    const cell    = document.createElement('div');
    const dow     = new Date(y, m - 1, d).getDay();
    const isSat   = dow === 6;
    const isSun   = dow === 0;
    const isHol   = isHoliday(y, m, d);
    const hName   = holidayName(y, m, d);
    const isBiz   = isBusinessDay(y, m, d);
    const isTdy   = isTodayDate(y, m, d);
    const isSel   = isSelectedDate(y, m, d);
    const isPast  = realTodayD !== null && d < realTodayD && isBiz;

    let cls = 'cal-cell';
    if (isTdy)              cls += ' today';
    else if (isSel)         cls += ' selected';
    else if (isSat)         cls += ' saturday';
    else if (isSun || isHol) cls += ' holiday';
    else if (isBiz)         cls += ' bizday';

    if (!isTdy && !isSel && isPast) cls += ' past-bizday';

    cell.className = cls;

    const numEl = document.createElement('span');
    numEl.className = 'day-num';
    numEl.textContent = d;
    cell.appendChild(numEl);

    if (hName) {
      const hnEl = document.createElement('span');
      hnEl.className = 'holiday-name';
      hnEl.textContent = hName;
      cell.appendChild(hnEl);
      cell.title = hName;
    }

    // クリックで選択日を変更
    cell.addEventListener('click', () => {
      selYear = y; selMonth = m; selDay = d;
      render();
    });

    grid.appendChild(cell);
  }
}

// ─────────────────────────────────────────────
// イベント
// ─────────────────────────────────────────────
document.getElementById('prevBtn').addEventListener('click', () => {
  viewMonth--;
  if (viewMonth < 1) { viewMonth = 12; viewYear--; }
  render();
});

document.getElementById('nextBtn').addEventListener('click', () => {
  viewMonth++;
  if (viewMonth > 12) { viewMonth = 1; viewYear++; }
  render();
});

document.getElementById('todayBtn').addEventListener('click', () => {
  viewYear  = now.getFullYear();
  viewMonth = now.getMonth() + 1;
  selYear   = now.getFullYear();
  selMonth  = now.getMonth() + 1;
  selDay    = now.getDate();
  render();
});

// 初期描画
render();
