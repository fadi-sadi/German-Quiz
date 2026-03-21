import { parseQuestions, parseMetadata, TriviaEngine } from './engine.js';

const params = new URLSearchParams(window.location.search);

// ── DOM references ───────────────────────────────────────────────────────────

const screens = {
  loading: document.getElementById('loading-screen'),
  category: document.getElementById('category-screen'),
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

function resolveBasePath(url) {
  const lastSlash = url.lastIndexOf('/');
  return lastSlash >= 0 ? url.substring(0, lastSlash + 1) : '';
}

function resolveImagePaths(questions, basePath) {
  if (!basePath) return questions;
  return questions.map((q) => {
    if (!q.image) return q;
    sanitizeResourcePath(q.image);
    return { ...q, image: basePath + q.image };
  });
}

// ── Game state ───────────────────────────────────────────────────────────────

/** @type {TriviaEngine} */
let engine;
/** @type {Array<{question: string, answer: string, image?: string, options: string[], hint?: string}>} */
let preparedQuestions = [];
let currentIndex = 0;
let score = 0;
let answered = false;
let selectedOptionIndex = -1;

/** @type {Array<{name: string, questions: string, metadata?: string}> | null} */
let categories = null;
let quizName = 'Trivia Game';

// ── Boot ─────────────────────────────────────────────────────────────────────

async function loadGame() {
  try {
    const metadataUrl = sanitizeResourcePath(params.get('metadata') ?? 'metadata.yaml');
    const metadataText = await fetchText(metadataUrl);
    const metadata = parseMetadata(metadataText);

    quizName = metadata.name;
    document.title = quizName;

    if (metadata.categories) {
      categories = metadata.categories;
      if (categories.length === 1) {
        await loadCategory(categories[0]);
      } else {
        showCategoryScreen();
      }
    } else {
      const questionsUrl = sanitizeResourcePath(params.get('questions') ?? 'questions.yaml');
      const questionsText = await fetchText(questionsUrl);
      const questions = resolveImagePaths(parseQuestions(questionsText), resolveBasePath(questionsUrl));
      engine = new TriviaEngine(questions, metadata);
      showStartScreen();
    }
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

// ── Category selection ───────────────────────────────────────────────────────

function showCategoryScreen() {
  document.getElementById('category-title').textContent = quizName;

  const grid = document.getElementById('categories-grid');
  grid.replaceChildren();

  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'category-btn';
    btn.textContent = cat.name;
    btn.addEventListener('click', () => handleCategorySelect(cat));
    grid.appendChild(btn);
  });

  showScreen('category');
}

async function handleCategorySelect(category) {
  showScreen('loading');
  try {
    await loadCategory(category);
  } catch (err) {
    showError(err.message);
  }
}

async function loadCategory(category) {
  const questionsUrl = sanitizeResourcePath(category.questions);
  const questionsText = await fetchText(questionsUrl);
  const questions = resolveImagePaths(parseQuestions(questionsText), resolveBasePath(questionsUrl));
  const catMetadata = { name: category.name, num_options: category.num_options };
  engine = new TriviaEngine(questions, catMetadata);
  showStartScreen();
}

// ── Start screen ─────────────────────────────────────────────────────────────

function showStartScreen() {
  document.getElementById('game-title').textContent = engine.metadata.name;
  document.getElementById('question-count').textContent =
    `${engine.totalQuestions} question${engine.totalQuestions !== 1 ? 's' : ''} available`;

  const limitInput = document.getElementById('question-limit');
  limitInput.max = engine.totalQuestions;
  limitInput.value = engine.totalQuestions;

  showScreen('start');
}

// ── Quiz flow ────────────────────────────────────────────────────────────────

function startQuiz() {
  const limitInput = document.getElementById('question-limit');
  const limit = Math.max(
    1,
    Math.min(engine.totalQuestions, parseInt(limitInput.value, 10) || engine.totalQuestions),
  );
  limitInput.value = limit;

  preparedQuestions = engine.getPreparedQuestions(limit);
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

  const questionImage = document.getElementById('question-image');
  if (q.image) {
    questionImage.src = q.image;
    questionImage.alt = q.question;
    questionImage.classList.remove('hidden');
  } else {
    questionImage.src = '';
    questionImage.alt = '';
    questionImage.classList.add('hidden');
  }

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

  selectedOptionIndex = 0;
  updateOptionHighlight();

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

function updateOptionHighlight() {
  const btns = document.getElementById('options-grid').querySelectorAll('.option-btn');
  btns.forEach((btn, i) => {
    btn.classList.toggle('kb-focus', i === selectedOptionIndex);
  });
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

  const changeCatBtn = document.getElementById('change-category-btn');
  if (categories && categories.length > 1) {
    changeCatBtn.classList.remove('hidden');
  } else {
    changeCatBtn.classList.add('hidden');
  }

  showScreen('result');
}

// ── Event listeners ──────────────────────────────────────────────────────────

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('next-btn').addEventListener('click', nextQuestion);
document.getElementById('restart-btn').addEventListener('click', showStartScreen);
document.getElementById('change-category-btn').addEventListener('click', showCategoryScreen);

const limitInput = document.getElementById('question-limit');
document.getElementById('limit-dec').addEventListener('click', () => {
  const cur = parseInt(limitInput.value, 10) || 1;
  limitInput.value = Math.max(1, cur - 1);
});
document.getElementById('limit-inc').addEventListener('click', () => {
  const cur = parseInt(limitInput.value, 10) || 1;
  limitInput.value = Math.min(parseInt(limitInput.max, 10), cur + 1);
});
limitInput.addEventListener('change', () => {
  const max = parseInt(limitInput.max, 10);
  const val = parseInt(limitInput.value, 10);
  if (isNaN(val) || val < 1) limitInput.value = 1;
  else if (val > max) limitInput.value = max;
});

document.addEventListener('keydown', (e) => {
  if (e.key === ' ' && !screens.start.classList.contains('hidden')) {
    e.preventDefault();
    document.getElementById('start-btn').click();
    return;
  }

  if (screens.quiz.classList.contains('hidden')) return;

  const optionBtns = document.getElementById('options-grid').querySelectorAll('.option-btn');
  const count = optionBtns.length;
  if (!count) return;

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (answered) return;
    if (e.key === 'ArrowDown') {
      selectedOptionIndex = (selectedOptionIndex + 1) % count;
    } else {
      selectedOptionIndex = (selectedOptionIndex - 1 + count) % count;
    }
    updateOptionHighlight();
  }

  if (e.key === ' ') {
    e.preventDefault();
    const nextBtn = document.getElementById('next-btn');
    if (answered && !nextBtn.classList.contains('hidden')) {
      nextBtn.click();
    } else if (!answered && selectedOptionIndex >= 0 && selectedOptionIndex < count) {
      optionBtns[selectedOptionIndex].click();
    }
  }
});

loadGame();
