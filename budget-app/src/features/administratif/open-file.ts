/**
 * Consultation et téléchargement via un lien temporaire (60 s), sans quitter Cocon pour une manipulation complexe.
 *
 * iPhone (Safari et application installée) n'autorise l'ouverture d'un onglet que pendant le geste
 * de l'utilisateur : l'onglet est donc ouvert tout de suite, puis dirigé vers le lien dès qu'il est prêt.
 */
export async function viewFile(getUrl: () => Promise<string>): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const url = await getUrl();
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export async function downloadFile(getUrl: () => Promise<string>, fileName: string): Promise<void> {
  const url = await getUrl();
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
