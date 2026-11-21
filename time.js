(function (root) {
  const yearInChina = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' });
  function anniversary(now = Date.now()) {
    let year = Math.max(2026, Number(yearInChina.format(now)));
    let target = Date.parse(`${year}-12-09T00:00:00+08:00`);
    const today = now >= target && now < target + 86400000;
    if (now >= target + 86400000) {
      year += 1;
      target = Date.parse(`${year}-12-09T00:00:00+08:00`);
    }
    return { year, number: year - 2025, target, today, remaining: Math.max(0, target - now) };
  }
  root.ZengMinTime = { anniversary };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZengMinTime;
})(globalThis);
