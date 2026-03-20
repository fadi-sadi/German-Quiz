import { parseQuestions, parseMetadata, TriviaEngine } from './engine.js';

const params = new URLSearchParams(window.location.search);

// ── DOM references ───────────────────────────────────────────────────────────

const screens = {
  loading: document.getElementById('loading-screen'),
  start: document.getElementById('start-screen'),
  quiz: document.getElementById('quiz-screen'),
  result: document.getElementById('result-screen'),
  error: document.getElementById('error-screen'),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add('hidden'));
  const target = screens[name];
  target.classList.remove('hidden');
  target.focus();
}

function showError(msg) {
  document.getElementById('error-message').textContent = msg;
  showScreen('error');
}

// ── Security ─────────────────────────────────────────────────────────────────

function sanitizeResourcePath(raw) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) {
    throw new Error(`External URLs are not allowed: "${raw}"`);
  }
  return raw;
}

// ── Game state ───────────────────────────────────────────────────────────────

/** @type {TriviaEngine} */
let engine;
/** @type {Array<{question: string, answer: string, options: string[], hint?: string}>} */
let preparedQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;

// ── Boot ─────────────────────────────────────────────────────────────────────

async function loadGame() {
  try {
    const questionsUrl = sanitizeResourcePath(params.get('questions') ?? 'questions.yaml');
    const metadataUrl = sanitizeResourcePath(params.get('metadata') ?? 'metadata.yaml');

    const [questionsText, metadataText] = await Promise.all([
      fetchText(questionsUrl),
      fetchText(metadataUrl),
    ]);

    const questions = parseQuestions(questionsText);
    const metadata = parseMetadata(metadataText);
    engine = new TriviaEngine(questions, metadata);

    document.title = metadata.name;
    document.getElementById('game-title').textContent = metadata.name;
    document.getElementById('question-count').textContent =
      `${questions.length} question${questions.length !== 1 ? 's' : ''}`;

    showScreen('start');
  } catch (err) {
    showError(err.message);
  }
}

async function fetchText(url) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`Network error while loading "${url}"`);
  }
  if (!res.ok) throw new Error(`Could not load "${url}" (HTTP ${res.status})`);
  return res.text();
}

// ── Quiz flow ────────────────────────────────────────────────────────────────

function startQuiz() {
  preparedQuestions = engine.getPreparedQuestions();
  currentIndex = 0;
  score = 0;
  showScreen('quiz');
  renderQuestion();
}

function renderQuestion() {
  answered = false;
  const q = preparedQuestions[currentIndex];
  const total = preparedQuestions.length;

  document.getElementById('progress-text').textContent = `Question ${currentIndex + 1} of ${total}`;
  document.getElementById('score-text').textContent = `Score: ${score}`;
  document.getElementById('question-text').textContent = q.question;

  // Hint
  const hintBtn = document.getElementById('hint-btn');
  const hintText = document.getElementById('hint-text');
  hintText.classList.add('hidden');

  if (q.hint) {
    hintText.textContent = q.hint;
    hintBtn.textContent = 'Show Hint';
    hintBtn.classList.remove('hidden');
    hintBtn.setAttribute('aria-expanded', 'false');
    hintBtn.onclick = () => {
      const isHidden = hintText.classList.toggle('hidden');
      hintBtn.textContent = isHidden ? 'Show Hint' : 'Hide Hint';
      hintBtn.setAttribute('aria-expanded', String(!isHidden));
    };
  } else {
    hintBtn.classList.add('hidden');
  }

  // Options
  const grid = document.getElementById('options-grid');
  grid.replaceChildren();
  q.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => handleAnswer(q, opt));
    grid.appendChild(btn);
  });

  document.getElementById('next-btn').classList.add('hidden');
}

function handleAnswer(question, selected) {
  if (answered) return;
  answered = true;

  const correct = engine.checkAnswer(question, selected);
  if (correct) score++;

  document
    .getElementById('options-grid')
    .querySelectorAll('.option-btn')
    .forEach((btn) => {
      btn.disabled = true;
      if (btn.textContent === question.answer) {
        btn.classList.add('correct');
      } else if (btn.textContent === selected) {
        btn.classList.add('wrong');
      }
    });

  document.getElementById('score-text').textContent = `Score: ${score}`;
  document.getElementById('next-btn').classList.remove('hidden');
}

function nextQuestion() {
  currentIndex++;
  if (currentIndex < preparedQuestions.length) {
    renderQuestion();
  } else {
    showResult();
  }
}

function showResult() {
  const total = preparedQuestions.length;
  const pct = Math.round((score / total) * 100);

  document.getElementById('final-score').textContent = `${score} / ${total}`;

  let msg;
  if (pct === 100) msg = 'Perfect score! Outstanding!';
  else if (pct >= 80) msg = 'Great job! Almost perfect.';
  else if (pct >= 60) msg = 'Not bad! Keep practising.';
  else if (pct >= 40) msg = "Keep studying, you'll get there!";
  else msg = 'Better luck next time!';

  document.getElementById('final-message').textContent = msg;
  showScreen('result');
}

// ── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('next-btn').addEventListener('click', nextQuestion);
document.getElementById('restart-btn').addEventListener('click', startQuiz);

loadGame();
