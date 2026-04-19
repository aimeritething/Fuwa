type ReleaseAssetPayload = {
  browser_download_url?: unknown
  name?: unknown
}

type GitHubReleasePayload = {
  assets?: ReleaseAssetPayload[]
  body?: unknown
  body_html?: unknown
  draft?: unknown
  html_url?: unknown
  name?: unknown
  prerelease?: unknown
  published_at?: unknown
  tag_name?: unknown
}

type ReleaseChannel = 'stable' | 'alpha'

type ReleaseDownload = {
  label: string
  url: string
}

type ReleaseEntry = {
  downloads: ReleaseDownload[]
  githubUrl: string | null
  notesHtml: string
  publishedLabel: string
  tagName: string
  title: string
}

type ReleaseSections = Record<ReleaseChannel, ReleaseEntry[]>

const RELEASE_HISTORY_PAGE_STYLES = `
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #f7f6f3;
      color: #37352f;
      padding: 32px 20px 48px;
    }

    main {
      width: min(100%, 840px);
      margin: 0 auto;
    }

    header {
      margin-bottom: 24px;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 4vw, 2.5rem);
      line-height: 1.1;
    }

    .subtitle,
    .keyboard-hint {
      margin: 0;
      color: #787774;
      line-height: 1.6;
    }

    .keyboard-hint {
      margin-top: 8px;
      font-size: 0.9375rem;
    }

    .channel-tabs {
      margin-bottom: 24px;
      border-bottom: 1px solid #e9e9e7;
    }

    .channel-tablist {
      display: inline-flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: -1px;
    }

    .channel-tab {
      appearance: none;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 12px 12px 0 0;
      background: transparent;
      color: #5e5c57;
      cursor: pointer;
      font: inherit;
      font-weight: 600;
      padding: 12px 16px;
    }

    .channel-tab:hover {
      background: rgba(21, 93, 255, 0.06);
      color: #155dff;
    }

    .channel-tab:focus-visible {
      outline: 2px solid #155dff;
      outline-offset: 2px;
    }

    .channel-tab[aria-selected="true"] {
      background: #ffffff;
      border-color: #d8e3ff;
      color: #155dff;
      box-shadow: 0 -1px 0 #ffffff inset;
    }

    .tab-count {
      color: #787774;
      font-weight: 500;
      margin-left: 6px;
    }

    .release-panel {
      display: grid;
      gap: 16px;
      outline: none;
    }

    .release-panel[hidden] {
      display: none;
    }

    .release-card {
      background: #ffffff;
      border: 1px solid #e9e9e7;
      border-radius: 18px;
      padding: 20px 22px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.05);
    }

    .release-card--alpha {
      border-left: 4px solid #f59e0b;
    }

    .release-card--stable {
      border-left: 4px solid #155dff;
    }

    .release-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 14px;
    }

    .release-header h2 {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.25;
    }

    .release-meta {
      margin: 4px 0 0;
      color: #787774;
      font-size: 0.9375rem;
    }

    .release-channel {
      align-self: start;
      background: #f1f5ff;
      border-radius: 999px;
      color: #155dff;
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 6px 10px;
      text-transform: uppercase;
    }

    .release-card--alpha .release-channel {
      background: #fff3d6;
      color: #b45309;
    }

    .release-notes {
      color: #44403c;
      font-size: 0.98rem;
      line-height: 1.7;
    }

    .release-notes > :first-child {
      margin-top: 0;
    }

    .release-notes > :last-child {
      margin-bottom: 0;
    }

    .release-notes h1,
    .release-notes h2,
    .release-notes h3 {
      line-height: 1.25;
      margin: 1.2em 0 0.4em;
    }

    .release-notes p,
    .release-notes ul,
    .release-notes ol,
    .release-notes blockquote,
    .release-notes pre {
      margin: 0 0 1em;
    }

    .release-notes ul,
    .release-notes ol {
      padding-left: 1.4rem;
    }

    .release-notes code {
      background: #f4f4f2;
      border-radius: 6px;
      padding: 0.12em 0.35em;
    }

    .release-notes pre {
      overflow-x: auto;
      background: #f4f4f2;
      border-radius: 12px;
      padding: 14px;
    }

    .release-notes pre code {
      background: transparent;
      padding: 0;
    }

    .release-notes blockquote {
      border-left: 3px solid #d6d3d1;
      color: #57534e;
      padding-left: 14px;
    }

    .release-notes a,
    .release-downloads a {
      color: #155dff;
      text-decoration-thickness: 0.08em;
      text-underline-offset: 0.18em;
    }

    .release-downloads {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .release-downloads a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 14px;
      border-radius: 10px;
      background: #155dff;
      color: #ffffff;
      font-weight: 600;
      text-decoration: none;
    }

    .release-downloads a[data-secondary="true"] {
      background: #ebeef5;
      color: #37352f;
    }

    .release-downloads a:hover,
    .release-downloads a:focus-visible {
      filter: brightness(0.96);
    }

    .release-downloads a:focus-visible {
      outline: 2px solid #155dff;
      outline-offset: 2px;
    }

    .empty-state {
      background: #ffffff;
      border: 1px dashed #d6d3d1;
      border-radius: 18px;
      color: #787774;
      padding: 28px 24px;
      text-align: center;
    }

    @media (max-width: 640px) {
      body {
        padding-inline: 16px;
      }

      .release-card {
        padding: 18px;
      }

      .channel-tablist {
        width: 100%;
      }

      .channel-tab {
        flex: 1 1 180px;
        text-align: center;
      }
    }
`

