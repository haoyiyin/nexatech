const MAX_EMAIL_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_BODY_LENGTH = 50000;

export interface EmailData {
  messageId: string | null;
  subject: string | null;
  textBody: string | null;
  htmlBody: string | null;
  headers: Record<string, string> | null;
  sizeBytes: number | null;
}

interface ParsedSection {
  headers: Record<string, string>;
  body: string;
}

export function parseEmail(raw: string): EmailData {
  const normalizedRaw = normalizeLineEndings(raw);
  const { headers, body } = parseHeadersAndBody(normalizedRaw);

  const messageId = headers["message-id"] || null;
  const subject = decodeHeader(headers["subject"] || "");
  const contentType = headers["content-type"] || "";
  const transferEncoding = headers["content-transfer-encoding"] || "";

  let textBody: string | null = null;
  let htmlBody: string | null = null;

  if (contentType.toLowerCase().includes("multipart")) {
    const boundary = extractBoundary(contentType);

    if (boundary) {
      const parts = body.split(`--${boundary}`);

      for (const part of parts) {
        const trimmedPart = part.trim();

        if (!trimmedPart || trimmedPart === "--") {
          continue;
        }

        const { headers: partHeaders, body: partBody } = parseHeadersAndBody(trimmedPart);
        const partContentType = partHeaders["content-type"] || "";
        const decodedPartBody = decodeBody(
          partBody,
          partHeaders["content-transfer-encoding"] || "",
          extractCharset(partContentType)
        );

        if (partContentType.toLowerCase().includes("text/plain")) {
          textBody = decodedPartBody;
        } else if (partContentType.toLowerCase().includes("text/html")) {
          htmlBody = decodedPartBody;
        }
      }
    }
  } else if (contentType.toLowerCase().includes("text/html")) {
    htmlBody = decodeBody(body, transferEncoding, extractCharset(contentType));
  } else {
    textBody = decodeBody(body, transferEncoding, extractCharset(contentType));
  }

  if (!textBody && !htmlBody) {
    textBody = body.trim().slice(0, MAX_BODY_LENGTH);
  }

  const sizeBytes = new TextEncoder().encode(raw).length;
  if (sizeBytes > MAX_EMAIL_SIZE_BYTES) {
    throw new Error("Email exceeds size limit");
  }

  return {
    messageId,
    subject,
    textBody: textBody ? textBody.trim().slice(0, MAX_BODY_LENGTH) : null,
    htmlBody: htmlBody ? htmlBody.trim().slice(0, MAX_BODY_LENGTH) : null,
    headers,
    sizeBytes,
  };
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function parseHeadersAndBody(value: string): ParsedSection {
  const lines = value.split("\n");
  const headers: Record<string, string> = {};
  let currentHeader: string | null = null;
  let bodyStart = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "") {
      bodyStart = i + 1;
      break;
    }

    if ((line.startsWith(" ") || line.startsWith("\t")) && currentHeader) {
      headers[currentHeader] = `${headers[currentHeader]} ${line.trim()}`;
      continue;
    }

    const match = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      currentHeader = null;
      continue;
    }

    const key = match[1].toLowerCase();
    const valuePart = match[2].trim();
    headers[key] = headers[key] ? `${headers[key]} ${valuePart}` : valuePart;
    currentHeader = key;
  }

  return {
    headers,
    body: lines.slice(bodyStart).join("\n"),
  };
}

function extractBoundary(contentType: string): string | null {
  const match = contentType.match(/boundary="?([^";]+)"?/i);
  return match ? match[1] : null;
}

function extractCharset(contentType: string): string {
  const match = contentType.match(/charset="?([^";]+)"?/i);
  return match ? match[1] : "utf-8";
}

function decodeBody(body: string, transferEncoding: string, charset: string): string {
  const normalizedEncoding = transferEncoding.trim().toLowerCase();

  if (normalizedEncoding === "base64") {
    return decodeBase64(body, charset);
  }

  if (normalizedEncoding === "quoted-printable") {
    return decodeQuotedPrintable(body, charset);
  }

  return body;
}

function decodeBase64(text: string, charset: string): string {
  const normalized = text.replace(/\s+/g, "");

  if (!normalized) {
    return "";
  }

  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return decodeBytes(bytes, charset);
  } catch {
    return text;
  }
}

function decodeQuotedPrintable(text: string, charset: string, treatUnderscoreAsSpace = false): string {
  const normalized = text.replace(/=\n/g, "");
  const source = treatUnderscoreAsSpace ? normalized.replace(/_/g, " ") : normalized;
  const bytes: number[] = [];

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const hex = source.slice(i + 1, i + 3);

    if (char === "=" && /^[A-Fa-f0-9]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
      continue;
    }

    bytes.push(source.charCodeAt(i));
  }

  return decodeBytes(new Uint8Array(bytes), charset);
}

function decodeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toLowerCase() === "b") {
        return decodeBase64(text, charset);
      }

      return decodeQuotedPrintable(text, charset, true);
    } catch {
      return text;
    }
  });
}

function decodeBytes(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
