import {
  FieldType,
  PageInfo,
  SANDBOX_TITLE,
  SANDBOX_URL,
  ScannedField,
  ScannedForm,
  ScanResult,
} from "../types";

/* ------------------------------------------------------------------ */
/*  Type detection: map native input.type + CSS/class/ARIA patterns   */
/* ------------------------------------------------------------------ */

function mapInputType(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldType {
  if (el instanceof HTMLSelectElement) return "select";
  if (el instanceof HTMLTextAreaElement) return "textarea";
  const t = (el.type || "text").toLowerCase();
  const allowed: FieldType[] = [
    "text", "number", "email", "tel", "date",
    "time", "datetime-local", "month", "week",
    "color", "range",
    "checkbox", "radio",
    "password", "hidden",
    "url", "search",
  ];
  return (allowed.includes(t as FieldType) ? t : "other") as FieldType;
}

/** Scan an element's class, attributes, ancestors for component-type clues. */
function detectWidgetType(el: HTMLElement): FieldType {
  // Build a searchable string from element + closest container
  const container = el.closest<HTMLElement>(
    "[class*='picker'],[class*='autocomplete'],[class*='select'],[class*='tag'],[class*='editor'],[class*='slider'],[class*='range'],[class*='upload'],[class*='color'],[class*='rating'],[class*='toggle'],[class*='switch'],[class*='date'],[class*='time']"
  );
  const hay = [
    el.className,
    el.getAttribute("data-type") || "",
    el.getAttribute("data-widget") || "",
    el.getAttribute("data-component") || "",
    el.getAttribute("data-picker") || "",
    el.getAttribute("data-mode") || "",
    el.getAttribute("role") || "",
    el.getAttribute("aria-autocomplete") || "",
    container?.className || "",
  ].join(" ").toLowerCase();

  // Date / datetime / time
  if (/date(?:pick|range|time)?|calendar|flatpickr|pikaday|dayjs|moment|bootstrap-datepicker|jquery-datepicker|ui-datepicker|react-datepicker|ant.*date|el.*date|mui.*date|o_datepicker/.test(hay)) {
    if (/range/.test(hay)) return "text"; // date-range → text
    return "date";
  }
  if (/time(?:pick)?|clock/.test(hay)) return "text";

  // Autocomplete / combobox / typeahead
  if (/autocomplete|typeahead|combobox|suggest|search.*dropdown|ui-autocomplete|react-select|ant.*select|el.*select|select.*search|o-autocomplete/.test(hay))
    return "select";

  // Multi-select / tagging / tag input / chips
  if (/tag(?:s|ging|input)?|chip|token|multi.*select|pill|badge.*input/.test(hay))
    return "select";

  // Native datalist
  if (el.getAttribute("list")) return "text";

  // Select-like
  if (/dropdown|listbox|select|chosen|select2|selectize|dropdown.*menu/.test(hay))
    return "select";

  // Rich text / WYSIWYG editor
  if (/editor|wysiwyg|quill|tinymce|ckeditor|prosemirror|tiptap|summernote|froala|draft.*js|slate|contenteditable/.test(hay))
    return "textarea";

  // Number / spinner / slider / range
  if (/slider|range|spin.*button|num.*picker|quantity|stepper|antd.*slider|mui.*slider/.test(hay))
    return "number";
  if (/counter|increment|decrement/.test(hay)) return "number";

  // File upload / dropzone
  if (/upload|dropzone|file.*input|image.*upload|avatar.*upload/.test(hay)) return "other";

  // Color picker
  if (/color(?:pick)?|swatch/.test(hay)) return "text";

  // Rating / star
  if (/rating|star|score/.test(hay)) return "number";

  // Toggle / switch
  if (/toggle|switch/.test(hay)) return "checkbox";

  // Phone
  if (/phone|tel|mobile|whatsapp|sms/.test(hay)) return "tel";

  // Email
  if (/e-?mail/.test(hay)) return "email";

  // URL
  if (/url|website|link/.test(hay)) return "text";

  // Textarea-like (markdown, code, etc.)
  if (/textarea|code.*editor|monaco|codemirror|ace.*editor|markdown/.test(hay)) return "textarea";

  // ARIA roles fallback
  const role = (el.getAttribute("role") || "").toLowerCase();
  if (role === "combobox" || role === "listbox" || role === "searchbox") return "select";
  if (role === "spinbutton") return "number";
  if (role === "switch" || role === "checkbox") return "checkbox";
  if (role === "radio") return "radio";
  if (role === "textbox" || role === "search") return "text";
  if (role === "slider") return "number";
  if (role === "progressbar") return "other";

  return "text";
}

/* ------------------------------------------------------------------ */
/*  Label detection — walks DOM upward/sideways                        */
/* ------------------------------------------------------------------ */

function findLabel(el: HTMLElement, root: ParentNode): string {
  const id = el.id;
  if (id) {
    const byFor = root.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (byFor?.textContent) return byFor.textContent.trim().replace(/\s+/g, " ");
  }
  const parentLabel = el.closest("label");
  if (parentLabel?.textContent) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,select,textarea").forEach((n) => n.remove());
    const text = clone.textContent?.trim().replace(/\s+/g, " ");
    if (text) return text;
  }
  // Previous sibling
  let prev = el.previousElementSibling;
  if (prev && /^(LABEL|SPAN|DIV|P|H[1-6])$/.test(prev.tagName)) {
    const text = prev.textContent?.trim().replace(/\s+/g, " ");
    if (text && text.length < 120) return text;
  }
  // Walk up: check containers for label-like elements
  const ancestors = [el.parentElement, el.parentElement?.parentElement, el.parentElement?.parentElement?.parentElement].filter(Boolean) as HTMLElement[];
  for (const anc of ancestors) {
    const lbl = anc.querySelector(":scope > label, :scope > .label, :scope > [class*='label'], :scope > [class*='Label']");
    if (lbl?.textContent && lbl.textContent.trim().length < 120) return lbl.textContent.trim().replace(/\s+/g, " ");
    // data-label / aria-label on container
    const dl = anc.getAttribute("data-label") || anc.getAttribute("aria-label");
    if (dl) return dl.trim();
  }
  // Placeholder
  const ph = el.getAttribute("placeholder");
  if (ph) return ph;
  // aria-label
  const al = el.getAttribute("aria-label");
  if (al) return al;
  return el.getAttribute("name") || el.id || "Unnamed field";
}

