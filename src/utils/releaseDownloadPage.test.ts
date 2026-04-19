import {
  buildStableDownloadRedirectPage,
  extractStableDmgUrl,
  extractStableDmgUrlFromReleases,
  resolveStableDmgUrl,
} from './releaseDownloadPage'

describe('extractStableDmgUrl', () => {
  it('returns the stable dmg url when present', () => {
    expect(
      extractStableDmgUrl({
        platforms: {
          'darwin-aarch64': {
            dmg_url: 'https://example.com/Tolaria.dmg',
          },
        },
      }),
    ).toBe('https://example.com/Tolaria.dmg')
  })

  it('returns null when the stable dmg url is missing', () => {
    expect(
      extractStableDmgUrl({
        platforms: {
          'darwin-aarch64': {
            url: 'https://example.com/Tolaria.app.tar.gz',
          },
        },
      }),
    ).toBeNull()
  })
})

describe('buildStableDownloadRedirectPage', () => {
  it('builds a redirect page when a stable dmg exists', () => {
    const html = buildStableDownloadRedirectPage('https://example.com/Tolaria.dmg')

    expect(html).toContain('Tolaria Stable Download')
    expect(html).toContain('window.location.replace("https://example.com/Tolaria.dmg");')
    expect(html).toContain('Download latest stable DMG')
    expect(html).toContain('meta http-equiv="refresh"')
  })

  it('builds a fallback page when no stable dmg exists yet', () => {
    const html = buildStableDownloadRedirectPage(null)

    expect(html).toContain('Tolaria Stable Download Unavailable')
    expect(html).toContain('View release history')
    expect(html).toContain('https://refactoringhq.github.io/tolaria/')
    expect(html).not.toContain('window.location.replace(')
  })
})

describe('resolveStableDmgUrl', () => {
  it('falls back to the latest stable github release dmg when latest.json has no dmg url', () => {
    const latestPayload = {
      platforms: {
        'darwin-aarch64': {
          url: 'https://example.com/Tolaria.app.tar.gz',
        },
      },
    }
    const releasesPayload = [
      {
        prerelease: true,
        assets: [
          {
            name: 'Tolaria-alpha.dmg',
            browser_download_url: 'https://example.com/alpha.dmg',
          },
        ],
      },
      {
        prerelease: false,
        assets: [
          {
            name: 'Tolaria.dmg',
            browser_download_url: 'https://example.com/stable.dmg',
          },
        ],
      },
    ]

    expect(extractStableDmgUrlFromReleases(releasesPayload)).toBe('https://example.com/stable.dmg')
    expect(resolveStableDmgUrl(latestPayload, releasesPayload)).toBe('https://example.com/stable.dmg')
  })
})