const RELEASE_HISTORY_PAGE_SCRIPT = `
    (() => {
      const tabs = Array.from(document.querySelectorAll('[data-release-tab]'));
      const panels = Array.from(document.querySelectorAll('[data-release-panel]'));
      if (!tabs.length || !panels.length) return;

      const activateTab = (nextTab) => {
        const nextChannel = nextTab.getAttribute('data-release-tab');
        tabs.forEach((tab) => {
          const selected = tab === nextTab;
          tab.setAttribute('aria-selected', String(selected));
          tab.tabIndex = selected ? 0 : -1;
        });
        panels.forEach((panel) => {
          panel.hidden = panel.getAttribute('data-release-panel') !== nextChannel;
        });
      };

      const moveFocus = (currentIndex, offset) => {
        const nextIndex = (currentIndex + offset + tabs.length) % tabs.length;
        tabs[nextIndex].focus();
        activateTab(tabs[nextIndex]);
      };

      const activateFocusedTab = (tab) => {
        tab.focus();
        activateTab(tab);
      };

      const handleTabKeydown = (event, tab, index) => {
        const keyActions = {
          ' ': () => activateTab(tab),
          ArrowDown: () => moveFocus(index, 1),
          ArrowLeft: () => moveFocus(index, -1),
          ArrowRight: () => moveFocus(index, 1),
          ArrowUp: () => moveFocus(index, -1),
          End: () => activateFocusedTab(tabs[tabs.length - 1]),
          Enter: () => activateTab(tab),
          Home: () => activateFocusedTab(tabs[0]),
        };
        const action = keyActions[event.key];
        if (!action) return;

        event.preventDefault();
        action();
      };

      tabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateTab(tab));
        tab.addEventListener('keydown', (event) => handleTabKeydown(event, tab, index));
      });
    })();
`

const RELEASE_CHANNEL_LABELS: Record<ReleaseChannel, string> = {
  alpha: 'Alpha',
  stable: 'Stable',
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : null
}

function normalizeUrl(value: unknown): string | null {
  const text = normalizeText(value)
  if (text === null) return null

  try {
    const parsedUrl = new URL(text)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null
    return parsedUrl.toString()
  } catch {
    return null
  }
}

function formatPublishedLabel(value: unknown): string {
  const text = normalizeText(value)
  if (text === null) return 'Unknown publish date'

  const publishedAt = new Date(text)
  if (Number.isNaN(publishedAt.getTime())) return 'Unknown publish date'

  return publishedAt.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  })
}

function isDownloadableAsset(name: string): boolean {
  return name.endsWith('.dmg') || name.endsWith('.app.tar.gz') || name.endsWith('.zip')
}

function normalizeDownloads(assets: ReleaseAssetPayload[] | undefined): ReleaseDownload[] {
  if (!Array.isArray(assets)) return []

  const seenUrls = new Set<string>()
  const downloads: ReleaseDownload[] = []

  for (const asset of assets) {
    const name = normalizeText(asset.name)
    const url = normalizeUrl(asset.browser_download_url)
    if (name === null || url === null || !isDownloadableAsset(name) || seenUrls.has(url)) continue

    seenUrls.add(url)
    downloads.push({ label: name, url })
  }

  return downloads
}

function buildFallbackReleaseNotesHtml(markdownFallback: string): string {
  const paragraphs = markdownFallback
    .split(/\n{2,}/)
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => `<p>${escapeHtml(part).replaceAll('\n', '<br>')}</p>`)

  return paragraphs.join('')
}

function resolveReleaseNotesHtml(renderedHtml: unknown, markdownFallback: unknown): string {
  const bodyHtml = normalizeText(renderedHtml)
  if (bodyHtml !== null) return bodyHtml

  const fallback = normalizeText(markdownFallback) ?? 'No release notes provided.'
  return buildFallbackReleaseNotesHtml(fallback)
}