/* ------------------------------------------------------------------ */
/*  Core scanner                                                       */
/* ------------------------------------------------------------------ */

export function scanDocument(
  doc: Document,
  url: string = SANDBOX_URL,
  title: string = SANDBOX_TITLE
): ScanResult {
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3"))
    .map((h) => h.textContent?.trim() || "")
    .filter(Boolean)
    .slice(0, 12);

  const descriptions = Array.from(doc.querySelectorAll("p, .form-hint, [data-description]"))
    .map((p) => p.textContent?.trim().replace(/\s+/g, " ") || "")
    .filter((t) => t.length > 20 && t.length < 280)
    .slice(0, 8);

  const pageInfo: PageInfo = {
    title: doc.title || title,
    url,
    headings,
    descriptions,
  };

  const formEls = Array.from(doc.querySelectorAll("form"));
  const forms: ScannedForm[] = formEls.map((form, index) => ({
    index,
    id: form.id || "",
    name: form.getAttribute("name") || "",
    action: form.getAttribute("action") || "",
    method: (form.getAttribute("method") || "get").toUpperCase(),
    fieldCount: form.querySelectorAll("input, select, textarea").length,
  }));

  const fields: ScannedField[] = [];
  const seen = new Set<Element>();
  let counter = 0;

  const pushField = (el: Element, formIndex: number) => {
    if (seen.has(el)) return;
    seen.add(el);

    let value = "";
    let checked: boolean | undefined;
    let options: string[] | undefined;

    if (el instanceof HTMLInputElement) {
      if (["submit", "button", "image", "reset"].includes(el.type)) return;
      if (el.type === "hidden") return;
      const type = mapInputType(el);
      if (el.type === "checkbox" || el.type === "radio") {
        checked = el.checked;
        value = el.value;
      } else {
        value = el.value;
      }
      const uid = `f-${formIndex}-${counter++}`;
      el.setAttribute("data-wsvs-uid", uid);
      fields.push({
        uid, formIndex, name: el.name, id: el.id, type,
        label: findLabel(el, doc),
        placeholder: el.placeholder || "",
        required: el.required || el.getAttribute("aria-required") === "true",
        options, value, checked,
      });
      return;
    }

    if (el instanceof HTMLSelectElement) {
      options = Array.from(el.options).map((o) => o.textContent?.trim() || o.value);
      const uid = `f-${formIndex}-${counter++}`;
      el.setAttribute("data-wsvs-uid", uid);
      fields.push({
        uid, formIndex, name: el.name, id: el.id, type: "select",
        label: findLabel(el, doc),
        placeholder: el.getAttribute("placeholder") || "",
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        options, value: el.value, checked,
      });
      return;
    }

    if (el instanceof HTMLTextAreaElement) {
      const uid = `f-${formIndex}-${counter++}`;
      el.setAttribute("data-wsvs-uid", uid);
      fields.push({
        uid, formIndex, name: el.name, id: el.id, type: "textarea",
        label: findLabel(el, doc),
        placeholder: el.placeholder || "",
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
        options, value: el.value, checked,
      });
      return;
    }

    // HTMLElement — detect widget type from CSS/ARIA/data attributes
    const type = detectWidgetType(el as HTMLElement);
    const htmlEl = el as HTMLElement;

    if (type === "checkbox") {
      checked = htmlEl.getAttribute("aria-checked") === "true"
        || htmlEl.classList.contains("active")
        || htmlEl.classList.contains("checked")
        || htmlEl.classList.contains("on");
    } else if (type === "select") {
      // Try to extract options from dropdown items
      const items = htmlEl.querySelectorAll<HTMLElement>(
        "[role='option'],.option,.dropdown-item,.select-item,.menu-item,.ant-select-item,.el-select-dropdown__item,[class*='option']"
      );
      if (items.length) {
        options = Array.from(items).map((i) => i.textContent?.trim() || "").filter(Boolean);
      }
      // Current value from display text
      value = htmlEl.querySelector<HTMLElement>(
        "[class*='display'],[class*='value'],[class*='selected'],[class*='single']"
      )?.textContent?.trim() || htmlEl.textContent?.trim()?.slice(0, 120) || "";
    } else {
      value = htmlEl.getAttribute("data-value")
        || htmlEl.getAttribute("aria-valuenow")
        || htmlEl.querySelector<HTMLInputElement>("input")?.value
        || htmlEl.textContent?.trim()?.slice(0, 200)
        || "";
    }

    const uid = `f-${formIndex}-${counter++}`;
    htmlEl.setAttribute("data-wsvs-uid", uid);
    fields.push({
      uid, formIndex,
      name: htmlEl.getAttribute("data-name") || htmlEl.getAttribute("name") || "",
      id: htmlEl.id || "",
      type,
      label: findLabel(htmlEl, doc),
      placeholder: htmlEl.getAttribute("placeholder") || htmlEl.getAttribute("aria-placeholder") || "",
      required: htmlEl.hasAttribute("aria-required") || htmlEl.hasAttribute("required"),
      options, value, checked,
    });
  };

  // 1. Standard inputs inside each form (or whole doc if no forms)
  const collectFrom = (root: ParentNode, formIndex: number) => {
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea"
    ).forEach((el) => pushField(el, formIndex));
  };

  if (formEls.length === 0) {
    collectFrom(doc, -1);
  } else {
    formEls.forEach((form, i) => collectFrom(form, i));
  }

  // 2. Widely-scanned widget containers & ARIA elements
  const widgetSelectors = [
    // Contenteditable & ARIA
    "[contenteditable='true']",
    "[role='combobox']", "[role='listbox']", "[role='searchbox']",
    "[role='spinbutton']", "[role='switch']", "[role='slider']",
    "[role='textbox']",
    // Date pickers
    "[class*='datepicker']", "[class*='date-picker']", "[class*='DatePicker']",
    "[class*='calendar']", "[class*='flatpickr']", "[class*='pikaday']",
    "[data-type='date']", "[data-type='datetime']", "[data-type='time']",
    "[data-widget='date']", "[data-component='DatePicker']",
    // Autocomplete / typeahead
    "[class*='autocomplete']", "[class*='typeahead']", "[class*='AutoComplete']",
    "[class*='combobox']", "[class*='Combobox']",
    "[data-widget='autocomplete']", "[data-component='AutoComplete']",
    // Multi-select / tags / chips
    "[class*='tag-input']", "[class*='tagging']", "[class*='TagInput']",
    "[class*='chip']", "[class*='Chip']", "[class*='token']",
    "[class*='multi-select']", "[class*='MultiSelect']",
    "[class*='react-select']", "[class*='ant-select']", "[class*='el-select']",
    "[class*='select2']", "[class*='Select2']",
    // Rich text editor / textarea widgets
    "[class*='editor']", "[class*='Editor']", "[class*='wysiwyg']",
    "[class*='quill']", "[class*='tinymce']", "[class*='ckeditor']",
    "[class*='prosemirror']", "[class*='tiptap']", "[class*='summernote']",
    "[class*='froala']", "[class*='monaco']", "[class*='CodeMirror']",
    "[data-component='Editor']",
    "[class*='textarea']", "[class*='TextArea']", "[class*='text-area']",
    "[class*='multiline']", "[class*='MultiLine']",
    "[data-component='TextArea']", "[data-widget='textarea']",
    "textarea",
    // Slider / range
    "[class*='slider']", "[class*='Slider']",
    "[class*='range']", "[class*='Range']",
    "[data-component='Slider']",
    // Upload / dropzone
    "[class*='upload']", "[class*='Upload']",
    "[class*='dropzone']", "[class*='Dropzone']",
    "[data-component='Upload']",
    // Color picker
    "[class*='color-picker']", "[class*='ColorPicker']",
    "[class*='colorpicker']",
    "[data-component='ColorPicker']",
    // Rating / star
    "[class*='rating']", "[class*='Rating']",
    "[class*='star']", "[class*='Star']",
    // Toggle / switch
    "[class*='toggle']", "[class*='Toggle']",
    "[class*='switch']", "[class*='Switch']",
    // Phone input
    "[class*='phone-input']", "[class*='PhoneInput']",
    "[data-type='phone']",
    // Generic framework field wrappers
    "[class*='field-wrapper']", "[class*='FieldWrapper']",
    "[class*='form-field']", "[class*='FormField']",
    "[class*='input-group']", "[class*='InputGroup']",
    "[data-field]", "[data-field-name]",
  ];

  // Use a broad selector to find potential widgets, then filter
  doc.querySelectorAll<HTMLElement>(widgetSelectors.join(",")).forEach((el) => {
    // Skip if it's a wrapper div with no interactive content
    if (!el.getAttribute("role") && !el.getAttribute("contenteditable")
        && !el.className && !el.getAttribute("data-type")
        && !el.getAttribute("data-widget") && !el.getAttribute("data-component")
        && !el.getAttribute("data-field")) return;
    // Skip if the element is itself an <input>/<select>/<textarea> (already collected)
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return;
    pushField(el, -1);
  });

  return { pageInfo, forms, fields, scannedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/*  Read / Write / Highlight                                           */
/* ------------------------------------------------------------------ */

export function readFieldValues(doc: Document, uids: string[]): Record<string, { value: string; checked?: boolean }> {
  const result: Record<string, { value: string; checked?: boolean }> = {};
  for (const uid of uids) {
    const el = doc.querySelector(`[data-wsvs-uid="${uid}"]`);
    if (!el) continue;
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      result[uid] = { value: el.value, checked: el.checked };
    } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      result[uid] = { value: el.value };
    } else {
      // Widget container — try inner input, else text content
      const inner = el.querySelector<HTMLInputElement>("input");
      if (inner) {
        result[uid] = { value: inner.value };
      } else {
        result[uid] = { value: el.textContent?.trim() || "" };
      }
    }
  }
  return result;
}

