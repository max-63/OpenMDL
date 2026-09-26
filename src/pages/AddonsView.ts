import { addonManager } from '../services/addonManager';
import { AddonPackage } from '../types/addon';
import { Icons } from '../components/Icons';
import { createNewAddonTemplate, ADDON_GUIDE_MARKDOWN } from '../services/addonTemplates';
import { packAddonBinary, unpackAddonBinary, triggerFileDownload } from '../services/binaryCodec';

export class AddonsView {
  private container: HTMLElement | null = null;

  public render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'w-full h-full flex flex-col gap-5 overflow-y-auto pr-1 select-none animate-enter';
    this.container = container;

    this.renderContent();
    return container;
  }

  private renderContent(): void {
    if (!this.container) return;
    this.container.innerHTML = '';

    const packages = addonManager.getPackages();
    const activeCount = packages.filter(p => p.manifest.enabled).length;

    this.container.innerHTML = `
      <!-- En-tête de la Bibliothèque d'Addons -->
      <div class="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold">
            ${Icons.puzzle('w-6 h-6')}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-black text-slate-900 dark:text-white tracking-tight">Bibliothèque d'Addons & Modding</h1>
              <span class="px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] font-extrabold uppercase border border-orange-500/20">
                Espace Administrateur
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Développez vos modules dans votre éditeur favori (VS Code, VSCodium, Lapce, Zed) et étendez librement le logiciel.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 flex-wrap">
          <!-- Guide Développeur -->
          <button id="btn-open-guide-modal" class="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700">
            ${Icons.book('w-4 h-4')}
            <span>Guide API & Développement</span>
          </button>

          <!-- Importer un Addon -->
          <button id="btn-import-addon" class="px-3.5 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700">
            ${Icons.download('w-4 h-4')}
            <span>Importer un Addon (.mdlx)</span>
          </button>
          <input type="file" id="import-file-input" accept=".mdlx,.json" class="hidden" />

          <!-- Créer un Addon -->
          <button id="btn-create-addon" class="px-4 py-2 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-extrabold text-xs shadow-md shadow-orange-600/20 transition-all flex items-center gap-2 cursor-pointer">
            ${Icons.plus('w-4 h-4')}
            <span>Créer un addon</span>
          </button>
        </div>
      </div>

      <!-- Bannière Développeur : Recommandation VS Code & Environnement Natif -->
      <div class="rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-sky-800/40 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-white">
        <div class="flex items-start gap-4">
          <div class="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
            ${Icons.code('w-5 h-5')}
          </div>
          <div class="space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-extrabold text-sm tracking-tight text-white">Développez avec Visual Studio Code</span>
              <span class="px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-[10px] font-bold uppercase">
                Recommandé pour OpenMDL
              </span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed max-w-3xl">
              Les addons OpenMDL sont écrits en <strong>TypeScript standard</strong> et <strong>Tailwind CSS</strong>. Ouvrez vos projets directement dans <strong>VS Code</strong>, <strong>VSCodium</strong>, <strong>Lapce</strong> ou <strong>Zed</strong> installés sur votre PC pour profiter de vos extensions, thèmes et raccourcis habituels. Les modifications sont appliquées en direct dans la caisse sans redémarrage.
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <a href="https://code.visualstudio.com/" target="_blank" class="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer no-underline">
            ${Icons.externalLink('w-3.5 h-3.5')}
            <span>Télécharger VS Code</span>
          </a>
        </div>
      </div>

      <!-- Barre de Statistiques & Règles Open Source -->
      <div class="rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-4 text-slate-600 dark:text-slate-300 font-bold">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>${activeCount} actif${activeCount > 1 ? 's' : ''}</span>
          </div>
          <span class="text-slate-300 dark:text-slate-700">|</span>
          <div class="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>Total : ${packages.length} module${packages.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <span class="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">Éditeur Externe Natif</span>
          <span>100% Gratuit & Libre • Vente strictement interdite</span>
        </div>
      </div>

      <!-- Grille des Addons Installés -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        ${packages.map(pkg => this.renderAddonCard(pkg)).join('')}
      </div>
    `;

    this.attachEvents();
  }

  private renderAddonCard(pkg: AddonPackage): string {
    const m = pkg.manifest;
    const isEnabled = m.enabled;

    return `
      <div class="rounded-3xl bg-white dark:bg-slate-900 border ${isEnabled ? 'border-orange-500/30 shadow-sm' : 'border-slate-200 dark:border-slate-800 opacity-80'} p-5 flex flex-col justify-between gap-4 transition-all hover:border-orange-500/50" data-addon-id="${m.id}">
        
        <!-- Haut de carte : Icône + Nom + Interrupteur -->
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                ${Icons.puzzle('w-5 h-5')}
              </div>
              <div>
                <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  ${m.category || 'Module'}
                </span>
              </div>
            </div>

            <!-- Interrupteur Marche / Arrêt -->
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-bold ${isEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">
                ${isEnabled ? 'Actif' : 'Inactif'}
              </span>
              <div class="w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors btn-toggle-switch ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}" data-id="${m.id}" title="${isEnabled ? 'Désactiver' : 'Activer'}">
                <span class="inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out my-0.5 ml-0.5 ${isEnabled ? 'translate-x-4' : 'translate-x-0'}"></span>
              </div>
            </div>
          </div>

          <!-- Titre & Description -->
          <div>
            <h3 class="text-sm font-black text-slate-900 dark:text-white tracking-tight">${m.name}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium pt-1 line-clamp-2 leading-relaxed">
              ${m.description || 'Aucune description fournie.'}
            </p>
          </div>
        </div>

        <!-- Bouton Principal d'Édition : Ouvrir dans VS Code -->
        <div class="pt-2">
          <button class="w-full py-2.5 px-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800/60 text-sky-700 dark:text-sky-300 font-extrabold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer btn-open-vscode" data-id="${m.id}">
            ${Icons.code('w-4 h-4 text-sky-500')}
            <span>Ouvrir dans VS Code / Mon Éditeur</span>
          </button>
        </div>

        <!-- Bas de carte : Auteur + Actions secondaires -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div class="text-[11px] text-slate-400 font-medium truncate">
            Par <span class="font-bold text-slate-600 dark:text-slate-300">${m.author}</span> (v${m.version})
          </div>

          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- Synchroniser depuis le disque -->
            <button class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors btn-sync-disk cursor-pointer" data-id="${m.id}" title="Recharger les fichiers modifiés dans votre éditeur">
              ${Icons.refresh('w-3.5 h-3.5')}
            </button>

            <!-- Exporter -->
            <button class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors btn-export-addon cursor-pointer" data-id="${m.id}" title="Exporter le fichier addon JSON pour GitHub">
              ${Icons.download('w-3.5 h-3.5')}
            </button>

            <!-- Supprimer -->
            <button class="p-2 rounded-xl bg-slate-100 hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 dark:bg-slate-800 dark:hover:bg-rose-500/20 transition-colors btn-delete-addon cursor-pointer" data-id="${m.id}" title="Supprimer cet addon">
              ${Icons.trash('w-3.5 h-3.5')}
            </button>
          </div>
        </div>

      </div>
    `;
  }

  private attachEvents(): void {
    if (!this.container) return;

    // Bouton Créer un Addon
    this.container.querySelector('#btn-create-addon')?.addEventListener('click', async () => {
      const name = prompt('Nom de votre nouvel addon (ex: Tombola du Foyer, Compteur de fidélité) :');
      if (!name || !name.trim()) return;

      const id = name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const author = prompt('Auteur (ex: Votre nom ou Bureau MDL) :') || 'Administrateur';

      const newPkg = createNewAddonTemplate(id, name.trim(), author.trim());
      addonManager.savePackage(newPkg);

      // Ouvrir immédiatement le projet dans l'éditeur de l'utilisateur (VS Code / Lapce)
      await this.launchEditor(newPkg);
      this.renderContent();
    });

    // Bouton Guide Développeur Markdown
    this.container.querySelector('#btn-open-guide-modal')?.addEventListener('click', () => {
      const renderedHtml = addonManager.api.ui.renderMarkdown(ADDON_GUIDE_MARKDOWN);
      const contentEl = document.createElement('div');
      contentEl.className = 'prose dark:prose-invert max-w-none text-xs leading-relaxed space-y-3';
      contentEl.innerHTML = renderedHtml;

      addonManager.api.ui.modal({
        title: 'Guide Officiel de Développement d\'Addons OpenMDL',
        content: contentEl,
        size: 'xl'
      });
    });

    // Bascule Actif / Inactif sur chaque carte
    this.container.querySelectorAll('.btn-toggle-switch').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        addonManager.toggleAddon(id);
        this.renderContent();
      });
    });

    // Bouton Principal : Ouvrir dans VS Code / Lapce externe
    this.container.querySelectorAll('.btn-open-vscode').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        const pkg = addonManager.getPackage(id);
        if (!pkg) return;
        await this.launchEditor(pkg);
      });
    });

    // Bouton Synchroniser depuis le disque
    this.container.querySelectorAll('.btn-sync-disk').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        const pkg = addonManager.getPackage(id);
        if (!pkg) return;

        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const diskFiles = await invoke<Array<{ path: string; content: string }>>('read_addon_files_from_disk', {
            addonId: pkg.manifest.id
          });

          if (diskFiles && diskFiles.length > 0) {
            diskFiles.forEach(df => {
              const existing = pkg.files.find(f => f.path === df.path);
              if (existing) {
                existing.content = df.content;
              } else {
                const filename = df.path.split('/').pop() || 'file';
                pkg.files.push({
                  name: filename,
                  path: df.path,
                  content: df.content,
                  language: filename.endsWith('.css') ? 'css' : filename.endsWith('.json') ? 'json' : filename.endsWith('.md') ? 'markdown' : 'typescript'
                });
              }
            });

            addonManager.savePackage(pkg);
            addonManager.api.ui.notify(`${diskFiles.length} fichiers synchronisés depuis le disque !`, 'success');
            this.renderContent();
          }
        } catch (err) {
          console.warn('Erreur synchronisation :', err);
          addonManager.api.ui.notify('Impossible de synchroniser depuis le disque : ' + String(err), 'error');
        }
      });
    });

    // Bouton Exporter (.mdlx binaire optimisé)
    this.container.querySelectorAll('.btn-export-addon').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        const pkg = addonManager.getPackage(id);
        if (!pkg) return;

        try {
          const binaryBytes = await packAddonBinary(pkg);
          triggerFileDownload(binaryBytes, `${pkg.manifest.id}.mdlx`, 'application/octet-stream');
          addonManager.api.ui.notify(`Addon "${pkg.manifest.name}" exporté au format binaire optimisé (.mdlx, ${binaryBytes.length} octets) !`, 'success');
        } catch (err) {
          console.error(err);
          addonManager.api.ui.notify('Erreur lors de l\'export binaire de l\'addon : ' + String(err), 'error');
        }
      });
    });

    // Bouton Supprimer
    this.container.querySelectorAll('.btn-delete-addon').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        const pkg = addonManager.getPackage(id);
        if (!pkg) return;

        addonManager.api.ui.confirm({
          title: 'Supprimer l\'addon',
          message: `Êtes-vous sûr de vouloir supprimer définitivement l'addon "${pkg.manifest.name}" ?`,
          confirmText: 'Supprimer',
          onConfirm: () => {
            addonManager.deletePackage(id);
            addonManager.api.ui.notify('Addon supprimé avec succès.', 'info');
            this.renderContent();
          }
        });
      });
    });

    // Importer un Addon (.mdlx binaire ou legacy .json)
    const fileInput = this.container.querySelector('#import-file-input') as HTMLInputElement;
    this.container.querySelector('#btn-import-addon')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const buffer = await file.arrayBuffer();
        const pkg = await unpackAddonBinary(buffer);
        addonManager.savePackage(pkg);
        const isMdlx = file.name.endsWith('.mdlx');
        addonManager.api.ui.notify(`Addon "${pkg.manifest.name}" (${isMdlx ? 'Package binaire .mdlx' : 'JSON'}) importé avec succès !`, 'success');
        this.renderContent();
      } catch (err) {
        console.error(err);
        addonManager.api.ui.notify('Erreur lors de l\'importation de l\'addon : ' + String(err), 'error');
      } finally {
        fileInput.value = '';
      }
    });
  }

  private async launchEditor(pkg: AddonPackage): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const filesDto = pkg.files.map(f => ({ path: f.path, content: f.content }));
      const msg = await invoke<string>('open_in_external_editor', {
        addonId: pkg.manifest.id,
        files: filesDto
      });
      addonManager.api.ui.notify(msg, 'success');
    } catch (err) {
      console.warn('Erreur ouverture externe via Tauri :', err);
      addonManager.api.ui.notify('Impossible d\'ouvrir l\'éditeur externe : ' + String(err), 'warning');
    }
  }
}
