const state = {
  all: [],
  byBase: new Map(),
  quizSentences: [],
  pool: [],
  answers: [],
  idx: 0,
  score: 0,
  count: 10,
  type: 'all',        
  kind: 'v1',           
  currMode: 'v1',     
  showHint: false,

  attempts: 0,
  lastV1: '', lastV2: '', lastV3: '',

  timerSec: 15,
  timerId: null,

  lastWrongSig: null
};

const el = (q)=>document.querySelector(q);

function norm(str){
  return (str||'').toLowerCase().replace(/\s+/g,' ').replace(/[._-]+/g,' ').trim();
}
function variants(form){
  return norm(form).replace(/,/g,'/').split('/').map(s=>s.trim()).filter(Boolean);
}
function isCorrect(user, truth){
  const target = new Set(variants(truth));
  const userParts = norm(user).split(/[\/, ]+/).filter(Boolean);
  if (target.has(norm(user))) return true;
  return userParts.some(p => target.has(p));
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

async function loadVerbs(){
  const r = await fetch('./data/verbs.json', {cache:'no-store'});
  const arr = await r.json();
  state.all = arr.filter(v => v.base && v.past && v.part);
  state.byBase.clear(); state.all.forEach(v => state.byBase.set(v.base.toLowerCase(), v));
}
async function loadQuizSentences(){
  try{
    const r = await fetch('./data/quizk.json', {cache:'no-store'});
    const arr = await r.json();
    state.quizSentences = (arr||[]).filter(q => q && q.sentence && q.answer && q.use);
  }catch(e){ console.warn('quizk.json missing/invalid'); state.quizSentences = []; }
}
async function loadData(){ await loadVerbs(); await loadQuizSentences(); }
loadData();

function buildPool(fromWrong=null){
  state.answers = []; state.idx = 0; state.score = 0; state.attempts = 0;

  if (fromWrong && fromWrong.length){
    if (state.kind === 'sentence'){
      const wrongBases = new Set(fromWrong.map(v=>v.base.toLowerCase()));
      const candidates = state.quizSentences.filter(q => wrongBases.has(String(q.answer).toLowerCase()));
      const picked = shuffle(candidates.slice()).slice(0, Math.min(state.count, candidates.length));
      state.pool = picked.map(q => {
        const v = state.byBase.get(String(q.answer).toLowerCase());
        return { ...v, __qSentence: q.sentence, __qUse: q.use, __qHint: q.hint || '' };
      });
    } else {
      state.pool = shuffle(fromWrong.map(a => state.byBase.get(a.base.toLowerCase())).filter(Boolean));
    }
    return;
  }

  if (state.kind === 'sentence'){
    const candidates = state.quizSentences.filter(q => {
      const v = state.byBase.get(String(q.answer).toLowerCase());
      if (!v) return false;
      if (state.type === 'all') return true;
      return v.type === state.type;
    });
    const picked = shuffle(candidates.slice()).slice(0, state.count);
    state.pool = picked.map(q => {
      const v = state.byBase.get(String(q.answer).toLowerCase());
      return { ...v, __qSentence: q.sentence, __qUse: q.use, __qHint: q.hint || '' };
    });
  } else {
    let pool = state.all;
    if (state.type !== 'all') pool = pool.filter(v => v.type === state.type);
    state.pool = shuffle(pool.slice()).slice(0, state.count);
  }
}

function renderBar(){
  el('#progressText').textContent = `Soal ${state.idx+1}/${state.count}`;
  el('#scoreText').textContent = `Skor: ${state.score}`;
  const pct = ((state.idx)/state.count) * 100;
  el('#progressBar').style.width = `${pct}%`;
}

function setFormInputs(kind){
  const box = el('#formInputs');
  if (kind === 'sentence'){
    box.classList.add('single');
    box.innerHTML = `
      <label><span id="lbl1">Isi kata kerja</span>
        <input id="ansV2" type="text" placeholder="ketik jawaban" />
      </label>`;
  } else {
    box.classList.remove('single');
    box.innerHTML = `
      <label><span id="lbl1">Jawaban</span>
        <input id="ansV2" type="text" placeholder="" />
      </label>
      <label><span id="lbl2">Jawaban</span>
        <input id="ansV3" type="text" placeholder="" />
      </label>`;
  }
}

function updateFormLabelsForMode(modeOrUse, isSentence){
  const L1 = el('#lbl1');
  const L2 = el('#lbl2');
  const I1 = el('#ansV2');
  const I2 = el('#ansV3');

  if (isSentence){
    if (modeOrUse === 'v1'){
      L1.textContent = 'Isi V1 (Base)';
      I1.placeholder = 'mis. go';
    } else if (modeOrUse === 'v2'){
      L1.textContent = 'Isi V2 (Past)';
      I1.placeholder = 'mis. went';
    } else { 
      L1.textContent = 'Isi V3 (Participle)';
      I1.placeholder = 'mis. gone';
    }
    return;
  }

  if (modeOrUse === 'v1'){
    L1.textContent = 'Jawaban V2 (Past)';
    L2.textContent = 'Jawaban V3 (Participle)';
    I1.placeholder = 'mis. went';
    I2.placeholder = 'mis. gone';
  } else if (modeOrUse === 'v2'){
    L1.textContent = 'Jawaban V1 (Base)';
    L2.textContent = 'Jawaban V3 (Participle)';
    I1.placeholder = 'mis. go';
    I2.placeholder = 'mis. gone';
  } else { 
    L1.textContent = 'Jawaban V1 (Base)';
    L2.textContent = 'Jawaban V2 (Past)';
    I1.placeholder = 'mis. go';
    I2.placeholder = 'mis. went';
  }
}

function stopTimer(){
  if (state.timerId){ clearInterval(state.timerId); state.timerId = null; }
}
function startTimer(){
  stopTimer();
  const badge = el('#timerText');
  state.timerSec = 15;              
  updateTimerBadge();
  state.timerId = setInterval(()=>{
    state.timerSec--;
    updateTimerBadge();
    if (state.timerSec <= 0){
      stopTimer();
      if (state.attempts === 0){
        state.attempts = 2; 
        const q = state.pool[state.idx];
        revealNow(q);
        finalizeQuestion(false);
      }
    }
  }, 1000);

  function updateTimerBadge(){
    badge.textContent = `⏱️ ${state.timerSec}s`;
    badge.classList.toggle('safe', state.timerSec >= 8);
  }
}

function renderQuestion(){
  const q = state.pool[state.idx];
  const isSentence = state.kind === 'sentence';
  setFormInputs(isSentence ? 'sentence' : 'form');

  const hintEl = el('#qHint');
  hintEl.hidden = !state.showHint;

  if (isSentence){
    const use = (q.__qUse || 'v1').toLowerCase();
    state.currMode = `sentence:${use}`;
    el('.question .badge').textContent = use.toUpperCase();
    el('#qV1').textContent = q.__qSentence || '…';
    if (!hintEl.hidden) hintEl.textContent = `Hint: ${q.__qHint || q.id || '—'}`;
    updateFormLabelsForMode(use, true);

  } else {

    const mode = (state.kind === 'random')
      ? ['v1','v2','v3'][Math.floor(Math.random()*3)]
      : state.kind;
    state.currMode = mode;

    let label='V1', display=q.base;
    if (mode==='v2'){ label='V2'; display=q.past; }
    if (mode==='v3'){ label='V3'; display=q.part; }

    el('.question .badge').textContent = label;
    el('#qV1').textContent = display;
    if (!hintEl.hidden) hintEl.textContent = `Hint: ${q.id || '—'}`;

    updateFormLabelsForMode(mode, false);
  }

  const a1 = el('#ansV2'); if (a1) a1.value = '';
  const a2 = el('#ansV3'); if (a2) a2.value = '';
  el('#feedback').innerHTML = '';
  el('#checkBtn').disabled = false;
  el('#nextBtn').disabled = true;

  state.attempts = 0; state.lastV1=''; state.lastV2=''; state.lastV3='';
  state.lastV1 = state.lastV2 = state.lastV3 = '';
  state.lastWrongSig = null;

  startTimer();                
  if (el('#ansV2')) el('#ansV2').focus();
}

function finalizeQuestion(ok){
  stopTimer();
  const q = state.pool[state.idx];
  state.answers.push({
    base: q.base, truthV2: q.past, truthV3: q.part,
    yoursV2: state.lastV2 || '—', yoursV3: state.lastV3 || '—',
    ok, mode: state.currMode
  });
  if (ok) state.score++;
  renderBar();
  el('#checkBtn').disabled = true;
  el('#nextBtn').disabled = false;
}

function answerSignature(kind, user1, user2='') {
  if (kind === 'sentence') return norm(user1);
  return `${norm(user1)}|${norm(user2)}`; 
}

function revealNow(q){
  el('#feedback').innerHTML =
    `<span class="no">❌ Salah 2x / Waktu habis.</span><br/>
     <small><b>${q.base}</b> → <code>${q.past}</code> & <code>${q.part}</code></small>`;
}

function checkAnswerFlow(){
  const q = state.pool[state.idx];
  const user1 = el('#ansV2')?.value || '';
  const user2 = el('#ansV3')?.value || '';

  state.lastV2 = user1;
  state.lastV3 = user2 || '—';

  let ok = false;
  if (state.kind === 'sentence'){
    const use = (q.__qUse || 'v1').toLowerCase();
    const truth = use==='v1' ? q.base : use==='v2' ? q.past : q.part;
    ok = isCorrect(user1, truth);
    state.lastV3 = '—'; 
  } else {
    if (state.currMode==='v1'){ ok = isCorrect(user1,q.past) && isCorrect(user2,q.part); }
    if (state.currMode==='v2'){ ok = isCorrect(user1,q.base) && isCorrect(user2,q.part); }
    if (state.currMode==='v3'){ ok = isCorrect(user1,q.base) && isCorrect(user2,q.past); }
  }

  if (ok){
    el('#feedback').innerHTML =
      `<span class="ok">✅ Betul!</span><br/><small>${q.base} → ${q.past} → ${q.part}</small>`;
    finalizeQuestion(true);
    return;
  }

  const isSentence = (state.kind === 'sentence');
  const sigNow = answerSignature(isSentence ? 'sentence' : 'form', user1, user2);

  if (state.lastWrongSig && sigNow === state.lastWrongSig){
    const remaining = Math.max(0, 2 - state.attempts);
    el('#feedback').innerHTML =
      `<span class="no">⚠️ Jawabanmu sama seperti sebelumnya.</span><br/>` +
      `<small>Masih salah. Coba ubah jawaban dulu (sisa <b>${remaining}</b> kali).</small>`;
    return;
  }

  state.lastWrongSig = sigNow;
  state.attempts++;

  if (state.attempts === 1){
    el('#feedback').innerHTML =
      `<span class="no">❌ Masih salah.</span><br/><small>Coba lagi (sisa <b>1</b> kali).</small>`;
    return;
  }

  el('#feedback').innerHTML =
    `<span class="no">❌ Salah 2x.</span><br/><small>Jawaban: <b>${q.base}</b> → <code>${q.past}</code> & <code>${q.part}</code></small>`;
  finalizeQuestion(false);
}


function nextQuestion(){
  if (state.idx < state.count - 1){
    state.idx++;
    renderBar();
    renderQuestion();
  } else {
    showResult();
  }
}
function skipQuestion(){
  const q = state.pool[state.idx];
  el('#feedback').innerHTML =
    `<span class="no">⏭️ Di-skip.</span><br/><small>Jawaban: <code>${q.past}</code> & <code>${q.part}</code></small>`;
  state.lastV2='—'; state.lastV3='—';
  finalizeQuestion(false);
}

function computeGrade(pct){
  if (pct >= 90) return 'A';
  if (pct >= 80) return 'B';
  if (pct >= 70) return 'C';
  if (pct >= 60) return 'D';
  return 'E';
}
function saveHighscore(pct){
  const key = 'verbQuizHighscores';
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  list.push({
    pct, score: state.score, count: state.count,
    kind: state.kind, type: state.type,
    date: new Date().toISOString()
  });
  list.sort((a,b)=> b.pct - a.pct || new Date(b.date)-new Date(a.date));
  localStorage.setItem(key, JSON.stringify(list.slice(0,5)));
  return JSON.parse(localStorage.getItem(key));
}
function renderHighscores(list){
  const ol = el('#highList'); ol.innerHTML='';
  (list||[]).forEach(h=>{
    const li = document.createElement('li');
    li.textContent = `${Math.round(h.pct)}% • ${h.score}/${h.count} • ${h.kind} • ${new Date(h.date).toLocaleDateString()}`;
    ol.appendChild(li);
  });
}
function confettiBurst(){
  const root = document.getElementById('confetti');
  if (!root) return;
  const colors = ['#00e5ff','#67e8f9','#22d3ee','#10b981','#f0abfc','#fbbf24','#ef4444'];
  for (let i=0;i<80;i++){
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = Math.random()*100 + 'vw';
    d.style.top = '-10px';
    d.style.background = colors[Math.floor(Math.random()*colors.length)];
    d.style.transform = `translateY(-10px) rotate(${Math.random()*360}deg)`;
    d.style.animationDuration = (6 + Math.random()*3) + 's';
    d.style.opacity = 0.9;
    root.appendChild(d);
    setTimeout(()=>d.remove(), 10000);
  }
}
function showResult(){
  stopTimer();
  el('.quiz-setup').hidden = true;
  el('.quiz-arena').hidden = true;
  el('.quiz-result').hidden = false;

  const pct = (state.score/state.count)*100;
  const grade = computeGrade(pct);
  el('#finalScore').textContent = `Skor kamu: ${state.score}/${state.count} (${Math.round(pct)}%)`;
  const gradeEl = el('#finalGrade');
  gradeEl.textContent = `Grade: ${grade}`;
  gradeEl.className = `grade ${grade}`;

  const highs = saveHighscore(pct);
  renderHighscores(highs);

  const tbody = el('#resultBody');
  tbody.innerHTML = '';
  state.answers.forEach((a,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${a.base}</td>
      <td>${a.truthV2}</td>
      <td>${a.truthV3}</td>
      <td><code>${a.yoursV2}</code> / <code>${a.yoursV3}</code></td>
      <td>${a.ok ? '✅' : '❌'}</td>`;
    tbody.appendChild(tr);
  });

  if (pct >= 80) confettiBurst();
}

document.addEventListener('DOMContentLoaded', () => {
  el('#startBtn').addEventListener('click', () => {
    state.count = parseInt(el('#qCount').value, 10) || 10;
    state.type  = el('#qType').value;
    state.showHint = el('#showHint').checked;
    state.kind  = el('#qKind').value;   

    buildPool();
    renderBar();
    renderQuestion();
    showArena(true);
  });

  el('#answerForm').addEventListener('submit', (e)=>{ e.preventDefault(); checkAnswerFlow(); });
  el('#nextBtn').addEventListener('click', nextQuestion);
  el('#skipBtn').addEventListener('click', skipQuestion);

  el('#retryWrongBtn').addEventListener('click', () => {
    const wrongs = state.answers.filter(a => !a.ok);
    if (!wrongs.length){
      alert('Mantap! Tidak ada yang salah.');
      return;
    }
    buildPool(wrongs);
    state.idx = 0; state.score = 0; state.answers = [];
    renderBar(); renderQuestion(); showArena(true);
    el('#progressBar').style.width = '0%';
  });

  document.addEventListener('keydown', (e) => {
    if (document.querySelector('.quiz-arena').hidden) return;
    if (e.key === 'Enter' && !e.ctrlKey){
      if (!el('#checkBtn').disabled){ e.preventDefault(); checkAnswerFlow(); }
    } else if (e.key === 'Enter' && e.ctrlKey){
      if (!el('#nextBtn').disabled){ e.preventDefault(); nextQuestion(); }
    } else if (e.key === 'Escape'){
      e.preventDefault(); skipQuestion();
    }
  });
});

function showArena(show){
  el('.quiz-setup').hidden = show;
  el('.quiz-arena').hidden = !show;
  el('.quiz-result').hidden = true;
}
