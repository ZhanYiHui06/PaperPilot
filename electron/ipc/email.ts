import { ipcMain } from 'electron';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { IPC_CHANNELS } from '../../shared/types';
import type { EmailConfig, Email, EmailTestResult, EmailType } from '../../shared/types';
import { getEmailConfig, getEmailById, findEmailByNaturalKey, findEmailByMessageId, insertEmail, updateEmail } from '../../database/db';
import { classifyEmailViaLLM } from './llm';

// Keywords that indicate a submission-related email
const SUBMISSION_KEYWORDS = [
  'review',
  'decision',
  'accept',
  'reject',
  'revision',
  'revise',
  'camera-ready',
  'camera ready',
  'rebuttal',
  'submission',
  'paper',
  'manuscript',
];

function isSubmissionRelated(subject: string, text: string): boolean {
  const content = `${subject} ${text}`.toLowerCase();
  return SUBMISSION_KEYWORDS.some((kw) => content.includes(kw));
}

/**
 * Clean email body text by stripping quoted replies, disclaimers, and noise.
 * This extracts only the "new" content of the email, not the conversation history.
 */
function cleanEmailBody(body: string): string {
  let lines = body.split(/\r?\n/);
  const cleaned: string[] = [];
  let inQuoteBlock = false;
  let pastSignature = false;

  for (const line of lines) {
    // Detect quoted reply lines (On <date>, <someone> wrote:)
    if (/^On .*(wrote|said):/i.test(line.trim()) || /^Am .*(schrieb|wrote):/i.test(line.trim())) {
      inQuoteBlock = true;
      continue;
    }
    // Detect lines starting with > (quoted text)
    if (/^\s*>/.test(line)) {
      inQuoteBlock = true;
      continue;
    }
    // Detect "--- Original Message ---" separator
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) {
      inQuoteBlock = true;
      continue;
    }
    // Detect "--- Forwarded Message ---" separator
    if (/^-{2,}\s*Forwarded Message\s*-{2,}/i.test(line.trim())) {
      inQuoteBlock = true;
      continue;
    }
    // End quote block on empty line after quoted content
    if (inQuoteBlock && line.trim() === '') {
      inQuoteBlock = false;
      continue;
    }
    if (inQuoteBlock) continue;

    // Detect email signature delimiter
    if (/^--\s*$/.test(line.trim()) || /^_{5,}$/.test(line.trim())) {
      pastSignature = true;
      break;
    }

    // Skip common disclaimer/privacy notice patterns
    if (pastSignature) break;
    if (/^(Disclaimer|Confidentiality|Privacy|NOTICE|重要提示|免责声明|保密声明)/i.test(line.trim())) {
      pastSignature = true;
      break;
    }

    cleaned.push(line);
  }

  // Trim trailing empty lines and collapse multiple blank lines
  let result = cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

