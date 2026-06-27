#!/usr/bin/env node
import fs from "fs";

function usage() {
  console.error("Usage: node scripts/prepare_outreach_recipients.js pasted-sheet.txt recipients.json");
  process.exit(1);
}

const inputFile = process.argv[2];
const outputFile = process.argv[3];
if (!inputFile || !outputFile) usage();

function splitTsvLine(line) {
  return line.split("\t");
}

function cleanCompanyName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmails(value) {
  return String(value || "")
    .replace(/\.$/, "")
    .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function hasObviousBadTld(email) {
  return /\.(cop|con|comm|cmo)$/i.test(email);
}

const lines = fs.readFileSync(inputFile, "utf8")
  .split(/\r?\n/)
  .filter(line => line.trim());

if (lines.length < 2) {
  throw new Error("No recipient rows found");
}

const headers = splitTsvLine(lines[0]).map(header => header.trim().toLowerCase());
const yardIndex = headers.indexOf("yard name");
const emailIndex = headers.indexOf("email");
if (yardIndex < 0 || emailIndex < 0) {
  throw new Error("Expected headers: Yard Name and Email");
}

const recipients = [];
const seen = new Set();
const skipped = [];

for (const line of lines.slice(1)) {
  const cols = splitTsvLine(line);
  const companyName = cleanCompanyName(cols[yardIndex]);
  const emails = extractEmails(cols[emailIndex]);

  if (!companyName || emails.length === 0) {
    skipped.push({ company_name: companyName || null, email_cell: cols[emailIndex] || "" });
    continue;
  }

  for (const email of emails) {
    const cleanEmail = email.toLowerCase();
    if (hasObviousBadTld(cleanEmail)) {
      skipped.push({ company_name: companyName, email_cell: cols[emailIndex] || "", reason: "obvious_bad_tld" });
      continue;
    }
    if (seen.has(cleanEmail)) continue;
    seen.add(cleanEmail);
    recipients.push({ company_name: companyName, email: cleanEmail });
  }
}

fs.writeFileSync(outputFile, JSON.stringify(recipients, null, 2) + "\n");
console.log(JSON.stringify({
  input_rows: lines.length - 1,
  recipients: recipients.length,
  skipped_rows: skipped.length,
  output: outputFile,
}, null, 2));
