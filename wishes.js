// Short, titled birthday wishes — a different one for each person.
// Shared by the server (push notifications) and the dashboard (WhatsApp button).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Wishes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const GENERAL = [
    'Happy Birthday, {T}! 🎉 Wishing you good health, joy and success this year.',
    'Many happy returns, {T}! 🎂 May this new year bring you abundant blessings.',
    'Today is your day, {T}! 🎈 Epe LGEA celebrates you. Happy Birthday!',
    'Warm birthday wishes, {T}! 🎁 May your days be full of peace and laughter.',
    'Happy Birthday, {T}! 🌟 Thank you for your dedication. Enjoy your day!',
    "It's your day, {T}! 🥳 Wishing you joy, favour and many more healthy years.",
    'Cheers to you, {T}! 🎊 May this year be your best yet. Happy Birthday!',
    "Happy Birthday, {T}! 🙏 May God's favour follow you all the days of your life.",
    'Another year, another blessing, {T}! 🎂 Have a day full of love and joy.',
    'Heartiest birthday wishes, {T}! 💐 May your hard work be rewarded this year.',
    'Happy Birthday, {T}! ✨ May your path be bright and your year fruitful.',
    'Celebrate big today, {T}! 🎉 Wishing you health, prosperity and joy.',
    'Birthday blessings, {T}! 🌺 May every good thing you hope for find you.',
    'Happy Birthday, {T}! 🎶 Enjoy today, you deserve every bit of it.',
    'Wishing you a wonderful birthday, {T}! 🌞 May this year bring peace and progress.',
    'Happy Birthday, {T}! 🍰 May your new year be full of good news.'
  ];
  const TEACHING = [
    'Happy Birthday, {T}! 📚 Thank you for shaping young minds. Enjoy your day!',
    'To a dedicated teacher, {T}: Happy Birthday! 🍎 Wishing you joy all year.',
    'Happy Birthday, {T}! 🌱 Our pupils are lucky to have you. Have a lovely day!',
    'Birthday blessings, {T}! ✏️ Keep inspiring. Enjoy your special day!',
    'Happy Birthday, {T}! 🏫 Thank you for all you do in the classroom.'
  ];
  const NONTEACHING = [
    'Happy Birthday, {T}! 🤝 Thank you for supporting the team. Have a great day!',
    'Wishing you a joyful birthday, {T}! 🌟 Your hard work keeps Epe LGEA running.',
    'Happy Birthday, {T}! 💼 We appreciate all you do. Enjoy your day!',
    'Many happy returns, {T}! 🎂 Thank you for your service. Stay blessed.'
  ];
  // Used only on the day someone's retirement date is also their birthday (or today).
  const RETIRING = [
    'Happy Birthday and Happy Retirement, {T}! 🎉 Thank you for your years of service to Epe LGEA.',
    'Happy Birthday and congratulations on your retirement, {T}! 🥳 Enjoy a well-earned rest.',
    'A double celebration, {T}! 🎂🎉 Happy Birthday and Happy Retirement. Epe LGEA thanks you.'
  ];

  function personTitle(b) {
    const t = String(b.title || '').replace(/\./g, '').trim();
    if (t) return t;
    if (b.gender === 'Male') return 'Mr';
    if (b.gender === 'Female') return 'Ms';
    return '';
  }
  function personCallName(b) {
    const sur = String(b.surname || '').trim() || String(b.name || '').trim().split(/\s+/)[0] || '';
    const t = personTitle(b);
    if (t) return `${t} ${sur}`.trim();
    const first = String(b.other_names || '').trim().split(/\s+/)[0] || '';
    return `${sur} ${first}`.trim();
  }
  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  // people: today's celebrants. dateKey: e.g. "2026-11-13". todayISO: "2026-11-13".
  // Everyone on the same day gets a different message (until the pool runs out).
  function buildBirthdayMessages(people, dateKey, todayISO) {
    const used = new Set();
    const sorted = [...people].sort((a, b) =>
      String(a.oracle_no || a.name).localeCompare(String(b.oracle_no || b.name)) ||
      String(a.name).localeCompare(String(b.name)));
    return sorted.map((b) => {
      const retiring = !!todayISO && b.retirement_date === todayISO;
      const pool = retiring ? RETIRING : GENERAL.concat(
        b.staff_type === 'Teaching' ? TEACHING :
        b.staff_type === 'Non-Teaching' ? NONTEACHING : []);
      const start = hashStr(`${dateKey}|${b.oracle_no || ''}|${b.name}`) % pool.length;
      let idx = start;
      for (let k = 0; k < pool.length; k++) {
        const cand = (start + k) % pool.length;
        if (!used.has(pool[cand])) { idx = cand; break; }
      }
      used.add(pool[idx]);
      const callName = personCallName(b);
      return {
        person: b, callName, retiring,
        title: retiring ? `🎂 Birthday & Retirement, ${callName}!` : `🎂 Happy Birthday, ${callName}!`,
        message: pool[idx].replace(/\{T\}/g, callName)
      };
    });
  }
  // WhatsApp needs the international format: 0802… → 234802…
  function whatsappLink(phone, message) {
    const m = String(phone || '').replace(/[^\d]/g, ' ').match(/\b(?:234\d{10}|0\d{10})\b/);
    if (!m) return '';
    const n = m[0].startsWith('0') ? '234' + m[0].slice(1) : m[0];
    return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
  }
  return { buildBirthdayMessages, whatsappLink, personTitle, personCallName,
           pools: { GENERAL, TEACHING, NONTEACHING, RETIRING } };
});
