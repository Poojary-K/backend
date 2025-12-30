import nodemailer, { type Transporter } from 'nodemailer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config/env.js';

interface EmailTemplate {
  readonly subject: string;
  readonly content: string;
}

interface EmailTemplates {
  readonly contribution: {
    readonly created: EmailTemplate;
    readonly updated: EmailTemplate;
    readonly deleted: EmailTemplate;
  };
  readonly cause: {
    readonly created: EmailTemplate;
    readonly updated: EmailTemplate;
    readonly deleted: EmailTemplate;
  };
}

export type EmailTemplateKey =
  | 'contribution.created'
  | 'contribution.updated'
  | 'contribution.deleted'
  | 'cause.created'
  | 'cause.updated'
  | 'cause.deleted';

let templatesCache: EmailTemplates | null = null;
let transporterCache: Transporter | null = null;
let layoutCache: string | null = null;

const templatePaths = [
  path.resolve(process.cwd(), 'src/config/emailTemplates.json'),
  path.resolve(process.cwd(), 'dist/config/emailTemplates.json'),
];
const layoutPaths = [
  path.resolve(process.cwd(), 'src/config/emailLayout.html'),
  path.resolve(process.cwd(), 'dist/config/emailLayout.html'),
];

const loadTemplates = async (): Promise<EmailTemplates> => {
  if (templatesCache) {
    return templatesCache;
  }

  let lastError: unknown;
  for (const templatePath of templatePaths) {
    try {
      const file = await readFile(templatePath, 'utf8');
      templatesCache = JSON.parse(file) as EmailTemplates;
      return templatesCache;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Email templates could not be loaded.', { cause: lastError });
};

const loadLayout = async (): Promise<string> => {
  if (layoutCache) {
    return layoutCache;
  }

  let lastError: unknown;
  for (const layoutPath of layoutPaths) {
    try {
      layoutCache = await readFile(layoutPath, 'utf8');
      return layoutCache;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('Email layout could not be loaded.', { cause: lastError });
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderTemplate = (template: string, data: Record<string, string>): string =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => escapeHtml(data[key] ?? ''));

const applyLayout = (layout: string, content: string): string =>
  layout.replace(/{{\s*content\s*}}/g, () => content);

const getTransporter = (): Transporter => {
  if (transporterCache) {
    return transporterCache;
  }

  const { mailUser, mailPass } = getConfig();
  transporterCache = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: mailUser,
      pass: mailPass,
    },
  });

  return transporterCache;
};

const getTemplate = async (key: EmailTemplateKey): Promise<EmailTemplate> => {
  const templates = await loadTemplates();
  const [group, action] = key.split('.') as ['contribution' | 'cause', 'created' | 'updated' | 'deleted'];
  return templates[group][action];
};

const normalizeRecipients = (recipients: string | string[]): string[] => {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return Array.from(new Set(list.map((recipient) => recipient.trim()).filter(Boolean)));
};

export const sendTemplatedEmail = async (
  templateKey: EmailTemplateKey,
  recipients: string | string[],
  data: Record<string, string>,
): Promise<void> => {
  const { mailEnabled, mailFrom, mailUser, mailPass } = getConfig();
  const resolvedRecipients = normalizeRecipients(recipients);

  if (!mailEnabled) {
    console.log(`Email skipped (disabled): ${templateKey}`);
    return;
  }
  if (!mailUser || !mailPass || (!mailFrom && !mailUser)) {
    console.warn('Mail configuration is missing. Skipping email send.');
    return;
  }
  if (resolvedRecipients.length === 0) {
    console.log(`Email skipped (no recipients): ${templateKey}`);
    return;
  }

  const template = await getTemplate(templateKey);
  const subject = renderTemplate(template.subject, data);
  const content = renderTemplate(template.content, data);
  const layout = await loadLayout();
  const html = applyLayout(layout, content);
  const transporter = getTransporter();
  const from = mailFrom || mailUser;

  for (const recipient of resolvedRecipients) {
    console.log(`Sending email (${templateKey}) to ${recipient}`);
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      html,
    });
    console.log(`Email sent (${templateKey}) to ${recipient}: ${info.messageId}`);
  }
};
