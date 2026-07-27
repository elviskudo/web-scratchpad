# Release Notes

## v0.1.0 — Initial Chrome Extension

### Architecture
- Chrome Extension Manifest V3 dengan side panel UI
- Content script untuk DOM operations (scan, read, simulate, highlight)
- Service worker untuk side panel behavior + message relay
- Messaging layer dengan ping/inject pattern untuk reliable content script connection
- Dual mode: Chrome Extension + web app standalone (iframe sandbox)
- Build: Vite 7 multi-entry (popup + background + content), chunk inlining plugin

### DOM Scanner
- Scan seluruh document (bukan cuma dalam `<form>`)
- Dedup via `seen` Set — field tidak dihitung 2x
- Deteksi semua native browser inputs: text, number, email, tel, date, time, datetime-local, month, week, color, range, url, search, checkbox, radio, password
- Framework-agnostic widget detection dari class/data-attributes/ARIA:
  - Date pickers (flatpickr, pikaday, bootstrap-datepicker, react-datepicker, ant/element)
  - Autocomplete (typeahead, combobox, react-select, ant-select, el-select, select2)
  - Tags/Multi-select (tag-input, chip, token, react-select)
  - Rich text editor (quill, tinymce, ckeditor, prosemirror, tiptap, summernote, froala, monaco, codemirror)
  - Slider/Range, Upload/Dropzone, Color picker, Rating/Star, Toggle/Switch
  - ARIA roles (combobox, listbox, searchbox, spinbutton, switch, slider, textbox)
  - Contenteditable elements
- Label detection: label[for], parent label, sibling, ancestor containers, placeholder, aria-label

### AI Integration
- Remote: Standard OpenAI chat completions format (messages array, system+user prompts)
- Local heuristic engine: offline fallback tanpa API
- Dynamic validation rules — generated dari scanned fields, bukan hardcode
- Dynamic simulation values — generated untuk SEMUA fields berdasarkan type + label
- `isLocalDemoUrl()` — hanya match explicit `demo://`/`local://`, bukan substring "local"
- Default API URL: `http://localhost:20128/v1/chat/completions`

### Simulate Fill
- Progressive fill: isi 1 per 1 dengan delay 1.2s antar field
- Async `applySimulation()` dengan `onProgress` callback
- Native checkbox/radio: `realClick()` (mousedown→mouseup→click)
- Native select: find matching `<option>` + set value + change event
- Native input/textarea: `setNativeValue()` bypass React/framework wrapper + events
- Date/time/datetime-local: format otomatis sesuai input type
- Color picker: hex format
- Custom dropdown: klik trigger → cari option match → klik option
- Autocomplete: type ke inner input + events
- Contenteditable: set textContent + input event

### Validation
- Remote AI: kirim field values + rules ke AI via chat completions
- Local engine: keyword-based + type-based validation (NPWP, email, phone, year, month, number, required, select)
- Field-level status: ok, invalid, missing, warning
- Overall status: pass/fail dengan summary

### Settings
- chrome.storage.local sync + localStorage fallback
- Hydration: async pull dari chrome.storage ke localStorage on mount
- Configurable: API URL, API key, model, AI enabled, simulate fill enabled
- Target URL: custom URL atau built-in sandbox

### UI
- Side panel (Chrome Extension) atau full-page (web app)
- Tabs: Controls, Analysis, Scratchpad, Settings
- Toast notifications
- Confirm dialogs
- Field status badges (ok/invalid/missing/warning)
- Simulation preview before apply
