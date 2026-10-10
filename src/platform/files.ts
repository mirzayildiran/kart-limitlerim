import { Capacitor } from '@capacitor/core'

/** True inside the iOS app (Capacitor), false in the browser and the installed PWA. */
export const isNativeApp = Capacitor.isNativePlatform()

/**
 * Hands a text file to the user. The browser downloads it; the iOS app, where
 * downloads do nothing, writes it to the cache and opens the share sheet
 * (Dosyalar'a kaydet, AirDrop, Mail…). Resolves false when the user closes the sheet.
 */
export async function saveTextFile(name: string, text: string, type: string): Promise<boolean> {
  if (isNativeApp) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ])
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ files: [uri] })
      return true
    } catch (e) {
      if (e instanceof Error && /cancel/i.test(e.message)) return false
      throw e
    }
  }

  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has started the download; some browsers read the URL late.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
