/**
 * AgentMail Helper - Core functionality for the AgentMail skill
 * 
 * This script provides programmatic access to AgentMail operations
 * for use within OpenClaw skill workflows.
 * 
 * IMPORTANT FIXES APPLIED:
 * - Use 'text' parameter (not 'body') when sending emails
 * - Proper multipart MIME email parsing
 * - Correct quoted-printable decoding with UTF-8 support
 * - Handles both single-part and multipart emails
 */

import { AgentMailClient } from "agentmail";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const CONFIG_DIR = join(process.env.HOME || "/root", ".openclaw-agentmail");
const INBOXES_FILE = join(CONFIG_DIR, "inboxes.json");

export class AgentMailHelper {
  constructor(apiKey) {
    this.apiKey = apiKey || this.#loadApiKey();
    if (!this.apiKey) {
      throw new Error(
        "AGENTMAIL_API_KEY not found. Set it in your environment or .env.agentmail file.\n" +
        "Get your API key at: https://agentmail.to"
      );
    }
    this.client = new AgentMailClient({ apiKey: this.apiKey });
    this.#ensureConfigDir();
  }

  #loadApiKey() {
    // Try environment variable first
    if (process.env.AGENTMAIL_API_KEY) {
      return process.env.AGENTMAIL_API_KEY;
    }
    
    // Try to load from .env.agentmail in workspace
    try {
      const envPath = join(process.cwd(), ".env.agentmail");
      if (existsSync(envPath)) {
        const envContent = readFileSync(envPath, "utf-8");
        const match = envContent.match(/AGENTMAIL_API_KEY=(.+)/);
        if (match) return match[1].trim();
      }
    } catch {}
    
