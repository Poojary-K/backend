import nodemailer, { type Transporter } from 'nodemailer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getConfig } from '../config/env.js';

interface EmailTemplate {
  readonly subject: string;
  readonly content: string;
}

interface EmailTemplates {
  readonly auth: {
    readonly verify: EmailTemplate;
    readonly reset: EmailTemplate;
  };
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
  | 'auth.verify'
  | 'auth.reset'
  | 'contribution.created'
  | 'contribution.updated'
  | 'contribution.deleted'
  | 'cause.created'
  | 'cause.updated'
  | 'cause.deleted';

let templatesCache: EmailTemplates | null = null;
let transporterCache: Transporter | null = null;
let layoutCache: string | null = null;
let mailConfigLogged = false;
let smtpDisabledAfterFailure = false;

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
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
    const value = data[key] ?? '';
    if (key.endsWith('Html')) {
      return value;
    }
    return escapeHtml(value);
  });

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

type EmailTemplateGroup = 'auth' | 'contribution' | 'cause';
type EmailTemplateAction = 'verify' | 'reset' | 'created' | 'updated' | 'deleted';

const getTemplate = async (key: EmailTemplateKey): Promise<EmailTemplate> => {
  const templates = await loadTemplates();
  const [group, action] = key.split('.') as [EmailTemplateGroup, EmailTemplateAction];
  if (group === 'auth') {
    if (action === 'verify') {
      return templates.auth.verify;
    }
    if (action === 'reset') {
      return templates.auth.reset;
    }
    throw new Error(`Unknown auth email template action: ${action}`);
  }
  return templates[group][action as 'created' | 'updated' | 'deleted'];
};

const normalizeRecipients = (recipients: string | string[]): string[] => {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return Array.from(new Set(list.map((recipient) => recipient.trim()).filter(Boolean)));
};

const logMailConfigOnce = (): void => {
  if (mailConfigLogged) {
    return;
  }
  mailConfigLogged = true;
  const { mailEnabled, mailProvider, mailFrom, mailUser, mailPass, resendApiKey } = getConfig();
  console.log('MAIL ENABLED:', mailEnabled);
  console.log('MAIL PROVIDER:', mailProvider);
  console.log('MAIL FROM:', mailFrom);
  console.log('MAIL USER:', mailUser ? 'set' : 'missing');
  console.log('MAIL PASS:', mailPass ? 'set' : 'missing');
  console.log('RESEND API KEY:', resendApiKey ? 'set' : 'missing');
};

const sendViaSmtp = async (
  templateKey: EmailTemplateKey,
  from: string,
  recipients: string[],
  subject: string,
  html: string,
): Promise<void> => {
  if (smtpDisabledAfterFailure) {
    throw new Error('SMTP disabled after previous failure');
  }
  const transporter = getTransporter();
  for (const recipient of recipients) {
    console.log(`Sending email via SMTP (${templateKey}) to ${recipient}`);
    const info = await transporter.sendMail({
      from,
      to: recipient,
      subject,
      html,
    });
    console.log(`Email sent via SMTP (${templateKey}) to ${recipient}: ${info.messageId}`);
  }
};

const sendViaResend = async (
  templateKey: EmailTemplateKey,
  from: string,
  recipients: string[],
  subject: string,
  html: string,
  resendApiKey: string,
): Promise<void> => {
  console.log(`Sending email via Resend (${templateKey}) to ${recipients.join(', ')}`);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend failed (${response.status}): ${errorBody}`);
  }

  const result = (await response.json().catch(() => null)) as { id?: string } | null;
  console.log(`Email sent via Resend (${templateKey}) id: ${result?.id ?? 'unknown'}`);
};

export const sendTemplatedEmail = async (
  templateKey: EmailTemplateKey,
  recipients: string | string[],
  data: Record<string, string>,
): Promise<void> => {
  const { mailEnabled, mailProvider, mailFrom, mailUser, mailPass, resendApiKey } = getConfig();
  logMailConfigOnce();
  const resolvedRecipients = normalizeRecipients(recipients);

  if (!mailEnabled) {
    console.log(`Email skipped (disabled): ${templateKey}`);
    return;
  }
  const smtpConfigured = Boolean(mailUser && mailPass);
  const resendConfigured = Boolean(resendApiKey && mailFrom);
  if (!smtpConfigured && !resendConfigured) {
    console.warn('Email configuration is missing. Skipping email send.');
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

  const smtpFrom = mailFrom || mailUser || '';
  if (mailProvider === 'smtp') {
    if (!smtpConfigured) {
      console.warn('SMTP configuration is missing. Skipping email send.');
      return;
    }
    try {
      await sendViaSmtp(templateKey, smtpFrom, resolvedRecipients, subject, html);
    } catch (error) {
      console.error(`SMTP failed (${templateKey}).`, error);
    }
    return;
  }

  if (mailProvider === 'resend') {
    if (!resendConfigured) {
      console.warn('Resend configuration is missing. Skipping email send.');
      return;
    }
    try {
      await sendViaResend(templateKey, mailFrom, resolvedRecipients, subject, html, resendApiKey);
    } catch (error) {
      console.error(`Resend failed (${templateKey}).`, error);
    }
    return;
  }

  if (smtpConfigured && !smtpDisabledAfterFailure) {
    try {
      await sendViaSmtp(templateKey, smtpFrom, resolvedRecipients, subject, html);
      return;
    } catch (error) {
      console.error(`SMTP failed (${templateKey}).`, error);
      smtpDisabledAfterFailure = true;
    }
  }

  if (!resendConfigured) {
    console.warn('Resend configuration is missing. Skipping email send.');
    return;
  }

  try {
    await sendViaResend(templateKey, mailFrom, resolvedRecipients, subject, html, resendApiKey);
  } catch (error) {
    console.error(`Resend failed (${templateKey}).`, error);
  }
};
