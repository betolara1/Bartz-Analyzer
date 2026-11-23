export function getItemId(item: any, index: number): number | string {
  if (!item) return index;
  if (item.nodeId !== undefined && item.nodeId !== null) return item.nodeId;
  if (item.id !== undefined && item.id !== null) return item.id;
  return index;
}

export function isParentItem(item: any): boolean {
  if (!item) return false;
  if (Array.isArray(item.childNodeIds) && item.childNodeIds.length > 0) return true;
  if (Array.isArray(item.descendantIds) && item.descendantIds.length > 0) return true;
  return false;
}

export function getChildrenCount(item: any): number {
  if (!item) return 0;
  if (Array.isArray(item.descendantIds) && item.descendantIds.length > 0) {
    return item.descendantIds.length;
  }
  if (Array.isArray(item.childNodeIds) && item.childNodeIds.length > 0) {
    return item.childNodeIds.length;
  }
  return 0;
}

export function isDupladoItem(item: any, es08Matches?: any[]): boolean {
  if (!item) return false;
  const base = (item.itemBase || "").toUpperCase();
  if (base.startsWith("ES08")) return true;
  const desc = (item.descricao || "").toLowerCase();
  if (desc.includes("duplado") || desc.includes("37mm")) return true;
  const es08List = Array.isArray(es08Matches) ? es08Matches : [];
  if (
    es08List.some(
      (e: any) =>
        (e.id && e.id === item.id) ||
        (e.desenho && item.desenho && e.desenho === item.desenho)
    )
  ) {
    return true;
  }
  return false;
}

export function parseItemDimensions(item: any): {
  largura: string;
  altura: string;
  profundidade: string;
} {
  if (!item) return { largura: "", altura: "", profundidade: "" };
  let l = item.largura ? String(item.largura) : "";
  let a = item.altura ? String(item.altura) : "";
  let p = item.profundidade ? String(item.profundidade) : "";
  if (!l || !a || !p) {
    const parts = (item.dimensao || "").split(/[xX*]/).map((s: string) => s.trim());
    if (parts.length >= 3) {
      if (!l) l = parts[0];
      if (!a) a = parts[1];
      if (!p) p = parts[2];
    }
  }
  return { largura: l, altura: a, profundidade: p };
}

export function isChapaItem(item: any): boolean {
  if (!item) return false;
  const code = String(item.itemBase || item.referencia || "").trim().toUpperCase();
  if (code.startsWith("10.01")) return true;
  return /^chapa\b/i.test(String(item.descricao || "").trim());
}

export interface FamilyTarget {
  item: any;
  role: "pai" | "filho" | "chapa" | "item";
}

function sameNode(a: any, b: any): boolean {
  if (a?.nodeId != null && b?.nodeId != null) return String(a.nodeId) === String(b.nodeId);
  return a === b;
}

function findNode(allItems: any[], nodeId: any): any | null {
  if (nodeId == null) return null;
  return allItems.find((n) => n && String(n.nodeId) === String(nodeId)) || null;
}

function getRootItem(item: any, allItems: any[]): any {
  const ancestors = item?.ancestorIds;
  if (!Array.isArray(ancestors) || ancestors.length === 0) return item;
  return findNode(allItems, ancestors[0]) || item;
}

function getDirectChildren(parent: any, allItems: any[]): any[] {
  return (parent?.childNodeIds || []).map((id: any) => findNode(allItems, id)).filter(Boolean);
}

function getDescendantItems(parent: any, allItems: any[]): any[] {
  const ids = Array.isArray(parent?.descendantIds) && parent.descendantIds.length
    ? parent.descendantIds
    : parent?.childNodeIds || [];
  return ids.map((id: any) => findNode(allItems, id)).filter(Boolean);
}

/** Returns all XML IDs for a selected target set without collapsing repeated product codes. */
export function getTargetIds(targets: FamilyTarget[]): string[] {
  return Array.from(new Set((targets || [])
    .flatMap(({ item }) => Array.isArray(item?.ids) ? item.ids : [item?.id])
    .filter((id) => id != null && String(id).trim() !== "")
    .map((id) => String(id))));
}

