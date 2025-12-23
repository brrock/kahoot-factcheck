import fs from "fs";
import csv from "csv-parser";
import { generateObject } from "ai";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import open from "open";

// Define the schema for structured output
const VerificationSchema = z.object({
  correctAnswer: z
    .string()
    .describe("The actual correct answer to the question"),
  isCorrect: z
    .boolean()
    .describe("Whether the quiz's claimed answer is correct (true/false)"),
  reasoning: z
    .string()
    .describe("Detailed explanation of why the answer is right or wrong"),
});

interface QuizQuestion {
  number: number;
  question: string;
  answers: string[];
  correctAnswerIndex: number;
}

interface VerificationResult {
  questionNumber: number;
  question: string;
  claimedCorrect: string;
  isCorrect: boolean;
  aiVerification: string;
}

async function parseCSV(filePath: string): Promise<QuizQuestion[]> {
  return new Promise((resolve, reject) => {
    const questions: QuizQuestion[] = [];

    fs.createReadStream(filePath)
      .pipe(csv({ headers: false }))
      .on("data", (row: Record<string, string>) => {
        const values = Object.values(row);
        questions.push({
          number: parseInt(values[0]!),
          question: values[1]!,
          answers: [values[2]!, values[3]!, values[4]!, values[5]!],
          correctAnswerIndex: parseInt(values[6]!) - 1,
        });
      })
      .on("end", () => resolve(questions))
      .on("error", reject);
  });
}

async function verifyQuestion(
  question: QuizQuestion,
): Promise<VerificationResult> {
  const optionsText = question.answers
    .map((ans, idx) => `${idx + 1}. ${ans}`)
    .join("\n");

  const prompt = `Question: ${question.question}

Options:
${optionsText}

The quiz claims the correct answer is option ${question.correctAnswerIndex + 1}: "${question.answers[question.correctAnswerIndex]}"

Verify if this is factually correct. Always search the web for every single question to verify if it is correct.
The date is ${new Date().toLocaleDateString()}.
.`;
  const modelId =
    process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview";
  const { object } = await generateObject({
    model: openrouter(modelId),
    schema: VerificationSchema,
    prompt,
    system:
      "You are an AI assistant that helps people find information. Please always use web search to verify the accuracy of the information and stay concise.",
  });

  return {
    questionNumber: question.number,
    question: question.question,
    claimedCorrect: question.answers[question.correctAnswerIndex]!,
    isCorrect: object.isCorrect,
    aiVerification: object.reasoning,
  };
}
function generateHTMLReport(
  results: VerificationResult[],
  outputPath: string = "quiz_report.html",
): void {
  const correctCount = results.filter((r) => r.isCorrect).length;
  const accuracy = Math.round((correctCount / results.length) * 100);

  const resultRows = results
    .map(
      (result) => `
    <div class="border-l-4 ${
      result.isCorrect
        ? "border-green-500 bg-green-50"
        : "border-red-500 bg-red-50"
    } p-6 rounded-lg">
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-lg font-semibold text-gray-900">
            Question ${result.questionNumber}
          </h3>
          <p class="text-gray-700 mt-2">${result.question}</p>
        </div>
        <span class="${
          result.isCorrect
            ? "bg-green-200 text-green-800"
            : "bg-red-200 text-red-800"
        } px-3 py-1 rounded-full text-sm font-medium">
          ${result.isCorrect ? "✓ Correct" : "✗ Incorrect"}
        </span>
      </div>
      <div class="mt-4">
        <p class="text-sm font-medium text-gray-900">
          Claimed Answer:
        </p>
        <p class="text-gray-700">${result.claimedCorrect}</p>
      </div>
      <div class="mt-4">
        <p class="text-sm font-medium text-gray-900">
          AI Verification:
        </p>
        <p class="text-gray-700 leading-relaxed">
          ${result.aiVerification}
        </p>
      </div>
    </div>
  `,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quiz Verification Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
    <div class="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-sm p-8 mb-8">
            <h1 class="text-4xl font-bold text-gray-900 mb-2">
                Quiz Verification Report
            </h1>
            <p class="text-gray-600">
                Generated on ${new Date().toLocaleString()}
            </p>
        </div>

        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-lg shadow-sm p-6">
                <p class="text-sm font-medium text-gray-600 uppercase">
                    Total Questions
                </p>
                <p class="text-3xl font-bold text-gray-900 mt-2">
                    ${results.length}
                </p>
            </div>
            <div class="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                <p class="text-sm font-medium text-gray-600 uppercase">
                    Correct
                </p>
                <p class="text-3xl font-bold text-green-600 mt-2">
                    ${correctCount}
                </p>
            </div>
            <div class="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                <p class="text-sm font-medium text-gray-600 uppercase">
                    Accuracy
                </p>
                <p class="text-3xl font-bold text-blue-600 mt-2">
                    ${accuracy}%
                </p>
            </div>
        </div>

        <!-- Results -->
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-900">
                Question Results
            </h2>
            ${resultRows}
        </div>

        <!-- Footer -->
        <div class="mt-12 text-center text-gray-600 text-sm">
            <p>
                This report was generated by the Quiz Verification Tool
            </p>
        </div>
    </div>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  console.log(`✓ HTML report generated: ${outputPath}`);
}
async function checkAllQuestions(): Promise<void> {
  console.log("📚 Loading quiz questions...\n");
  const questions = await parseCSV("quiz.csv");
  console.log(`✓ Found ${questions.length} questions\n`);

  const results: VerificationResult[] = [];
  let correctCount = 0;

  for (const question of questions) {
    console.log(`Checking Q${question.number}...`);
    const result = await verifyQuestion(question);
    results.push(result);

    if (result.isCorrect) {
      console.log(`✓ Q${question.number}: CORRECT\n`);
      correctCount++;
    } else {
      console.log(`✗ Q${question.number}: INCORRECT\n`);
    }
  }

  fs.writeFileSync(
    "quiz_verification_results.json",
    JSON.stringify(results, null, 2),
  );
  generateHTMLReport(results);
  await open(`${process.cwd()}/quiz_report.html`);
  console.log(
    `\n📊 Summary: ${correctCount}/${questions.length} ` +
      `questions verified as correct`,
  );
  console.log("💾 Full results saved to quiz_verification_results.json");
}

checkAllQuestions().catch(console.error);
