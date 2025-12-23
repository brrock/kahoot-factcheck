# Kahoot quiz fact-checker
Simple tools to fact check Kahoot quizzes.

## Installation

To install dependencies:

```bash
bun install
```

## Usage
Make sure to copy .env.example to .env and fill in the envs, before attempting below steps.
### To scrape a quiz:
Start your kahoot, and find the quizId search param in the url like `https://play.kahoot.it/v2/lobby?quizId=(your quiz id is here)`. 
Then run 
```bash 
bun run scrape.ts export (your quiz id is here)``` 
to scrape the quiz.
### To run fact-check (quiz needs to be scraped first):

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.