    // Try to load from ~/.openclaw-agentmail/config
    try {
      const configPath = join(CONFIG_DIR, "config");
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        return config.apiKey;
      }
    } catch {}
    
    return null;
  }

  #ensureConfigDir() {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
  }

  #saveInboxToCache(inbox) {
    try {
      let inboxes = [];
      if (existsSync(INBOXES_FILE)) {
        inboxes = JSON.parse(readFileSync(INBOXES_FILE, "utf-8"));
      }
      // Check if already exists
      const exists = inboxes.some(inv => inv.id === inbox.id || inv.email === inbox.email);
      if (!exists) {
        inboxes.push({
          id: inbox.id,
          email: inbox.email,
          identifier: inbox.identifier,
          createdAt: inbox.createdAt,
          cachedAt: new Date().toISOString()
        });
        writeFileSync(INBOXES_FILE, JSON.stringify(inboxes, null, 2));
      }
    } catch (e) {
      // Non-critical error, don't throw
    }
  }

  #removeInboxFromCache(inboxId) {
    try {
      if (!existsSync(INBOXES_FILE)) return;
      let inboxes = JSON.parse(readFileSync(INBOXES_FILE, "utf-8"));
      inboxes = inboxes.filter(inv => inv.id !== inboxId && inv.email !== inboxId);
      writeFileSync(INBOXES_FILE, JSON.stringify(inboxes, null, 2));
    } catch (e) {
      // Non-critical error, don't throw
    }
  }

  /**
   * Create a new email inbox
   * @param {string} identifier - Unique identifier for the inbox
   * @returns {Promise<Object>} Inbox object with id, email, displayName, createdAt
   */
  async createInbox(identifier) {
    const inbox = await this.client.inboxes.create({ identifier });
    const result = {
      id: inbox.inboxId,
      email: inbox.email,
      displayName: inbox.displayName,
      createdAt: inbox.createdAt
    };
    this.#saveInboxToCache(result);
    return result;
  }

  /**
   * List all inboxes
   * @returns {Promise<Array>} Array of inbox objects
   */
  async listInboxes() {
    const response = await this.client.inboxes.list();
    return (response.inboxes || []).map(inv => ({
      id: inv.inboxId,
      email: inv.email,
      displayName: inv.displayName,
      createdAt: inv.createdAt
    }));
  }

  /**
   * Delete an inbox
   * @param {string} inboxId - The inbox ID to delete
   */
  async deleteInbox(inboxId) {
    await this.client.inboxes.delete(inboxId);
    this.#removeInboxFromCache(inboxId);
  }

  /**
   * Send an email
   * 
   * IMPORTANT: Use 'text' parameter, NOT 'body' parameter
   * The AgentMail API requires 'text' for the email content
   * 
   * @param {string} fromInboxId - Sender's inbox ID
   * @param {Object} options - Email options
   * @param {string[]} options.to - Array of recipient emails
   * @param {string} options.subject - Email subject
   * @param {string} options.text - Email body (plain text) - USE THIS, NOT 'body'
   * @returns {Promise<Object>} Sent message info with messageId
   */
  async sendEmail(fromInboxId, { to, subject, text }) {
    if (!text || text.trim() === '') {
      throw new Error('Email body (text) cannot be empty');
    }
    
    const response = await this.client.inboxes.messages.send(fromInboxId, {
      to,
      subject,
      text  // CRITICAL: Use 'text', not 'body'
    });
    return {
      messageId: response.messageId,
      success: true
    };
  }

  /**
   * Get emails in an inbox
   * @param {string} inboxId - Inbox ID to check
   * @param {Object} options - Options
   * @param {boolean} options.includeBody - Whether to fetch full body (slower)
   * @returns {Promise<Array>} Array of email objects
   */
  async getEmails(inboxId, { includeBody = false } = {}) {
    const response = await this.client.inboxes.messages.list(inboxId);
    const messages = response.messages || [];

    if (!includeBody) {
      return messages.map(msg => ({
        id: msg.messageId,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        createdAt: msg.createdAt,
        threadId: msg.threadId
      }));
    }

    return Promise.all(
      messages.map(async (msg) => {
        const body = await this.getEmailBody(inboxId, msg.messageId);
        return {
          id: msg.messageId,
          from: msg.from,
          to: msg.to,
          subject: msg.subject,
          createdAt: msg.createdAt,
          threadId: msg.threadId,
          body
        };
      })
    );
  }

  /**
   * Get full email body with proper parsing
   * 
   * Handles:
   * - Multipart MIME emails (text/plain and text/html)
   * - Quoted-printable encoding
   * - UTF-8 encoding with proper emoji support
   * - HTML to text conversion
   * 
   * @param {string} inboxId - Inbox ID
   * @param {string} messageId - Message ID
   * @returns {Promise<string>} Email body text (plain text)
   */
  async getEmailBody(inboxId, messageId) {
    const raw = await this.client.inboxes.messages.getRaw(inboxId, messageId);
    const response = await fetch(raw.downloadUrl);
    const emlContent = await response.text();
    return this.#parseEmlBody(emlContent);
  }

  /**
   * Parse body from .eml content
   * 
   * Handles multipart MIME emails and extracts the text/plain part.
   * Falls back to text/html if no plain text found.
   * 
   * @param {string} emlContent - Raw .eml file content
   * @returns {string} Plain text body
   */
  #parseEmlBody(emlContent) {
    // Check if multipart by looking for boundary
    const boundaryMatch = emlContent.match(/boundary="?([^"\s]+)"?/i);
    
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const parts = emlContent.split(`--${boundary}`);
      
      // First try to find text/plain part
      for (const part of parts) {
        if (part.includes('Content-Type: text/plain')) {
          const contentMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?:\r?\n--|$)/);
          if (contentMatch) {
            return this.#decodeBody(contentMatch[1].trim());
          }
        }
      }
      
      // Fallback to text/html if no plain text
      for (const part of parts) {
        if (part.includes('Content-Type: text/html')) {
          const contentMatch = part.match(/\r?\n\r?\n([\s\S]+?)(?:\r?\n--|$)/);
          if (contentMatch) {
            return this.#decodeBody(contentMatch[1].trim(), true);
          }
        }
      }
    }
    
    // Single part email - split headers from body
    const parts = emlContent.split(/\r?\n\r?\n/);
    if (parts.length < 2) return "";
    
    // Check content type in headers
    const headers = parts[0];
    const isHtml = headers.toLowerCase().includes('content-type: text/html');
    
    return this.#decodeBody(parts.slice(1).join('\n\n'), isHtml);
  }

  /**
   * Decode email body with proper encoding handling
   * 
   * Handles:
   * - Quoted-printable decoding with hex escapes (=XX)
   * - Soft line breaks (=\r\n or =\n)
   * - UTF-8 byte sequences for emoji and international characters
   * - HTML to text conversion
   * - HTML entity decoding
   * 
   * @param {string} body - Raw body content
   * @param {boolean} isHtml - Whether content is HTML
   * @returns {string} Decoded plain text
   */
  #decodeBody(body, isHtml = false) {
    // Remove soft line breaks (quoted-printable continuation)
    body = body.replace(/=\r?\n/g, '');
    
    // Decode quoted-printable hex escapes (=XX) to bytes
    const bytes = [];
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '=' && i + 2 < body.length) {
        const hex = body.slice(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(body.charCodeAt(i));
    }
    
    // Decode bytes as UTF-8 (properly handles emoji and international chars)
    try {
      body = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    } catch (e) {
      // Fallback to latin1 if UTF-8 fails
      body = bytes.map(b => String.fromCharCode(b)).join('');
    }
    
    // If HTML, convert to text
    if (isHtml || body.includes('<html') || body.includes('<body') || body.includes('<div')) {
      // Replace <br>, <p> with newlines
      body = body.replace(/<br\s*\/?>/gi, '\n');
      body = body.replace(/<\/p>/gi, '\n\n');
      // Remove all other HTML tags
      body = body.replace(/<[^>]+>/g, ' ');
      // Normalize whitespace
      body = body.replace(/\s+/g, ' ');
    }
    
    // Decode HTML entities
    body = body.replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'")
               .replace(/&#x27;/g, "'")
               .replace(/&amp;/g, '&')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&nbsp;/g, ' ')
               .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
    
    return body.trim();
  }

  /**
   * Wait for emails to arrive in an inbox
   * 
   * Polls the inbox until new emails arrive or timeout is reached.
   * 
   * @param {string} inboxId - Inbox ID to watch
   * @param {Object} options - Options
   * @param {number} options.timeout - Max wait time in ms (default: 60000)
   * @param {number} options.interval - Check interval in ms (default: 2000)
   * @param {number} options.minCount - Minimum emails to wait for (default: 1)
   * @returns {Promise<Array>} Array of emails
   */
  async waitForEmails(inboxId, { timeout = 60000, interval = 2000, minCount = 1 } = {}) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const emails = await this.getEmails(inboxId);
      if (emails.length >= minCount) {
        return emails;
      }
      await new Promise(r => setTimeout(r, interval));
    }
    
    // Return whatever we have on timeout
    return this.getEmails(inboxId);
  }

  /**
   * Reply to an email
   * @param {string} inboxId - Your inbox ID
   * @param {string} messageId - Message ID to reply to
   * @param {Object} options - Reply options
   * @param {string} options.text - Reply body
   * @returns {Promise<Object>} Sent reply info
   */
  async replyToEmail(inboxId, messageId, { text }) {
    if (!text || text.trim() === '') {
      throw new Error('Reply body cannot be empty');
    }
    
    const response = await this.client.inboxes.messages.reply(inboxId, messageId, {
      text
    });
    return {
      messageId: response.messageId,
      success: true
    };
  }

  /**
   * Forward an email
   * @param {string} inboxId - Your inbox ID
   * @param {string} messageId - Message ID to forward
   * @param {Object} options - Forward options
   * @param {string[]} options.to - Recipients to forward to
   * @param {string} options.text - Optional additional text
   * @returns {Promise<Object>} Sent forward info
   */
  async forwardEmail(inboxId, messageId, { to, text }) {
    const response = await this.client.inboxes.messages.forward(inboxId, messageId, {
      to,
      text: text || ''
    });
    return {
      messageId: response.messageId,
      success: true
    };
  }
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const command = process.argv[2];
  const args = process.argv.slice(3);
  
  const mail = new AgentMailHelper();
  
  switch (command) {
    case 'create':
      const identifier = args[0] || `cli-${Date.now()}`;
      mail.createInbox(identifier).then(inv => {
        console.log(JSON.stringify(inv, null, 2));
      }).catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      break;
      
    case 'list':
      mail.listInboxes().then(inboxes => {
        console.log(JSON.stringify(inboxes, null, 2));
      }).catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      break;
      
    case 'delete':
      if (!args[0]) {
        console.error(JSON.stringify({ error: 'Usage: delete [inbox-id]' }));
        process.exit(1);
      }
      mail.deleteInbox(args[0]).then(() => {
        console.log(JSON.stringify({ success: true }));
      }).catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      break;
      
    case 'send':
      if (args.length < 3) {
        console.error(JSON.stringify({ error: 'Usage: send [from] [to] [subject] [body]' }));
        process.exit(1);
      }
      mail.sendEmail(args[0], {
        to: [args[1]],
        subject: args[2],
        text: args[3] || ''
      }).then(result => {
        console.log(JSON.stringify(result, null, 2));
      }).catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      break;
      
    case 'receive':
      if (!args[0]) {
        console.error(JSON.stringify({ error: 'Usage: receive [inbox-id] [--full]' }));
        process.exit(1);
      }
      mail.getEmails(args[0], { includeBody: args.includes('--full') }).then(emails => {
        console.log(JSON.stringify(emails, null, 2));
      }).catch(err => {
        console.error(JSON.stringify({ error: err.message }));
        process.exit(1);
      });
      break;
      
    default:
      console.log(`
AgentMail Helper CLI

Usage:
  node agentmail-helper.mjs create [identifier]     Create a new inbox
  node agentmail-helper.mjs list                    List all inboxes
  node agentmail-helper.mjs delete [inbox-id]       Delete an inbox
  node agentmail-helper.mjs send [from] [to] [subject] [body]  Send email
  node agentmail-helper.mjs receive [inbox-id] [--full]        Receive emails

Important Notes:
  - Use 'text' parameter (not 'body') when sending emails
  - AGENTMAIL_API_KEY must be set in environment or .env.agentmail file
  - Emails are parsed automatically from multipart MIME format

Environment:
  AGENTMAIL_API_KEY    Your AgentMail API key from https://agentmail.to
`);
  }
}
