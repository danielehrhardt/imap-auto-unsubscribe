import * as cheerio from "cheerio";
import Imap from "imap";
import type { ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import { appendFileSync } from "node:fs";
import * as os from "os";

interface EmailConfig {
  email: string;
  password: string;
  imapServer: string;
  folder?: string;
  limit?: number;
}

// Helper function to open the mailbox
function openInbox(imap: Imap, mailbox: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.openBox(mailbox, true, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Helper function to search emails matching criteria
function searchEmails(imap: Imap, criteria: any[]): Promise<number[]> {
  return new Promise((resolve, reject) => {
    imap.search(criteria, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

export async function processEmails(
  config: EmailConfig,
  logCallback: (message: string) => void = console.log
) {
  const {
    email,
    password,
    imapServer,
    folder = "INBOX",
    limit = 0
  } = config;

  const unsubLinks: Set<string> = new Set();
  let emailCount = 0;

  const imap = new Imap({
    user: email,
    password: password,
    host: imapServer,
    port: 993,
    tls: true,
  });

  return new Promise((resolve, reject) => {
    imap.on("error", (err: Error) => {
      logCallback(`IMAP Error: ${err.message}`);
      reject(err);
    });

    imap.once("ready", async () => {
      try {
        await openInbox(imap, folder);
        logCallback("Processing mailbox...");

        const searchCriteria = [["TEXT", "unsubscribe"]];
        const results = await searchEmails(imap, searchCriteria);
        logCallback(`Found ${results.length} emails matching search criteria.`);

        const emailsToProcess = limit > 0 ? results.slice(0, limit) : results;
        const fetcher = imap.fetch(emailsToProcess, { bodies: "" });

        fetcher.on("message", (msg, seqno) => {
          logCallback(`Processing email id = ${seqno}...`);
          let emailBuffer = "";

          msg.on("body", (stream, _info) => {
            stream.on("data", (chunk) => {
              emailBuffer += chunk.toString("utf8");
            });
          });

          msg.once("end", async () => {
            try {
              const parsed: ParsedMail = await simpleParser(emailBuffer);
              let htmlBody = parsed.html;
              if (!htmlBody) {
                return;
              }

              const $ = cheerio.load(htmlBody);
              $("a").each((_, elem) => {
                const linkText = $(elem).text().trim();
                const href = $(elem).attr("href");
                if (
                  href &&
                  (linkText.toLowerCase().includes("unsubscribe") ||
                    href.toLowerCase().includes("unsubscribe"))
                ) {
                  if (!unsubLinks.has(href)) {
                    unsubLinks.add(href);
                    logCallback("Found new link to unsubscribe from: " + href);
                    processLink(href);
                  }
                }
              });
            } catch (parseError) {
              logCallback(`Error parsing email: ${parseError}`);
            }
            emailCount++;
          });
        });

        fetcher.once("error", (err) => {
          logCallback(`Fetch error: ${err}`);
          reject(err);
        });

        fetcher.once("end", () => {
          logCallback(`Emails processed: ${emailCount}`);
          logCallback(`Unsubscribe links found: ${unsubLinks.size}`);
          imap.end();
          resolve(undefined);
        });
      } catch (error) {
        logCallback(`Error during processing: ${error}`);
        imap.end();
        reject(error);
      }
    });

    imap.connect();
  });
}

async function processLink(href: string) {
  // appendFileSync("unsubscribeLinks.txt", href + os.EOL);
  try {
    await fetch(href);
  } catch (error) {
    // Ignore fetch errors
  }
}

// Only run if this file is called directly
/*
const config: EmailConfig = {
  email: "",
  password: "",
  imapServer: "",
};

processEmails(config).catch((err) => {
  console.error("Unexpected error: ", err);
});*/