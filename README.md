# YAML Trivia Engine

A lightweight, static trivia game engine powered by YAML question files. Build and
host trivia games on GitHub Pages or any static web host — no backend required.

## Usage

This repository is a **template**. To create your own trivia game:

1. Fork the repo or click **"Use this template"** on GitHub
2. Clone your new repository
3. Replace `public/questions.yaml` with your own questions
4. Update `public/metadata.yaml` with your game's name and settings
5. Run `npm install && npm run dev` to preview locally
6. Deploy to GitHub Pages or any static host (see [Deployment](#deployment))

That's it — no code changes required. The engine reads your YAML files at runtime
and handles everything else.

## Features

- **YAML-driven** — Define questions, answers, hints, and options in a simple YAML file
- **Zero backend** — Fully static; deploy to GitHub Pages, Netlify, or any static host
- **Auto-generated options** — If a question doesn't specify choices, they're randomly
  sampled from the answer pool
- **Hints** — Optional hints per question with a show/hide toggle
- **Randomized** — Both question order and answer options are shuffled on every play
- **Customizable** — Configure the game name and number of options via a metadata file
- **Multiple quizzes** — Host several quizzes by pointing to different YAML files via
  URL parameters

## Quick Start

```bash
npm install
npm run dev
```

Open <http://localhost:5173> in your browser.

## YAML File Format

### Questions (`questions.yaml`)

A YAML list where each item has:

| Field      | Type     | Required | Description                                          |
| ---------- | -------- | -------- | ---------------------------------------------------- |
| `question` | string   | Yes      | The question text                                    |
| `answer`   | string   | Yes      | The correct answer (must appear in `options` if set) |
| `options`  | string[] | No       | Explicit answer choices; auto-generated if omitted   |
| `hint`     | string   | No       | A hint shown via a toggle button                     |

Example:

```yaml
- question: What is the capital of France?
  answer: Paris
  hint: Known as the City of Light

- question: What is 2 + 2?
  answer: '4'
  options:
    - '3'
    - '4'
    - '5'
    - '6'
```

> **Tip:** Wrap numeric answers in quotes (e.g. `"4"`) so YAML parses them as strings
> rather than numbers.

When `options` is omitted, the engine automatically builds a choice list by sampling
random wrong answers from the full answer pool. The number of choices is controlled
by `num_options` in the metadata file.

### Metadata (`metadata.yaml`)

| Field         | Type   | Default       | Description                          |
| ------------- | ------ | ------------- | ------------------------------------ |
| `name`        | string | `Trivia Game` | Displayed as the game title          |
| `num_options` | int    | `4`           | Number of answer choices (minimum 2) |

Example:

```yaml
name: General Knowledge Quiz
num_options: 4
```

## Deployment

### GitHub Pages

This project includes a GitHub Actions workflow (`.github/workflows/deploy.yml`)
that automatically builds and deploys to GitHub Pages on every push to `main`.

To set it up for your fork:

1. In `vite.config.js`, change the `base` option to match **your** repository name:

   ```js
   base: '/your-repo-name/',
   ```

2. In your GitHub repository, go to **Settings → Pages** and set the **Source** to
   **GitHub Actions**.

3. Push to `main` — the workflow will build and deploy your site automatically.

Your game will be available at `https://<username>.github.io/<repo-name>/`.

> **Note:** If you skip step 1, asset paths will break on GitHub Pages because the
> site is served from a subdirectory, not the domain root.

### Custom YAML Files via URL Parameters

Load different quiz files by passing URL parameters:

```
https://your-site.com/?questions=my-quiz.yaml&metadata=my-config.yaml
```

Both paths are resolved relative to the site root. External URLs are blocked for
security.

## Development

```bash
npm install            # Install dependencies
npm run dev            # Start dev server
npm test               # Run tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run lint           # Lint source files
npm run format         # Format all files with Prettier
```

### Pre-commit Hooks

This project uses [pre-commit](https://pre-commit.com/) for automated checks.
The hooks use the project's own `node_modules`, so `npm install` must be run first.

```bash
pip install pre-commit
pre-commit install
```

Hooks include Prettier formatting, ESLint, trailing whitespace cleanup, large file
detection, and secret detection.

## Answer Visibility

Since this is a fully static application, the YAML question files are served as-is
and can be read by anyone who inspects the page source or navigates to the file URL
directly. This is an inherent trade-off of the zero-backend architecture. For casual
quizzes, study tools, and educational games, this is generally acceptable.

## License

[MIT](LICENSE)
