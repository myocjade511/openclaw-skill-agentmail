---
name: agentmail
description: "Send and receive emails programmatically using AgentMail API. Create disposable inboxes, send emails, wait for replies, and manage email workflows."
version: 1.0.0
license: MIT
metadata: {"openclaw":{"requires":{"env":["AGENTMAIL_API_KEY"],"bins":["node"]},"primaryEnv":"AGENTMAIL_API_KEY","emoji":"📧","homepage":"https://agentmail.to"}}
---

# AgentMail Skill

Send and receive emails programmatically using the AgentMail API. Perfect for testing, automation, privacy, and email-based workflows.

## ⚠️ Critical Implementation Notes

### Sending Emails - USE `text` NOT `body`

**This is the #1 cause of issues.** When sending emails via AgentMail, you **MUST** use the `text` parameter, not `body`:

```javascript
// ✅ CORRECT - Use 'text'
await client.inboxes.messages.send(inboxId, {
  to: ["recipient@example.com"],
  subject: "Hello",
  text: "Email body content here"  // <-- USE THIS
});

// ❌ WRONG - Do NOT use 'body'
await client.inboxes.messages.send(inboxId, {
  to: ["recipient@example.com"],
  subject: "Hello",
  body: "Email body content here"   // <-- This will send an empty email!
});
```

### Email Body Parsing

Received emails are automatically parsed from multipart MIME format:
- Handles `text/plain` parts (preferred)
- Falls back to `text/html` parts with HTML-to-text conversion
- Properly decodes quoted-printable encoding
- Full UTF-8 support including emoji (🎉)

### Inbox Limits

AgentMail has inbox limits (typically 3-5 inboxes per account). Always clean up inboxes when done:

```javascript
// Create inbox
const inbox = await mail.createInbox('temp');

// ... do work ...

// Clean up
await mail.deleteInbox(inbox.id);
```

## When to Activate

Activate this skill when the user wants to:
- Send emails programmatically
- Create disposable email inboxes
- Receive and process incoming emails
- Test email verification flows
- Build email-based automations
- Use temporary emails for privacy
- Wait for email replies in workflows
- Forward or reply to emails automatically

**Activation Keywords:**
agentmail, send email, receive email, disposable email, temp email, temporary inbox, email automation, email testing, email verification, create inbox, delete inbox, wait for email, email reply, forward email, email workflow, programmatic email, email api, mail inbox, email helper

## First Interaction

When this skill is first used, the agent should:

1. **Check for API key:** Verify `AGENTMAIL_API_KEY` is set in the environment
2. **If missing:** Guide the user to get an API key from https://agentmail.to
3. **Validate:** Run a quick test to confirm the API key works
4. **Show capabilities:** Brief overview of what the skill can do

**Welcome message:**
> 📧 **AgentMail Skill Activated**
>
> I can help you send and receive emails programmatically. Here's what I can do:
>
> | Command | Description |
> |---------|-------------|
> | `/agentmail inbox create [name]` | Create a new disposable inbox |
> | `/agentmail inbox list` | List all your inboxes |
> | `/agentmail inbox delete [id]` | Delete an inbox |
> | `/agentmail send [from] [to] [subject]` | Send an email |
> | `/agentmail receive [inbox]` | Check for emails |
> | `/agentmail wait [inbox]` | Wait for new emails |
> | `/agentmail reply [inbox] [msg-id]` | Reply to an email |
>
> **⚠️ Important:** When sending emails, use the `text` parameter, NOT `body`.
>
> **Quick start:**
> ```
> /agentmail inbox create test
> /agentmail send test@your-inbox.agentmail.to recipient@example.com "Hello"
> ```

## Commands

### `/agentmail inbox create [identifier]`

Create a new disposable email inbox.

**Workflow:**
1. Generate a unique identifier if not provided (use timestamp + random)
2. Call AgentMail API to create inbox: `POST /v0/inboxes` with `{ identifier }`
3. Extract and display: inbox ID, email address, creation time
4. Save inbox details to `~/.openclaw-agentmail/inboxes.json` for reference

**Example:**
```
/agentmail inbox create my-test-inbox
```

**Output:**
```
✅ Inbox created!
   Email: my-test-inbox-abc123@agentmail.to
   ID: my-test-inbox-abc123@agentmail.to
   Created: 2026-05-17T04:20:00Z
```

### `/agentmail inbox list`

List all your AgentMail inboxes.

**Workflow:**
1. Call AgentMail API: `GET /v0/inboxes`
2. Parse response and format as table
3. Show: email address, created date

**Example:**
```
/agentmail inbox list
```

**Output:**
```
📧 Your Inboxes (3):

   Email                              Created
   ─────────────────────────────────────────────────
   test-1@agentmail.to                2026-05-17
   newsletter@agentmail.to            2026-05-16
   shopping@agentmail.to              2026-05-15
```

### `/agentmail inbox delete [inbox-id]`

Delete an inbox and all its messages.

