import { STYLE_CATALOG_FOLDER, styleCatalogEntries } from './style-catalog'
import { createMockVault, MOCK_VAULT_PATH } from './vault-fixture'

describe('style catalog', () => {
  it('reads every Document and picture under style-catalog/ into entries below the catalog folder', () => {
    const entries = styleCatalogEntries()
    const documents = entries.filter((entry) => entry.content !== undefined)
    const pictures = entries.filter((entry) => entry.dataUrl !== undefined)

    expect(documents.length).toBeGreaterThan(0)
    expect(pictures.length).toBeGreaterThan(0)
    expect(entries.every((entry) => entry.relativePath.startsWith(`${STYLE_CATALOG_FOLDER}/`))).toBe(true)
    expect(documents.every((entry) => entry.relativePath.endsWith('.md') && entry.content !== '')).toBe(true)
    expect(pictures.every((entry) => entry.dataUrl?.startsWith('data:image/') && entry.fileSize > 0)).toBe(true)
  })

  it('keeps its paths ASCII, so the same directory opens anywhere as a real Folder', () => {
    // eslint-disable-next-line no-control-regex -- the ASCII range, spelled out
    expect(styleCatalogEntries().filter((entry) => !/^[\x00-\x7F]+$/u.test(entry.relativePath))).toEqual([])
  })

  it('is part of the default seed: its Documents open and its pictures are served', async () => {
    const vault = createMockVault()
    const listing = await vault.invoke('list_files', { vaultPath: MOCK_VAULT_PATH })
    const catalog = listing.filter((entry) => entry.path.startsWith(`${MOCK_VAULT_PATH}/${STYLE_CATALOG_FOLDER}/`))
    const document = catalog.find((entry) => entry.kind === 'note')
    const picture = catalog.find((entry) => entry.kind === 'image')

    expect(catalog.some((entry) => entry.kind === 'folder')).toBe(true)
    await expect(vault.invoke('get_note_content', { path: document?.path ?? '' })).resolves.toMatch(/^(---\n|# )/u)
    expect(vault.assetUrl(picture?.path ?? '')).toMatch(/^data:image\//u)
  })
})
