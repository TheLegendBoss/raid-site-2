// Where saves live. The desktop build (Electron) exposes window.raidHost and
// writes a real file in the user's app-data folder. A plain browser falls
// back to localStorage so `npm run dev` still works.
interface RaidHost {
  readSave(): Promise<string | null>;
  writeSave(text: string): Promise<void>;
}

const KEY = 'raid-site-2.save';

function desktopHost(): RaidHost | undefined {
  return (window as unknown as { raidHost?: RaidHost }).raidHost;
}

export const isDesktop = (): boolean => desktopHost() !== undefined;

export async function readSaveText(): Promise<string | null> {
  const h = desktopHost();
  if (h) return h.readSave();
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function writeSaveText(text: string): Promise<void> {
  const h = desktopHost();
  if (h) return h.writeSave(text);
  try {
    localStorage.setItem(KEY, text);
  } catch {
    /* private mode or blocked storage: the run still plays, it just will not persist */
  }
}
