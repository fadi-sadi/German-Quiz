import jsyaml from 'js-yaml';

/**
 * Parse and validate a questions YAML string.
 *
 * @param {string} yamlContent
 * @returns {Array<{question: string, answer: string, options?: string[], hint?: string}>}
 */
export function parseQuestions(yamlContent) {
  const data = jsyaml.load(yamlContent);
  if (!Array.isArray(data)) {
    throw new Error('Questions file must be a YAML list');
  }
  if (data.length === 0) {
    throw new Error('Questions file must contain at least one question');
  }
  return data.map((item, i) => {
    const label = `Question ${i + 1}`;
    if (!item.question || typeof item.question !== 'string') {
      throw new Error(`${label} is missing a valid "question" field`);
    }
    if (!item.answer || typeof item.answer !== 'string') {
      throw new Error(`${label} is missing a valid "answer" field`);
    }

    const entry = { question: item.question, answer: item.answer };

    if (item.options !== undefined) {
      if (!Array.isArray(item.options) || item.options.length === 0) {
        throw new Error(`${label}: "options" must be a non-empty array`);
      }
      entry.options = item.options.map(String);
      if (!entry.options.includes(item.answer)) {
        throw new Error(`${label}: "options" must include the correct answer`);
      }
    }

    if (item.hint) {
      entry.hint = String(item.hint);
    }

    return entry;
  });
}

/**
 * Validate a raw `num_options` value. Returns the validated integer or
 * `undefined` when the value is absent.
 */
function validateNumOptions(raw, label) {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new Error(`${label}: "num_options" must be an integer, got: ${JSON.stringify(raw)}`);
  }
  if (raw < 2) {
    throw new Error(`${label}: "num_options" must be at least 2, got: ${raw}`);
  }
  return raw;
}

/**
 * Parse and validate a metadata YAML string.
 *
 * When the YAML contains a `categories` array, each entry must have a `name`
 * and a `questions` path. An optional `num_options` integer can override the
 * default number of answer choices per category.
 *
 * @param {string} yamlContent
 * @returns {{ name: string, num_options: number, categories?: Array<{name: string, questions: string, num_options: number}> }}
 */
export function parseMetadata(yamlContent) {
  const data = jsyaml.load(yamlContent);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Metadata file must be a YAML object');
  }

  const rootNumOptions = validateNumOptions(data.num_options, 'Root');

  const result = {
    name: data.name ? String(data.name) : 'Trivia Game',
    num_options: rootNumOptions ?? 4,
  };

  if (data.categories !== undefined) {
    if (!Array.isArray(data.categories) || data.categories.length === 0) {
      throw new Error('"categories" must be a non-empty array');
    }
    result.categories = data.categories.map((cat, i) => {
      const label = `Category ${i + 1}`;
      if (!cat || typeof cat !== 'object' || Array.isArray(cat)) {
        throw new Error(`${label} must be an object`);
      }
      if (!cat.name || typeof cat.name !== 'string') {
        throw new Error(`${label} is missing a valid "name" field`);
      }
      if (!cat.questions || typeof cat.questions !== 'string') {
        throw new Error(`${label} is missing a valid "questions" path`);
      }
      const catNumOptions = validateNumOptions(cat.num_options, label);
      return {
        name: cat.name,
        questions: cat.questions,
        num_options: catNumOptions ?? result.num_options,
      };
    });
  }

  return result;
}

/**
 * Shuffle an array using Fisher-Yates. Returns a new array; does not mutate the input.
 *
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Build the options list for a single question.
 *
 * If the question already defines explicit options, those are returned (shuffled).
 * Otherwise, `numOptions - 1` wrong answers are sampled at random from `allAnswers`
 * and the correct answer is inserted, then the whole list is shuffled.
 *
 * @param {{ question: string, answer: string, options?: string[] }} question
 * @param {string[]} allAnswers - All unique answers present in the question set
 * @param {number} numOptions
 * @returns {string[]}
 */
export function buildQuestionOptions(question, allAnswers, numOptions) {
  if (question.options) {
    return shuffleArray(question.options);
  }
  const wrongAnswers = allAnswers.filter((a) => a !== question.answer);
  const needed = Math.min(numOptions - 1, wrongAnswers.length);
  const sampled = shuffleArray(wrongAnswers).slice(0, needed);
  return shuffleArray([question.answer, ...sampled]);
}

/**
 * High-level trivia engine that bundles parsed questions and metadata
 * with game-play helpers.
 */
export class TriviaEngine {
  /**
   * @param {ReturnType<typeof parseQuestions>} questions
   * @param {ReturnType<typeof parseMetadata>} metadata
   */
  constructor(questions, metadata) {
    this.questions = questions;
    this.metadata = metadata;
    /** Deduplicated list of every answer in the set, used for random option sampling. */
    this.allAnswers = [...new Set(questions.map((q) => q.answer))];
  }

  /** Total number of questions in the bank. */
  get totalQuestions() {
    return this.questions.length;
  }

  /**
   * Returns questions with their `options` array populated, in random order.
   * Safe to call multiple times; each call re-shuffles both questions and options.
   *
   * @param {number} [limit] - Max questions to return. Defaults to all.
   * @returns {Array<{question: string, answer: string, options: string[], hint?: string}>}
   */
  getPreparedQuestions(limit) {
    const shuffled = shuffleArray(this.questions);
    const selected = limit != null ? shuffled.slice(0, limit) : shuffled;
    return selected.map((q) => ({
      ...q,
      options: buildQuestionOptions(q, this.allAnswers, this.metadata.num_options),
    }));
  }

  /**
   * @param {{ answer: string }} question
   * @param {string} selectedAnswer
   * @returns {boolean}
   */
  checkAnswer(question, selectedAnswer) {
    return question.answer === selectedAnswer;
  }
}
