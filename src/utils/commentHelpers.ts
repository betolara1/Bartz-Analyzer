export function cleanCommentHtml(text?: string): string {
  if (!text) return "";
  let cleaned = text.replace(
    /<div[^>]*style=['"][^'"]*border-top:[^'"]*['"][^>]*>[\s\S]*?\[Alterado para[\s\S]*?<\/div>/gi,
    ""
  );
  cleaned = cleaned.replace(/\[Alterado para[^\]]*\]/gi, "");
  return cleaned.trim();
}

export function extractCommentAttachments(comment: any): string[] {
  if (!comment) return [];
  const files: string[] = [];
  if (Array.isArray(comment.anexos)) {
    comment.anexos.forEach((f: any) => {
      if (f && typeof f === "string") {
        const trimmed = f.trim();
        if (trimmed && !files.includes(trimmed)) {
          files.push(trimmed);
        }
      }
    });
  }
  if (comment.txt_arquivo && typeof comment.txt_arquivo === "string") {
    const trimmed = comment.txt_arquivo.trim();
    if (trimmed && !files.includes(trimmed)) {
      files.push(trimmed);
    }
  }
  return files;
}

export function normalizeAndGroupComments<T extends Record<string, any>>(
  comments: T[] | undefined | null,
  options?: {
    filterBySituacao?: boolean;
    excludeDesconsiderado?: boolean;
    preserveWithoutId?: boolean;
  }
): T[] {
  if (!Array.isArray(comments) || comments.length === 0) return [];

  const map = new Map<number | string, T>();
  const withoutId: T[] = [];

  for (const c of comments) {
    if (!c) continue;

    if (options?.filterBySituacao) {
      const sit = c.int_situacao !== null && c.int_situacao !== undefined ? Number(c.int_situacao) : 0;
      if (sit !== 0 && sit !== 1) continue;
    }

    if (options?.excludeDesconsiderado) {
      const title = String(c.txt_titulo || "").toLowerCase();
      const text = String(c.txt_comentario || "").toLowerCase();
      if (title.includes("desconsiderad") || text.includes("desconsiderad")) {
        continue;
      }
    }

    const id = c.pk_pedido_comentario;
    const incomingFiles = extractCommentAttachments(c);

    if (!id) {
      if (options?.preserveWithoutId) {
        withoutId.push({
          ...c,
          anexos: incomingFiles,
        });
      }
      continue;
    }

    if (!map.has(id)) {
      map.set(id, {
        ...c,
        anexos: incomingFiles,
      });
    } else {
      const existing = map.get(id)!;
      const current = Array.isArray(existing.anexos) ? [...existing.anexos] : [];
      for (const f of incomingFiles) {
        if (!current.includes(f)) {
          current.push(f);
        }
      }
      (existing as any).anexos = current;
    }
  }

  return [...Array.from(map.values()), ...withoutId];
}

