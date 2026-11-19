export interface UserPermissionsSummary {
  userId: number;
  permissionIds: number[];
  displayName: string;
  hasAdminPermission: boolean;          // ID ou Permissão 37 ou 38
  isPerm37: boolean;                    // ID ou Permissão 37
  isPerm38: boolean;                    // ID ou Permissão 38
  canViewEs08: boolean;                 // ID ou Permissão 37 ou 38
  canCopyXml: boolean;                  // ID ou Permissão 37 ou 38
  hasSpecialOrdersPermission: boolean;  // Permissão 36
  hasPlateSeparationPermission: boolean;// ID ou Permissão 39
}

export function extractPermissionIds(currentUser: any): number[] {
  if (!currentUser) return [];
  const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
  return perms
    .map((p: any) => (typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p)))
    .filter((n: number) => !isNaN(n));
}

export function getUserDisplayName(currentUser: any, fallback: string = ""): string {
  if (!currentUser) return fallback;
  const name =
    currentUser.txt_nome ||
    currentUser.nome ||
    currentUser.txt_login ||
    currentUser.nome_usuario ||
    currentUser.name ||
    fallback;
  return typeof name === "string" ? name.trim() : fallback;
}

export function getUserPermissions(currentUser: any): UserPermissionsSummary {
  if (!currentUser) {
    return {
      userId: 0,
      permissionIds: [],
      displayName: "",
      hasAdminPermission: false,
      isPerm37: false,
      isPerm38: false,
      canViewEs08: false,
      canCopyXml: false,
      hasSpecialOrdersPermission: false,
      hasPlateSeparationPermission: false,
    };
  }

  const userId = Number(currentUser.pk_usuario ?? currentUser.id ?? 0);
  const permissionIds = extractPermissionIds(currentUser);
  const displayName = getUserDisplayName(currentUser);

  const isPerm37 = userId === 37 || permissionIds.includes(37);
  const isPerm38 = userId === 38 || permissionIds.includes(38);
  const hasAdminPermission = isPerm37 || isPerm38;
  const canViewEs08 = hasAdminPermission;
  const canCopyXml = hasAdminPermission;
  const hasSpecialOrdersPermission = permissionIds.includes(36);
  const hasPlateSeparationPermission = userId === 39 || permissionIds.includes(39);

  return {
    userId,
    permissionIds,
    displayName,
    hasAdminPermission,
    isPerm37,
    isPerm38,
    canViewEs08,
    canCopyXml,
    hasSpecialOrdersPermission,
    hasPlateSeparationPermission,
  };
}

export function formatUserPermissionsList(currentUser: any): Array<{ id: number; label: string }> {
  if (!currentUser) return [];
  const perms = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
  return perms.map((p: any) => {
    const id = typeof p === "object" && p !== null ? Number(p.pk_permissao) : Number(p);
    const name = typeof p === "object" && p !== null ? p.txt_permissao || p.nome : null;
    let label = name || `Permissão #${id}`;
    if (id === 37 || id === 38) label = `Admin Analisador (${id})`;
    if (id === 39) label = `Pedidos Especiais (${id})`;
    if (id === 40) label = `Separação de Chapas (${id})`;
    return { id, label };
  });
}

