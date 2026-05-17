# 📧 AgentMail Skill for OpenClaw

Send and receive emails programmatically using the AgentMail API. Perfect for testing, automation, privacy, and email-based workflows.

## ⚠️ Critical Fix: Use `text` NOT `body`

**This is the most important thing to know:** When sending emails, you **MUST** use the `text` parameter, not `body`:

```javascript
// ✅ CORRECT
await mail.sendEmail(inbox.id, {
  to: ['recipient@example.com'],
  subject: 'Hello',
  text: 'Email body here'  // <-- USE THIS
});

// ❌ WRONG - This sends an empty email!
await mail.sendEmail(inbox.id, {
  to: ['recipient@example.com'],
  subject: 'Hello',
  body: 'Email body here'   // <-- DON'T USE THIS
});
```

## Features

- ✅ Create disposable email inboxes
- ✅ Send emails programmatically (use `text` parameter!)
- ✅ Receive and parse incoming emails
- ✅ Automatic multipart MIME email parsing
- ✅ Proper quoted-printable decoding
- ✅ Full UTF-8 and emoji support (🎉)
- ✅ Wait for email replies (perfect for verification flows)
- ✅ Reply to and forward emails
- ✅ HTML to text conversion

## Installation

1. Copy this skill to your OpenClaw skills directory:
   ```bash
   cp -r agentmail ~/.openclaw/skills/
   ```

2. Install dependencies:
   ```bash
   cd ~/.openclaw/skills/agentmail
   npm install
   ```

3. Set your AgentMail API key:
   ```bash
   export AGENTMAIL_API_KEY="your_api_key_here"
   ```
   
   Or create a `.env.agentmail` file in your workspace:
   ```
   AGENTMAIL_API_KEY=your_api_key_here
   ```

## Getting an API Key

1. Visit https://agentmail.to
2. Sign up for an account
3. Generate an API key from your dashboard

## Usage

### Slash Commands

| Command | Description |
|---------|-------------|
| `/agentmail inbox create [name]` | Create a new disposable inbox |
| `/agentmail inbox list` | List all your inboxes |
| `/agentmail inbox delete [id]` | Delete an inbox |
| `/agentmail send [from] [to] [subject]` | Send an email |
| `/agentmail receive [inbox]` | Check for emails |
| `/agentmail wait [inbox]` | Wait for new emails |
| `/agentmail reply [inbox] [msg-id]` | Reply to an email |
| `/agentmail forward [inbox] [msg-id] [to]` | Forward an email |

### Natural Language Examples

- "Create a temporary email inbox for me"
- "Send an email from my test inbox to example@gmail.com"
- "Check if I have any new emails"
- "Wait for a verification email in my test inbox"
- "Reply to the last email I received"

### Programmatic Usage

```javascript
import { AgentMailHelper } from './scripts/agentmail-helper.mjs';

const mail = new AgentMailHelper();

// Create inbox
const inbox = await mail.createInbox('my-test');
console.log(`Created: ${inbox.email}`);

// Send email - USE 'text', NOT 'body'
await mail.sendEmail(inbox.id, {
  to: ['recipient@example.com'],
  subject: 'Hello!',
  text: 'Email body with emoji 🎉'  // ✅ CORRECT
});

// Wait for reply
const emails = await mail.waitForEmails(inbox.id, { timeout: 60000 });
for (const email of emails) {
  console.log(`From: ${email.from}`);
  console.log(`Subject: ${email.subject}`);
  console.log(`Body: ${email.body}`);  // Auto-parsed plain text
}

// Cleanup
await mail.deleteInbox(inbox.id);
```

## Email Body Parsing

The helper automatically handles complex email formats:

- **Multipart MIME:** Extracts text from multipart emails
- **Quoted-printable:** Decodes `=XX` hex escapes and soft line breaks
- **UTF-8:** Properly handles international characters and emoji
- **HTML:** Converts HTML emails to plain text
- **Entities:** Decodes HTML entities (`&quot;`, `&#39;`, etc.)

Example of parsed email:
```javascript
{
  id: '<message-id@email.amazonses.com>',
  from: 'sender@example.com',
  to: ['your-inbox@agentmail.to'],
  subject: 'Test Email',
  createdAt: '2026-05-17T04:20:00Z',
  threadId: 'abc-123',
  body: 'This is the email body with emoji 🎉\n\nAnd newlines preserved!'
}
```

## Inbox Limits

AgentMail has inbox limits (typically 3-5 inboxes per account). Always clean up:

```javascript
// Good practice: cleanup after use
try {
  const inbox = await mail.createInbox('temp');
  // ... do your work ...
} finally {
  await mail.deleteInbox(inbox.id);  // Always cleanup
}
```

## CLI Usage

The helper script can also be used from command line:

```bash
# Create inbox
node scripts/agentmail-helper.mjs create my-inbox

# List inboxes
node scripts/agentmail-helper.mjs list

# Send email
node scripts/agentmail-helper.mjs send \
  from@agentmail.to \
  to@example.com \
  "Subject" \
  "Email body"

# Receive emails
node scripts/agentmail-helper.mjs receive from@agentmail.to --full
```

## Troubleshooting

### Emails arrive empty

**Problem:** You're using `body` instead of `text` when sending.

**Solution:** Always use `text`:
```javascript
await mail.sendEmail(inbox.id, {
  to: ['recipient@example.com'],
  subject: 'Hello',
  text: 'This is the body'  // ✅ Use 'text'
});
```

### Inbox limit exceeded

**Problem:** You've hit the inbox limit (usually 3-5 inboxes).

**Solution:** Delete old inboxes:
```bash
/agentmail inbox list
/agentmail inbox delete old-inbox@agentmail.to
```

### API key not found

**Problem:** `AGENTMAIL_API_KEY` environment variable not set.

**Solution:** 
```bash
export AGENTMAIL_API_KEY="your_key_here"
# Or create .env.agentmail file
```

## License

MIT
