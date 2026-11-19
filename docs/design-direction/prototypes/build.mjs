// Builds the three design-direction prototypes (Home, Tasks, Habits) as static HTML.
// Same content and shell for every direction; only the world (type, palette, density, signature move) differs.
// Run: node docs/design-direction/prototypes/build.mjs   (reads icons from the installed lucide-react)
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = join(HERE, '../../../node_modules/lucide-react/dist/esm/icons');

const ICONS = {};
for (const n of 'house calendar-check list-checks inbox calendar folder-kanban target repeat timer clipboard-check chart-column users notebook-pen book-open lock settings trash plus search chevron-right chevron-down flag bell briefcase sprout heart shapes ellipsis check map-pin clock link sparkles sun moon droplet'.split(' ')) {
  const { __iconData } = await import(pathToFileURL(join(ICON_DIR, `${n}.mjs`)).href);
  ICONS[n] = __iconData.node.map(([t, a]) => `<${t} ${Object.entries(a).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
}
const ic = (n, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

// ---------- Content (the Researcher profile, Fri 20 Nov 2026, 09:40) ----------
const AREAS = {
  work: { name: 'Work', icon: 'briefcase', open: 9, sections: [['Research', 2, ['Physical AI']], ['Thesis', 3], ['Coursework', 2, ['SMAI']], ['Adviser Meetings', 1], ['Updates'], ['Ideas & Projects']] },
  self: { name: 'Self-Improvement', icon: 'sprout', open: 3, sections: [['Gym & Fitness', 1], ['Health', 1], ['Learning & Skills', 1]] },
  personal: { name: 'Personal Life', icon: 'heart', open: 2, sections: [['Movies & Series'], ['Places'], ['Trips'], ['Dates & Occasions', 2]] },
  misc: { name: 'Miscellaneous', icon: 'shapes', open: 2, sections: [['Shopping', 1], ['Household'], ['Expenses', 1], ['Documents']] },
};
const T = (title, area, section, time, extra = {}) => ({ title, area, section, time, ...extra });
const GROUPS = [
  ['Overdue', [T('Submit SMAI assignment 2 report', 'work', 'SMAI', 'Thu', { late: true, flag: true })]],
  ['Today', [
    T('Email Prof. Rajan about the draft', 'work', 'Thesis', '09:30', { flag: true, sub: '1/3' }),
    T('SMAI lecture, H-105', 'work', 'SMAI', '11:30', { event: '11:30–13:00' }),
    T('Prepare lab meeting slides', 'work', 'Research', '14:00', { project: 'Grasping baseline' }),
    T('Pay the hostel mess bill', 'misc', 'Expenses', 'Any time'),
    T('Call Amma about the trip', 'personal', 'Trips', 'Any time', { done: true }),
  ]],
  ['Tomorrow', [T('Read the RT-2 paper', 'work', 'Physical AI', 'Sat', { project: 'Literature review' })]],
  ['Later this week', [
    T('Leg day: squat 5×5', 'self', 'Gym & Fitness', 'Sun'),
    T('Buy protein and oats', 'misc', 'Shopping', 'Sun'),
  ]],
  ['Next week', [
    T('Amma’s birthday', 'personal', 'Dates & Occasions', 'Tue 24', { occasion: true }),
    T('Renew library card', 'misc', 'Documents', 'Wed 25'),
    T('SMAI assignment 3 due', 'work', 'SMAI', 'Thu 26'),
  ]],
];
// d = done, s = skipped, r = rest, m = missed, t = due today (not yet), f = future, x = done today
const DAYS = [['M', 16], ['T', 17], ['W', 18], ['T', 19], ['F', 20], ['S', 21], ['S', 22]];
const TODAY_COL = 4;
const HABITS = [
  { name: 'Gym', area: 'self', rule: '4× a week', remind: '07:00', link: 'Gym & Fitness', week: 'drdmt ff', count: '2/4', rate: '86%' },
  { name: 'DSA practice', area: 'work', rule: 'Every day', remind: '18:00', week: 'ddsdtff', count: '3/7', rate: '71%' },
  { name: 'Read a research paper', area: 'work', rule: 'Weekdays', remind: '10:00', week: 'mdmdtff', count: '2/5', rate: '48%' },
  { name: 'Meditate 10 minutes', area: 'self', rule: 'Every day', remind: '22:30', week: 'dddmxff', count: '4/7', rate: '80%' },
  { name: 'Call home', area: 'personal', rule: '2× a week', remind: '20:00', week: 'fdffff f', count: '1/2', rate: '92%' },
].map((h) => ({ ...h, week: h.week.replace(/ /g, '').padEnd(7, 'f').slice(0, 7).split('') }));
const STATE_LABEL = { d: 'Done', x: 'Done', s: 'Skipped', r: 'Rest day', m: 'Missed', t: 'Due today', f: '' };

// ---------- Shared shell ----------
const NAV = [
  ['Plan', [['house', 'Home', 'home'], ['calendar-check', 'Today', 'today'], ['list-checks', 'All Tasks', 'tasks'], ['inbox', 'Inbox', 'inbox', 5], ['calendar', 'Calendar']]],
  ['Build', [['folder-kanban', 'Projects'], ['target', 'Goals']]],
  ['Track', [['repeat', 'Habits', 'habits'], ['timer', 'Focus'], ['clipboard-check', 'Reviews'], ['chart-column', 'Analytics']]],
];
const sidebar = (cur) => `<aside class="side" aria-label="Main">
<div class="brand"><span class="mark" aria-hidden="true"><i class="work"></i><i class="self"></i><i class="personal"></i><i class="misc"></i></span>Personal OS</div>
<div class="side-actions"><button class="btn btn-primary btn-block">${ic('plus')}New task<kbd>N</kbd></button><button class="btn btn-icon" aria-label="Search">${ic('search')}</button></div>
${NAV.map(([g, items]) => `<div class="nav-group"><p class="nav-label">${g}</p>${items.map(([i, l, k, n]) => `<a class="nav-item${k === cur ? ' on' : ''}" ${k === cur ? 'aria-current="page"' : ''} href="#">${ic(i)}<span>${l}</span>${n ? `<b class="count">${n}</b>` : ''}</a>`).join('')}</div>`).join('')}
<div class="nav-group"><p class="nav-label">Sections</p>${Object.entries(AREAS).map(([k, a]) => `<a class="nav-item area-item" href="#"><span class="area-dot ${k}"></span><span>${a.name}</span><b class="count">${a.open}</b></a>`).join('')}</div>
<div class="nav-group"><p class="nav-label">Personal</p>${[['users', 'People'], ['notebook-pen', 'Notes'], ['book-open', 'Journal'], ['lock', 'Vault']].map(([i, l]) => `<a class="nav-item" href="#">${ic(i)}<span>${l}</span></a>`).join('')}</div>
<div class="side-foot"><a class="nav-item" href="#">${ic('settings')}<span>Settings</span></a><a class="nav-item" href="#">${ic('trash')}<span>Trash</span></a></div>
</aside>`;
const tabbar = (cur) => `<nav class="tabbar" aria-label="Main">${[['house', 'Home', 'home'], ['calendar-check', 'Today', 'today'], ['plus', 'New', 'new'], ['list-checks', 'Tasks', 'tasks'], ['ellipsis', 'More', 'habits']].map(([i, l, k]) => k === 'new' ? `<button class="tab-new" aria-label="New task">${ic('plus')}</button>` : `<a class="tab${k === cur ? ' on' : ''}" href="#">${ic(i)}<span>${l}</span></a>`).join('')}</nav>`;

// The fore-edge tab rail (direction B only): one tab per area, height proportional to open items.
const total = Object.values(AREAS).reduce((s, a) => s + a.open, 0);
const forerail = () => `<nav class="forerail" aria-label="Areas">${Object.entries(AREAS).map(([k, a]) => `<a class="fore ${k}" href="#" style="flex-grow:${a.open}" title="${a.name}: ${a.open} open"><span>${a.name}</span><b>${a.open}</b></a>`).join('')}</nav>`;

// ---------- Components ----------
const check = (t, dir) => {
  if (dir === 'c') return `<button class="station ${t.area}${t.done ? ' done' : ''}${t.late ? ' late' : ''}" role="checkbox" aria-checked="${!!t.done}" aria-label="Complete ${t.title}">${t.done ? ic('check') : ''}</button>`;
  return `<button class="check${t.done ? ' done' : ''}${t.late ? ' late' : ''}" role="checkbox" aria-checked="${!!t.done}" aria-label="Complete ${t.title}">${t.done ? ic('check') : ''}</button>`;
};
const meta = (t) => [
  `<span class="sec"><span class="area-dot ${t.area}"></span>${t.section}</span>`,
  t.event && `<span>${ic('clock', 'i-s')}${t.event}</span>`,
  t.project && `<span>${ic('folder-kanban', 'i-s')}${t.project}</span>`,
  t.sub && `<span>${ic('list-checks', 'i-s')}${t.sub}</span>`,
  t.late && `<span class="late-txt">Due Thursday</span>`,
].filter(Boolean).join('');
const taskRow = (t, dir) => `<li class="task ${t.area}${t.done ? ' is-done' : ''}${t.late ? ' is-late' : ''}">
${dir === 'a' ? `<span class="period">${t.time}</span>` : ''}${check(t, dir)}
<div class="task-body"><p class="task-title">${t.flag ? `<span class="flag" title="High priority">${ic('flag', 'i-s')}<span class="sr">High priority</span></span>` : ''}${t.title}</p><p class="task-meta">${meta(t)}</p></div>
${dir === 'a' ? '' : `<span class="when">${t.time}</span>`}</li>`;

const seg = (label, opts, on) => `<div class="seg" role="tablist" aria-label="${label}">${opts.map(([l, n]) => `<button role="tab" aria-selected="${l === on}" class="${l === on ? 'on' : ''}">${l}${n ? `<span>${n}</span>` : ''}</button>`).join('')}</div>`;

// ---------- Screens ----------
const pageHead = (title, sub, action = '') => `<header class="page-head"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${action}</header>`;

function home(dir) {
  const checkin = `<section class="block checkin" aria-labelledby="ci"><div class="block-head"><h2 id="ci">Check-in</h2><span class="hint">Saved 08:24</span></div>
<div class="ci-grid">
<div class="ci-field"><p class="lbl">Mood</p>${seg('Mood', [['Rough'], ['Low'], ['Okay'], ['Good'], ['Great']], 'Good')}</div>
<div class="ci-field"><p class="lbl">Energy</p>${seg('Energy', [['Drained'], ['Low'], ['Okay'], ['Good'], ['Full']], 'Okay')}</div>
<div class="ci-field"><p class="lbl">Sleep</p><p class="ci-val"><b>7 h 15 m</b><span>01:05 to 08:20</span></p></div>
<div class="ci-field"><p class="lbl">Water</p><div class="stepper"><button class="btn btn-icon btn-sm" aria-label="One glass less">–</button><b>3</b><span>of 8</span><button class="btn btn-icon btn-sm" aria-label="One more glass">+</button></div></div>
</div></section>`;
  const next = `<section class="block" aria-labelledby="nu"><div class="block-head"><h2 id="nu">Next up</h2><a class="link" href="#">Open Today</a></div>
<ul class="next">
<li class="next-item work"><span class="next-time"><b>11:30</b><span>in 1 h 50 m</span></span><div><p class="task-title">SMAI lecture</p><p class="task-meta"><span class="sec"><span class="area-dot work"></span>SMAI</span><span>${ic('map-pin', 'i-s')}H-105, till 13:00</span></p></div></li>
<li class="next-item work"><span class="next-time"><b>Today</b><span>high priority</span></span><div><p class="task-title">Email Prof. Rajan about the draft</p><p class="task-meta"><span class="sec"><span class="area-dot work"></span>Thesis</span><span>${ic('list-checks', 'i-s')}1/3</span></p></div></li>
</ul></section>`;
  const map = dir === 'c' ? transitMap() : `<div class="map">${Object.entries(AREAS).map(([k, a]) => `<div class="map-col ${k}"><a class="map-area" href="#">${ic(a.icon)}<span>${a.name}</span><b>${a.open} open</b></a><ul>${a.sections.map(([s, n, kids]) => `<li><a href="#">${s}${n ? `<b>${n}</b>` : ''}</a>${kids ? `<ul>${kids.map((c) => `<li><a href="#">${c}</a></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></div>`).join('')}</div>`;
  const sections = `<section class="block" aria-labelledby="ys"><div class="block-head"><h2 id="ys">Your sections</h2><button class="link">${ic('chevron-down', 'i-s')}Hide</button></div>${map}</section>`;
  const today = dir === 'a' ? `<section class="block" aria-labelledby="tt"><div class="block-head"><h2 id="tt">Friday’s timetable</h2><a class="link" href="#">Calendar</a></div>${timetableStrip()}</section>` : '';
  return `${pageHead('Home', 'Friday, 20 November')}${checkin}${next}${today}${sections}`;
}

// Direction A signature on Home: the day ruled as a timetable, periods on a time axis.
function timetableStrip() {
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  const blocks = [['work', 9.5, 10, 'Email'], ['work', 11.5, 13, 'SMAI lecture · H-105'], ['work', 14, 15.5, 'Lab meeting slides'], ['work', 16, 17, 'Lab meeting'], ['self', 18, 19, 'DSA practice'], ['personal', 20, 20.5, 'Call']];
  const pct = (h) => ((h - 8) / 13) * 100;
  return `<div class="tt"><div class="tt-hours">${hours.map((h) => `<span style="left:${pct(h)}%">${String(h).padStart(2, '0')}</span>`).join('')}</div><div class="tt-track"><span class="tt-now" style="left:${pct(9.67)}%" aria-label="Now, 09:40"></span>${blocks.map(([a, s, e, l]) => `<span class="tt-block ${a}" style="left:${pct(s)}%;width:${pct(e) - pct(s)}%">${l}</span>`).join('')}</div></div>`;
}

// Direction C signature on Home: the section map drawn as a line diagram.
function transitMap() {
  return `<div class="metro">${Object.entries(AREAS).map(([k, a]) => {
    const stops = a.sections.flatMap(([s, n, kids]) => [[s, n], ...(kids || []).map((c) => [c, 0, true])]);
    return `<div class="metro-line ${k}"><a class="metro-term" href="#">${ic(a.icon)}<span>${a.name}</span><b>${a.open}</b></a><ol>${stops.map(([s, n, child]) => `<li class="${child ? 'branch' : ''}${n ? ' busy' : ''}"><a href="#"><span class="stop"></span><span class="stop-name">${s}${n ? ` <b>${n}</b>` : ''}</span></a></li>`).join('')}</ol></div>`;
  }).join('')}</div>`;
}

function tasks(dir) {
  const head = pageHead('All Tasks', 'Every task from every section.');
  const add = `<div class="add"><span class="add-plus">${ic('plus')}</span><input aria-label="Add a task" placeholder="Add a task, like “lab meeting slides fri 2pm”"><span class="add-dest">Goes to ${ic('inbox', 'i-s')}Inbox</span></div>`;
  const filters = `<div class="filters">${seg('When', [['All'], ['This week'], ['Upcoming']], 'All')}<label class="select"><span class="sr">Section</span><select><option>All sections</option></select>${ic('chevron-down', 'i-s')}</label><span class="spacer"></span>${seg('Status', [['Open', 11], ['Completed'], ['Skipped']], 'Open')}</div>`;
  const list = GROUPS.map(([g, items]) => `<section class="tgroup${g === 'Overdue' ? ' overdue' : ''}" aria-label="${g}"><h2 class="tgroup-head">${g}<span>${items.length}</span>${g === 'Overdue' ? '<button class="link">Move all to today</button>' : ''}</h2><ul class="tasks${dir === 'c' ? ' line' : ''}">${items.map((t) => taskRow(t, dir)).join('')}</ul></section>`).join('');
  return `${head}${add}${filters}${list}`;
}

function habits(dir) {
  const head = pageHead('Habits', 'Tap a day to mark it done. Long press or right-click to skip, rest or clear.', `<button class="btn btn-primary">${ic('plus')}New habit</button>`);
  const cell = (s, i, h) => {
    const label = `${h.name}, ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]} ${DAYS[i][1]}: ${STATE_LABEL[s] || 'Not yet'}`;
    const glyph = dir === 'a' ? { d: ic('check'), x: ic('check'), s: 'S', r: 'R', m: '–', t: '', f: '' }[s] : (s === 'd' || s === 'x') ? ic('check') : s === 's' ? '<i class="slash"></i>' : s === 'r' ? '<i class="rest"></i>' : '';
    return `<button class="cell s-${s}${i === TODAY_COL ? ' today' : ''}" aria-label="${label}"${s === 'f' ? ' disabled' : ''}>${glyph}</button>`;
  };
  const grid = `<div class="hgrid" role="table" aria-label="Habits this week">
<div class="hrow hhead" role="row"><span class="hname" role="columnheader">This week<span class="sub2">16 to 22 November</span></span>${DAYS.map(([d, n], i) => `<span class="hday${i === TODAY_COL ? ' today' : ''}" role="columnheader"><span>${d}</span><b>${n}</b></span>`).join('')}<span class="hcount" role="columnheader">Week</span></div>
${HABITS.map((h) => `<div class="hrow ${h.area}" role="row"><div class="hname" role="rowheader"><p class="task-title"><span class="area-dot ${h.area}"></span>${h.name}</p><p class="task-meta"><span>${h.rule}</span><span>${ic('bell', 'i-s')}${h.remind}</span>${h.link ? `<span>${ic('link', 'i-s')}${h.link}</span>` : ''}</p></div>${dir === 'c' ? `<div class="hline" role="presentation"></div>` : ''}${h.week.map((s, i) => cell(s, i, h)).join('')}<span class="hcount"><b>${h.count}</b><span>${h.rate} 30 d</span></span><button class="btn btn-icon btn-ghost hmore" aria-label="More for ${h.name}">${ic('ellipsis')}</button></div>`).join('')}
</div>`;
  const legend = dir === 'a'
    ? `<p class="legend"><span><b>${ic('check', 'i-s')}</b> Done</span><span><b>S</b> Skipped, with a reason</span><span><b>R</b> Rest day</span><span><b>–</b> Missed</span></p>`
    : `<p class="legend"><span><i class="lg s-d"></i>Done</span><span><i class="lg s-s"></i>Skipped, with a reason</span><span><i class="lg s-r"></i>Rest day</span><span><i class="lg s-m"></i>Missed</span></p>`;
  const sugg = `<section class="block" aria-labelledby="sg"><div class="block-head"><h2 id="sg">Suggested</h2><button class="link">${ic('chevron-down', 'i-s')}Show 2</button></div></section>`;
  return `${head}${grid}${legend}${sugg}`;
}

// ---------- Direction styles ----------
const BASE = `*{box-sizing:border-box;margin:0;padding:0}html{-webkit-text-size-adjust:100%}body{background:var(--bg);color:var(--fg);font:var(--fs-body)/1.45 var(--font);font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}button,input,select{font:inherit;color:inherit;background:none;border:0}button{cursor:pointer}ul,ol{list-style:none}
.i{width:18px;height:18px;flex:none}.i-s{width:14px;height:14px;flex:none;vertical-align:-2px}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}::selection{background:color-mix(in srgb,var(--focus) 28%,transparent)}
html,.side{scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--muted) 45%,transparent) transparent}
.app{display:grid;grid-template-columns:var(--side-w) 1fr;min-height:100vh}
.side{position:sticky;top:0;height:100vh;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:14px 12px}
.brand{display:flex;align-items:center;gap:9px;font-weight:650;padding:2px 6px}.mark{display:grid;grid-template-columns:7px 7px;gap:2px}.mark i{width:7px;height:7px;border-radius:2px}
.mark .work,.area-dot.work{background:var(--work)}.mark .self,.area-dot.self{background:var(--self)}.mark .personal,.area-dot.personal{background:var(--personal)}.mark .misc,.area-dot.misc{background:var(--misc)}
.area-dot{display:inline-block;width:8px;height:8px;border-radius:var(--dot-r);flex:none}
.side-actions{display:flex;gap:6px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:34px;padding:0 12px;border-radius:var(--r-ctl);font-weight:560;font-size:var(--fs-ui);white-space:nowrap}
.btn-block{flex:1;justify-content:flex-start}.btn kbd{margin-left:auto;font:inherit;font-size:11px;opacity:.6}.btn-icon{width:34px;padding:0}.btn-sm{width:28px;height:28px}
.nav-group{display:flex;flex-direction:column;gap:1px}.nav-label{font-size:var(--fs-label);font-weight:600;padding:0 8px 4px}
.nav-item{display:flex;align-items:center;gap:10px;height:32px;padding:0 8px;border-radius:var(--r-ctl);font-size:var(--fs-ui)}.nav-item .count{margin-left:auto;font-weight:500;font-size:12px}
.side-foot{margin-top:auto;display:flex;flex-direction:column;gap:1px}
.main{min-width:0}.page{max-width:var(--page-w);margin:0 auto;padding:var(--page-pad)}
.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:var(--gap-l)}
h1{font-size:var(--fs-h1);line-height:1.15;font-weight:var(--h1-w);letter-spacing:var(--h1-ls)}.sub{margin-top:4px;font-size:var(--fs-ui)}
.block{margin-bottom:var(--gap-l)}.block-head{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:10px}
h2{font-size:var(--fs-h2);font-weight:650}.hint,.link{font-size:12.5px;display:inline-flex;align-items:center;gap:4px}
.ci-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 28px}.lbl{font-size:12.5px;margin-bottom:6px}
.seg{display:inline-flex;gap:2px;padding:2px;border-radius:var(--r-ctl)}.seg button{white-space:nowrap;height:28px;padding:0 10px;border-radius:calc(var(--r-ctl) - 2px);font-size:12.5px;font-weight:540;display:inline-flex;gap:6px;align-items:center}.seg button span{opacity:.65}
.ci-val{display:flex;align-items:baseline;gap:8px}.ci-val b{font-size:15px;font-weight:600}.ci-val span{font-size:12.5px}
.stepper{display:flex;align-items:center;gap:8px}.stepper b{font-size:15px;min-width:1ch;text-align:center}.stepper span{font-size:12.5px;margin-right:4px}
.next-item{display:flex;gap:16px;align-items:flex-start;padding:10px 0}.next-time{display:flex;flex-direction:column;width:84px;flex:none}.next-time b{font-weight:600}.next-time span{font-size:12px}
.task-title{font-size:var(--fs-body);font-weight:500;display:flex;align-items:center;gap:7px}.task-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;margin-top:2px}.task-meta span{display:inline-flex;align-items:center;gap:5px}
.map{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}.map-area{display:flex;align-items:center;gap:8px;font-weight:600;padding:8px 0}.map-area b{margin-left:auto;font-size:12px;font-weight:500}
.map ul ul{padding-left:14px}.map li a{display:flex;justify-content:space-between;font-size:var(--fs-ui);padding:4px 0}.map li b{font-weight:500;font-size:12px}
.add{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:var(--r-card);margin-bottom:12px}.add input{flex:1;outline:0;font-size:var(--fs-body)}.add-dest{display:inline-flex;align-items:center;gap:5px;font-size:12px;white-space:nowrap}
.filters{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:var(--gap-l)}.spacer{flex:1}
.select{position:relative;display:inline-flex;align-items:center}.select select{appearance:none;height:32px;padding:0 30px 0 10px;border-radius:var(--r-ctl);font-size:12.5px;font-weight:540}.select .i-s{position:absolute;right:9px;pointer-events:none}
.tgroup{margin-bottom:22px}.tgroup-head{display:flex;align-items:center;gap:8px;font-size:var(--fs-h2);margin-bottom:4px}.tgroup-head>span{font-weight:500;font-size:12px}.tgroup-head .link{margin-left:auto;font-weight:500}
.task{display:flex;align-items:flex-start;gap:12px;padding:9px 0}.task-body{flex:1;min-width:0}.when{font-size:12.5px;white-space:nowrap;padding-top:2px}
.check{width:18px;height:18px;margin-top:1px;border-radius:var(--r-check);border:1.5px solid var(--check);display:grid;place-items:center;flex:none}.check .i{width:12px;height:12px;stroke-width:3}
.is-done .task-title{text-decoration:line-through;text-decoration-thickness:1px}.flag{color:var(--danger);display:inline-flex}.late-txt{color:var(--danger)}
.hgrid{border-radius:var(--r-card);overflow:hidden}.hrow{display:grid;grid-template-columns:minmax(200px,1fr) repeat(7,var(--cell)) 88px 34px;align-items:center;gap:6px;padding:10px 14px}
.hday{display:flex;flex-direction:column;align-items:center;font-size:11.5px}.hday b{font-size:13px;font-weight:600}
.cell{width:var(--cell);height:var(--cell);border-radius:var(--r-cell);display:grid;place-items:center;font-weight:650}.cell .i{width:16px;height:16px;stroke-width:2.6}.cell:disabled{cursor:default}
.hcount{display:flex;flex-direction:column;align-items:flex-end;font-size:12px}.hcount b{font-size:13.5px;font-weight:600}.hhead .hcount{font-weight:600;font-size:12px}.hname .sub2{display:block;font-size:12px;font-weight:400}.hhead .hname{font-weight:600;font-size:12.5px}
.legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;margin:10px 0 var(--gap-l)}.legend span{display:inline-flex;align-items:center;gap:6px}
.tabbar,.forerail-ph{display:none}
@media (max-width:767px){.app{display:block}.side{display:none}.page{padding:18px 16px 96px}
.tabbar{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;height:64px;align-items:center;z-index:5}
.tab{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:540}.tab-new{justify-self:center;width:48px;height:48px;border-radius:var(--r-fab);display:grid;place-items:center}
.ci-grid{grid-template-columns:1fr}.seg{display:flex}.seg button{flex:1;height:36px;justify-content:center;padding:0 4px}.map{grid-template-columns:1fr 1fr}
.filters .spacer{display:none}.add-dest{display:none}
.hrow{grid-template-columns:repeat(7,1fr) 34px;row-gap:8px;padding:12px}.hrow .hname{grid-column:1/-1}.hrow .hcount{display:none}.cell{width:100%;height:40px}.hhead .hname{display:none}.hmore{grid-row:1;grid-column:8}.hrow .hname{grid-column:1/8}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;

const FONTS = {
  a: 'family=Public+Sans:wght@400;500;600;700',
  b: 'family=Archivo:wdth,wght@75..100,400..700',
  c: 'family=Overpass:wght@400;500;600;700',
};

const STYLES = {
  // A. Timetable: the registrar's printed course timetable and the attendance register.
  a: `:root{--font:'Public Sans',system-ui,sans-serif;--fs-body:14px;--fs-ui:13px;--fs-label:11.5px;--fs-h1:21px;--fs-h2:13.5px;--h1-w:700;--h1-ls:-.01em;
--side-w:236px;--page-w:1040px;--page-pad:28px 40px 64px;--gap-l:26px;--r-ctl:4px;--r-card:4px;--r-check:3px;--r-cell:3px;--r-fab:6px;--dot-r:1px;--cell:34px;
--bg:#f3f5f7;--surface:#fff;--surface-2:#e8ecf0;--rule:#d5dbe2;--rule-2:#a3afbc;--fg:#17202b;--muted:#596574;--shell:#1b2735;--shell-fg:#d9e0e8;--shell-muted:#8b99aa;--shell-on:#2b3b4e;
--accent:#17202b;--accent-fg:#fff;--check:#7d8896;--danger:#c4401a;--focus:#3b4fc8;--work:#3b4fc8;--self:#1d8556;--personal:#b3367a;--misc:#a26b0a}
@media (prefers-color-scheme:dark){:root{--bg:#0f151c;--surface:#151d26;--surface-2:#1c2631;--rule:#263241;--rule-2:#3c4a5b;--fg:#e3e8ee;--muted:#8f9bab;--shell:#0a0f15;--shell-fg:#c8d1dc;--shell-muted:#7a889a;--shell-on:#1a2531;
--accent:#e3e8ee;--accent-fg:#0f151c;--check:#6c7a8b;--danger:#ff7a52;--focus:#8c9bff;--work:#8c9bff;--self:#57c792;--personal:#f07fb5;--misc:#e3b04b}}
.side{background:var(--shell);color:var(--shell-fg)}.nav-label,.side .count{color:var(--shell-muted)}.nav-item:hover{background:var(--shell-on)}.nav-item.on{background:var(--shell-on);color:#fff;box-shadow:inset 2px 0 0 var(--shell-fg)}
.side .btn-primary{background:var(--shell-fg);color:var(--shell)}.side .btn-icon{border:1px solid var(--shell-on)}.side .btn kbd{color:var(--shell)}
.btn-primary{background:var(--accent);color:var(--accent-fg)}.btn-ghost,.muted,.sub,.hint,.link,.lbl,.task-meta,.when,.next-time span,.hday,.hcount span,.legend,.tgroup-head>span,.map li b,.map-area b,.ci-val span,.stepper span,.add-dest,.hname .sub2{color:var(--muted)}
h1{padding-bottom:10px;border-bottom:2px solid var(--fg)}.page-head{border:0}.page-head .btn{margin-top:-2px}
.block-head{border-bottom:1px solid var(--rule-2);padding-bottom:6px}.block-head h2{font-weight:700}
.seg{background:var(--surface-2)}.seg button.on{background:var(--surface);box-shadow:0 0 0 1px var(--rule-2)}
.stepper .btn{border:1px solid var(--rule-2)}.checkin .ci-grid{background:var(--surface);border:1px solid var(--rule);padding:14px 16px}
.next-item{border-bottom:1px solid var(--rule)}.next-time b{font-size:15px}
.tt{background:var(--surface);border:1px solid var(--rule);padding:8px 12px 12px}.tt-hours{position:relative;height:18px;font-size:11px;color:var(--muted)}.tt-hours span{position:absolute;transform:translateX(-50%)}
.tt-track{position:relative;height:46px;background:repeating-linear-gradient(90deg,var(--rule) 0 1px,transparent 1px calc(100%/13))}.tt-block{position:absolute;top:6px;bottom:6px;padding:0 6px;font-size:11.5px;font-weight:600;line-height:34px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border:1px solid;color:var(--fg)}
.tt-block.work{border-color:var(--work);background:color-mix(in srgb,var(--work) 12%,var(--surface))}.tt-block.self{border-color:var(--self);background:color-mix(in srgb,var(--self) 12%,var(--surface))}.tt-block.personal{border-color:var(--personal);background:color-mix(in srgb,var(--personal) 12%,var(--surface))}
.tt-now{position:absolute;top:-4px;bottom:-4px;width:2px;background:var(--danger)}
.map{gap:0;border:1px solid var(--rule);background:var(--surface)}.map-col{padding:10px 14px;border-left:1px solid var(--rule)}.map-col:first-child{border-left:0}.map-area{border-bottom:2px solid}.map-col.work .map-area{border-color:var(--work)}.map-col.self .map-area{border-color:var(--self)}.map-col.personal .map-area{border-color:var(--personal)}.map-col.misc .map-area{border-color:var(--misc)}
.map li a{border-bottom:1px solid var(--rule)}.map ul ul a{color:var(--muted)}
.add{background:var(--surface);border:1px solid var(--rule-2);border-radius:var(--r-ctl)}.add-plus{color:var(--muted)}
.select select{background:var(--surface);border:1px solid var(--rule-2)}
.tgroup-head{border-bottom:2px solid var(--fg);padding-bottom:5px;margin-bottom:0}.overdue .tgroup-head{border-color:var(--danger);color:var(--danger)}
.task{display:grid;grid-template-columns:72px 18px 1fr;gap:12px;padding:8px 0 8px;border-bottom:1px solid var(--rule);position:relative}
.task .period{font-size:12.5px;font-weight:600;padding-top:1px;border-right:3px solid;padding-right:8px;align-self:stretch}.task.work .period{border-color:var(--work)}.task.self .period{border-color:var(--self)}.task.personal .period{border-color:var(--personal)}.task.misc .period{border-color:var(--misc)}
.check.done{background:var(--fg);border-color:var(--fg);color:var(--bg)}.is-done .task-title,.is-done .period{color:var(--muted)}.is-late .period{color:var(--danger)}
.hgrid{background:var(--surface);border:1px solid var(--rule-2);border-radius:0}.hrow{border-bottom:1px solid var(--rule);gap:0;padding:0 0 0 14px;min-height:56px}.hhead{min-height:48px;border-bottom:2px solid var(--fg)}
.hrow>.cell,.hrow>.hday{border-left:1px solid var(--rule);height:100%;width:100%;border-radius:0}.hrow>.cell{min-height:56px;font-size:15px}.hday.today,.cell.today{background:color-mix(in srgb,var(--fg) 6%,transparent);box-shadow:inset 1px 0 0 var(--fg),inset -1px 0 0 var(--fg)}
.hday{justify-content:center}.hday.today b{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:2px}
.cell.s-d,.cell.s-x{color:var(--fg)}.cell.s-s,.cell.s-r{color:var(--muted);font-size:13px}.cell.s-m{color:var(--danger)}.cell.s-t{}.cell.s-t::after{content:'';width:14px;height:14px;border:1.5px solid var(--check);border-radius:50%}
.cell:not(:disabled):hover{background:var(--surface-2)}.hcount{padding:0 10px;border-left:1px solid var(--rule);height:100%;justify-content:center}.hrow .hname .area-dot{border-radius:1px}
.legend b{display:inline-grid;place-items:center;width:20px;height:20px;border:1px solid var(--rule-2);font-size:12px;color:var(--fg)}
.tabbar{background:var(--shell);color:var(--shell-muted)}.tab.on{color:#fff}.tab-new{background:var(--shell-fg);color:var(--shell)}
@media (max-width:767px){.task{grid-template-columns:56px 18px 1fr}.hrow{padding:12px 12px 0;gap:0}.hrow>.cell{min-height:44px;border-top:1px solid var(--rule)}.hrow>.cell:first-of-type{border-left:0}.tt-block{font-size:0}.map{grid-template-columns:1fr 1fr}.map-col:nth-child(3){border-left:0}.map-col:nth-child(n+3){border-top:1px solid var(--rule)}.hhead{display:grid;padding:0}.hhead .hday{min-height:44px}.hhead .hday:first-of-type{border-left:0}}`,

  // B. Divider tabs: a reference manual open at a tabbed section; the area hue is the board, content sits on leaves.
  b: `:root{--font:'Archivo',system-ui,sans-serif;--fs-body:14.5px;--fs-ui:13.5px;--fs-label:12px;--fs-h1:26px;--fs-h2:14px;--h1-w:700;--h1-ls:0;
--side-w:232px;--page-w:980px;--page-pad:30px 40px 64px;--gap-l:24px;--r-ctl:6px;--r-card:8px;--r-check:5px;--r-cell:6px;--r-fab:14px;--dot-r:2px;--cell:36px;
--board:#2a2d32;--board-fg:#e9e9e6;--bg:#2a2d32;--leaf:#fbfbf9;--leaf-2:#f0f0ec;--rule:#e2e2dc;--fg:#1d1f23;--muted:#62656c;--accent:#1d1f23;--accent-fg:#fbfbf9;--check:#8d9098;--danger:#d9431c;--focus:#2448c8;
--work:#2448c8;--self:#2a7d3e;--personal:#c43a7c;--misc:#e0a015}
@media (prefers-color-scheme:dark){:root{--board:#0d0e10;--bg:#0d0e10;--board-fg:#c9cac6;--leaf:#1b1d21;--leaf-2:#24272c;--rule:#2e3137;--fg:#ecece8;--muted:#9a9da4;--accent:#ecece8;--accent-fg:#1b1d21;--check:#6d717a;--danger:#ff7650;--focus:#8ea2ff;
--work:#6f86ff;--self:#5cbf6c;--personal:#ec6aa6;--misc:#f2bb3a}
.forerail .fore[class],.map .map-col[class] .map-area,.hgrid .hrow[class] .cell.s-d,.hgrid .hrow[class] .cell.s-x{color:#0d0e10}}
body{background:var(--board)}.app{grid-template-columns:var(--side-w) 1fr 34px}
.side{color:var(--board-fg)}.nav-label{color:color-mix(in srgb,var(--board-fg) 55%,transparent);font-stretch:85%;font-weight:700}.side .count{opacity:.6}.nav-item:hover{background:rgb(255 255 255/.06)}.nav-item.on{background:var(--leaf);color:var(--fg);border-radius:var(--r-ctl) 0 0 var(--r-ctl);margin-right:-12px;padding-right:20px}
.brand{font-stretch:80%;font-size:17px;letter-spacing:.01em}.side .btn-primary{background:var(--misc);color:#1d1f23}.side .btn-icon{background:rgb(255 255 255/.08)}
.main{background:var(--leaf);margin:10px 0;border-radius:10px 0 0 10px;box-shadow:0 1px 0 rgb(0 0 0/.2)}
.btn-primary{background:var(--accent);color:var(--accent-fg)}.muted,.sub,.hint,.link,.lbl,.task-meta,.when,.next-time span,.hday,.hcount span,.legend,.tgroup-head>span,.map li b,.map-area b,.ci-val span,.stepper span,.add-dest,.hname .sub2{color:var(--muted)}
h1{font-stretch:78%;font-size:30px;letter-spacing:.005em}h2{font-stretch:85%;font-size:15px;font-weight:700}.page-head{padding-bottom:14px;border-bottom:1px solid var(--rule)}
.block{background:var(--leaf);border:1px solid var(--rule);border-radius:var(--r-card);padding:14px 16px}.block-head{margin-bottom:12px}
.seg{background:var(--leaf-2)}.seg button.on{background:var(--fg);color:var(--leaf)}.stepper .btn{background:var(--leaf-2)}
.next-item+.next-item{border-top:1px solid var(--rule)}.next-time b{font-stretch:80%;font-size:17px}
.map-col{border-radius:var(--r-ctl);overflow:hidden;background:var(--leaf-2)}.map-area{padding:10px 12px;color:#fff}.map-col.misc .map-area{color:#1d1f23}.map-col.work .map-area{background:var(--work)}.map-col.self .map-area{background:var(--self)}.map-col.personal .map-area{background:var(--personal)}.map-col.misc .map-area{background:var(--misc)}.map-area b{color:inherit;opacity:.85}
.map>.map-col>ul{padding:6px 12px 10px}
.add{background:var(--leaf-2);border:1px solid var(--rule)}.select select{background:var(--leaf-2)}
.tgroup-head{font-stretch:85%;font-size:15px}.overdue .tgroup-head{color:var(--danger)}
.tasks{border-top:1px solid var(--rule)}.task{border-bottom:1px solid var(--rule);padding:10px 4px}
.check.done{background:var(--fg);border-color:var(--fg);color:var(--leaf)}.is-done .task-title{color:var(--muted)}.is-late .check{border-color:var(--danger)}
.hgrid{border:1px solid var(--rule)}.hrow+.hrow{border-top:1px solid var(--rule)}.hhead{background:var(--leaf-2)}.hday.today{color:var(--fg)}.hday.today b{background:var(--fg);color:var(--leaf);border-radius:4px;padding:0 5px}
.cell{border:1.5px solid var(--rule);background:var(--leaf)}.cell.today{border-color:var(--fg)}
.hrow.work .cell.s-d,.hrow.work .cell.s-x{background:var(--work);border-color:var(--work);color:#fff}.hrow.self .cell.s-d,.hrow.self .cell.s-x{background:var(--self);border-color:var(--self);color:#fff}.hrow.personal .cell.s-d,.hrow.personal .cell.s-x{background:var(--personal);border-color:var(--personal);color:#fff}
.cell .slash{width:16px;height:2px;background:var(--muted);transform:rotate(-45deg)}.cell .rest{width:10px;height:10px;border-radius:50%;background:var(--muted)}.cell.s-m{border-style:dashed;border-color:var(--danger)}.cell:disabled{background:transparent;border-color:color-mix(in srgb,var(--rule) 60%,transparent)}
.lg{display:inline-grid;place-items:center;width:16px;height:16px;border-radius:4px;border:1.5px solid var(--rule)}.lg.s-d{background:var(--fg);border-color:var(--fg)}.lg.s-s::after{content:'';width:10px;height:1.5px;background:var(--muted);transform:rotate(-45deg)}.lg.s-r::after{content:'';width:6px;height:6px;border-radius:50%;background:var(--muted)}.lg.s-m{border-style:dashed;border-color:var(--danger)}
.forerail{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;gap:3px;padding:10px 0}.fore{writing-mode:vertical-rl;display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-radius:0 8px 8px 0;font-weight:650;font-size:12.5px;font-stretch:80%;color:#fff;min-height:84px}.fore b{font-weight:600;opacity:.85}
.fore.work{background:var(--work)}.fore.self{background:var(--self)}.fore.personal{background:var(--personal)}.fore.misc{background:var(--misc);color:#1d1f23}
.tabbar{background:var(--board);color:color-mix(in srgb,var(--board-fg) 65%,transparent)}.tab.on{color:var(--board-fg)}.tab-new{background:var(--misc);color:#1d1f23}
@media (max-width:767px){.app{display:flex;flex-direction:column}.main{margin:0;border-radius:0;min-height:100vh}.forerail{order:-1;position:sticky;top:0;z-index:4;flex-direction:row;height:30px;padding:0;gap:2px;background:var(--board)}.fore{writing-mode:horizontal-tb;min-height:0;padding:0 8px;border-radius:0 0 6px 6px;font-size:11.5px;overflow:hidden;white-space:nowrap}.fore span{overflow:hidden;text-overflow:ellipsis}.block{padding:12px}.map{grid-template-columns:1fr 1fr;gap:10px}.cell{height:40px}}`,

  // C. Lines: a transit diagram; each life area is a line, sections are its stations.
  c: `:root{--font:'Overpass',system-ui,sans-serif;--fs-body:14.5px;--fs-ui:13.5px;--fs-label:12px;--fs-h1:24px;--fs-h2:14.5px;--h1-w:700;--h1-ls:-.01em;
--side-w:240px;--page-w:1000px;--page-pad:30px 40px 64px;--gap-l:30px;--r-ctl:999px;--r-card:12px;--r-check:50%;--r-cell:50%;--r-fab:50%;--dot-r:50%;--cell:30px;
--bg:#f6f7f8;--surface:#fff;--surface-2:#eceef1;--rule:#e0e3e7;--fg:#1a1d21;--muted:#5d646e;--accent:#1a1d21;--accent-fg:#fff;--check:#9aa1ab;--danger:#d3361d;--focus:#0067c6;
--work:#0067c6;--self:#007f52;--personal:#d02a66;--misc:#b88200;--line-w:4px}
@media (prefers-color-scheme:dark){:root{--bg:#131518;--surface:#1b1e22;--surface-2:#24282d;--rule:#2c3036;--fg:#eceef0;--muted:#9aa1ab;--accent:#eceef0;--accent-fg:#131518;--check:#6f7680;--danger:#ff6f52;--focus:#5aa9ff;
--work:#4c9dff;--self:#2fc28a;--personal:#ff6b9d;--misc:#ffc233}
.metro .metro-line .metro-term,.tasks .station.done,.hgrid .hrow .cell.s-d,.hgrid .hrow .cell.s-x{color:#131518}}
.side{background:var(--surface);border-right:1px solid var(--rule)}.nav-label,.side .count{color:var(--muted)}.nav-item:hover{background:var(--surface-2)}.nav-item.on{background:var(--fg);color:var(--bg)}.nav-item.on .count{color:inherit}
.area-item .area-dot{width:14px;height:4px;border-radius:2px}
.btn-primary{background:var(--accent);color:var(--accent-fg)}.side .btn-icon{background:var(--surface-2)}.btn kbd{color:inherit}
.muted,.sub,.hint,.link,.lbl,.task-meta,.when,.next-time span,.hday,.hcount span,.legend,.tgroup-head>span,.ci-val span,.stepper span,.add-dest,.hname .sub2{color:var(--muted)}
.seg{background:var(--surface-2)}.seg button{border-radius:999px}.seg button.on{background:var(--fg);color:var(--bg)}.stepper .btn{background:var(--surface-2)}
.checkin,.block:has(.next){background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-card);padding:16px 18px}
.next{position:relative}.next-item{position:relative;padding-left:22px}.next-item::before{content:'';position:absolute;left:4px;top:14px;width:10px;height:10px;border-radius:50%;border:3px solid var(--work);background:var(--surface)}.next-item:not(:last-child)::after{content:'';position:absolute;left:9.5px;top:27px;bottom:-14px;width:var(--line-w);background:var(--work);transform:translateX(-50%)}
.metro{display:flex;flex-direction:column;gap:18px;background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-card);padding:18px}
.metro-line{display:grid;grid-template-columns:200px 1fr;align-items:center;gap:12px}.metro-term{display:flex;align-items:center;gap:8px;font-weight:700;padding:6px 12px;border-radius:999px;color:#fff;font-size:13.5px}.metro-term b{margin-left:auto;font-weight:600;opacity:.9}
.metro-line.work .metro-term{background:var(--work)}.metro-line.self .metro-term{background:var(--self)}.metro-line.personal .metro-term{background:var(--personal)}.metro-line.misc .metro-term{background:var(--misc);color:#1a1d21}
.metro ol{display:flex;position:relative;padding-top:2px}.metro ol::before{content:'';position:absolute;left:0;right:12px;top:9px;height:var(--line-w);border-radius:2px;background:var(--c)}.metro-line{--c:var(--work)}.metro-line.self{--c:var(--self)}.metro-line.personal{--c:var(--personal)}.metro-line.misc{--c:var(--misc)}
.metro li{flex:1;position:relative;min-width:0}.metro li a{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600}.stop{width:14px;height:14px;border-radius:50%;background:var(--surface);border:3px solid var(--c);position:relative;z-index:1}.busy .stop{width:18px;height:18px;margin:-2px 0 0 -2px;border-width:4px}
.metro li.branch .stop{border-style:dotted}.metro li.branch .stop-name{color:var(--muted);font-weight:500}.stop-name{padding-right:8px;line-height:1.25}.metro li b{font-weight:700;color:var(--c)}
.add{background:var(--surface);border:1px solid var(--rule);border-radius:999px;padding:0 16px}.select select{background:var(--surface-2);border-radius:999px}
.tgroup-head{font-size:15px}.overdue .tgroup-head{color:var(--danger)}
.tasks.line{position:relative}.tasks.line .task{position:relative;padding:9px 0 9px 0}.tasks.line .task::before{content:'';position:absolute;left:9px;top:0;bottom:0;width:var(--line-w);transform:translateX(-50%);background:var(--c)}.tasks.line .task:first-child::before{top:14px}.tasks.line .task:last-child::before{bottom:calc(100% - 14px)}
.task{--c:var(--work)}.task.self{--c:var(--self)}.task.personal{--c:var(--personal)}.task.misc{--c:var(--misc)}
.station{position:relative;z-index:1;width:18px;height:18px;margin-top:1px;border-radius:50%;background:var(--bg);border:3.5px solid var(--c);display:grid;place-items:center;flex:none}.station.done{background:var(--c);color:#fff}.station .i{width:11px;height:11px;stroke-width:3.4}.station.late{box-shadow:0 0 0 2px var(--bg),0 0 0 4px var(--danger)}
.is-done .task-title{color:var(--muted);text-decoration:line-through}.tasks.line .task{column-gap:0}.tasks.line .station{margin-right:12px}.task-body,.tasks.line .when{padding-bottom:9px;border-bottom:1px solid var(--rule);align-self:stretch}.tasks.line .when{padding-left:12px}.when{font-weight:600;color:var(--fg)}
.hgrid{background:var(--surface);border:1px solid var(--rule)}.hrow{position:relative;padding:12px 16px;column-gap:10px}.hrow+.hrow{border-top:1px solid var(--rule)}.hrow{--c:var(--work)}.hrow.self{--c:var(--self)}.hrow.personal{--c:var(--personal)}
.hline{position:absolute;height:var(--line-w);background:var(--c);border-radius:2px;top:50%;margin-top:-2px;left:calc(16px + max(200px, 100% - 32px - 7*var(--cell) - 9*10px - 122px) + 10px + var(--cell)/2);width:calc(6*(var(--cell) + 10px))}
.hhead .hday.today b{background:var(--fg);color:var(--bg);border-radius:999px;padding:0 6px}.hday{gap:2px}
.cell{position:relative;z-index:1;width:var(--cell);height:var(--cell);border-radius:50%;background:var(--surface);border:3.5px solid var(--c);justify-self:center}.cell.s-d,.cell.s-x{background:var(--c);color:#fff}.cell.today{box-shadow:0 0 0 3px var(--surface),0 0 0 5px var(--fg)}
.cell .slash{width:14px;height:3px;background:var(--c);transform:rotate(-45deg)}.cell.s-r{border-width:3.5px;width:18px;height:18px}.cell.s-m{border-color:var(--surface);background:var(--surface);box-shadow:inset 0 0 0 2px var(--danger);border:0;width:14px;height:14px}.cell:disabled{border-color:color-mix(in srgb,var(--c) 30%,var(--surface))}
.lg{display:inline-block;width:14px;height:14px;border-radius:50%;border:3px solid var(--work)}.lg.s-d{background:var(--work)}.lg.s-s{background:linear-gradient(135deg,transparent 44%,var(--work) 44% 56%,transparent 56%)}.lg.s-r{width:10px;height:10px}.lg.s-m{border:2px solid var(--danger);width:10px;height:10px}
.tabbar{background:var(--surface);border-top:1px solid var(--rule);color:var(--muted)}.tab.on{color:var(--fg)}.tab-new{background:var(--fg);color:var(--bg)}
@media (max-width:767px){.metro{padding:14px;gap:22px}.metro-line{grid-template-columns:1fr}.metro ol{overflow-x:auto;padding-bottom:4px}.metro li{flex:0 0 92px}.hline{display:none}.cell{width:36px;height:36px}.hrow{column-gap:4px}}`,
};

// The system theme wins unless <html data-theme="light|dark"> forces one (compare.html sets it).
function themeable(css) {
  return css.replace(/@media \(prefers-color-scheme:dark\)\{([\s\S]*?\})\}/, (_, inner) => {
    const scope = (s) => inner.replace(/(^|\})\s*([^{}]+)\{/g, (m, close, sels) =>
      `${close}${sels.split(',').map((x) => (x.trim().startsWith(':root') ? x.trim().replace(':root', s) : `${s} ${x.trim()}`)).join(',')}{`);
    return `@media (prefers-color-scheme:dark){${scope(':root:not([data-theme=light])')}}\n${scope(':root[data-theme=dark]')}`;
  });
}

// ---------- Write ----------
const NAMES = { a: 'Timetable', b: 'Divider tabs', c: 'Lines' };
const SCREENS = { home: ['Home', 'home', home], tasks: ['All Tasks', 'tasks', tasks], habits: ['Habits', 'habits', habits] };
for (const d of ['a', 'b', 'c']) {
  for (const [key, [title, cur, render]] of Object.entries(SCREENS)) {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${NAMES[d]}: ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${FONTS[d]}&display=swap">
<style>${BASE}
${themeable(STYLES[d])}</style></head><body><div class="app">${sidebar(cur)}<main class="main"><div class="page">${render(d)}</div></main>${d === 'b' ? forerail() : ''}</div>${tabbar(cur)}</body></html>`;
    writeFileSync(join(HERE, `${d}-${key}.html`), html);
  }
}
writeFileSync(join(HERE, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Design directions</title><style>body{font:15px/1.5 system-ui;max-width:640px;margin:40px auto;padding:0 16px}a{display:block;padding:4px 0}</style></head><body><h1>Design directions</h1>${['a', 'b', 'c'].map((d) => `<h2>${d.toUpperCase()}. ${NAMES[d]}</h2>${Object.entries(SCREENS).map(([k, [t]]) => `<a href="${d}-${k}.html">${t}</a>`).join('')}`).join('')}</body></html>`);
console.log('wrote 9 screens + index');
