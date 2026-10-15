/* Font licences dialog (presentation only). Renders the complete OFL notices as text
 * nodes only. Uses the native <dialog> element for focus and Escape handling. */
import { FONT_NOTICES } from "../../assets/fonts/notices.js"

export function mountLicenceDialog(doc = document) {
  const dialog = doc.createElement("dialog")
  dialog.id = "licenceDialog"
  dialog.className = "licence-dialog"
  dialog.setAttribute("aria-labelledby", "licenceDialogTitle")

  const title = doc.createElement("h2")
  title.id = "licenceDialogTitle"
  title.textContent = "Font licences"

  const intro = doc.createElement("p")
  intro.textContent =
    "The typefaces in this app are self-hosted and bundled unmodified. Each is licensed under the SIL Open Font License, Version 1.1."

  const body = doc.createElement("div")
  body.className = "licence-body"
  for (const notice of FONT_NOTICES) {
    const heading = doc.createElement("h3")
    heading.textContent = notice.family
    const pre = doc.createElement("pre")
    pre.textContent = notice.text
    body.append(heading, pre)
  }

  const close = doc.createElement("button")
  close.type = "button"
  close.className = "btn btn-ghost btn-sm"
  close.textContent = "Close"
  close.addEventListener("click", () => dialog.close())

  dialog.append(title, intro, body, close)
  doc.body.append(dialog)

  return {
    open() {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    },
    close() {
      dialog.close()
    },
    element: dialog,
  }
}
