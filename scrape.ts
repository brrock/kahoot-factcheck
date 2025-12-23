import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

interface Choice {
  answer: string;
  correct?: boolean;
}

interface Question {
  question: string;
  choices: Choice[];
}

async function requestQuestion(gameId: string): Promise<Question[]> {
  const apiUrl =
    `https://corsproxy.io/https://play.kahoot.it/rest/kahoots/${gameId}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.questions;
}

function parser(input: Question[]): Record<
  string,
  Array<{ answer: string; correct: boolean }>
> {
  const finalDictionary: Record<
    string,
    Array<{ answer: string; correct: boolean }>
  > = {};

  input.forEach((question) => {
    const questionText = question.question;
    if (questionText) {
      const choices = question.choices || [];
      const answers = choices.map((option) => ({
        answer: option.answer,
        correct: option.correct || false,
      }));
      finalDictionary[questionText] = answers;
    }
  });

  return finalDictionary;
}

function convertToCSV(
  parsed: Record<
    string,
    Array<{ answer: string; correct: boolean }>
  >
): string {
  

  const rows = Object.entries(parsed).map(
    ([question, answers], idx) => {
      const answerTexts = answers.map((a) => a.answer);
      const correctIdx = answers.findIndex((a) => a.correct) + 1;

      return [
        idx + 1,
        `"${question.replace(/"/g, '""')}"`,
        ...answerTexts
          .slice(0, 4)
          .concat(
            new Array(Math.max(0, 4 - answerTexts.length)).fill("")
          ),
        correctIdx > 0 ? correctIdx : "",
      ];
    }
  );

  return [ ...rows.map((r) => r.join(","))].join(
    "\n"
  );
}

const program = new Command();

program
  .name("kahoot-export")
  .description("Export Kahoot quizzes as CSV")
  .version("1.0.0");

program
  .command("export <gameId> [output]")
  .description("Export a Kahoot by game ID to CSV")
  .action(async (gameId: string, output?: string) => {
    try {
      console.log(`Fetching game ${gameId}...`);
      const questions = await requestQuestion(gameId);
      const parsed = parser(questions);

      const csv = convertToCSV(parsed);
      const filename = output || `kahoot_${gameId}.csv`;
      const filepath = path.resolve(filename);

      fs.writeFileSync(filepath, csv);
      console.log(
        `✓ Exported ${questions.length} questions to ${filepath}`
      );
    } catch (error) {
      console.error("Export failed:", error);
      process.exit(1);
    }
  });

program.parse();