//
// (c) Copyright Ascensio System SIA 2025
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

// @ts-check

/**
 * Renders the Mermaid diagrams of a page.
 *
 * The library is vendored, and the script is included by the plugin on every
 * page, so that the diagrams can be rendered everywhere the contents are
 * shown: the diagrams are the elements with the "mermaid" class, including the
 * code fences of the Markdown contents, which are converted here.
 *
 * The library is loaded only when the page has a diagram.
 *
 * [Local Reference](../../app/views/onlyoffice/_mermaid.html.erb)
 */
(function () {
  "use strict"

  const script = /** @type {HTMLScriptElement | null} */ (
    document.currentScript || document.querySelector("script[data-mermaid]")
  )
  const url = script?.dataset.mermaid || ""
  const sourceLabel = script?.dataset.sourceLabel || "Diagram source"
  const fences = ["mermaid", "mmd"]

  /** @type {Promise<any> | null} */
  let pending = null

  /**
   * @returns {any}
   */
  function library() {
    return /** @type {any} */ (window).mermaid
  }

  /**
   * Loads the library if it is not a part of the page yet.
   *
   * @returns {Promise<any>}
   */
  function ensure() {
    if (library()) return Promise.resolve(library())
    if (pending) return pending
    if (!url) return Promise.resolve(null)

    pending = new Promise((resolve) => {
      const element = document.createElement("script")
      element.src = url
      element.addEventListener("load", () => resolve(library()))
      element.addEventListener("error", () => resolve(null))
      document.head.appendChild(element)
    })

    return pending
  }

  /**
   * @param {HTMLElement} element
   * @returns {Promise<boolean>}
   */
  async function render(element) {
    const mermaid = await ensure()
    if (!mermaid) return false

    const source = (element.textContent || "").trim()
    if (source === "") return false

    // The library marks the rendered elements, so they are reset to be able to
    // render the edited source again.
    element.removeAttribute("data-processed")
    element.textContent = source

    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" })
    try {
      await mermaid.run({ nodes: [element], suppressErrors: true })
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  /**
   * The language of a code fence, which depends on the renderer of the
   * contents.
   *
   * @param {Element} code
   * @returns {string}
   */
  function fenceLanguage(code) {
    const attribute = (code.getAttribute("data-language") || "").toLowerCase()
    if (attribute !== "") return attribute

    const match = /(?:^|\s)language-([\w+-]+)/.exec(code.className || "")
    return match ? match[1].toLowerCase() : ""
  }

  /**
   * Replaces the code fences of the diagrams with the diagram elements.
   *
   * @returns {void}
   */
  function convertFences() {
    document.querySelectorAll("pre > code").forEach((code) => {
      if (!fences.includes(fenceLanguage(code))) return

      const pre = code.closest("pre")
      if (!pre || !pre.parentElement) return

      // The code blocks are wrapped with a container which holds the button
      // which copies the code.
      const source = pre.parentElement.classList.contains("pre-wrapper")
        ? pre.parentElement
        : pre
      const text = code.textContent || ""

      const diagram = document.createElement("div")
      diagram.className = "onlyoffice-mermaid"

      const canvas = document.createElement("div")
      canvas.className = "mermaid"
      canvas.textContent = text
      diagram.appendChild(canvas)

      const details = document.createElement("details")
      details.className = "onlyoffice-mermaid__source"

      const summary = document.createElement("summary")
      summary.textContent = sourceLabel

      const block = document.createElement("pre")
      block.textContent = text

      details.append(summary, block)
      diagram.appendChild(details)

      source.replaceWith(diagram)
    })
  }

  /**
   * @returns {Promise<void>}
   */
  async function renderAll() {
    const nodes = Array.from(document.querySelectorAll(".mermaid")).filter(
      (node) => node.getAttribute("data-processed") !== "true"
    )
    if (nodes.length === 0) return

    const mermaid = await ensure()
    if (!mermaid) return

    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" })
    try {
      await mermaid.run({ nodes, suppressErrors: true })
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async function setup() {
    convertFences()
    await renderAll()
  }

  /** @type {any} */ (window).OnlyOfficeMermaid = {
    ensure,
    render,
    renderAll,
    setup
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      setup()
    })
  } else {
    setup()
  }
})()