**Workflow:**
1. Confirm with user: "Delete inbox [id]? This cannot be undone."
2. Call AgentMail API: `DELETE /v0/inboxes/{inboxId}`
3. Remove from local cache if present
4. Confirm deletion

**Example:**
```
/agentmail inbox delete test-1@agentmail.to
```

### `/agentmail send [from-inbox] [to-email] [subject]`

Send an email from an inbox.

**⚠️ CRITICAL:** Use `text` parameter for email body, NOT `body`.

**Workflow:**
1. Validate the from-inbox exists (check local cache or API)
2. Prompt for email body if not provided via interactive input
3. Call AgentMail API: `POST /v0/inboxes/{inboxId}/messages/send`
   ```json
   {
     "to": ["recipient@example.com"],
     "subject": "Subject line",
     "text": "Email body content"  // <-- USE 'text', NOT 'body'
   }
   ```
4. Display confirmation with message ID

**Example:**
```
/agentmail send my-inbox@agentmail.to friend@example.com "Hello!"
```

**Interactive mode:**
```
/agentmail send my-inbox@agentmail.to friend@example.com "Hello!"
> Enter email body (Ctrl+D when done):
> Hi there,
> 
> This is a test email from AgentMail!
> 
> Best regards
```

**Output:**
```
✅ Email sent!
   From: my-inbox@agentmail.to
   To: friend@example.com
   Subject: Hello!
   Message ID: <abc123@email.amazonses.com>
```

### `/agentmail receive [inbox-id]`

Check for received emails in an inbox.

**Workflow:**
1. Call AgentMail API: `GET /v0/inboxes/{inboxId}/messages`
2. Parse message list
3. For each message, show: from, subject, received time, preview
4. Offer to show full body with `/agentmail read [inbox] [msg-id]`

**Example:**
```
/agentmail receive my-inbox@agentmail.to
```

**Output:**
```
📨 Emails in my-inbox@agentmail.to (2):

   From: sender@example.com
   Subject: Welcome!
   Received: 2026-05-17 04:20:00
   Preview: Thank you for signing up...
   
   From: noreply@service.com
   Subject: Verification Code
   Received: 2026-05-17 04:15:00
   Preview: Your code is: 123456...
```

### `/agentmail read [inbox-id] [message-id]`

Read the full content of a specific email.

**Workflow:**
1. Call AgentMail API: `GET /v0/inboxes/{inboxId}/messages/{messageId}`
2. If body not in response, fetch raw message: `GET /v0/inboxes/{inboxId}/messages/{messageId}/raw`
3. Download from `downloadUrl` if provided
4. Parse multipart email to extract plain text body:
   - Handle quoted-printable encoding
   - Decode UTF-8 including emoji
   - Convert HTML to text if needed
5. Display full email: headers, body, attachments info

**Example:**
```
/agentmail read my-inbox@agentmail.to <msg-id>
```

### `/agentmail wait [inbox-id]`

Wait for new emails to arrive in an inbox.

**Workflow:**
1. Get current message count
2. Poll inbox every 2 seconds for up to 60 seconds (configurable)
3. When new messages arrive, display them immediately
4. Exit with timeout message if no emails received

**Options:**
- `--timeout [seconds]` - Maximum wait time (default: 60)
- `--count [n]` - Wait for at least N emails (default: 1)

**Example:**
```
/agentmail wait my-inbox@agentmail.to --timeout 120
```

**Output:**
```
⏳ Waiting for emails in my-inbox@agentmail.to...
   Checking every 2 seconds (timeout: 120s)

✅ New email received!
   From: sender@example.com
   Subject: Test Email
   Time: 2026-05-17 04:25:00
```

### `/agentmail reply [inbox-id] [message-id]`

Reply to a received email.

**⚠️ CRITICAL:** Use `text` parameter for reply body, NOT `body`.

**Workflow:**
1. Prompt for reply body if not provided
2. Call AgentMail API: `POST /v0/inboxes/{inboxId}/messages/{messageId}/reply`
   ```json
   {
     "text": "Reply body content"  // <-- USE 'text', NOT 'body'
   }
   ```
3. Confirm reply sent with message ID

**Example:**
```
/agentmail reply my-inbox@agentmail.to <msg-id>
> Enter your reply: Thanks for the email!
```

### `/agentmail forward [inbox-id] [message-id] [to-email]`

Forward an email to another address.

**Workflow:**
1. Prompt for optional additional text
2. Call AgentMail API: `POST /v0/inboxes/{inboxId}/messages/{messageId}/forward`
   ```json
   {
     "to": ["recipient@example.com"],
     "text": "Optional forwarding note"
   }
   ```
3. Confirm forward sent

**Example:**
```
/agentmail forward my-inbox@agentmail.to <msg-id> other@example.com
```

## Guardrails

1. **API Key Protection:** Never log or display the AGENTMAIL_API_KEY. Always reference it via environment variable.

2. **Inbox Limit Check:** Before creating inboxes, check current count. AgentMail has limits (typically 3-5 inboxes). Warn user if approaching limit.

