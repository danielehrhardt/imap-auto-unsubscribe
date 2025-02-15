import * as cheerio from "cheerio";
import Imap from "imap";
import type { ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import { appendFileSync } from "node:fs";
import * as os from "os";

// ---- Configuration ----
const userEmail = ""; // your email address
const userEmailAppPass = ""; // your email app password
const emailProviderImap = "";
const userEmailFolder = "INBOX"; // adjust as needed
const subLinksFileName = "unsubscribeLinks.txt";
// Process only this many emails (set 0 for unlimited)
const limit = 0;

// ------------------------

const imap = new Imap({
  user: userEmail,
  password: userEmailAppPass,
  host: emailProviderImap,
  port: 993,
  tls: true,
});

// Promisified function to open the mailbox
function openInbox(mailbox: string): Promise<void> {
  return new Promise((resolve, reject) => {
    imap.openBox(mailbox, true, (err, box) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Helper function to search emails matching a criteria
function searchEmails(criteria: any[]): Promise<number[]> {
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

async function processEmails() {
  const unsubLinks: Set<string> = new Set();
  let emailCount = 0;

  imap.on("error", (err: any) => {
    console.error("IMAP Error: ", err);
  });

  imap.once("ready", async () => {
    try {
      await openInbox(userEmailFolder);
      console.log("Processing mailbox...");

      // Search for emails that contain the word "unsubscribe"
      // You may adjust the search criteria as needed.
      const searchCriteria = [["TEXT", "unsubscribe"]];
      const results = await searchEmails(searchCriteria);
      console.log(`Found ${results.length} emails matching search criteria.`);

      // If a limit is specified and > 0, process at most that many emails.
      const emailsToProcess = limit > 0 ? results.slice(0, limit) : results;

      const fetcher = imap.fetch(emailsToProcess, { bodies: "" });

      fetcher.on("message", (msg, seqno) => {
        console.log(`Processing email id = ${seqno}...`);
        let emailBuffer = "";

        msg.on("body", (stream, _info) => {
          stream.on("data", (chunk) => {
            emailBuffer += chunk.toString("utf8");
          });
        });

        msg.once("end", async () => {
          try {
            // Parse the email using mailparser to handle MIME etc.
            const parsed: ParsedMail = await simpleParser(emailBuffer);
            let htmlBody = parsed.html;
            // If no HTML part exists, skip this email.
            if (!htmlBody) {
              return;
            }

            // Use cheerio to parse the HTML
            const $ = cheerio.load(htmlBody);
            $("a").each((_, elem) => {
              const linkText = $(elem).text().trim();
              const href = $(elem).attr("href")!;
              if (
                href &&
                (linkText.toLowerCase().includes("unsubscribe") ||
                  href.toLowerCase().includes("unsubscribe"))
              ) {
                if (!unsubLinks.has(href)) {
                  unsubLinks.add(href);
                  console.log("Found new link to unsubscribe from:", href);
                  processLink(href);
                }
              }
            });
          } catch (parseError) {
            console.error("Error parsing email: ", parseError);
          }
          emailCount++;
        });
      });

      fetcher.once("error", (err) => {
        console.error("Fetch error: ", err);
      });

      fetcher.once("end", () => {
        console.log(`Emails processed: ${emailCount}`);
        console.log(`Unsubscribe links found: ${unsubLinks.size}`);
        imap.end();
      });
    } catch (error) {
      console.error("Error during processing: ", error);
      imap.end();
    }
  });

  imap.connect();
}

async function processLink(href: string) {
  appendFileSync(subLinksFileName, href + os.EOL);
  try {
    await fetch(href);
  } catch (error) {}
}

processEmails().catch((err) => {
  console.error("Unexpected error: ", err);
});
