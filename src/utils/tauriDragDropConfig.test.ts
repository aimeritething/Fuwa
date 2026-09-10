import { readFileSync } from 'node:fs'

describe('Tauri drag/drop configuration', () => {
  it('keeps native drag-drop enabled so dropped files arrive through the tauri://drag-drop event', () => {
    const config = JSON.parse(readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, 'utf8'))

    expect(config.app.windows[0].dragDropEnabled).toBe(true)
  })
})