/** Stable identifiers for a specific XML node when its ID is reused elsewhere. */
export function getTargetRefs(targets: FamilyTarget[], allItems: any[] = []): Array<{ id: string; uniqueId?: string; path?: number[] }> {
  const refs = (targets || []).flatMap(({ item }) => {
    const ids = Array.isArray(item?.ids) ? item.ids : [item?.id];
    const chain: any[] = [item];
    let current = item;
    while (current?.parentId != null) {
      current = findNode(allItems, current.parentId);
      if (!current) break;
      chain.unshift(current);
    }
    const path = chain.map((node) => {
      const siblings = node.parentId == null
        ? allItems.filter((candidate) => candidate?.parentId == null)
        : getDirectChildren(findNode(allItems, node.parentId), allItems);
      return siblings.findIndex((sibling) => sameNode(sibling, node));
    });
    return ids
      .filter((id) => id != null && String(id).trim() !== "")
      .map((id) => ({
        id: String(id),
        uniqueId: item?.uniqueId != null && String(item.uniqueId).trim() !== "" ? String(item.uniqueId).trim() : undefined,
        path: path.every((index) => index >= 0) ? path : undefined,
      }));
  });
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.id}|${ref.uniqueId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isProdutoFilho(child: any, parent: any): boolean {
  if (!child || isChapaItem(child)) return false;
  const childBase = String(child.itemBase || child.referencia || "").trim().toUpperCase();
  const childDesc = String(child.descricao || "").trim();
  // A nested non-sheet item is the product child. Consumables and packaging
  // (for example cola, fita and embalagem) retain their independent descriptions.
  if (/^(EMBALAGEM|COLA|FITA|FERRAGEM)\b/i.test(childBase) || /^(embalagem|cola|fita|ferragem)\b/i.test(String(child.descricao || "").trim())) return false;
  if (isParentItem(child)) return true;
  // Product modules are nested with their parts; these known consumables,
  // packaging and sheet codes are the exceptions that keep their own text.
  return (!!childBase || !!childDesc) && !/^(10\.\d+|EMBALAGEM|COLA|FITA|FERRAGEM)\b/i.test(childBase) && !/^(embalagem|cola|fita|ferragem)\b/i.test(childDesc);
}

function pushUniqueTarget(list: FamilyTarget[], item: any, role: FamilyTarget["role"]) {
  if (!item || (item.id == null && (!Array.isArray(item.ids) || item.ids.length === 0)) || (item.id != null && String(item.id).trim() === "")) return;
  if (list.some((t) => sameNode(t.item, item))) return;
  list.push({ item, role });
}

function dimensionNumbers(item: any): number[] | null {
  const dims = parseItemDimensions(item);
  const nums = [dims.largura, dims.altura, dims.profundidade].map((v) => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  });
  if (nums.some((n) => n === null)) return null;
  return nums as number[];
}

function sameDimensionBag(a: any, b: any): boolean {
  const da = dimensionNumbers(a);
  const db = dimensionNumbers(b);
  if (!da || !db) return false;
  const sa = [...da].sort((x, y) => x - y);
  const sb = [...db].sort((x, y) => x - y);
  return sa.every((n, i) => Math.abs(n - sb[i]) < 0.1);
}

/** Descrição na aba Itens: sync pai + produto filho; a edição de componentes internos fica local. */
export function resolveDescriptionTargets(item: any, allItems: any[]): FamilyTarget[] {
  if (!item) return [];
  if (!Array.isArray(allItems) || allItems.length === 0) return [{ item, role: "item" }];

  const parent = item.parentId != null ? findNode(allItems, item.parentId) : null;
  const root = getRootItem(item, allItems);
  const relevantParent = parent && isProdutoFilho(item, parent) ? parent : null;
  const relevantChildren = getDirectChildren(item, allItems).filter((child) => isProdutoFilho(child, item));
  const familyParent = relevantParent || (sameNode(item, root) && relevantChildren.length ? item : null);

  if (relevantParent) {
    const targets: FamilyTarget[] = [];
    pushUniqueTarget(targets, relevantParent, "pai");
    pushUniqueTarget(targets, item, "filho");
    return targets.length > 1 ? targets : [{ item, role: "item" }];
  }

  if (familyParent) {
    const targets: FamilyTarget[] = [];
    pushUniqueTarget(targets, familyParent, "pai");
    if (relevantChildren.length === 1) pushUniqueTarget(targets, relevantChildren[0], "filho");
    return targets.length > 1 ? targets : [{ item, role: "item" }];
  }

  return [{ item, role: "item" }];
}

