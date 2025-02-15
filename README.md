# IMAP Auto Unsubscribe 🔗

A Node.js script that automatically finds and processes unsubscribe links from your email inbox using IMAP.

## Features ✨

- Automatically scans your email inbox for messages containing "unsubscribe"
- Parses HTML content to extract unsubscribe links
- Stores found links in `unsubscribeLinks.txt`
- Attempts to visit each unsubscribe link (GET request)
- Configurable email processing limits

## Installation 💻

1. Clone the repository:
```bash
git clone https://github.com/danielehrhardt/imap-auto-unsubscribe.git
cd imap-auto-unsubscribe
```

2. Install dependencies using Bun:

```bash
bun install
```

## Configuration ⚙️

Edit the configuration constants at the top of index.ts:

```typescript
const userEmail = "your.email@example.com";        // Your full email address
const userEmailAppPass = "your-app-password";      // Application-specific password
const emailProviderImap = "imap.example.com";      // e.g., imap.gmail.com for Gmail
const userEmailFolder = "INBOX";                   // Mailbox to scan
const subLinksFileName = "unsubscribeLinks.txt";   // Output file name
const limit = 10;                                  // Number of emails to process
```

## Usage 🚀

Run the script with Bun:

```bash
bun run index.ts
```

The script will:

- Connect to your IMAP email server
- Search for emails containing "unsubscribe"
- Parse found emails for unsubscribe links
- Save links to unsubscribeLinks.txt
- Attempt to visit each link

Check the output file:

```bash
cat unsubscribeLinks.txt
```

## Security 🔒

- Use an app-specific password instead of your main email password
- Never commit your credentials to GitHub
- Be cautious with unsubscribe links - manually verify suspicious links
- Add unsubscribeLinks.txt to your .gitignore

## Limitations ⚠️

- Only processes emails with "unsubscribe" in body text
- Relies on HTML parsing (may miss links in plain text emails)
- GET requests may not complete all unsubscribe processes
- IMAP connections only (no OAuth support)
- Tested with Bun but should work with Node.js

## Contributing 🤝

PRs and issues welcome! Please:

- Open an issue to discuss major changes
- Ensure tests are added for new features
- Update documentation as needed

## License

MIT License

**Important Security Reminder:** Always use app-specific passwords and never commit actual credentials to version control. Consider adding `unsubscribeLinks.txt` and `index.ts` (with your credentials) to your `.gitignore` file.