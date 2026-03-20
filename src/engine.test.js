import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseQuestions,
  parseMetadata,
  shuffleArray,
  buildQuestionOptions,
  TriviaEngine,
} from './engine.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const QUESTIONS_YAML = `
- question: "What is the capital of France?"
  answer: "Paris"
  hint: "City of Light"
- question: "What is 2 + 2?"
  answer: "4"
  options:
    - "3"
    - "4"
    - "5"
    - "6"
- question: "Who wrote Hamlet?"
  answer: "Shakespeare"
- question: "What color is the sky?"
  answer: "Blue"
- question: "What is the largest planet?"
  answer: "Jupiter"
`;

const METADATA_YAML = `
name: "Test Quiz"
num_options: 4
`;

// ── parseQuestions ────────────────────────────────────────────────────────────

describe('parseQuestions', () => {
  it('parses all questions from valid YAML', () => {
    const questions = parseQuestions(QUESTIONS_YAML);
    expect(questions).toHaveLength(5);
  });

  it('maps fields correctly', () => {
    const [first] = parseQuestions(QUESTIONS_YAML);
    expect(first).toEqual({
      question: 'What is the capital of France?',
      answer: 'Paris',
      hint: 'City of Light',
    });
  });

  it('preserves explicit options', () => {
    const questions = parseQuestions(QUESTIONS_YAML);
    expect(questions[1].options).toEqual(['3', '4', '5', '6']);
  });

  it('omits options key when not defined', () => {
    const [first] = parseQuestions(QUESTIONS_YAML);
    expect(first).not.toHaveProperty('options');
  });

  it('throws when root is not a list', () => {
    expect(() => parseQuestions('name: foo')).toThrow();
  });

  it('throws when questions list is empty', () => {
    expect(() => parseQuestions('[]')).toThrow(/at least one/i);
  });

  it('throws when question field is missing', () => {
    expect(() => parseQuestions('- answer: "Paris"')).toThrow(/question/i);
  });

  it('throws when answer field is missing', () => {
    expect(() => parseQuestions('- question: "What?"')).toThrow(/answer/i);
  });

  it('throws when options is not an array', () => {
    expect(() =>
      parseQuestions('- question: "Q"\n  answer: "A"\n  options: "not-an-array"')
    ).toThrow(/non-empty array/i);
  });

  it('throws when options is an empty array', () => {
    expect(() => parseQuestions('- question: "Q"\n  answer: "A"\n  options: []')).toThrow(
      /non-empty array/i
    );
  });

  it('throws when options do not include the correct answer', () => {
    const yaml = '- question: "Q"\n  answer: "A"\n  options:\n    - "B"\n    - "C"';
    expect(() => parseQuestions(yaml)).toThrow(/correct answer/i);
  });
});

// ── parseMetadata ─────────────────────────────────────────────────────────────

describe('parseMetadata', () => {
  it('parses all fields', () => {
    expect(parseMetadata(METADATA_YAML)).toEqual({ name: 'Test Quiz', num_options: 4 });
  });

  it('defaults num_options to 4', () => {
    expect(parseMetadata('name: "Quiz"').num_options).toBe(4);
  });

  it('defaults name to "Trivia Game"', () => {
    expect(parseMetadata('num_options: 3').name).toBe('Trivia Game');
  });

  it('throws when root is not an object', () => {
    expect(() => parseMetadata('- item')).toThrow();
  });

  it('throws when num_options is less than 2', () => {
    expect(() => parseMetadata('name: "Q"\nnum_options: 1')).toThrow(/at least 2/i);
  });

  it('throws when num_options is 0', () => {
    expect(() => parseMetadata('name: "Q"\nnum_options: 0')).toThrow(/at least 2/i);
  });

  it('throws when num_options is negative', () => {
    expect(() => parseMetadata('name: "Q"\nnum_options: -1')).toThrow(/at least 2/i);
  });

  it('throws when num_options is not a number', () => {
    expect(() => parseMetadata('num_options: "four"')).toThrow(/integer/i);
  });

  it('throws when num_options is a float', () => {
    expect(() => parseMetadata('num_options: 3.5')).toThrow(/integer/i);
  });
});

// ── shuffleArray ──────────────────────────────────────────────────────────────

describe('shuffleArray', () => {
  it('returns a new array (does not mutate)', () => {
    const original = [1, 2, 3, 4, 5];
    const shuffled = shuffleArray(original);
    expect(shuffled).not.toBe(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
  });

  it('preserves all elements', () => {
    const original = [1, 2, 3, 4, 5];
    expect(shuffleArray(original).sort((a, b) => a - b)).toEqual(original);
  });

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([]);
  });
});

// ── buildQuestionOptions ──────────────────────────────────────────────────────

describe('buildQuestionOptions', () => {
  const ALL_ANSWERS = ['Paris', '4', 'Shakespeare', 'Blue', 'Jupiter'];

  it('always includes the correct answer', () => {
    const q = { question: 'Q', answer: 'Paris' };
    for (let i = 0; i < 20; i++) {
      expect(buildQuestionOptions(q, ALL_ANSWERS, 4)).toContain('Paris');
    }
  });

  it('returns exactly numOptions items when enough answers exist', () => {
    const q = { question: 'Q', answer: 'Paris' };
    expect(buildQuestionOptions(q, ALL_ANSWERS, 4)).toHaveLength(4);
  });

  it('contains no duplicate options', () => {
    const q = { question: 'Q', answer: 'Paris' };
    const opts = buildQuestionOptions(q, ALL_ANSWERS, 4);
    expect(new Set(opts).size).toBe(opts.length);
  });

  it('uses explicit options when provided', () => {
    const q = { question: 'Q', answer: '4', options: ['3', '4', '5', '6'] };
    const opts = buildQuestionOptions(q, ALL_ANSWERS, 4);
    expect(opts).toHaveLength(4);
    expect(opts).toContain('4');
  });

  it('caps options at available answers when pool is small', () => {
    const q = { question: 'Q', answer: 'A' };
    const opts = buildQuestionOptions(q, ['A', 'B'], 4);
    expect(opts.length).toBeLessThanOrEqual(2);
    expect(opts).toContain('A');
  });
});

// ── TriviaEngine ──────────────────────────────────────────────────────────────

describe('TriviaEngine', () => {
  let questions;
  let metadata;
  let engine;

  beforeEach(() => {
    questions = parseQuestions(QUESTIONS_YAML);
    metadata = parseMetadata(METADATA_YAML);
    engine = new TriviaEngine(questions, metadata);
  });

  it('collects all unique answers', () => {
    expect(engine.allAnswers).toHaveLength(5);
  });

  it('prepares questions with options arrays', () => {
    const prepared = engine.getPreparedQuestions();
    expect(prepared).toHaveLength(5);
    prepared.forEach((q) => {
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options.length).toBeGreaterThan(0);
    });
  });

  it('getPreparedQuestions does not mutate originals', () => {
    engine.getPreparedQuestions();
    expect(questions[0]).not.toHaveProperty('options');
  });

  it('getPreparedQuestions returns all questions regardless of order', () => {
    const prepared = engine.getPreparedQuestions();
    const originalTexts = questions.map((q) => q.question).sort();
    const preparedTexts = prepared.map((q) => q.question).sort();
    expect(preparedTexts).toEqual(originalTexts);
  });

  it('checkAnswer returns true for a correct answer', () => {
    expect(engine.checkAnswer(questions[0], 'Paris')).toBe(true);
  });

  it('checkAnswer returns false for a wrong answer', () => {
    expect(engine.checkAnswer(questions[0], 'Rome')).toBe(false);
  });

  it('checkAnswer is case-sensitive', () => {
    expect(engine.checkAnswer(questions[0], 'paris')).toBe(false);
  });
});