/** Dimensão na aba Itens: pai, filho e a chapa do mesmo tamanho. */
export function resolveDimensionTargets(item: any, allItems: any[]): FamilyTarget[] {
  if (!item) return [];
  if (!Array.isArray(allItems) || allItems.length === 0) return [{ item, role: "item" }];

  const root = getRootItem(item, allItems);
  const filhos = getDirectChildren(root, allItems).filter((child) => isProdutoFilho(child, root));
  const isRoot = sameNode(item, root);
  const asFilho = filhos.find((filho) => sameNode(filho, item));
  const asChapa = isChapaItem(item);
  if (!isRoot && !asFilho && !asChapa) return [{ item, role: "item" }];

  let scopeFilhos: any[] = [];
  if (isRoot) scopeFilhos = filhos;
  else if (asFilho) scopeFilhos = [asFilho];
  else {
    const ancestors = (item.ancestorIds || []).map((id: any) => String(id));
    const filho = filhos.find((candidate) => ancestors.includes(String(candidate.nodeId)));
    scopeFilhos = filho ? [filho] : [];
  }

  const targets: FamilyTarget[] = [];
  pushUniqueTarget(targets, root, "pai");
  for (const filho of scopeFilhos) pushUniqueTarget(targets, filho, "filho");

  // Chapas candidatas: as que ficam sob o(s) filho(s) do escopo e também as que ficam
  // diretamente sob o pai (irmãs do filho), que é o caso mais comum no XML.
  const candidates: any[] = scopeFilhos.length
    ? [
        ...getDirectChildren(root, allItems).filter(isChapaItem),
        ...scopeFilhos.flatMap((filho) => getDescendantItems(filho, allItems)),
      ]
    : getDescendantItems(root, allItems);
  const refs = [item, root, ...scopeFilhos];
  for (const descendant of candidates) {
    if (!isChapaItem(descendant)) continue;
    const matchesSize = refs.some((ref) => sameDimensionBag(descendant, ref));
    if (matchesSize || sameNode(descendant, item)) {
      pushUniqueTarget(targets, descendant, "chapa");
    }
  }

  return targets.length > 1 ? targets : [{ item, role: asChapa ? "chapa" : "item" }];
}

export function familyScopeNote(targets: FamilyTarget[], kind: "descricao" | "dimensao"): string | null {
  if (!targets || targets.length <= 1) return null;
  const roles = new Set(targets.map((t) => t.role));
  if (kind === "descricao" && roles.has("pai") && roles.has("filho")) {
    return "A descrição será alterada no item pai e no filho.";
  }
  if (kind === "dimensao" && roles.has("pai") && roles.has("filho") && roles.has("chapa")) {
    return "A dimensão será alterada no pai, no filho e na chapa.";
  }
  if (kind === "dimensao" && roles.has("pai") && roles.has("filho")) {
    return "A dimensão será alterada no pai e no filho.";
  }
  if (kind === "dimensao" && roles.has("pai") && roles.has("chapa")) {
    return "A dimensão será alterada no pai e na chapa.";
  }
  return null;
}

export function matchesItemFilter(
  item: any,
  searchTerm: string,
  options?: {
    includeId?: boolean;
    includeReferencia?: boolean;
    includeExtraSearch?: boolean;
    defaultItemBase?: string;
  }
): boolean {
  if (!searchTerm || !searchTerm.trim()) return true;
  if (!item) return false;
  const search = searchTerm.toLowerCase().trim();
  const itemBase = (item.itemBase || options?.defaultItemBase || "").toLowerCase();
  const desenho = (item.desenho || "").toLowerCase();
  const dimensao = (item.dimensao || "").toLowerCase();
  const descricao = (item.descricao || "").toLowerCase();
  const id = options?.includeId !== false ? String(item.id || "").toLowerCase() : "";
  const referencia = options?.includeReferencia !== false ? (item.referencia || "").toLowerCase() : "";
  const extraSearch = options?.includeExtraSearch ? (item.extraSearch || "").toLowerCase() : "";

  return (
    itemBase.includes(search) ||
    desenho.includes(search) ||
    dimensao.includes(search) ||
    descricao.includes(search) ||
    (id ? id.includes(search) : false) ||
    (referencia ? referencia.includes(search) : false) ||
    (extraSearch ? extraSearch.includes(search) : false)
  );
}
