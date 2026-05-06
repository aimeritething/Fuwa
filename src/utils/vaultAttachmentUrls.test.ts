import { describe, expect, it } from 'vitest'
import { isVaultAttachmentUrl, resolveVaultAttachmentPath } from './vaultAttachmentUrls'

describe('resolveVaultAttachmentPath', () => {
  it('resolves relative attachment URLs inside the active vault', () => {
    expect(resolveVaultAttachmentPath({ url: 'attachments/report.pdf', vaultPath: '/vault' })).toBe(
      '/vault/attachments/report.pdf',
    )
  })

  it('resolves encoded Tauri asset URLs inside the active vault', () => {
    expect(
      resolveVaultAttachmentPath({
        url: 'asset://localhost/%2Fvault%2Fattachments%2Freport.pdf',
        vaultPath: '/vault',
      }),
    ).toBe('/vault/attachments/report.pdf')
  })

  it('rejects asset URLs outside the active vault', () => {
    expect(
      resolveVaultAttachmentPath({
        url: 'asset://localhost/%2Fother%2Fattachments%2Freport.pdf',
        vaultPath: '/vault',
      }),
    ).toBeNull()
  })

  it('rejects unsafe relative attachment traversal', () => {
    expect(
      resolveVaultAttachmentPath({
        url: 'attachments/../secret.pdf',
        vaultPath: '/vault',
      }),
    ).toBeNull()
  })

  it('keeps Windows vault paths case-insensitive and separator-safe', () => {
    expect(
      resolveVaultAttachmentPath({
        url: 'asset://localhost/C%3A%5CVault%5Cattachments%5CReport.pdf',
        vaultPath: 'c:\\vault',
      }),
    ).toBe('C:\\Vault\\attachments\\Report.pdf')
  })

  it('identifies attachment URLs before falling back to external link handling', () => {
    expect(isVaultAttachmentUrl({ url: 'attachments/report.pdf' })).toBe(true)
    expect(
      isVaultAttachmentUrl({
        url: 'asset://localhost/%2Fvault%2Fattachments%2Freport.pdf',
      }),
    ).toBe(true)
    expect(isVaultAttachmentUrl({ url: 'https://example.com/report.pdf' })).toBe(false)
  })
})
