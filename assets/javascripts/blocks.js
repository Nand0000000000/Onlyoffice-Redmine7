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
 * The block editor of the plugin.
 *
 * The documents are stored as Markdown: it is parsed into blocks when the
 * editor is opened and written back when the document is saved.
 *
 * [Local Reference](../../app/views/onlyoffice/blocks.rb)
 */
(async function () {
  "use strict"

  /**
   * @typedef {Object} Block
   * @property {string} type
   * @property {string} text
   * @property {boolean} [checked]
   * @property {string} [language]
   */

  /**
   * @typedef {Object} Labels
   * @property {string} error
   * @property {string} modified
   * @property {string} placeholder
   * @property {string} saved
   * @property {string} saving
   */

  /**
   * The state of the editor.
   */
  const State = {
    /** @type {HTMLElement | null} */
    root: null,
    /** @type {HTMLElement | null} */
    container: null,
    /** @type {HTMLElement | null} */
    toolbar: null,
    /** @type {HTMLElement | null} */
    status: null,
    /** @type {HTMLTextAreaElement | null} */
    source: null,
    /** @type {string} */
    saveUrl: "",
    /** @type {Labels} */
    labels: {
      error: "",
      modified: "",
      placeholder: "",
      saved: "",
      saving: ""
    },
    /** @type {boolean} */
    modified: false
  }

  /**
   * @returns {void}
   */
  function setup() {
    const root = /** @type {HTMLElement | null} */ (
      document.querySelector(".onlyoffice-blocks")
    )
    if (!root) return

    State.root = root
    State.saveUrl = root.dataset.saveUrl || ""
    State.labels = JSON.parse(
      root.dataset.labels || "{}"
    )
    State.container = /** @type {HTMLElement | null} */ (
      root.querySelector("[data-blocks]")
    )
    State.toolbar = /** @type {HTMLElement | null} */ (
      root.querySelector(".onlyoffice-blocks__toolbar")
    )
    State.status = /** @type {HTMLElement | null} */ (
      root.querySelector("[data-status]")
    )
    State.source = /** @type {HTMLTextAreaElement | null} */ (
      root.querySelector("[data-source]")
    )

    if (!State.container || !State.source) return

    render(parse(State.source.value))
    setupToolbar()
    setupEditing()
    setupSaving()
  }

  /* ------------------------------------------------------------------ */
  /* Markdown                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * @param {string} text
   * @returns {string}
   */
  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function escapeMarkdown(text) {
    return text.replace(/([\\`*_~[\]])/g, "\\$1")
  }

  /**
   * Renders the inline Markdown of a block as HTML.
   *
   * @param {string} text
   * @returns {string}
   */
  function inlineToHtml(text) {
    let html = ""
    let index = 0

    while (index < text.length) {
      const char = text[index]

      if (char === "\\" && index + 1 < text.length) {
        html += escapeHtml(text[index + 1])
        index += 2
        continue
      }

      if (char === "`") {
        const end = text.indexOf("`", index + 1)
        if (end > index + 1) {
          html += `<code>${escapeHtml(text.slice(index + 1, end))}</code>`
          index = end + 1
          continue
        }
      }

      if (text.startsWith("**", index) || text.startsWith("__", index)) {
        const marker = text.slice(index, index + 2)
        const end = text.indexOf(marker, index + 2)
        if (end > index + 2) {
          html += `<strong>${inlineToHtml(text.slice(index + 2, end))}</strong>`
          index = end + 2
          continue
        }
      }

      if (text.startsWith("~~", index)) {
        const end = text.indexOf("~~", index + 2)
        if (end > index + 2) {
          html += `<del>${inlineToHtml(text.slice(index + 2, end))}</del>`
          index = end + 2
          continue
        }
      }

      if (char === "*" || char === "_") {
        const end = text.indexOf(char, index + 1)
        if (end > index + 1) {
          html += `<em>${inlineToHtml(text.slice(index + 1, end))}</em>`
          index = end + 1
          continue
        }
      }

      if (char === "[") {
        const match = /^\[([^\]]*)\]\(([^)]*)\)/.exec(text.slice(index))
        if (match) {
          html += `<a href="${escapeHtml(match[2])}">${inlineToHtml(match[1])}</a>`
          index += match[0].length
          continue
        }
      }

      html += escapeHtml(char)
      index += 1
    }

    return html
  }

  /**
   * Renders the inline HTML of a block as Markdown.
   *
   * @param {Node} node
   * @returns {string}
   */
  function inlineToMarkdown(node) {
    let markdown = ""

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        markdown += escapeMarkdown(
          (child.nodeValue || "").replace(/\u00a0/g, " ")
        )
        return
      }

      if (child.nodeType !== Node.ELEMENT_NODE) return

      const element = /** @type {HTMLElement} */ (child)
      const tag = element.tagName.toLowerCase()
      const inner = inlineToMarkdown(element)

      switch (tag) {
        case "strong":
        case "b":
          markdown += inner.trim() === "" ? inner : `**${inner}**`
          break
        case "em":
        case "i":
          markdown += inner.trim() === "" ? inner : `*${inner}*`
          break
        case "del":
        case "s":
        case "strike":
          markdown += inner.trim() === "" ? inner : `~~${inner}~~`
          break
        case "code":
          markdown += `\`${element.textContent || ""}\``
          break
        case "a":
          markdown += `[${inner}](${element.getAttribute("href") || ""})`
          break
        case "br":
          markdown += "\n"
          break
        default:
          markdown += inner
      }
    })

    return markdown
  }

  /**
   * @param {string} markdown
   * @returns {Block[]}
   */
  function parse(markdown) {
    /** @type {string[]} */
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
    /** @type {Block[]} */
    const blocks = []
    /** @type {Block | null} */
    let paragraph = null

    /** @returns {void} */
    function flush() {
      if (paragraph) {
        blocks.push(paragraph)
        paragraph = null
      }
    }

    let index = 0
    while (index < lines.length) {
      const line = lines[index]
      /** @type {RegExpExecArray | null} */
      let match = null

      if (/^```/.test(line)) {
        flush()
        const language = line.replace(/^```/, "").trim()
        /** @type {string[]} */
        const body = []
        index += 1
        while (index < lines.length && !/^```\s*$/.test(lines[index])) {
          body.push(lines[index])
          index += 1
        }
        if (index < lines.length) index += 1
        blocks.push({ type: "code", text: body.join("\n"), language })
        continue
      }

      if (/^\s*$/.test(line)) {
        flush()
        index += 1
        continue
      }

      match = /^(#{1,6})\s+(.*)$/.exec(line)
      if (match) {
        flush()
        const level = Math.min(match[1].length, 6)
        blocks.push({ type: `heading${level}`, text: match[2].trim() })
        index += 1
        continue
      }

      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flush()
        blocks.push({ type: "divider", text: "" })
        index += 1
        continue
      }

      match = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line)
      if (match) {
        flush()
        blocks.push({
          type: "todo",
          text: match[2],
          checked: match[1].toLowerCase() === "x"
        })
        index += 1
        continue
      }

      match = /^\s*[-*+]\s+(.*)$/.exec(line)
      if (match) {
        flush()
        blocks.push({ type: "bulleted", text: match[1] })
        index += 1
        continue
      }

      match = /^\s*\d+[.)]\s+(.*)$/.exec(line)
      if (match) {
        flush()
        blocks.push({ type: "numbered", text: match[1] })
        index += 1
        continue
      }

      match = /^\s*>\s?(.*)$/.exec(line)
      if (match) {
        flush()
        blocks.push({ type: "quote", text: match[1] })
        index += 1
        continue
      }

      if (/^\s*\|/.test(line)) {
        flush()
        /** @type {string[]} */
        const body = []
        while (index < lines.length && /^\s*\|/.test(lines[index])) {
          body.push(lines[index])
          index += 1
        }
        blocks.push({ type: "raw", text: body.join("\n") })
        continue
      }

      if (paragraph) {
        paragraph.text = `${paragraph.text} ${line.trim()}`.trim()
      } else {
        paragraph = { type: "paragraph", text: line.trim() }
      }
      index += 1
    }

    flush()

    if (blocks.length === 0) {
      blocks.push({ type: "paragraph", text: "" })
    }

    return blocks
  }

  /**
   * @param {Block[]} blocks
   * @returns {string}
   */
  function serialize(blocks) {
    let markdown = ""
    /** @type {string | null} */
    let previous = null
    let number = 0

    blocks.forEach((block) => {
      if (block.type === "numbered") {
        number = previous === "numbered" ? number + 1 : 1
      }

      /** @type {string} */
      let line = block.text
      switch (block.type) {
        case "heading1":
        case "heading2":
        case "heading3":
        case "heading4":
        case "heading5":
        case "heading6":
          line = `${"#".repeat(Number(block.type.slice(-1)))} ${block.text}`
          break
        case "bulleted":
          line = `- ${block.text}`
          break
        case "numbered":
          line = `${number}. ${block.text}`
          break
        case "todo":
          line = `- [${block.checked ? "x" : " "}] ${block.text}`
          break
        case "quote":
          line = block.text === "" ? ">" : `> ${block.text}`
          break
        case "code":
          line = `\`\`\`${block.language || ""}\n${block.text}\n\`\`\``
          break
        case "divider":
          line = "---"
          break
        default:
          line = block.text
      }

      const list = ["bulleted", "numbered", "todo"].includes(block.type)

      if (markdown === "") {
        markdown = line
      } else if (list && block.type === previous) {
        markdown += `\n${line}`
      } else {
        markdown += `\n\n${line}`
      }

      previous = block.type
    })

    return `${markdown}\n`
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * @param {Block[]} blocks
   * @returns {void}
   */
  function render(blocks) {
    if (!State.container) return

    State.container.innerHTML = ""
    blocks.forEach((block, position) => {
      State.container?.appendChild(renderBlock(block, position))
    })
    refreshNumbering()
  }

  /**
   * @param {Block} block
   * @param {number} position
   * @returns {HTMLElement}
   */
  function renderBlock(block, position) {
    const element = document.createElement("div")
    element.className = "onlyoffice-blocks__block"
    element.dataset.type = block.type
    if (block.language) element.dataset.language = block.language
    if (block.type === "divider") {
      element.classList.add("onlyoffice-blocks__block--divider")
    }

    const handle = document.createElement("button")
    handle.type = "button"
    handle.className = "onlyoffice-blocks__handle"
    handle.draggable = true
    handle.title = "Drag to move"
    handle.textContent = "⠿"
    element.appendChild(handle)

    if (block.type === "divider") {
      const rule = document.createElement("hr")
      rule.className = "onlyoffice-blocks__divider"
      element.appendChild(rule)
      return element
    }

    if (block.type === "todo") {
      const checkbox = document.createElement("input")
      checkbox.type = "checkbox"
      checkbox.className = "onlyoffice-blocks__checkbox"
      checkbox.checked = Boolean(block.checked)
      checkbox.addEventListener("change", () => {
        element.classList.toggle("onlyoffice-blocks__block--checked", checkbox.checked)
        markModified()
      })
      element.classList.toggle("onlyoffice-blocks__block--checked", checkbox.checked)
      element.appendChild(checkbox)
    }

    if (block.type === "bulleted" || block.type === "numbered") {
      const marker = document.createElement("span")
      marker.className = "onlyoffice-blocks__marker"
      marker.textContent = block.type === "bulleted" ? "•" : "1."
      element.appendChild(marker)
    }

    const body = document.createElement("div")
    body.className = "onlyoffice-blocks__body"
    body.contentEditable = "true"
    body.spellcheck = true

    if (block.type === "code" || block.type === "raw") {
      body.classList.add("onlyoffice-blocks__code")
      body.textContent = block.text
    } else {
      body.innerHTML = inlineToHtml(block.text)
    }

    if (block.type === "paragraph" && position === 0) {
      body.dataset.placeholder = State.labels.placeholder
    }

    element.appendChild(body)

    return element
  }

  /**
   * Updates the markers of the numbered lists.
   *
   * @returns {void}
   */
  function refreshNumbering() {
    if (!State.container) return

    const blocks = Array.from(State.container.children)
    let number = 0

    blocks.forEach((block, index) => {
      const element = /** @type {HTMLElement} */ (block)
      if (element.dataset.type !== "numbered") {
        number = 0
        return
      }

      const previous = index > 0
        ? /** @type {HTMLElement} */ (blocks[index - 1]).dataset.type
        : null
      number = previous === "numbered" ? number + 1 : 1

      const marker = element.querySelector(".onlyoffice-blocks__marker")
      if (marker) marker.textContent = `${number}.`
    })
  }

  /**
   * @returns {Block[]}
   */
  function readBlocks() {
    if (!State.container) return []

    return Array.from(State.container.children).map((child) => {
      const element = /** @type {HTMLElement} */ (child)
      const type = element.dataset.type || "paragraph"
      /** @type {Block} */
      const block = { type, text: "" }

      if (type === "divider") return block

      const body = element.querySelector(".onlyoffice-blocks__body")
      if (!body) return block

      if (type === "code" || type === "raw") {
        block.text = body.textContent || ""
        if (type === "code") block.language = element.dataset.language || ""
        return block
      }

      block.text = inlineToMarkdown(body).trim()

      if (type === "todo") {
        const checkbox = element.querySelector(
          "input[type=checkbox]"
        )
        block.checked = checkbox instanceof HTMLInputElement && checkbox.checked
      }

      return block
    })
  }

  /* ------------------------------------------------------------------ */
  /* Editing                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * @returns {void}
   */
  function setupEditing() {
    if (!State.container) return

    State.container.addEventListener("keydown", handleKeyDown)
    State.container.addEventListener("input", handleInput)
    State.container.addEventListener("paste", handlePaste)
    State.container.addEventListener("dragstart", handleDragStart)
    State.container.addEventListener("dragover", handleDragOver)
    State.container.addEventListener("drop", handleDrop)
    State.container.addEventListener("dragend", handleDragEnd)
  }

  /**
   * @param {KeyboardEvent} event
   * @returns {void}
   */
  function handleKeyDown(event) {
    const body = targetBody(event.target)
    if (!body) return

    const block = blockOf(body)
    if (!block) return

    if (event.key === "Enter" && !event.shiftKey) {
      if (block.dataset.type === "code" || block.dataset.type === "raw") {
        event.preventDefault()
        document.execCommand("insertText", false, "\n")
        markModified()
        return
      }

      event.preventDefault()
      splitBlock(block, body)
      return
    }

    if (event.key === "Backspace" && isCaretAtStart(body)) {
      event.preventDefault()
      mergeBlock(block, body)
      return
    }

    if (event.key === "Tab") {
      event.preventDefault()
    }
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  function handleInput(event) {
    const body = targetBody(event.target)
    if (!body) return

    const block = blockOf(body)
    if (!block) return

    if (block.dataset.type === "paragraph") {
      applyShortcut(block, body)
    }

    markModified()
  }

  /**
   * Applies the Markdown shortcut which has been typed in a paragraph.
   *
   * @param {HTMLElement} block
   * @param {HTMLElement} body
   * @returns {void}
   */
  function applyShortcut(block, body) {
    const text = body.textContent || ""
    /** @type {Array<{pattern: RegExp, type: (match: RegExpExecArray) => string}>} */
    const shortcuts = [
      {
        pattern: /^(#{1,6})\s/,
        type: (match) => `heading${match[1].length}`
      },
      { pattern: /^[-*+]\s+\[[ xX]\]\s/, type: () => "todo" },
      { pattern: /^[-*+]\s+/, type: () => "bulleted" },
      { pattern: /^\d+[.)]\s/, type: () => "numbered" },
      { pattern: /^>\s/, type: () => "quote" },
      { pattern: /^```/, type: () => "code" },
      { pattern: /^---+$/, type: () => "divider" }
    ]

    for (const shortcut of shortcuts) {
      const match = shortcut.pattern.exec(text)
      if (!match) continue

      const type = shortcut.type(match)
      const rest = text.slice(match[0].length)

      if (type === "divider") {
        changeType(block, type)
        return
      }

      body.textContent = rest
      changeType(block, type)
      return
    }
  }

  /**
   * @param {HTMLElement} block
   * @param {HTMLElement} body
   * @returns {void}
   */
  function splitBlock(block, body) {
    const selection = window.getSelection()
    let after = ""

    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      if (body.contains(range.startContainer)) {
        const tail = range.cloneRange()
        tail.selectNodeContents(body)
        tail.setStart(range.endContainer, range.endOffset)

        const holder = document.createElement("div")
        holder.appendChild(tail.extractContents())
        after = holder.innerHTML
      }
    }

    /** @type {string} */
    let type = "paragraph"
    const current = block.dataset.type || "paragraph"
    const continues = ["bulleted", "numbered", "todo", "quote"].includes(current)
    if (continues && (after.trim() !== "" || body.textContent?.trim() !== "")) {
      type = current
    }

    const next = renderBlock({ type, text: "" }, 1)
    const nextBody = /** @type {HTMLElement | null} */ (
      next.querySelector(".onlyoffice-blocks__body")
    )

    if (nextBody) nextBody.innerHTML = after

    block.after(next)
    refreshNumbering()
    markModified()

    if (nextBody) placeCaretAtEnd(nextBody)
  }

  /**
   * @param {HTMLElement} block
   * @param {HTMLElement} body
   * @returns {void}
   */
  function mergeBlock(block, body) {
    if (!State.container) return

    const blocks = Array.from(State.container.children)
    const index = blocks.indexOf(block)

    if (blocks.length === 1) {
      changeType(block, "paragraph")
      body.textContent = ""
      markModified()
      return
    }

    if (index <= 0) return

    const previous = /** @type {HTMLElement} */ (blocks[index - 1])
    const previousBody = /** @type {HTMLElement | null} */ (
      previous.querySelector(".onlyoffice-blocks__body")
    )

    if (!previousBody) {
      return
    }

    const content = body.innerHTML
    if ((body.textContent || "").trim() !== "") {
      previousBody.insertAdjacentHTML("beforeend", content)
    }

    block.remove()
    refreshNumbering()
    markModified()
    placeCaretAtEnd(previousBody)
  }

  /**
   * @param {HTMLElement} block
   * @param {string} type
   * @returns {void}
   */
  function changeType(block, type) {
    const body = /** @type {HTMLElement | null} */ (
      block.querySelector(".onlyoffice-blocks__body")
    )
    const content = body ? body.innerHTML : ""

    let checked = false
    const checkbox = block.querySelector("input[type=checkbox]")
    if (checkbox instanceof HTMLInputElement) {
      checked = checkbox.checked
    }

    const replacement = renderBlock({ type, text: "", checked }, 0)
    const replacementBody = /** @type {HTMLElement | null} */ (
      replacement.querySelector(".onlyoffice-blocks__body")
    )

    if (replacementBody) replacementBody.innerHTML = content

    block.replaceWith(replacement)
    refreshNumbering()
    markModified()

    if (replacementBody) placeCaretAtEnd(replacementBody)
  }

  /* ------------------------------------------------------------------ */
  /* Toolbar                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * @returns {void}
   */
  function setupToolbar() {
    if (!State.toolbar) return

    // The focus must stay in the document while a toolbar button is pressed.
    State.toolbar.addEventListener("mousedown", (event) => {
      if (event.target instanceof Element && event.target.closest("button")) {
        event.preventDefault()
      }
    })

    State.toolbar.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return

      const button = event.target.closest("button")
      if (!button) return

      const block = activeBlock()
      if (!block) return

      if (button.dataset.type) {
        changeType(block, button.dataset.type)
        return
      }

      const inline = button.dataset.inline
      if (!inline) return

      const body = /** @type {HTMLElement | null} */ (
        block.querySelector(".onlyoffice-blocks__body")
      )
      if (!body) return

      body.focus()

      switch (inline) {
        case "bold":
          document.execCommand("bold")
          break
        case "italic":
          document.execCommand("italic")
          break
        case "strike":
          document.execCommand("strikeThrough")
          break
        case "code":
          wrapSelection("code")
          break
        case "link": {
          const url = window.prompt("URL", "https://")
          if (url) wrapSelection("a", { href: url })
          break
        }
      }

      markModified()
    })
  }

  /**
   * @param {string} tag
   * @param {Record<string, string>} [attributes]
   * @returns {void}
   */
  function wrapSelection(tag, attributes = {}) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) return

    const element = document.createElement(tag)
    Object.keys(attributes).forEach((name) => {
      element.setAttribute(name, attributes[name])
    })

    try {
      range.surroundContents(element)
    } catch (error) {
      element.textContent = selection.toString()
      range.deleteContents()
      range.insertNode(element)
    }

    const updated = document.createRange()
    updated.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(updated)
  }

  /* ------------------------------------------------------------------ */
  /* Drag and drop                                                       */
  /* ------------------------------------------------------------------ */

  /** @type {HTMLElement | null} */
  let dragged = null

  /**
   * @param {DragEvent} event
   * @returns {void}
   */
  function handleDragStart(event) {
    if (!(event.target instanceof Element)) return

    const handle = event.target.closest(".onlyoffice-blocks__handle")
    if (!handle) {
      event.preventDefault()
      return
    }

    const block = handle.closest(".onlyoffice-blocks__block")
    if (!(block instanceof HTMLElement)) return

    dragged = block
    block.classList.add("onlyoffice-blocks__block--dragging")

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", "")
    }
  }

  /**
   * @param {DragEvent} event
   * @returns {void}
   */
  function handleDragOver(event) {
    if (!dragged) return
    event.preventDefault()

    const target = dropTarget(event)
    /** @type {HTMLElement[]} */
    const blocks = State.container
      ? Array.from(State.container.children).map((child) => /** @type {HTMLElement} */ (child))
      : []

    blocks.forEach((block) => {
      block.classList.toggle(
        "onlyoffice-blocks__block--over",
        block === target && block !== dragged
      )
    })
  }

  /**
   * @param {DragEvent} event
   * @returns {void}
   */
  function handleDrop(event) {
    if (!dragged) return
    event.preventDefault()

    const target = dropTarget(event)
    if (target && target !== dragged) {
      const rect = target.getBoundingClientRect()
      const after = event.clientY > rect.top + rect.height / 2
      target.parentNode?.insertBefore(dragged, after ? target.nextSibling : target)
      refreshNumbering()
      markModified()
    }

    handleDragEnd()
  }

  /**
   * @returns {void}
   */
  function handleDragEnd() {
    if (dragged) {
      dragged.classList.remove("onlyoffice-blocks__block--dragging")
      dragged = null
    }

    if (!State.container) return
    Array.from(State.container.children).forEach((child) => {
      child.classList.remove("onlyoffice-blocks__block--over")
    })
  }

  /**
   * @param {DragEvent} event
   * @returns {HTMLElement | null}
   */
  function dropTarget(event) {
    if (!(event.target instanceof Element)) return null

    const block = event.target.closest(".onlyoffice-blocks__block")
    if (!(block instanceof HTMLElement)) return null

    return block
  }

  /* ------------------------------------------------------------------ */
  /* Saving                                                              */
  /* ------------------------------------------------------------------ */

  /**
   * @returns {void}
   */
  function setupSaving() {
    if (!State.root) return

    const button = State.root.querySelector("[data-action=save]")
    if (button instanceof HTMLElement) {
      button.addEventListener("click", () => save())
    }

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        save()
      }
    })

    window.addEventListener("beforeunload", (event) => {
      if (!State.modified) return
      event.preventDefault()
      event.returnValue = ""
    })
  }

  /**
   * @returns {void}
   */
  function save() {
    if (State.saveUrl === "") return

    setStatus(State.labels.saving)

    fetch(State.saveUrl, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken()
      },
      body: JSON.stringify({ content: serialize(readBlocks()) })
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then(() => {
        State.modified = false
        setStatus(State.labels.saved)
      })
      .catch(() => {
        setStatus(State.labels.error, true)
      })
  }

  /**
   * @returns {string}
   */
  function csrfToken() {
    const meta = document.querySelector("meta[name=csrf-token]")
    if (!(meta instanceof HTMLMetaElement)) return ""
    return meta.content
  }

  /**
   * @param {string} text
   * @param {boolean} [error]
   * @returns {void}
   */
  function setStatus(text, error = false) {
    if (!State.status) return

    State.status.textContent = text
    State.status.classList.toggle("onlyoffice-blocks__status--error", error)
  }

  /**
   * @returns {void}
   */
  function markModified() {
    if (State.modified) return

    State.modified = true
    setStatus(State.labels.modified)
  }

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * @param {string} text
   * @returns {void}
   */
  function insertText(text) {
    document.execCommand("insertText", false, text)
  }

  /**
   * @param {Event} event
   * @returns {void}
   */
  function handlePaste(event) {
    const body = targetBody(event.target)
    if (!body) return

    const clipboard = /** @type {ClipboardEvent} */ (event)
    const data = clipboard.clipboardData
    if (!data) return

    event.preventDefault()

    const text = data.getData("text/plain")
    if (!text) return

    const block = blockOf(body)
    const type = block?.dataset.type || "paragraph"

    if (type === "code" || type === "raw") {
      insertText(text)
      markModified()
      return
    }

    const lines = text.replace(/\r\n?/g, "\n").split("\n")
    insertText(lines[0])

    if (lines.length === 1) {
      markModified()
      return
    }

    /** @type {HTMLElement} */
    let last = body.parentElement || body
    lines.slice(1).forEach((line) => {
      const next = renderBlock({ type: "paragraph", text: line }, 1)
      last.after(next)
      last = next
    })

    const lastBody = /** @type {HTMLElement | null} */ (
      last.querySelector(".onlyoffice-blocks__body")
    )
    if (lastBody) placeCaretAtEnd(lastBody)

    markModified()
  }

  /**
   * @param {EventTarget | null} target
   * @returns {HTMLElement | null}
   */
  function targetBody(target) {
    if (!(target instanceof Element)) return null

    const body = target.closest(".onlyoffice-blocks__body")
    if (!(body instanceof HTMLElement)) return null

    return body
  }

  /**
   * @param {HTMLElement} body
   * @returns {HTMLElement | null}
   */
  function blockOf(body) {
    const block = body.closest(".onlyoffice-blocks__block")
    if (!(block instanceof HTMLElement)) return null

    return block
  }

  /**
   * @returns {HTMLElement | null}
   */
  function activeBlock() {
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const node = range.startContainer
      const element = node instanceof Element ? node : node.parentElement
      const block = element ? element.closest(".onlyoffice-blocks__block") : null
      if (block instanceof HTMLElement) return block
    }

    if (document.activeElement instanceof Element) {
      const block = document.activeElement.closest(".onlyoffice-blocks__block")
      if (block instanceof HTMLElement) return block
    }

    return null
  }

  /**
   * @param {HTMLElement} body
   * @returns {boolean}
   */
  function isCaretAtStart(body) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false

    const range = selection.getRangeAt(0)
    if (!range.collapsed) return false
    if (!body.contains(range.startContainer)) return false

    const before = range.cloneRange()
    before.selectNodeContents(body)
    before.setEnd(range.startContainer, range.startOffset)

    return before.toString().length === 0
  }

  /**
   * @param {HTMLElement} element
   * @returns {void}
   */
  function placeCaretAtEnd(element) {
    element.focus()

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)

    const selection = window.getSelection()
    if (!selection) return

    selection.removeAllRanges()
    selection.addRange(range)
  }

  main()

  /**
   * @returns {void}
   */
  function main() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setup)
    } else {
      setup()
    }
  }
})()
