import "server-only";
import ExcelJS from "exceljs";
import { readingProblems } from "@/server/books";
import { isValidDay } from "@/server/dates";

// Reads a book tracker spreadsheet (.xlsx or .csv) into rows the app can
// preview before saving. Nothing is stored here: the app saves the rows the
// user accepts into its own database, and they sync like any other edit.
//
// Expected columns (matched case-insensitively, common variants accepted):
//   Sr No, Book Title, Author, Genre, Type, Start Date, End Date, Status, Rating

export const MAX_ROWS = 2000;

const COLUMNS = {
  readNumber: ["sr no", "sr no.", "sr. no", "sr. no.", "srno", "sr", "s no", "times read", "read number"],
  title: ["book title", "title", "book", "book name", "name"],
  author: ["author", "writer", "author name"],
  genre: ["genre", "category"],
  type: ["type", "format"],
  startDate: ["start date", "started", "start", "date started"],
  endDate: ["end date", "finished", "end", "finish date", "date finished", "completed date"],
  status: ["status"],
  rating: ["rating", "stars"],
};

const TYPE_WORDS = {
  hardcopy: ["hardcopy", "hard copy", "hard", "physical", "paperback", "hardcover", "print", "book"],
  softcopy: ["softcopy", "soft copy", "soft", "ebook", "e-book", "kindle", "pdf", "digital"],
  audiobook: ["audiobook", "audio book", "audio", "audible"],
};
const STATUS_WORDS = {
  planned: ["planned", "plan", "to read", "want to read", "tbr", "not started"],
  reading: ["reading", "in progress", "currently reading", "current", "started", "ongoing"],
  completed: ["completed", "complete", "done", "finished", "read"],
};
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const headerKey = (value) => clean(value).toLowerCase().replace(/[:.]+$/, "").trim();

function lookup(words, value) {
  const key = clean(value).toLowerCase();
  return Object.keys(words).find((name) => words[name].includes(key)) ?? null;
}

// ---- reading the file --------------------------------------------------

// Returns a 2-D array of cell values (row 0 = headers) plus the sheet row
// number of each data row, so errors can say "row 7" like Excel does.
export async function readSheet(buffer, fileName) {
  const isXlsx = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK" zip header
  if (isXlsx) return readXlsx(buffer);
  if (/\.(xlsx|xls)$/i.test(fileName ?? "")) throw new Error("That Excel file couldn't be read. Save it as .xlsx and try again.");
  return readCsv(buffer.toString("utf8"));
}

async function readXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) return { rows: [], rowNumbers: [] };
  const rows = [];
  const rowNumbers = [];
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    rows.push(row.values.slice(1).map(cellValue));
    rowNumbers.push(number);
  });
  return { rows, rowNumbers };
}

function cellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    if ("result" in value) return cellValue(value.result); // formula
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return cellValue(value.text); // hyperlink
    return "";
  }
  return value;
}

// RFC 4180 CSV with quotes; the delimiter (, ; or tab) is taken from the header line.
export function readCsv(text) {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter = [",", ";", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const kept = [];
  const rowNumbers = [];
  rows.forEach((cells, index) => {
    if (cells.some((cell) => clean(cell))) {
      kept.push(cells);
      rowNumbers.push(index + 1);
    }
  });
  return { rows: kept, rowNumbers };
}

// ---- interpreting values ----------------------------------------------

const pad = (value) => String(value).padStart(2, "0");

// Accepts Excel dates and serial numbers, 2026-10-12, 12/10/2026 (day first,
// as in India), 12-10-26, 12 Oct 2026 and Oct 12, 2026.
export function parseDate(value) {
  if (value === "" || value === null || value === undefined) return { value: null };
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return { error: "isn't a valid date" };
    return { value: value.toISOString().slice(0, 10) };
  }
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return { error: "isn't a valid date" };
    return { value: new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10) };
  }

  const text = clean(value).toLowerCase().replace(/,/g, "");
  let year;
  let month;
  let date;
  let match;
  if ((match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) [, year, month, date] = match;
  else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) [, date, month, year] = match;
  else if ((match = text.match(/^(\d{1,2})[- ]([a-z]+)[- ](\d{2}|\d{4})$/))) {
    [, date, month, year] = match;
    month = MONTHS.indexOf(month.slice(0, 3)) + 1;
  } else if ((match = text.match(/^([a-z]+) (\d{1,2}) (\d{4})$/))) {
    [, month, date, year] = match;
    month = MONTHS.indexOf(month.slice(0, 3)) + 1;
  } else return { error: "isn't a date we understand (use DD/MM/YYYY)" };

  if (String(year).length === 2) year = `20${year}`;
  const day = `${year}-${pad(month)}-${pad(date)}`;
  return isValidDay(day) ? { value: day } : { error: "isn't a valid date" };
}

