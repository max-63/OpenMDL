# Système, Thème & Utilitaires

Cette section couvre les modules `OpenMDL.system`, `OpenMDL.theme` et `OpenMDL.utils`.

---

## 1. Informations Système & Journalisation (`OpenMDL.system`)

Le module `OpenMDL.system` donne accès aux métadonnées logicielles, aux journaux d'audit et aux fonctions de sauvegarde globale.

### Méthodes Disponibles

| Méthode / Propriété | Type | Description |
| :--- | :--- | :--- |
| `version` | `string` | Version actuelle d'OpenMDL (ex: `"1.0.4"`). |
| `appName` | `string` | Nom officiel de l'application (`"OpenMDL"`). |
| `author` | `string` | Nom de l'auteur original (`"Adrien Courault"`). |
| `portfolioUrl` | `string` | Lien vers le portfolio de l'auteur. |
| `getInfo()` | `Function` | Renvoie un récapitulatif global (nombre de ventes, produits, séance active, thème). |
| `exportBackup()` | `Function` | Génère une archive JSON complète de toutes les tables de la base de données. |
| `importBackup(json)` | `Function` | Restaure une sauvegarde JSON dans la base locale. |
| `getActivityLogs()` | `Function` | Récupère le journal chronologique des événements (connexions, ventes, réapprovisionnements). |
| `logActivity(type, msg)`| `Function` | Écrit une ligne dans le journal d'activité d'OpenMDL (`'INFO'`, `'SALE'`, `'SECURITY'`, etc.). |

---

### Exemple de Journalisation d'Activité

```typescript
// Enregistrer un événement dans le journal officiel du foyer
OpenMDL.system.logActivity('INFO', 'Addon Tombola : Tirage au sort lancé pour la séance en cours.');
```

---

## 2. Thème Visuel & Injection CSS (`OpenMDL.theme`)

Permet de synchroniser les couleurs de vos modules avec le mode sombre ou d'injecter des styles CSS dynamiques.

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `getTheme()` | aucun | `'dark' \| 'light'` | Renvoie le mode visuel actuellement actif. |
| `setTheme(theme)` | `'dark' \| 'light'` | `void` | Définit le thème de l'application. |
| `toggleTheme()` | aucun | `'dark' \| 'light'` | Alterne entre mode sombre et clair. |
| `injectCss(css, id?)` | `css: string, id?: string` | `void` | Injecte une feuille de style CSS dans le `<head>`. |
| `removeInjectedCss(id)`| `id: string` | `void` | Supprime une feuille de style injectée. |

---

## 3. Utilitaires Universels (`OpenMDL.utils`)

Fonctions utilitaires intégrées pour simplifier l'écriture de vos composants :

### Méthodes Disponibles

| Méthode | Paramètres | Type de retour | Description |
| :--- | :--- | :--- | :--- |
| `formatPrice(amount)` | `amount: number` | `string` | Formate un nombre en devise française (ex: `1.5` -> `"1,50 €"`). |
| `formatDate(date)` | `date: string \| Date` | `string` | Formate une date en chaîne lisible (ex: `"16 sept. 2026"`). |
| `formatTime(date)` | `date: string \| Date` | `string` | Formate l'horodatage (ex: `"14:30"`). |
| `escapeHtml(str)` | `str: string` | `string` | Échappe les balises HTML sensibles contre les failles XSS. |
| `generateId(prefix?)` | `prefix?: string` | `string` | Génère un identifiant unique aléatoire (ex: `"btn-xyz123"`). |
| `downloadFile(name, content, mime?)` | `name: string, content: string, mime?: string` | `void` | Déclenche le téléchargement d'un fichier texte dans le navigateur. |
| `copyToClipboard(text)`| `text: string` | `Promise<boolean>` | Copie une chaîne dans le presse-papiers du système. |

---

### Exemple de Téléchargement de Rapport

```typescript
const rapport = `Rapport de permanence\nDate: ${OpenMDL.utils.formatDate(new Date())}\nVentes totales: ${OpenMDL.sales.getTodaySales().length}`;

// Déclencher le téléchargement automatique d'un fichier texte
OpenMDL.utils.downloadFile('rapport-foyer.txt', rapport, 'text/plain');
```
