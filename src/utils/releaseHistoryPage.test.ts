import { buildReleaseHistoryPage } from './releaseHistoryPage'

describe('buildReleaseHistoryPage', () => {
  it('renders markdown notes into separate stable and alpha panels with stable selected by default', () => {
    const html = buildReleaseHistoryPage([
      {
        assets: [
          {
            browser_download_url: 'https://example.com/Tolaria.dmg',
            name: 'Tolaria.dmg',
          },
        ],
        body: '## Highlights\n\n- Faster startup\n- Better release notes',
        body_html: '<h2>Highlights</h2><ul><li>Faster startup</li><li>Better release notes</li></ul>',
        html_url: 'https://github.com/refactoringhq/tolaria/releases/tag/stable-v2026.4.19',
        name: 'Tolaria Stable 2026.4.19',
        prerelease: false,
        published_at: '2026-04-19T11:00:00Z',
        tag_name: 'stable-v2026.4.19',
      },
      {
        assets: [
          {
            browser_download_url: 'https://example.com/Tolaria.app.tar.gz',
            name: 'Tolaria.app.tar.gz',
          },
        ],
        body: '**Alpha** notes with [details](https://example.com/details).',
        body_html: '<p><strong>Alpha</strong> notes with <a href="https://example.com/details">details</a>.</p>',
        html_url: 'https://github.com/refactoringhq/tolaria/releases/tag/2026.4.19-alpha.1',
        name: 'Alpha 2026.4.19.1',
        prerelease: true,
        published_at: '2026-04-19T10:00:00Z',
        tag_name: '2026.4.19-alpha.1',
      },
    ])

    expect(html).toContain('role="tablist"')
    expect(html).toContain('id="tab-stable"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('data-release-panel="alpha" hidden')
    expect(html).toContain('<h2>Highlights</h2>')
    expect(html).toContain('<li>Faster startup</li>')
    expect(html).toContain('<strong>Alpha</strong> notes')
    expect(html).toContain('Tolaria.app.tar.gz')
    expect(html).toContain('View on GitHub')
  })

  it('falls back to escaped paragraph markup when rendered html is unavailable', () => {
    const html = buildReleaseHistoryPage([
      {
        body: 'First paragraph\nwith a line break.\n\nSecond paragraph',
        name: 'Fallback release',
        prerelease: false,
        published_at: '2026-04-19T11:00:00Z',
        tag_name: 'stable-v2026.4.19',
      },
    ])

    expect(html).toContain('<p>First paragraph<br>with a line break.</p><p>Second paragraph</p>')
  })

  it('filters draft releases and shows an empty state for channels without published builds', () => {
    const html = buildReleaseHistoryPage([
      {
        body: 'Draft release',
        draft: true,
        name: 'Draft release',
        prerelease: false,
        published_at: '2026-04-19T11:00:00Z',
        tag_name: 'stable-v2026.4.19',
      },
    ])

    expect(html).not.toContain('Draft release')
    expect(html).toContain('No stable releases published yet.')
    expect(html).toContain('No alpha releases published yet.')
  })
})
