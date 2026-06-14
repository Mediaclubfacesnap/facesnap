/**
 * FaceSnap Email Validation Utilities
 * - Restricts to allowed providers only (Gmail, Outlook, Hotmail)
 * - Blocks disposable/temporary email domains
 */

export const ALLOWED_EMAIL_DOMAINS = ["gmail.com", "outlook.com", "hotmail.com"];

export const DISPOSABLE_DOMAINS = new Set([
  "tempmail.com", "10minutemail.com", "guerrillamail.com", "mailinator.com",
  "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
  "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net", "guerrillamail.org",
  "spam4.me", "trashmail.com", "trashmail.me", "trashmail.net", "trashmail.at",
  "trashmail.io", "trashmail.xyz", "yopmail.com", "yopmail.fr", "cool.fr.nf",
  "jetable.fr.nf", "nospam.ze.tc", "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr",
  "courriel.fr.nf", "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
  "filzmail.com", "throwam.com", "fakeinbox.com", "dispostable.com",
  "mailnull.com", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "discard.email", "spamhereplease.com", "throwaway.email", "maildrop.cc",
  "getnada.com", "inboxbear.com", "spamboy.com", "spamex.com",
  "mailnesia.com", "mailnull.com", "mailscrap.com", "mailtemp.info",
  "mailzilla.com", "mintemail.com", "mt2009.com", "mt2014.com",
  "nwldx.com", "objectmail.com", "obobbo.com", "odaymail.com",
  "oneoffemail.com", "ordinaryamerican.net", "ovpn.to", "pookmail.com",
  "proxymail.eu", "rcpt.at", "rppkn.com", "rtrtr.com",
  "s0ny.net", "safe-mail.net", "safetymail.info", "safetypost.de",
  "sandelf.de", "schafmail.de", "selfdestructingmail.com",
  "shitaway.ga", "shitaway.tk", "shitaway.xyz",
  "skeefmail.com", "slapsfromlastnight.com", "soodonims.com",
  "spamevader.com", "spamfree24.org", "spamgaps.net", "spamhere.eu",
  "speed.1s.fr", "spoofmail.de", "spammotel.com",
  "squizzy.de", "squizzy.eu", "squizzy.net",
  "startkeys.com", "stexsy.com", "stinkefuss.de",
  "streetwisemail.com", "supergreatmail.com", "supermailer.jp",
  "superstachel.de", "suremail.info", "svk.jp",
  "sweetxxx.de", "tafmail.com", "tagyourself.com",
  "teewars.org", "teleworm.com", "teleworm.us",
  "tempalias.com", "tempe-mail.com", "tempinbox.co.uk",
  "tempinbox.com", "tempomail.fr", "temporaryemail.net",
  "temporaryemail.us", "temporaryforwarding.com", "temporaryinbox.com",
  "tempsky.com", "tempthe.net", "tempymail.com", "thankyou2010.com",
  "thecloudindex.com", "thelimestones.com", "thisisnotmyrealemail.com",
  "throwam.com", "throwam.org",
]);

/**
 * Validates an email address against FaceSnap's allowed domains.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase();

  // Basic format check
  if (!trimmed.includes("@") || trimmed.split("@").length !== 2) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  const [local, domain] = trimmed.split("@");

  if (!local || !domain || !domain.includes(".")) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  // Check regex format
  const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hotmail\.com)$/;
  if (!emailRegex.test(trimmed)) {
    // Check if domain is disposable first for a better message
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return { valid: false, error: "Disposable email addresses are not allowed." };
    }
    // If domain is not in allowed list
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return {
        valid: false,
        error: "Only Gmail (@gmail.com) and Outlook (@outlook.com, @hotmail.com) addresses are allowed.",
      };
    }
    return { valid: false, error: "Please enter a valid email address." };
  }

  return { valid: true };
}

/**
 * Returns real-time validation feedback as the user types.
 * Designed for inline display below the email input field.
 */
export function getEmailFeedback(email: string): {
  status: "idle" | "invalid" | "valid";
  message: string;
} {
  if (!email) return { status: "idle", message: "" };

  const result = validateEmail(email);
  if (!result.valid) {
    return { status: "invalid", message: result.error || "Invalid email." };
  }
  return { status: "valid", message: "✓ Valid email address" };
}
