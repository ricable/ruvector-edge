
import * as fs from 'fs';
import * as path from 'path';
import { parseQuestionsFromMarkdown } from './self-learning-demo/question-parser.ts';

const inputPath = path.join(process.cwd(), 'docs/ran-domain/250-questions.md');
const outputPath = path.join(process.cwd(), 'src/wasm/demo-browser/questions.js');

try {
    const result = parseQuestionsFromMarkdown(inputPath);
    const allQuestions = [
        ...result.categoryA,
        ...result.categoryB,
        ...result.categoryC
    ];

    const simpleQuestions = allQuestions.map(q => ({
        id: q.id,
        feature: q.featureName || q.featureAcronym,
        type: q.questionType,
        text: q.question,
        category: q.category
    }));

    const fileContent = `/**
 * Generated file - Do not edit manually.
 * Source: docs/ran-domain/250-questions.md
 */

export const QUESTIONS = ${JSON.stringify(simpleQuestions, null, 2)};
`;

    fs.writeFileSync(outputPath, fileContent);
    console.log(`Successfully generated ${outputPath} with ${simpleQuestions.length} questions.`);

} catch (error) {
    console.error('Error generating questions.js:', error);
    process.exit(1);
}