function normalizeReleaseEntry(release: GitHubReleasePayload): [ReleaseChannel, ReleaseEntry] | null {
  if (release.draft === true) return null

  const title = normalizeText(release.name) ?? normalizeText(release.tag_name) ?? 'Untitled release'
  const tagName = normalizeText(release.tag_name) ?? 'Unknown tag'
  const channel: ReleaseChannel = release.prerelease === true ? 'alpha' : 'stable'

  return [channel, {
    downloads: normalizeDownloads(release.assets),
    githubUrl: normalizeUrl(release.html_url),
    notesHtml: resolveReleaseNotesHtml(release.body_html, release.body),
    publishedLabel: formatPublishedLabel(release.published_at),
    tagName,
    title,
  }]
}

function collectReleaseSections(payload: unknown): ReleaseSections {
  const sections: ReleaseSections = { alpha: [], stable: [] }
  if (!Array.isArray(payload)) return sections

  for (const item of payload) {
    if (!item || typeof item !== 'object') continue

    const normalizedRelease = normalizeReleaseEntry(item as GitHubReleasePayload)
    if (normalizedRelease === null) continue

    const [channel, release] = normalizedRelease
    sections[channel].push(release)
  }

  return sections
}

function buildTabMarkup(channel: ReleaseChannel, count: number, selected: boolean): string {
  const label = RELEASE_CHANNEL_LABELS[channel]
  return `
      <button
        id="tab-${channel}"
        class="channel-tab"
        type="button"
        role="tab"
        aria-controls="panel-${channel}"
        aria-selected="${selected}"
        data-release-tab="${channel}"
        tabindex="${selected ? '0' : '-1'}"
      >
        ${label}<span class="tab-count">${count}</span>
      </button>`
}

function buildReleaseMarkup(channel: ReleaseChannel, release: ReleaseEntry): string {
  const downloads = [...release.downloads]
  if (release.githubUrl !== null) {
    downloads.push({ label: 'View on GitHub', url: release.githubUrl })
  }

  const channelLabel = RELEASE_CHANNEL_LABELS[channel]
  const downloadsMarkup = downloads.length > 0
    ? `
      <div class="release-downloads">
        ${downloads.map(download => {
          const isSecondary = download.label === 'View on GitHub'
          return `<a href="${escapeHtml(download.url)}" ${isSecondary ? 'data-secondary="true" ' : ''}target="_blank" rel="noreferrer">${escapeHtml(download.label)}</a>`
        }).join('')}
      </div>`
    : ''

  return `
      <article class="release-card release-card--${channel}">
        <div class="release-header">
          <div>
            <h2>${escapeHtml(release.title)}</h2>
            <p class="release-meta">${escapeHtml(release.publishedLabel)} · ${escapeHtml(release.tagName)}</p>
          </div>
          <span class="release-channel">${channelLabel}</span>
        </div>
        <div class="release-notes">${release.notesHtml}</div>${downloadsMarkup}
      </article>`
}

function buildPanelMarkup(channel: ReleaseChannel, releases: ReleaseEntry[], selected: boolean): string {
  const releasesMarkup = releases.length > 0
    ? releases.map(release => buildReleaseMarkup(channel, release)).join('')
    : `<div class="empty-state">No ${channel} releases published yet.</div>`

  return `
    <section
      id="panel-${channel}"
      class="release-panel"
      role="tabpanel"
      tabindex="0"
      aria-labelledby="tab-${channel}"
      data-release-panel="${channel}"${selected ? '' : ' hidden'}
    >
      ${releasesMarkup}
    </section>`
}

export function buildReleaseHistoryPage(releasesPayload: unknown): string {
  const sections = collectReleaseSections(releasesPayload)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tolaria — Release History</title>
  <style>${RELEASE_HISTORY_PAGE_STYLES}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Tolaria Release History</h1>
      <p class="subtitle">Stable builds appear when a stable-vYYYY.M.D tag is promoted. Alpha builds update on every push to main.</p>
      <p class="keyboard-hint">Use Tab to reach the channel picker, then use the arrow keys to switch between Stable and Alpha.</p>
    </header>
    <div class="channel-tabs">
      <div class="channel-tablist" role="tablist" aria-label="Release channels">
        ${buildTabMarkup('stable', sections.stable.length, true)}
        ${buildTabMarkup('alpha', sections.alpha.length, false)}
      </div>
    </div>
    ${buildPanelMarkup('stable', sections.stable, true)}
    ${buildPanelMarkup('alpha', sections.alpha, false)}
  </main>
  <script>${RELEASE_HISTORY_PAGE_SCRIPT}
  </script>
</body>
</html>
`
}
