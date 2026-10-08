export function verifyEvaluationUsage(report) {
  const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
  if (!report || !Array.isArray(report.results) || !report.results.length || !nonnegative(report.inputTokens) || !nonnegative(report.outputTokens)) throw new Error("Measured aggregate usage is required.");
  let inputTokens = 0; let outputTokens = 0;
  for (const item of report.results) {
    if (!item.answer?.usage || !nonnegative(item.answer.usage.inputTokens) || !nonnegative(item.answer.usage.outputTokens)) throw new Error("Each provider response needs measured usage.");
    inputTokens += item.answer.usage.inputTokens; outputTokens += item.answer.usage.outputTokens;
    if (!nonnegative(inputTokens) || !nonnegative(outputTokens)) throw new Error("Measured usage exceeds a safe integer.");
  }
  if (inputTokens !== report.inputTokens || outputTokens !== report.outputTokens) throw new Error("Aggregate usage does not match the measured responses.");
  return { inputTokens, outputTokens };
}