3. **Email Validation:** Validate email addresses before sending. Reject obviously malformed addresses.

4. **Body Size Limit:** Warn if email body exceeds reasonable size (100KB+) as it may be rejected.

5. **Rate Limiting:** Respect AgentMail rate limits. If receiving 429 responses, implement exponential backoff.

6. **Sensitive Content:** Do not automatically forward emails containing potential sensitive content (passwords, tokens, PII) without explicit user confirmation.

7. **Cleanup Reminder:** Remind users to delete temporary inboxes when done to free up quota.

8. **Parameter Validation:** Always validate that `text` parameter is provided and non-empty when sending emails. Reject empty emails before API call.

## Failure Handling

| Error | Handling |
|-------|----------|
| 401 Unauthorized | API key invalid or missing. Prompt user to set AGENTMAIL_API_KEY. |
| 403 Forbidden | Inbox limit exceeded or permission denied. Show current inbox count and suggest cleanup. |
| 404 Not Found | Inbox or message not found. Verify ID and suggest listing inboxes. |
| 429 Too Many Requests | Rate limit hit. Wait and retry with exponential backoff. |
| 500 Server Error | AgentMail service issue. Report error and suggest retry later. |
| Network timeout | Retry up to 3 times with 2s delays. If still failing, report connectivity issue. |
| Invalid email format | Reject before sending with clear error message showing expected format. |
| Empty body | Reject send/reply commands with empty body. Prompt for content. |
| Wrong parameter | If user tries to use `body` instead of `text`, warn and correct them. |

## Example Prompts

**Basic usage:**
- "Create a temporary email inbox for me"
- "Send an email from my test inbox to example@gmail.com"
- "Check if I have any new emails"
- "Delete my old test inbox"

**Workflow automation:**
- "Create an inbox and wait for a verification email"
- "Send a test email and confirm it was received"
- "Forward all emails from my temp inbox to my real email"
- "Reply to the last email I received"

**Testing scenarios:**
- "I need to test email verification flow - create an inbox and show me the code when it arrives"
- "Send 3 test emails to check my email parsing"
- "Monitor this inbox for 5 minutes and alert me when emails arrive"

**Privacy/Security:**
- "Give me a disposable email for signing up on this website"
- "Create a temporary inbox that auto-forwards to my email then deletes itself"
- "I need an email for a one-time signup"

## Pro Tips

1. **Testing workflows:** Use `/agentmail wait` to pause execution until an email arrives — perfect for testing verification flows.

2. **Inbox naming:** Use descriptive identifiers like `signup-test` or `newsletter-check` to remember what each inbox is for.

3. **Auto-cleanup:** Build workflows that delete inboxes after use to stay under quota limits.

4. **Email parsing:** The skill automatically extracts plain text from multipart emails — no need to handle MIME parsing yourself.

5. **Reply threading:** Replies maintain thread context automatically via AgentMail's threadId tracking.

6. **Send parameter:** Always remember: use `text`, not `body` when sending emails!

## Implementation Reference

This skill uses the AgentMail Node.js SDK internally. The SDK provides:

```javascript
import { AgentMailClient } from "agentmail";

const client = new AgentMailClient({ apiKey: process.env.AGENTMAIL_API_KEY });

// Inbox operations
await client.inboxes.create({ identifier: "my-inbox" });
await client.inboxes.list();
await client.inboxes.delete(inboxId);

// Send email - CRITICAL: use 'text', not 'body'
await client.inboxes.messages.send(inboxId, {
  to: ["recipient@example.com"],
  subject: "Hello",
  text: "Email body here"  // ✅ CORRECT
});

// Receive emails
await client.inboxes.messages.list(inboxId);

// Get full email (returns download URL for .eml file)
const raw = await client.inboxes.messages.getRaw(inboxId, messageId);
const response = await fetch(raw.downloadUrl);
const emlContent = await response.text();

// Reply and forward
await client.inboxes.messages.reply(inboxId, messageId, { text: "Reply" });
await client.inboxes.messages.forward(inboxId, messageId, { to: ["other@example.com"] });
```

**Email Parsing Logic:**

The skill includes sophisticated email parsing to handle real-world email formats:

1. **Multipart detection:** Checks for `boundary` parameter in Content-Type header
2. **Part extraction:** Splits on boundary to get individual MIME parts
3. **Content-Type selection:** Prefers `text/plain`, falls back to `text/html`
4. **Quoted-printable decoding:** 
   - Removes soft line breaks (`=\r\n`)
   - Decodes hex escapes (`=XX` → byte value)
   - Handles UTF-8 multi-byte sequences correctly
5. **HTML conversion:** Strips tags, replaces `<br>` and `<p>` with newlines
6. **Entity decoding:** Converts `&quot;`, `&#39;`, `&amp;`, etc. to actual characters
7. **Emoji support:** Full UTF-8 decoding including 4-byte emoji characters

This ensures that received emails are readable regardless of how they were encoded by the sender.
