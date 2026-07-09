#!/usr/bin/env node
import fs from "fs";
import https from "https";
import path from "path";

const VARIANTS = {
  base: "dist/hotline_hq_outreach.html",
  money: "dist/hotline_hq_outreach_money.html",
  listen: "dist/hotline_hq_outreach_listen.html",
  network: "dist/hotline_hq_outreach_network.html",
  own_line: "dist/hotline_hq_outreach_own_line.html",
};
const VARIANT_KEYS = Object.keys(VARIANTS);
const LOGIN_URL = "https://hotlinehq.online/client/login";
const SIGNUP_URL = "https://hotlinehq.online/client/signup";

function usage() {
  console.error(
      "Usage: SENDGRID_API_KEY=... node scripts/send_outreach.js recipients.json [variant|random] [--dry-run]\n" +
      "Variants: base, money, listen, network, own_line, random\n" +
      "JSON: [{ \"email\": \"buyer@example.com\", \"company_name\": \"ABC Auto\" }]"
  );
  process.exit(1);
}

function readRecipients(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const recipients = Array.isArray(parsed) ? parsed : parsed.recipients;
  if (!Array.isArray(recipients)) {
    throw new Error("Recipients JSON must be an array or { recipients: [...] }");
  }
  return recipients;
}

function getSubject(html, file) {
  const marker = '<meta name="email-subject" content="';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Missing email-subject meta in ${file}`);
  const rest = html.slice(start + marker.length);
  return rest.slice(0, rest.indexOf('"'));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSignupUrl(recipient) {
  const url = new URL(SIGNUP_URL);
  const company = recipient.company_name?.trim();
  const email = recipient.email?.trim();
  const referralCode = recipient.referral_code?.trim() || recipient.ref?.trim();
  const room = recipient.room?.trim();
  if (company) url.searchParams.set("company_name", company);
  if (email) url.searchParams.set("email", email);
  if (referralCode) url.searchParams.set("ref", referralCode);
  if (room) url.searchParams.set("room", room);
  return url.toString();
}

function pickVariant(recipient, defaultVariant) {
  if (recipient.variant) return recipient.variant;
  if (defaultVariant === "random") {
    return VARIANT_KEYS[Math.floor(Math.random() * VARIANT_KEYS.length)];
  }
  return defaultVariant;
}

function personalize(html, recipient) {
  const company = recipient.company_name?.trim() || "your yard";
  const companySentence = recipient.company_name?.trim() || "Your yard";
  const email = recipient.email?.trim();
  const signupUrl = buildSignupUrl(recipient);
  return html
    .replaceAll("{{company_name}}", escapeHtml(company))
    .replaceAll("{{company_name_sentence}}", escapeHtml(companySentence))
    .replaceAll("{{recipient_email}}", escapeHtml(email || ""))
    .replaceAll("{{signup_url}}", escapeHtml(signupUrl))
    .replaceAll("{{login_url}}", escapeHtml(LOGIN_URL));
}

function sendEmail({ apiKey, to, subject, html, variant }) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
          custom_args: { variant },
        },
      ],
      from: { email: "hotlinehq@redlineusedautoparts.com", name: "Hotline HQ" },
      subject,
      content: [{ type: "text/html", value: html }],
    });

    const req = https.request(
      {
        hostname: "api.sendgrid.com",
        path: "/v3/mail/send",
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          const result = {
            email: to,
            variant,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            body,
          };
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(result);
          else reject(Object.assign(new Error(`Send failed for ${to}`), { result }));
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cleanArgs = args.filter((arg) => arg !== "--dry-run");
  const recipientsFile = cleanArgs[0];
  const defaultVariant = cleanArgs[1] || "random";
  if (!recipientsFile || (defaultVariant !== "random" && !VARIANTS[defaultVariant])) usage();

  const recipients = readRecipients(recipientsFile);
  const cache = new Map();
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!dryRun && !apiKey) throw new Error("SENDGRID_API_KEY is required");

  const results = [];
  for (const recipient of recipients) {
    if (!recipient.email) throw new Error("Every recipient needs an email");
    const variant = pickVariant(recipient, defaultVariant);
    const templateFile = VARIANTS[variant];
    if (!templateFile) throw new Error(`Unknown variant "${variant}" for ${recipient.email}`);

    if (!cache.has(templateFile)) {
      const html = fs.readFileSync(templateFile, "utf8");
      cache.set(templateFile, {
        html,
        subject: getSubject(html, templateFile),
      });
    }

    const template = cache.get(templateFile);
    const html = personalize(template.html, recipient);
    if (dryRun) {
      results.push({
        email: recipient.email,
        company_name: recipient.company_name || null,
        variant,
        subject: template.subject,
        template: path.basename(templateFile),
        signup_url: buildSignupUrl(recipient),
      });
      continue;
    }

    results.push(
      await sendEmail({
        apiKey,
        to: recipient.email,
        subject: template.subject,
        html,
        variant,
      })
    );
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  if (err.result) console.error(JSON.stringify(err.result, null, 2));
  else console.error(err.message);
  process.exit(1);
});