/** Set value on a native input bypassing React/framework wrappers. */
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, val: string) {
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, val);
  else el.value = val;
}

/** Click an element and dispatch mouse events that frameworks listen to. */
function realClick(el: Element) {
  for (const type of ["mousedown", "mouseup", "click"]) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
}

/** Format value for specific native input types. */
function formatForInputType(type: string, val: string): string {
  if (type === "date") {
    // Accept DD-MM-YYYY or YYYY-MM-DD → convert to YYYY-MM-DD
    const dmy = val.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
    const ymd = val.match(/^\d{4}-\d{2}-\d{2}$/);
    if (ymd) return val;
    return val;
  }
  if (type === "time") {
    // Accept HH:MM or HH:MM:SS
    return /^\d{2}:\d{2}(:\d{2})?$/.test(val) ? val : "12:00";
  }
  if (type === "datetime-local") {
    // Accept YYYY-MM-DDTHH:MM
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(val)) return val;
    return "2026-01-01T12:00";
  }
  if (type === "month") {
    // Accept YYYY-MM
    if (/^\d{4}-\d{2}$/.test(val)) return val;
    return "2026-01";
  }
  if (type === "week") {
    // Accept YYYY-Www
    return val;
  }
  if (type === "color") {
    // Ensure hex color
    if (/^#[0-9a-fA-F]{3,8}$/.test(val)) return val;
    return "#3b82f6";
  }
  if (type === "range") {
    return val;
  }
  return val;
}

