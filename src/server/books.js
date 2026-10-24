import "server-only";

// Book tracker rules, shared by sync (src/server/sync.js) and the Excel/CSV
// import (src/server/bookImport.js) so both enforce exactly the same thing.

export const BOOK_TYPES = ["hardcopy", "softcopy", "audiobook"];
export const READING_STATUSES = ["planned", "reading", "completed"];

// Returns a list of problems with a reading ([] = valid).
export function readingProblems({ status, startDate, endDate, rating }) {
  const problems = [];
  if (startDate && endDate && endDate < startDate) problems.push("End date can't be before the start date");
  if (rating !== null && rating !== undefined && status !== "completed") {
    problems.push("A rating is only allowed when the status is Completed");
  }
  if (status === "planned" && endDate) problems.push("A planned book can't have an end date");
  return problems;
}
