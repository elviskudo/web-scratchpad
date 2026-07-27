# Web Screening & Validation Scratchpad

Chrome Extension (Manifest V3) untuk scan, analisis, simulasi fill, dan validasi form di halaman web manapun. Bisa juga dijalankan sebagai web app standalone dengan sandbox bawaan.

## Fitur

- **Scan DOM** — deteksi semua form fields di halaman target (input, select, textarea, contenteditable, ARIA widgets)
- **Widget Detection** — framework-agnostic: date picker, autocomplete, rich text editor, multi-select/tags, slider, color picker, rating, toggle, upload, dll
- **AI Analysis** — kirim scan data ke AI (OpenAI-compatible API) untuk analisis halaman, identifikasi field penting, dan generate validasi rules
- **Local Heuristic Engine** — fallback offline tanpa API: auto-detect field type dari label/attributes, generate validation rules & simulation values
- **Simulate Fill** — isi semua field dengan data dummy secara progresif (1.2s delay per field), React-safe value setter, native browser events
- **Validate** — validasi field berdasarkan rules dari AI atau local engine
- **Scratchpad** — catatan manual untuk screening notes
- **Dual Mode** — Chrome Extension (side panel + content script) atau web app (iframe sandbox)

## Install & Build

```bash
npm install

# Web app
npm run dev

# Chrome Extension
npm run build:ext
# lalu load unpacked dist/ di chrome://extensions
```

## Penggunaan

1. Buka target web page
2. Buka side panel extension
3. **Scan** — klik scan untuk deteksi semua fields
4. **Analyze** — AI menganalisis halaman & identifikasi field penting
5. **Simulate Fill** — isi field dengan data dummy (progressive, 1 per 1)
6. **Validate** — cek apakah semua field valid

## Architecture

```
src/
├── App.tsx                    # Main orchestrator (dual mode: extension + web)
├── content.ts                 # Content script (DOM operations via messaging)
├── background.ts              # Service worker (side panel + message relay)
├── extension.ts               # Messaging layer (ping/inject/sendWithInject)
├── types/index.ts             # TypeScript types + DEFAULT_SETTINGS
├── services/
│   ├── scanner.ts             # DOM scanner + apply simulation (async, progressive)
│   ├── ai.ts                  # AI service (remote OpenAI + local heuristic engine)
│   └── storage.ts             # Chrome storage sync + localStorage fallback
└── components/
    ├── ExtensionPanel.tsx      # Main panel UI (controls, analysis, scratchpad, settings)
    ├── SandboxPage.tsx         # Built-in sandbox for web app mode
    ├── StatusBadge.tsx         # Field status indicators
    ├── ConfirmDialog.tsx       # Confirmation dialogs
    ├── Toast.tsx               # Toast notifications
    └── Icons.tsx               # SVG icons
```

## AI Configuration

Default: `http://localhost:20128/v1/chat/completions` (OpenAI-compatible).

Settings disimpan di chrome.storage.local (extension) atau localStorage (web app). Fields yang tersimpan:

| Field | Default | Keterangan |
|-------|---------|------------|
| `apiUrl` | `http://localhost:20128/v1/chat/completions` | Endpoint OpenAI-compatible |
| `apiKey` | (empty) | API key untuk auth |
| `model` | (auto-fetch) | Model ID dari /v1/models |
| `enabled` | `true` | Aktifkan AI analysis |

## Field Detection

Scanner mendeteksi semua jenis komponen input:

### Native Browser
- `<input type="text|number|email|tel|date|time|datetime-local|month|week|color|range|url|search|checkbox|radio|password">`
- `<select>`, `<textarea>`

### Custom Widgets (framework-agnostic)
- **Date picker** — flatpickr, pikaday, bootstrap-datepicker, react-datepicker, ant/element/odoo
- **Autocomplete** — typeahead, combobox, react-select, ant-select, el-select, select2
- **Tags/Multi-select** — tag-input, chip, token, multi-select, react-select
- **Rich text editor** — quill, tinymce, ckeditor, prosemirror, tiptap, summernote, froala, monaco, codemirror
- **Slider/Range** — native range, ant-slider, mui-slider
- **Upload** — file input, dropzone
- **Color picker** — native color, react-color
- **Rating** — star, score widgets
- **Toggle/Switch** — native checkbox, custom toggles
- **ARIA** — role=combobox, listbox, searchbox, spinbutton, switch, slider, textbox

### Detection Strategy
1. Standard `<input>/<select>/<textarea>` — via `querySelectorAll`
2. Widget containers — class patterns (`[class*='datepicker']`, `[class*='autocomplete']`, dll)
3. ARIA roles — `role="combobox"`, `role="textbox"`, dll
4. Data attributes — `data-type`, `data-widget`, `data-component`
5. Contenteditable — `[contenteditable='true']`

## Simulate Fill

Progressive fill dengan delay 1.2s per field:

| Component | Cara Isi |
|-----------|----------|
| `<select>` | Cari `<option>` match → set value + change event |
| `<input type=date>` | Format YYYY-MM-DD + native setter |
| `<input type=time>` | Format HH:MM |
| `<input type=datetime-local>` | Format YYYY-MM-DDTHH:MM |
| `<input type=color>` | Hex format #rrggbb |
| `<input type=range>` | Numeric dalam min/max |
| Checkbox/Radio | `realClick()` (mousedown→mouseup→click) |
| React/framework | `setNativeValue` bypass React wrapper + events |
| Custom dropdown | Klik trigger → cari option → klik option |
| Autocomplete | Type ke inner input + events |
| Contenteditable | Set textContent + input event |

## Build Targets

| Command | Output | Keterangan |
|---------|--------|------------|
| `npm run dev` | localhost:5173 | Web app dev server |
| `npm run build` | `dist/` | Web app (singlefile) |
| `npm run build:ext` | `dist/` | Chrome Extension (Manifest V3) |

## Tech Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS 4
- Manifest V3 (side panel, content script, service worker)
- Chrome Extension APIs (tabs, scripting, storage, sidePanel)