export function registerEmailIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.EMAIL_CONNECT,
    async (_e, config: EmailConfig): Promise<boolean> => {
      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.ssl === 1,
        auth: { user: config.username, pass: config.password },
        logger: false,
      });
      try {
        await client.connect();
        await client.mailboxOpen('INBOX');
        return true;
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.EMAIL_TEST_CONNECTION,
    async (_e, config: EmailConfig): Promise<EmailTestResult> => {
      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.ssl === 1,
        auth: { user: config.username, pass: config.password },
        logger: false,
      });
      try {
        await client.connect();
        return { success: true, message: 'IMAP 连接成功' };
      } catch (err) {
        const error = err as Error;
        return { success: false, message: error.message };
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.EMAIL_FETCH,
    async (event, projectId: string): Promise<Email[]> => {
      const config = getEmailConfig();
      if (!config) {
        throw new Error('IMAP not configured');
      }

      const syncDays = config.sync_days ?? 30;
      // IMAP SINCE is day-granular; normalize to local midnight for stability.
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      since.setDate(since.getDate() - syncDays);

      // Safety cap: within the sync window, only consider the newest N candidates.
      const MAX_CANDIDATES = 200;

      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.ssl === 1,
        auth: { user: config.username, pass: config.password },
        logger: false,
      });
      try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');
        try {
          const persisted: Email[] = [];

          // 1) Search only messages within the configured window (newest-oriented).
          //    Returns UIDs; empty / false when nothing matches.
          const searchResult = await client.search({ since }, { uid: true });
          const uids = Array.isArray(searchResult) ? searchResult : [];
          if (uids.length === 0) {
            return persisted;
          }

          // Newest first (higher UID is typically newer in INBOX).
          const candidateUids = [...uids].sort((a, b) => b - a).slice(0, MAX_CANDIDATES);

          // 2) Lightweight pass: envelope only — skip full body download for
          //    messages already stored locally (true incremental sync).
          type Candidate = {
            uid: number;
            subject: string;
            sender: string;
            receivedAt: string;
            messageId: string | null;
          };
          const needBody: Candidate[] = [];

          for await (const msg of client.fetch(
            candidateUids,
            { envelope: true, uid: true, internalDate: true },
            { uid: true },
          )) {
            const env = msg.envelope;
            const subject = env?.subject ?? '(no subject)';
            const sender = env?.from?.[0]?.address ?? 'unknown';
            const internalDate = msg.internalDate;
            const receivedAt = internalDate
              ? internalDate instanceof Date
                ? internalDate.toISOString()
                : new Date(internalDate).toISOString()
              : new Date().toISOString();
            const messageId = env?.messageId ?? null;

            // Already in DB by Message-ID → no download, no LLM.
            if (messageId) {
              const existing = findEmailByMessageId(projectId, messageId);
              if (existing) {
                persisted.push(existing);
                continue;
              }
            }

            // Fallback natural-key check from envelope fields alone.
            const existingByKey = findEmailByNaturalKey(
              projectId,
              subject,
              sender,
              receivedAt,
            );
            if (existingByKey) {
              if (messageId && !existingByKey.message_id) {
                updateEmail(existingByKey.id, { message_id: messageId });
                existingByKey.message_id = messageId;
              }
              persisted.push(existingByKey);
              continue;
            }

            needBody.push({
              uid: msg.uid,
              subject,
              sender,
              receivedAt,
              messageId,
            });
          }

          // 3) Full download + parse + LLM only for unknown messages.
          for (const cand of needBody) {
            const msg = await client.fetchOne(
              cand.uid,
              { source: true, envelope: true, internalDate: true },
              { uid: true },
            );
            if (!msg) continue;

            const env = msg.envelope;
            const subject = env?.subject ?? cand.subject;
            const sender = env?.from?.[0]?.address ?? cand.sender;
            const internalDate = msg.internalDate;
            const receivedAt = internalDate
              ? internalDate instanceof Date
                ? internalDate.toISOString()
                : new Date(internalDate).toISOString()
              : cand.receivedAt;

            const rawSource = msg.source ?? Buffer.alloc(0);
            const parsed = await simpleParser(rawSource);

            let bodyText = parsed.text ?? '';
            if (!bodyText && parsed.html) {
              bodyText = (parsed.html as string)
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }
            if (!bodyText) bodyText = '';
            bodyText = cleanEmailBody(bodyText);

            const messageId = parsed.messageId ?? env?.messageId ?? cand.messageId;

            // Keyword gate before LLM / insert.
            if (!isSubmissionRelated(subject, bodyText)) continue;

            // Race-safe re-check after full parse (Message-ID may only appear here).
            if (messageId) {
              const existing = findEmailByMessageId(projectId, messageId);
              if (existing) {
                persisted.push(existing);
                continue;
              }
            }
            const existingByKey = findEmailByNaturalKey(
              projectId,
              subject,
              sender,
              receivedAt,
            );
            if (existingByKey) {
              if (messageId && !existingByKey.message_id) {
                updateEmail(existingByKey.id, { message_id: messageId });
              }
              persisted.push(existingByKey);
              continue;
            }

            const email: Email = {
              id: crypto.randomUUID(),
              project_id: projectId,
              subject,
              sender,
              received_at: receivedAt,
              email_type: null,
              ai_summary: null,
              is_read: 0,
              is_important: 0,
              raw_content: bodyText.slice(0, 10000),
              message_id: messageId,
            };

            try {
              const result = await classifyEmailViaLLM(bodyText.slice(0, 2000));
              email.email_type = result.type;
              email.ai_summary = result.summary;
              if (result.type === 'decision' || result.type === 'revision') {
                email.is_important = 1;
              }
            } catch {
              // LLM classification is best-effort
            }

            const saved = insertEmail(email);
            persisted.push(saved);
            event.sender.send('email:fetched', saved);
          }

          return persisted;
        } finally {
          lock.release();
        }
      } finally {
        await client.logout().catch(() => {});
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.EMAIL_CLASSIFY,
    async (_e, emailId: string): Promise<EmailType> => {
      // Re-classify an existing email by its raw content
      const email = getEmailById(emailId);
      if (!email || !email.raw_content) {
        throw new Error('Email not found or no content');
      }
      const result = await classifyEmailViaLLM(email.raw_content.slice(0, 2000));
      updateEmail(emailId, {
        email_type: result.type,
        ai_summary: result.summary,
        is_important: result.type === 'decision' || result.type === 'revision' ? 1 : 0,
      });
      return result.type;
    },
  );
}