function parseRating(value) {
  const text = clean(value);
  if (!text) return { value: null };
  const stars = text.match(/^★+$/);
  const number = stars ? stars[0].length : Number(text.replace(/\s*\/\s*5$/, ""));
  if (!Number.isInteger(number) || number < 1 || number > 5) return { error: "must be a whole number from 1 to 5" };
  return { value: number };
}

function parseReadNumber(value) {
  const text = clean(value);
  if (!text) return { value: null };
  const number = Number(text);
  if (!Number.isInteger(number) || number < 1 || number > 999) return { error: "must be a whole number like 1 or 2" };
  return { value: number };
}

// ---- rows -------------------------------------------------------------

// Turns the sheet into { columns, rows, summary } for the preview.
export function interpretSheet({ rows, rowNumbers }) {
  if (!rows.length) return { error: "The file is empty." };

  const headers = rows[0].map(headerKey);
  const index = {};
  for (const [field, names] of Object.entries(COLUMNS)) {
    const position = headers.findIndex((header) => names.includes(header));
    if (position !== -1) index[field] = position;
  }
  const missing = Object.keys(COLUMNS).filter((field) => index[field] === undefined);
  if (index.title === undefined) {
    return { error: 'No "Book Title" column found. The first row must hold the column names.', missing };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) return { error: `Too many rows: the most we can import at once is ${MAX_ROWS}.` };

  const result = dataRows.map((cells, position) => {
    const get = (field) => (index[field] === undefined ? "" : (cells[index[field]] ?? ""));
    const errors = [];
    const warnings = [];
    const take = (label, parsed) => {
      if (parsed.error) errors.push(`${label} ${parsed.error}`);
      return parsed.value ?? null;
    };

    const title = clean(get("title")).slice(0, 200);
    if (!title) errors.push("Book Title is empty");

    const startDate = take("Start Date", parseDate(get("startDate")));
    const endDate = take("End Date", parseDate(get("endDate")));
    const rating = take("Rating", parseRating(get("rating")));
    const readNumber = take("Sr No", parseReadNumber(get("readNumber")));

    let type = lookup(TYPE_WORDS, get("type"));
    if (!type) {
      if (clean(get("type"))) errors.push(`Type "${clean(get("type"))}" should be Hardcopy, Softcopy or Audiobook`);
      else warnings.push("No type given, saved as Hardcopy");
      type ??= "hardcopy";
    }

    let status = lookup(STATUS_WORDS, get("status"));
    if (!status) {
      if (clean(get("status"))) errors.push(`Status "${clean(get("status"))}" should be Planned, Reading or Completed`);
      else {
        status = endDate ? "completed" : startDate ? "reading" : "planned";
        warnings.push(`No status given, saved as ${status[0].toUpperCase()}${status.slice(1)}`);
      }
    }

    const data = {
      readNumber,
      title,
      author: clean(get("author")).slice(0, 150),
      genre: clean(get("genre")).slice(0, 60),
      type,
      status: status ?? "planned",
      startDate,
      endDate,
      rating,
    };
    if (status) errors.push(...readingProblems(data));

    return { row: rowNumbers[position + 1], ok: errors.length === 0, data, errors, warnings };
  });

  const valid = result.filter((row) => row.ok).length;
  return {
    columns: { found: Object.keys(index), missing },
    rows: result,
    summary: { total: result.length, valid, invalid: result.length - valid },
  };
}
