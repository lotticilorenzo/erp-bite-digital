type PdfBufferLike = Uint8Array & {
  toString: (encoding?: string) => string;
};

type PdfBufferShim = {
  alloc: (size: number) => PdfBufferLike;
  allocUnsafe: (size: number) => PdfBufferLike;
  byteLength: (value: string | ArrayBuffer | ArrayBufferView, encoding?: string) => number;
  concat: (items: Array<ArrayBuffer | ArrayBufferView | PdfBufferLike>, totalLength?: number) => PdfBufferLike;
  from: (
    value: string | ArrayBuffer | ArrayBufferView | ArrayLike<number>,
    encoding?: string
  ) => PdfBufferLike;
  isBuffer: (value: unknown) => value is PdfBufferLike;
};

function toPdfBuffer(value: Uint8Array): PdfBufferLike {
  const buffer = value as PdfBufferLike;
  buffer.toString = (encoding = "utf8") => {
    if (encoding === "base64" && typeof btoa === "function") {
      let binary = "";
      value.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    }

    if (typeof TextDecoder !== "undefined") {
      return new TextDecoder().decode(value);
    }

    return Array.from(value)
      .map((byte) => String.fromCharCode(byte))
      .join("");
  };

  return buffer;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof atob !== "function") {
    return new Uint8Array();
  }

  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function createPdfBufferShim(): PdfBufferShim {
  return {
    alloc(size) {
      return toPdfBuffer(new Uint8Array(Math.max(0, size)));
    },
    allocUnsafe(size) {
      return toPdfBuffer(new Uint8Array(Math.max(0, size)));
    },
    byteLength(value, encoding = "utf8") {
      if (typeof value === "string") {
        if (encoding === "base64") {
          return decodeBase64(value).length;
        }

        if (typeof TextEncoder !== "undefined") {
          return new TextEncoder().encode(value).length;
        }

        return value.length;
      }

      if (value instanceof ArrayBuffer) {
        return value.byteLength;
      }

      return value.byteLength;
    },
    concat(items, totalLength) {
      const buffers = items.map((item) => {
        if (item instanceof Uint8Array) {
          return item;
        }

        if (ArrayBuffer.isView(item)) {
          return new Uint8Array(item.buffer, item.byteOffset, item.byteLength);
        }

        if (item instanceof ArrayBuffer) {
          return new Uint8Array(item);
        }

        return new Uint8Array();
      });

      const length =
        totalLength ??
        buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
      const combined = new Uint8Array(length);
      let offset = 0;

      buffers.forEach((buffer) => {
        combined.set(buffer, offset);
        offset += buffer.byteLength;
      });

      return toPdfBuffer(combined);
    },
    from(value, encoding = "utf8") {
      if (typeof value === "string") {
        if (encoding === "base64") {
          return toPdfBuffer(decodeBase64(value));
        }

        if (typeof TextEncoder !== "undefined") {
          return toPdfBuffer(new TextEncoder().encode(value));
        }

        return toPdfBuffer(Uint8Array.from(value.split("").map((char) => char.charCodeAt(0))));
      }

      if (value instanceof ArrayBuffer) {
        return toPdfBuffer(new Uint8Array(value));
      }

      if (ArrayBuffer.isView(value)) {
        return toPdfBuffer(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
      }

      return toPdfBuffer(Uint8Array.from(value));
    },
    isBuffer(value): value is PdfBufferLike {
      return value instanceof Uint8Array;
    },
  };
}

const pdfBufferGlobal = globalThis as typeof globalThis & { Buffer?: PdfBufferShim };

if (typeof pdfBufferGlobal.Buffer === "undefined") {
  pdfBufferGlobal.Buffer = createPdfBufferShim();
}

export function ensurePdfArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function safePdfNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safePdfText(value: unknown, fallback = "—"): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function resolvePdfAssetSrc(path?: string | null): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("data:")) {
    return path;
  }

  if (typeof window === "undefined") {
    return path;
  }

  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return null;
  }
}
