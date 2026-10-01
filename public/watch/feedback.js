import { esc, fmtTime, FEELINGS, FEELING_LABELS, RELEVANCE_LABELS, LIKED } from '/shared/ui.js';
import { api, done, show, showSaved, state } from '/watch/watch.js';

const $ = (id) => document.getElementById(id);

const f = { ctx: null, answers: {}, steps: [], i: 0, lineFilter: '' };

/** Each step renders into #fb-body and reads its own inputs back into `f.answers`. */
function buildSteps(ctx) {
  const steps = [
    {
      id: 'feeling',
      required: () => f.answers.feeling,
      render: () => `<p class="eyebrow">Your reaction</p><h1>How did that make you feel?</h1><p class="muted">Go with your gut.</p>
        <div class="emoji-scale">${FEELINGS.map((e, i) => `<button type="button" data-set="feeling" data-v="${i + 1}" class="${f.answers.feeling === i + 1 ? 'on' : ''}"><span class="e">${e}</span>${FEELING_LABELS[i]}</button>`).join('')}</div>`,
    },
    {
      id: 'relevance',
      required: () => f.answers.relevance,
      render: () => `<p class="eyebrow">The topic</p><h1>How relevant is this topic to your life right now?</h1>
        <div class="scale-row">${RELEVANCE_LABELS.map((l, i) => `<button type="button" data-set="relevance" data-v="${i + 1}" class="${f.answers.relevance === i + 1 ? 'on' : ''}"><strong>${i + 1}</strong>${l}</button>`).join('')}</div>`,
    },
    {
      id: 'liked',
      required: () => f.answers.liked,
      render: () => `<p class="eyebrow">Overall</p><h1>So… did you like it?</h1>
        <div class="big-cards">${LIKED.map((l) => `<button type="button" data-set="liked" data-v="${l.key}" class="${f.answers.liked === l.key ? 'on' : ''}"><span class="e">${l.emoji}</span>${l.label}</button>`).join('')}</div>`,
    },
  ];

  if (ctx.moments.length) {
    steps.push({
      id: 'moments',
      render: () => `<p class="eyebrow">Your moments</p><h1>You marked ${ctx.moments.length} moment${ctx.moments.length === 1 ? '' : 's'} ✨</h1><p class="muted">What grabbed you? A few words each is perfect. Skip any you don't remember.</p>
        ${ctx.moments.map((m) => `<div class="moment"><span class="t">${fmtTime(m.at)}</span>${m.text ? `<q>${esc(m.text)}</q>` : '<span class="faint small">(no transcript for this part)</span>'}
          <input type="text" maxlength="500" data-moment="${m.at}" placeholder="What made this interesting?" value="${esc(f.answers.momentNotes?.[m.at] ?? '')}" /></div>`).join('')}`,
      read: () => {
        const notes = {};
        for (const el of document.querySelectorAll('[data-moment]')) if (el.value.trim()) notes[el.dataset.moment] = el.value.trim();
        f.answers.momentNotes = notes;
      },
    });
  }

  if (ctx.transcript.length) {
    steps.push({
      id: 'lines',
      render: () => {
        const picked = f.answers.standoutLines ?? [];
        return `<p class="eyebrow">Hooks</p><h1>Which lines stood out?</h1><p class="muted">Tap up to ${ctx.maxStandoutLines} lines that stuck with you: a quote you'd share, a surprise, an idea you'll remember.</p>
          <div class="lines-tools"><input type="search" id="line-search" placeholder="Search the transcript" value="${esc(f.lineFilter)}" /><span class="picked-count" id="picked-count">${picked.length} / ${ctx.maxStandoutLines}</span></div>
          <div class="lines" id="lines">${linesHtml()}</div>
          <div class="fb-q"><label for="why">Why did they stand out?</label><textarea id="why" maxlength="1000" placeholder="e.g. It changed how I think about sleep">${esc(f.answers.standoutWhy ?? '')}</textarea></div>`;
      },
      read: () => (f.answers.standoutWhy = $('why').value.trim()),
      mount: () => {
        $('line-search').oninput = (e) => {
          f.lineFilter = e.target.value;
          $('lines').innerHTML = linesHtml();
        };
        $('lines').onclick = (e) => {
          const b = e.target.closest('[data-line]');
          if (!b) return;
          const idx = Number(b.dataset.line);
          const set = new Set(f.answers.standoutLines ?? []);
          if (set.has(idx)) set.delete(idx);
          else if (set.size < ctx.maxStandoutLines) set.add(idx);
          f.answers.standoutLines = [...set];
          b.classList.toggle('on', set.has(idx));
          $('picked-count').textContent = `${set.size} / ${ctx.maxStandoutLines}`;
        };
      },
    });
  } else {
    steps.push({
      id: 'why',
      render: () => `<p class="eyebrow">Hooks</p><h1>What stood out most?</h1><p class="muted">A quote, a story, a surprising idea. What would you tell a friend about first?</p>
        <textarea id="why" maxlength="1000" placeholder="The bit where…">${esc(f.answers.standoutWhy ?? '')}</textarea>`,
      read: () => (f.answers.standoutWhy = $('why').value.trim()),
    });
  }

  steps.push(
    {
      id: 'pitch',
      render: () => `<p class="eyebrow">Packaging</p><h1>Pitch it to a friend</h1>
        <div class="fb-q"><label for="one-liner">Describe this episode in one sentence</label><input type="text" id="one-liner" maxlength="300" placeholder="It's about…" value="${esc(f.answers.oneLiner ?? '')}" /></div>
        <div class="fb-q"><label for="title-idea">What title would make you click on YouTube?</label><input type="text" id="title-idea" maxlength="150" placeholder="Your dream title" value="${esc(f.answers.titleIdea ?? '')}" /></div>`,
      read: () => {
        f.answers.oneLiner = $('one-liner').value.trim();
        f.answers.titleIdea = $('title-idea').value.trim();
      },
    },
    {
      id: 'cut',
      render: () => `<p class="eyebrow">Be honest</p><h1>Anything you'd cut or speed up?</h1><p class="muted">Parts that dragged, felt repetitive or lost you. This really helps the editors.</p>
        <textarea id="would-cut" maxlength="1000" placeholder="The section about…">${esc(f.answers.wouldCut ?? '')}</textarea>`,
      read: () => (f.answers.wouldCut = $('would-cut').value.trim()),
    },
    {
      id: 'recommend',
      required: () => f.answers.recommend !== undefined,
      render: () => `<p class="eyebrow">Last big one</p><h1>How likely are you to recommend it to a friend?</h1>
        <div class="nps">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-set="recommend" data-v="${i}" class="${f.answers.recommend === i ? 'on' : ''}">${i}</button>`).join('')}</div>
        <div class="nps-labels"><span>Not likely</span><span>Extremely likely</span></div>`,
    },
  );

  if (ctx.custom.length) {
    steps.push({
      id: 'custom',
      render: () => `<p class="eyebrow">A few more</p><h1>Just a couple more questions</h1>${ctx.custom
        .map((q) => {
          const v = f.answers.custom?.[q.id];
          if (q.kind === 'scale') return `<div class="fb-q"><label>${esc(q.text)}</label><div class="nps" style="grid-template-columns:repeat(10,1fr)">${Array.from({ length: 10 }, (_, i) => `<button type="button" data-custom="${esc(q.id)}" data-v="${i + 1}" class="${v === i + 1 ? 'on' : ''}">${i + 1}</button>`).join('')}</div></div>`;
          if (q.kind === 'yesno') return `<div class="fb-q"><label>${esc(q.text)}</label><div class="choice-row">${['yes', 'no'].map((o) => `<button type="button" data-custom="${esc(q.id)}" data-v="${o}" class="${v === o ? 'on' : ''}">${o === 'yes' ? 'Yes' : 'No'}</button>`).join('')}</div></div>`;
          return `<div class="fb-q"><label>${esc(q.text)}</label><textarea data-custom-text="${esc(q.id)}" maxlength="2000">${esc(v ?? '')}</textarea></div>`;
        })
        .join('')}`,
      read: () => {
        f.answers.custom = f.answers.custom || {};
        for (const el of document.querySelectorAll('[data-custom-text]')) f.answers.custom[el.dataset.customText] = el.value.trim();
      },
    });
  }
  return steps;
}

function linesHtml() {
  const picked = new Set(f.answers.standoutLines ?? []);
  const q = f.lineFilter.trim().toLowerCase();
  const rows = f.ctx.transcript
    .map((c, i) => ({ ...c, i }))
    .filter((c) => !q || c.text.toLowerCase().includes(q) || picked.has(c.i));
  if (!rows.length) return '<p class="faint small center" style="padding:20px">No lines match.</p>';
  return rows.map((c) => `<button type="button" class="line ${picked.has(c.i) ? 'on' : ''}" data-line="${c.i}"><span class="t">${fmtTime(c.start)}</span><span>${esc(c.text)}</span></button>`).join('');
}

function render() {
  const step = f.steps[f.i];
  $('fb-body').innerHTML = step.render();
  $('fb-body').style.animation = 'none';
  void $('fb-body').offsetWidth;
  $('fb-body').style.animation = '';
  $('fb-progress').style.width = `${(100 * (f.i + 1)) / f.steps.length}%`;
  $('fb-back').style.visibility = f.i === 0 ? 'hidden' : 'visible';
  $('fb-skip').classList.toggle('hidden', !!step.required);
  $('fb-next').textContent = f.i === f.steps.length - 1 ? 'Send my feedback 🚀' : 'Next';
  $('fb-error').classList.add('hidden');
  step.mount?.();
}

/** Single-choice buttons (data-set / data-custom) update the answers immediately. */
function onBodyClick(e) {
  const b = e.target.closest('[data-set],[data-custom]');
  if (!b) return;
  const raw = b.dataset.v;
  const v = /^\d+$/.test(raw) ? Number(raw) : raw;
  if (b.dataset.set) f.answers[b.dataset.set] = v;
  else {
    f.answers.custom = f.answers.custom || {};
    f.answers.custom[b.dataset.custom] = v;
  }
  const group = b.dataset.set ? `[data-set="${b.dataset.set}"]` : `[data-custom="${b.dataset.custom}"]`;
  for (const o of document.querySelectorAll(group)) o.classList.toggle('on', o === b);
  const step = f.steps[f.i];
  // Single-choice steps move on by themselves, except the last one, which waits for "Send".
  if (b.dataset.set && step.id === b.dataset.set && f.i < f.steps.length - 1) setTimeout(() => next(), 280);
}

async function persist(final = false) {
  const s = state.session;
  return api(`/api/public/sessions/${s.sessionId}/feedback`, { answers: f.answers, final }, { key: s.sessionKey });
}

async function next(skip = false) {
  const step = f.steps[f.i];
  step.read?.();
  if (!skip && step.required && !step.required()) {
    $('fb-error').textContent = 'Pick one to continue.';
    $('fb-error').classList.remove('hidden');
    return;
  }
  persist().catch(() => {});
  if (f.i < f.steps.length - 1) {
    f.i++;
    render();
    return;
  }
  $('fb-next').disabled = true;
  try {
    const out = await persist(true);
    if (out.redirect) return location.assign(out.redirect);
    done(out.completionCode);
  } catch (err) {
    $('fb-error').textContent = err.message;
    $('fb-error').classList.remove('hidden');
    $('fb-next').disabled = false;
  }
}

export async function startFeedback(justFinished = false) {
  const s = state.session;
  show('feedback');
  $('fb-body').innerHTML = '<div class="center" style="padding:80px 0"><div class="spinner"></div></div>';
  try {
    f.ctx = await api(`/api/public/sessions/${s.sessionId}/feedback`, undefined, { key: s.sessionKey });
  } catch (err) {
    $('fb-body').innerHTML = `<h1>Hmm.</h1><p class="error">${esc(err.message)}</p>`;
    return;
  }
  f.answers = f.ctx.draft || {};
  f.steps = buildSteps(f.ctx);
  // Returning viewers start at the first unanswered step.
  f.i = justFinished ? 0 : Math.max(0, f.steps.findIndex((st) => (st.required ? !st.required() : false)));
  if (f.i < 0) f.i = 0;
  $('fb-body').onclick = onBodyClick;
  $('fb-next').onclick = () => next();
  $('fb-skip').onclick = () => next(true);
  $('fb-back').onclick = () => {
    f.steps[f.i].read?.();
    if (f.i > 0) f.i--;
    render();
  };
  $('fb-later').onclick = async () => {
    f.steps[f.i].read?.();
    await persist().catch(() => {});
    showSaved('feedback');
  };
  render();
}