/** Find the best matching option text inside a dropdown. */
function findBestOption(container: HTMLElement, val: string): HTMLElement | null {
  const opts = container.querySelectorAll<HTMLElement>(
    "[role='option'],.option,.dropdown-item,.select-item,.menu-item,"
    + ".ant-select-item,.el-select-dropdown__item,[class*='option'],[class*='Option'],"
    + "[class*='item']:not([class*='disabled']):not([class*='header']),"
    + "li,[data-value]"
  );
  const v = val.toLowerCase();
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const opt of opts) {
    const text = (opt.textContent || "").trim().toLowerCase();
    const dv = (opt.getAttribute("data-value") || "").toLowerCase();
    if (text === v || dv === v) { best = opt; break; }
    if (text.includes(v) || v.includes(text)) {
      const score = Math.min(text.length, v.length) / Math.max(text.length, v.length);
      if (score > bestScore) { bestScore = score; best = opt; }
    }
  }
  return best || (opts.length > 0 ? opts[0] : null);
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function applySimulation(
  doc: Document,
  mapping: Array<{ uid: string; value: string | boolean }>,
  onProgress?: (uid: string, index: number, total: number) => void,
): Promise<string[]> {
  const applied: string[] = [];
  const total = mapping.length;
  for (let i = 0; i < total; i++) {
    const item = mapping[i];
    const el = doc.querySelector(`[data-wsvs-uid="${item.uid}"]`);
    if (!el) {
      onProgress?.(item.uid, i + 1, total);
      continue;
    }

    el.classList.remove("field-highlight");
    el.classList.add("field-simulated");

    // ── Native checkbox / radio → click() ──
    if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      if (el.checked !== Boolean(item.value)) realClick(el);
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    // ── Native <select> → set matched option + change event ──
    if (el instanceof HTMLSelectElement) {
      const val = String(item.value);
      const opts = Array.from(el.options);
      const match = opts.find(
        (o) => o.value === val || o.textContent?.trim().toLowerCase() === val.toLowerCase()
      );
      if (match) {
        el.value = match.value;
      } else if (opts.length > 0) {
        el.value = opts[0].value;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    // ── Native <input> / <textarea> → formatted value + React-safe setter ──
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      const raw = String(item.value);
      const formatted = el instanceof HTMLInputElement ? formatForInputType(el.type, raw) : raw;
      setNativeValue(el, formatted);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.dispatchEvent(new Event("blur", { bubbles: true }));
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    // ── Widget container: autocomplete / dropdown / select / contenteditable ──
    const val = String(item.value);
    const htmlEl = el as HTMLElement;

    // Strategy 1: find a matching option and click it
    const option = findBestOption(htmlEl, val);
    if (option) {
      const trigger = htmlEl.querySelector<HTMLElement>(
        "[class*='trigger'],[class*='control'],[class*='single'],[class*='display'],"
        + "[class*='selection'],[class*='placeholder'],[class*='value'],"
        + "[class*='Toggle'],[class*='arrow'],button,[role='combobox']"
      );
      if (trigger) realClick(trigger);
      await delay(300);
      realClick(option);
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    // Strategy 2: set inner input directly
    const inner = htmlEl.querySelector<HTMLInputElement>("input");
    if (inner) {
      inner.focus();
      setNativeValue(inner, val);
      inner.dispatchEvent(new Event("input", { bubbles: true }));
      inner.dispatchEvent(new Event("change", { bubbles: true }));
      inner.blur();
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    // Strategy 3: contenteditable
    if (htmlEl.getAttribute("contenteditable") === "true") {
      htmlEl.textContent = val;
      htmlEl.dispatchEvent(new Event("input", { bubbles: true }));
      applied.push(item.uid);
      onProgress?.(item.uid, i + 1, total);
      if (i < total - 1) await delay(1200);
      continue;
    }

    applied.push(item.uid);
    onProgress?.(item.uid, i + 1, total);
    if (i < total - 1) await delay(1200);
  }
  return applied;
}

export function highlightField(doc: Document, uid: string): boolean {
  doc.querySelectorAll(".field-highlight").forEach((n) => n.classList.remove("field-highlight"));
  const el = doc.querySelector<HTMLElement>(`[data-wsvs-uid="${uid}"]`);
  if (!el) return false;
  el.classList.add("field-highlight");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  try { el.focus({ preventScroll: true }); } catch { /* ignore */ }
  return true;
}

export function clearHighlights(doc: Document): void {
  doc.querySelectorAll(".field-highlight, .field-simulated").forEach((n) => {
    n.classList.remove("field-highlight", "field-simulated");
  });
}
