const RELEASE_HISTORY_URL = 'https://refactoringhq.github.io/tolaria/'

type PlatformPayload = {
  dmg_url?: unknown
}

type LatestReleasePayload = {
  platforms?: Record<string, PlatformPayload | undefined>
}

type ReleaseAssetPayload = {
  browser_download_url?: unknown
  name?: unknown
}

type GitHubReleasePayload = {
  assets?: ReleaseAssetPayload[]
  draft?: unknown
  prerelease?: unknown
}

type DownloadPageContent = {
  buttonLabel: string
  destinationUrl: string
  helperText: string
  message: string
  shouldRedirect: boolean
  title: string
}

const REDIRECT_PAGE_STYLES = `
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
      display: grid;
      place-items: center;
      padding: 24px;
      background: #f7f6f3;
      color: #37352f;
    }

    main {
      width: min(100%, 460px);
      background: #ffffff;
      border: 1px solid #e9e9e7;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
    }

    h1 {
      margin: 0 0 12px;
      font-size: 1.5rem;
      line-height: 1.2;
    }

    p {
      margin: 0 0 12px;
      line-height: 1.5;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      background: #155dff;
      color: #ffffff;
      text-decoration: none;
      font-weight: 600;
    }

    a:hover,
    a:focus-visible {
      background: #1248cc;
    }
`

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function extractStableDmgUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const { platforms } = payload as LatestReleasePayload
  if (!platforms || typeof platforms !== 'object') return null

  const dmgUrl = platforms['darwin-aarch64']?.dmg_url
  if (typeof dmgUrl !== 'string') return null

  const trimmedUrl = dmgUrl.trim()
  return trimmedUrl.length > 0 ? trimmedUrl : null
}

function isPublicStableRelease(release: GitHubReleasePayload): boolean {
  return release.draft !== true && release.prerelease !== true
}

function extractAssetDmgUrl(asset: ReleaseAssetPayload): string | null {
  if (typeof asset.name !== 'string' || !asset.name.endsWith('.dmg')) return null
  if (typeof asset.browser_download_url !== 'string') return null

  const trimmedUrl = asset.browser_download_url.trim()
  return trimmedUrl.length > 0 ? trimmedUrl : null
}

function findReleaseDmgUrl(release: GitHubReleasePayload): string | null {
  if (!isPublicStableRelease(release)) return null
  if (!Array.isArray(release.assets)) return null

  for (const asset of release.assets) {
    const dmgUrl = extractAssetDmgUrl(asset)
    if (dmgUrl !== null) return dmgUrl
  }

  return null
}

export function extractStableDmgUrlFromReleases(payload: unknown): string | null {
  if (!Array.isArray(payload)) return null

  for (const release of payload) {
    if (!release || typeof release !== 'object') continue

    const dmgUrl = findReleaseDmgUrl(release as GitHubReleasePayload)
    if (dmgUrl !== null) return dmgUrl
  }

  return null
}

export function resolveStableDmgUrl(
  latestPayload: unknown,
  releasesPayload: unknown,
): string | null {
  return extractStableDmgUrl(latestPayload) ?? extractStableDmgUrlFromReleases(releasesPayload)
}

function buildStableDownloadPageContent(dmgUrl: string | null): DownloadPageContent {
  if (dmgUrl !== null) {
    return {
      buttonLabel: 'Download latest stable DMG',
      destinationUrl: dmgUrl,
      helperText: 'If the download does not start automatically, use the button below.',
      message: 'Redirecting to the latest stable Tolaria DMG.',
      shouldRedirect: true,
      title: 'Tolaria Stable Download',
    }
  }

  return {
    buttonLabel: 'View release history',
    destinationUrl: RELEASE_HISTORY_URL,
    helperText: 'Use the button below to check the latest release history.',
    message: 'No stable Tolaria DMG is available yet.',
    shouldRedirect: false,
    title: 'Tolaria Stable Download Unavailable',
  }
}

function buildRedirectMarkup(destinationUrl: string, shouldRedirect: boolean): string {
  if (!shouldRedirect) return ''

  const escapedDestinationUrl = escapeHtml(destinationUrl)
  return `
    <meta http-equiv="refresh" content="0; url=${escapedDestinationUrl}">
    <script>
      window.location.replace(${JSON.stringify(destinationUrl)});
    </script>`
}

export function buildStableDownloadRedirectPage(dmgUrl: string | null): string {
  const page = buildStableDownloadPageContent(dmgUrl)
  const escapedDestinationUrl = escapeHtml(page.destinationUrl)
  const redirectMarkup = buildRedirectMarkup(page.destinationUrl, page.shouldRedirect)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>${redirectMarkup}
  <style>${REDIRECT_PAGE_STYLES}
  </style>
</head>
<body>
  <main>
    <h1>${page.title}</h1>
    <p>${page.message}</p>
    <p>${page.helperText}</p>
    <a id="download-link" href="${escapedDestinationUrl}">${page.buttonLabel}</a>
  </main>
</body>
</html>
`
}
