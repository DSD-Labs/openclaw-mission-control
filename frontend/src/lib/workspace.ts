const KEY = "mc.workspaceId";

export function getWorkspaceId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setWorkspaceId(id: string | null) {
  try {
    if (!id) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch {
    // ignore
  }
}
