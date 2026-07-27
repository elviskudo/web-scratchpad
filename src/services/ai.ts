import {
  AiAnalysis,
  AiModel,
  AiSettings,
  ImportantField,
  ScanResult,
  ValidationRule,
  ValidationResult,
} from "../types";

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

export class AiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiResponseError";
  }
}

function assertAiReady(settings: AiSettings) {
  if (!settings.enabled) {
    throw new AiConfigError("AI belum diaktifkan. Aktifkan Enable AI Analysis di Settings.");
  }
  if (!settings.apiUrl.trim()) {
    throw new AiConfigError("AI belum dikonfigurasi dengan benar. AI API URL wajib diisi.");
  }
}

function buildHeaders(settings: AiSettings): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
    headers["X-API-Key"] = settings.apiKey;
  }
  if (settings.apiSecret) {
    headers["X-API-Secret"] = settings.apiSecret;
  }
  return headers;
}

export function isLocalDemoUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return true;
  // Only match explicit demo/local protocol schemes or bare identifiers
  if (u === "demo" || u === "local" || u === "demo://local" || u === "local://demo") return true;
  if (u.startsWith("demo://") || u.startsWith("local://")) return true;
  return false;
}

/** Resolve /models endpoints from the configured AI API URL. */
export function resolveModelsEndpoints(apiUrl: string): string[] {
  const raw = apiUrl.trim().replace(/\/+$/, "");
  if (!raw || isLocalDemoUrl(raw)) return [];

  const endpoints = new Set<string>();

  try {
    const u = new URL(raw);
    const path = u.pathname;
    const parts = path.split("/").filter(Boolean);
    const last = parts[parts.length - 1]?.toLowerCase() ?? "";

    // Strip known action leaves to find the base
    const actionLeaves = new Set([
      "chat", "completions", "completion", "analyze", "validate",
      "messages", "responses", "generate", "screening", "embeddings",
    ]);

    let baseParts = [...parts];
    if (actionLeaves.has(last)) {
      baseParts.pop();
      // also strip "chat" if path ended with chat/completions
      if (baseParts[baseParts.length - 1]?.toLowerCase() === "chat") baseParts.pop();
    }

    const base = `${u.origin}/${baseParts.join("/")}`.replace(/\/+$/, "");

    // Most common: base/models
    endpoints.add(`${base}/models`);

    // If there's a /v1 segment, also try origin/v1/models
    const v1Idx = parts.findIndex((p) => /^v\d+$/i.test(p));
    if (v1Idx >= 0) {
      endpoints.add(`${u.origin}/${parts.slice(0, v1Idx + 1).join("/")}/models`);
    }

    // Also try the raw URL as-is (some APIs list models at the base)
    endpoints.add(raw);
  } catch {
    // fallback: just append /models
    endpoints.add(`${raw}/models`);
    endpoints.add(raw);
  }

  return Array.from(endpoints);
}

function normalizeModelsPayload(data: unknown): AiModel[] {
  if (!data) return [];

  const asModel = (item: unknown, index: number): AiModel | null => {
    if (typeof item === "string" && item.trim()) {
      return { id: item.trim(), name: item.trim() };
    }
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    const id = String(o.id ?? o.model ?? o.name ?? o.model_id ?? o.modelId ?? "").trim();
    if (!id) return null;
    const name = String(o.name ?? o.display_name ?? o.title ?? id).trim();
    const description =
      typeof o.description === "string"
        ? o.description
        : typeof o.about === "string"
          ? o.about
          : undefined;
    const ownedBy =
      typeof o.owned_by === "string"
        ? o.owned_by
        : typeof o.provider === "string"
          ? o.provider
          : typeof o.organization === "string"
            ? o.organization
            : undefined;
    return { id, name: name || id || `model-${index}`, description, ownedBy };
  };

  if (Array.isArray(data)) {
    return data.map(asModel).filter(Boolean) as AiModel[];
  }

  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const candidates = [o.data, o.models, o.result, o.items, o.model_list];
    for (const c of candidates) {
      if (Array.isArray(c)) {
        return c.map(asModel).filter(Boolean) as AiModel[];
      }
    }
    // single model object
    const single = asModel(o, 0);
    if (single) return [single];
  }

  return [];
}

export const LOCAL_DEMO_MODELS: AiModel[] = [
  {
    id: "local-heuristic-v1",
    name: "Local Heuristic v1",
    description: "Engine screening bawaan (offline demo) untuk form pajak/DOM.",
    ownedBy: "scratchpad",
  },
  {
    id: "local-tax-rules-v1",
    name: "Local Tax Rules v1",
    description: "Fokus aturan validasi NPWP, masa pajak, dan nilai terutang.",
    ownedBy: "scratchpad",
  },
];

/**
 * Fetch available AI models from the configured API using API Key + Secret.
 * Tries OpenAI-compatible GET /v1/models and several fallbacks, then POST action=list_models.
 */
export async function fetchAiModels(settings: AiSettings): Promise<AiModel[]> {
  if (!settings.apiUrl.trim()) {
    throw new AiConfigError("AI API URL wajib diisi untuk mengambil daftar model.");
  }

  if (isLocalDemoUrl(settings.apiUrl)) {
    await new Promise((r) => setTimeout(r, 350));
    return LOCAL_DEMO_MODELS;
  }

  const headers = buildHeaders(settings);
  const endpoints = resolveModelsEndpoints(settings.apiUrl);
  let lastError: Error | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        lastError = new AiResponseError(`HTTP ${res.status} on GET ${endpoint}`);
        continue;
      }
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        lastError = new AiResponseError("Response models bukan JSON valid.");
        continue;
      }
      const models = normalizeModelsPayload(json);
      if (models.length > 0) {
        return dedupeModels(models);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  // Fallback: GET {baseUrl}/models
  try {
    const base = new URL(settings.apiUrl.trim());
    const baseModels = base.origin + "/v1/models";
    const res = await fetch(baseModels, { method: "GET", headers });
    if (res.ok) {
      const json = await res.json();
      const models = normalizeModelsPayload(json);
      if (models.length > 0) return dedupeModels(models);
    }
  } catch { /* ignore */ }

  throw new AiResponseError(
    lastError?.message
      ? `Gagal fetch model AI: ${lastError.message}`
      : "Gagal fetch model AI dari API URL."
  );
}

function dedupeModels(models: AiModel[]): AiModel[] {
  const map = new Map<string, AiModel>();
  for (const m of models) {
    if (!map.has(m.id)) map.set(m.id, m);
  }
  return Array.from(map.values());
}

async function chatCompletion(settings: AiSettings, systemPrompt: string, userContent: string): Promise<string> {
  assertAiReady(settings);
  const res = await fetch(settings.apiUrl, {
    method: "POST",
    headers: buildHeaders(settings),
    body: JSON.stringify({
      model: settings.model || undefined,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    throw new AiResponseError(`AI API error: HTTP ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as Record<string, unknown>;
  const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content;
  if (!content) throw new AiResponseError("Response AI tidak memiliki content.");
  return content;
}

function extractJsonFromResponse(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text;
  const brace = raw.indexOf("{");
  const bracket = raw.indexOf("[");
  let start = -1;
  if (brace >= 0 && bracket >= 0) start = Math.min(brace, bracket);
  else if (brace >= 0) start = brace;
  else if (bracket >= 0) start = bracket;
  if (start < 0) throw new AiResponseError("Response AI tidak mengandung JSON.");
  const sub = raw.slice(start);
  try {
    return JSON.parse(sub);
  } catch {
    throw new AiResponseError("JSON dalam response AI tidak valid.");
  }
}

function matchFieldUid(scan: ScanResult, nameOrId: string, label: string): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  const target = norm(nameOrId || label);
  const found = scan.fields.find((f) => {
    return (
      norm(f.name) === target ||
      norm(f.id) === target ||
      norm(f.label) === target ||
      norm(f.name).includes(target) ||
      norm(f.id).includes(target) ||
      norm(f.label).includes(target)
    );
  });
  return found?.uid;
}

function enrichImportantFields(scan: ScanResult, fields: ImportantField[]): ImportantField[] {
  return fields.map((f) => {
    const uid = f.uid || matchFieldUid(scan, f.nameOrId, f.label);
    const scanned = scan.fields.find((s) => s.uid === uid);
    return {
      ...f,
      uid,
      type: f.type || scanned?.type || "text",
      status: f.status || "unknown",
    };
  });
}

/** Local heuristic engine used when no remote API is reachable or for demo mode. */
export function localAnalyze(scan: ScanResult): AiAnalysis {
  const labels = scan.fields.map((f) => f.label.toLowerCase());
  const names = scan.fields.map((f) => `${f.name} ${f.id} ${f.label}`.toLowerCase());
  const blob = [...labels, ...names, ...scan.pageInfo.headings, ...scan.pageInfo.descriptions]
    .join(" ")
    .toLowerCase();

  const isTax =
    /pajak|spt|pph|ppn|coretax|djp|npwp|masa pajak|pemotong|bukti potong/.test(blob) ||
    scan.pageInfo.url.includes("coretax") ||
    scan.pageInfo.url.includes("sandbox");

  const importantKeys = [
    { test: /npwp/, reason: "Identitas wajib pajak / pemotong yang menjadi kunci pelaporan." },
    { test: /nama\s*(wp|wajib|pemotong|perusahaan)?/, reason: "Identitas formal yang harus cocok dengan master data." },
    { test: /masa\s*pajak|periode|bulan/, reason: "Menentukan periode pelaporan SPT Masa." },
    { test: /tahun/, reason: "Tahun pajak terkait masa pelaporan." },
    { test: /jenis\s*(pajak|spt)|pasal/, reason: "Menentukan jenis kewajiban pajak yang dilaporkan." },
    { test: /penghasilan|bruto|dasar\s*pengenaan|dpp/, reason: "Basis perhitungan pajak terutang." },
    { test: /pajak\s*terutang|pph|tarif/, reason: "Nilai pajak yang akan dilaporkan; kritis untuk validasi." },
    { test: /nil\s*report|nihil|status\s*lapor/, reason: "Menandai apakah pelaporan nihil (pajak = 0)." },
    { test: /email|telepon|hp|kontak/, reason: "Kontak untuk notifikasi atau koreksi." },
    { test: /alamat/, reason: "Data alamat formal pada formulir." },
    { test: /tanggal/, reason: "Tanggal transaksi/pelaporan harus sesuai format resmi." },
    { test: /rekening|bank/, reason: "Informasi pembayaran/restitusi bila relevan." },
  ];

  const picked: ImportantField[] = [];
  const used = new Set<string>();

  for (const key of importantKeys) {
    for (const field of scan.fields) {
      if (used.has(field.uid)) continue;
      const hay = `${field.label} ${field.name} ${field.id}`.toLowerCase();
      if (key.test.test(hay)) {
        used.add(field.uid);
        picked.push({
          uid: field.uid,
          label: field.label,
          nameOrId: field.name || field.id || field.uid,
          type: field.type,
          reason: key.reason,
          status: "unknown",
        });
        break;
      }
    }
  }

  // Ensure we always surface required fields
  for (const field of scan.fields) {
    if (used.has(field.uid)) continue;
    if (field.required) {
      used.add(field.uid);
      picked.push({
        uid: field.uid,
        label: field.label,
        nameOrId: field.name || field.id || field.uid,
        type: field.type,
        reason: "Field wajib pada form; harus diisi sebelum submit manual.",
        status: "unknown",
      });
    }
  }

  // Cap list but keep at least some
  const important = picked.slice(0, 12);
  if (important.length === 0) {
    scan.fields.slice(0, 6).forEach((field) => {
      important.push({
        uid: field.uid,
        label: field.label,
        nameOrId: field.name || field.id || field.uid,
        type: field.type,
        reason: "Field terdeteksi pada form utama halaman.",
        status: "unknown",
      });
    });
  }

  const page_summary = isTax
    ? `Halaman ini tampak sebagai formulir pelaporan pajak elektronik (mirip Coretax/SPT Masa). Judul halaman: “${scan.pageInfo.title}”. Terdapat ${scan.forms.length} form dengan total ${scan.fields.length} field input yang dapat diisi. Fokus screening adalah memastikan field identitas, masa pajak, dan nilai pajak terisi konsisten sebelum Anda submit secara manual.`
    : `Halaman “${scan.pageInfo.title}” berisi ${scan.forms.length} form dan ${scan.fields.length} field. Extension ini mengekstrak struktur DOM/form untuk screening: field mana yang krusial, apa tujuannya, dan bagaimana memvalidasi isian tanpa mengirim form secara otomatis.`;

  const detected_purpose = isTax
    ? "Mengisi dan memvalidasi SPT Masa / pelaporan pajak (termasuk skenario nihil) tanpa submit otomatis."
    : "Screening struktur form web dan validasi isian field penting sebelum aksi manual pengguna.";

  const warnings: string[] = [];
  if (isTax) {
    warnings.push(
      "Halaman ini tampak sebagai aplikasi pajak resmi/sandbox. Pastikan automation dan berbagi data ke AI tidak melanggar ketentuan internal atau regulasi."
    );
    warnings.push(
      "Extension tidak akan pernah menekan tombol Submit. Pengiriman laporan tetap menjadi tanggung jawab Anda."
    );
  }
  if (scan.fields.some((f) => f.type === "password")) {
    warnings.push("Terdeteksi field password. Hindari mengirim nilai sensitif ke AI kecuali benar-benar diperlukan.");
  }

  // Generate validation rules dynamically from scanned fields
  const validation_rules: ValidationRule[] = [];
  for (const field of scan.fields) {
    const hay = `${field.label} ${field.name} ${field.id}`.toLowerCase();
    const name = field.name || field.id || field.label;
    if (/npwp|tax.?id|nik|nip/.test(hay)) {
      validation_rules.push({ field: name, rule: "digits_15_or_16", description: "Harus 15 atau 16 digit angka." });
    }
    if (/email/.test(hay) || field.type === "email") {
      validation_rules.push({ field: name, rule: "email_format", description: "Format email valid." });
    }
    if (/tahun|year/.test(hay) && field.type !== "email") {
      validation_rules.push({ field: name, rule: "year_range", description: "Tahun wajar (2000–2100)." });
    }
    if (/bulan|month|masa|periode/.test(hay) && field.type === "select") {
      validation_rules.push({ field: name, rule: "month_option", description: "Pilih bulan 01–12." });
    }
    if (/bulan|month|masa/.test(hay) && field.type !== "select") {
      validation_rules.push({ field: name, rule: "month_1_12", description: "Bulan 01–12." });
    }
    if (/phone|telepon|hp|telp|fax/.test(hay) || field.type === "tel") {
      validation_rules.push({ field: name, rule: "phone_format", description: "Nomor telepon valid." });
    }
    if (/url|website|link/.test(hay)) {
      validation_rules.push({ field: name, rule: "url_format", description: "URL valid (https://...)." });
    }
    if (field.type === "number" || /jumlah|nilai|nominal|amount|price|total|bruto|dpp|pph|pajak/.test(hay)) {
      validation_rules.push({ field: name, rule: "number_non_negative", description: "Harus angka ≥ 0." });
    }
    if (/tanggal|date/.test(hay) || field.type === "date") {
      validation_rules.push({ field: name, rule: "date_format", description: "Format tanggal (DD-MM-YYYY atau YYYY-MM-DD)." });
    }
    if (field.required) {
      validation_rules.push({ field: name, rule: "required", description: "Field wajib diisi." });
    }
    if (field.type === "select" && field.options?.length) {
      validation_rules.push({ field: name, rule: "select_from_options", description: `Pilih salah satu dari ${field.options.length} opsi.` });
    }
    if (field.type === "checkbox" || field.type === "radio") {
      validation_rules.push({ field: name, rule: "boolean", description: "Centang atau tidak." });
    }
  }

  const simulation_values: Record<string, string | boolean> = {};
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateYmd = `${y}-${m}-${d}`;
  const yearStr = String(y);

  for (const field of scan.fields) {
    const hay = `${field.label} ${field.name} ${field.id}`.toLowerCase();

    // Keyword-based smart values
    if (/npwp|tax.?id|nik|nip/.test(hay)) simulation_values[field.uid] = "0123456789012345";
    else if (/email/.test(hay)) simulation_values[field.uid] = "finance@contoh.co.id";
    else if (/telepon|hp|phone|telp|fax|kontak/.test(hay)) simulation_values[field.uid] = "081234567890";
    else if (/tahun|year/.test(hay) && field.type !== "date") simulation_values[field.uid] = yearStr;
    else if (/bulan|month|masa|periode/.test(hay) && field.type !== "select" && field.type !== "date") simulation_values[field.uid] = "01";
    else if (/alamat|address|kota|kabupaten|kecamatan|kelurahan|kode\s*pos/.test(hay)) simulation_values[field.uid] = "Jl. Jenderal Sudirman No. 1, Jakarta Pusat, 10220";
    else if (/url|website|link/.test(hay)) simulation_values[field.uid] = "https://example.co.id";
    else if (/jumlah|nilai|nominal|amount|price|total|bruto|dpp|pph|pajak|tarif|biaya|harga|salary|gaji/.test(hay)) simulation_values[field.uid] = "0";
    else if (/nama|name/.test(hay) && /perusahaan|company|usaha|pt|cv|badan/.test(hay))
      simulation_values[field.uid] = "PT Contoh Nusantara";
    else if (/nama|name/.test(hay) && /wp|wajib|pemotong|lengkap|person|karyawan|staff|pegawai/.test(hay))
      simulation_values[field.uid] = "Budi Santoso";
    else if (/nama|name/.test(hay)) simulation_values[field.uid] = "Budi Santoso";
    else if (/keterangan|description|catatan|note|remark|memo/.test(hay)) simulation_values[field.uid] = "Data testing";
    else if (/referensi|reference|reff|no\.?\s*(ref|doc|invoice|surat)/.test(hay)) simulation_values[field.uid] = "REF-2026-001";
    else if (/jenis|pasal|kategori|type|category/.test(hay) && field.type === "select" && field.options?.length)
      simulation_values[field.uid] = field.options[0];
    else if (/nil|nihil/.test(hay) && (field.type === "checkbox" || field.type === "radio"))
      simulation_values[field.uid] = true;

    // Fallback by native browser/OS field type
    else if (field.type === "select" && field.options?.length)
      simulation_values[field.uid] = field.options[0];
    else if (field.type === "checkbox" || field.type === "radio")
      simulation_values[field.uid] = true;
    else if (field.type === "date")
      simulation_values[field.uid] = dateYmd;            // YYYY-MM-DD for native date picker
    else if (field.type === "time")
      simulation_values[field.uid] = "12:00";            // HH:MM for native time picker
    else if (field.type === "datetime-local")
      simulation_values[field.uid] = `${dateYmd}T12:00`; // YYYY-MM-DDTHH:MM
    else if (field.type === "month")
      simulation_values[field.uid] = `${y}-${m}`;       // YYYY-MM for native month picker
    else if (field.type === "color")
      simulation_values[field.uid] = "#3b82f6";          // hex for native color picker
    else if (field.type === "number" || field.type === "range")
      simulation_values[field.uid] = "50";
    else if (field.type === "url")
      simulation_values[field.uid] = "https://example.co.id";
    else if (field.type === "email")
      simulation_values[field.uid] = "test@example.com";
    else if (field.type === "tel")
      simulation_values[field.uid] = "081234567890";
    else if (field.type === "textarea")
      simulation_values[field.uid] = "Data testing";
    else
      simulation_values[field.uid] = "Test Value";
  }

  return {
    page_summary,
    detected_purpose,
    important_fields: important,
    validation_rules,
    warnings,
    simulation_values,
  };
}

function localValidate(scan: ScanResult, analysis: AiAnalysis | null): ValidationResult {
  const important = analysis?.important_fields ?? [];
  const focusUids = new Set(
    important.map((f) => f.uid).filter(Boolean) as string[]
  );
  const targets =
    focusUids.size > 0 ? scan.fields.filter((f) => focusUids.has(f.uid)) : scan.fields;

  const results: ValidationResult["fields"] = targets.map((field) => {
    const hay = `${field.label} ${field.name} ${field.id}`.toLowerCase();
    const raw = (field.value ?? "").trim();
    const isEmpty =
      field.type === "checkbox" || field.type === "radio"
        ? !field.checked
        : raw.length === 0;

    if (isEmpty && field.required) {
      return {
        nameOrId: field.name || field.id || field.uid,
        status: "missing" as const,
        message: "Field wajib masih kosong.",
        value: raw,
      };
    }
    if (isEmpty) {
      return {
        nameOrId: field.name || field.id || field.uid,
        status: "missing" as const,
        message: "Belum diisi (opsional, tetapi relevan untuk screening).",
        value: raw,
      };
    }

    if (/npwp/.test(hay)) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length !== 15 && digits.length !== 16) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "NPWP harus 15 atau 16 digit angka.",
          value: raw,
        };
      }
    }

    if (/email/.test(hay) || field.type === "email") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "Format email tidak valid.",
          value: raw,
        };
      }
    }

    if (/tahun/.test(hay)) {
      const y = Number(raw);
      if (!Number.isFinite(y) || y < 2000 || y > 2100) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "Tahun pajak di luar rentang wajar (2000–2100).",
          value: raw,
        };
      }
    }

    if (/masa|bulan/.test(hay) && field.type !== "select") {
      const m = Number(raw);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "Masa pajak harus 1–12.",
          value: raw,
        };
      }
    }

    if (/penghasilan|bruto|dpp|pajak\s*terutang|pph/.test(hay) || field.type === "number") {
      const n = Number(String(raw).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "Harus berupa angka ≥ 0.",
          value: raw,
        };
      }
    }

    if (/tanggal|date/.test(hay) || field.type === "date") {
      const dmy = /^(\d{2})-(\d{2})-(\d{4})$/.test(raw);
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw);
      if (!dmy && !iso) {
        return {
          nameOrId: field.name || field.id || field.uid,
          status: "invalid",
          message: "Format tanggal harus DD-MM-YYYY atau YYYY-MM-DD.",
          value: raw,
        };
      }
    }

    return {
      nameOrId: field.name || field.id || field.uid,
      status: "valid" as const,
      message: "Nilai sesuai aturan screening awal.",
      value: raw,
    };
  });

  const bad = results.filter((r) => r.status !== "valid").length;
  return {
    overall: bad === 0 ? "pass" : "fail",
    summary:
      bad === 0
        ? "Validasi LULUS — semua field penting tampak valid."
        : `Validasi GAGAL — ${bad} field invalid/missing. Perbaiki sebelum submit manual.`,
    fields: results,
  };
}

export async function analyzePage(
  settings: AiSettings,
  scan: ScanResult,
  options?: { forceLocal?: boolean }
): Promise<AiAnalysis> {
  if (options?.forceLocal || !settings.apiUrl.trim() || isLocalDemoUrl(settings.apiUrl)) {
    if (!settings.enabled) {
      throw new AiConfigError("AI belum diaktifkan. Aktifkan Enable AI Analysis di Settings.");
    }
    // Simulate latency
    await new Promise((r) => setTimeout(r, 700));
    return localAnalyze(scan);
  }

  try {
    const fieldData = scan.fields.map((f) => ({
      uid: f.uid, name: f.name, id: f.id, type: f.type, label: f.label,
      placeholder: f.placeholder, required: f.required, options: f.options,
    }));

    const systemPrompt = `Kamu adalah AI analis halaman web. Tugas: analisis form/web untuk screening & validasi.
Return HANYA JSON valid (tanpa markdown fence, tanpa teks tambahan) dengan struktur:
{
  "page_summary": "ringkasan singkat halaman",
  "detected_purpose": "tujuan form/halaman",
  "important_fields": [{"uid":"...","label":"...","nameOrId":"...","reason":"alasan","status":"unknown","type":"text"}],
  "validation_rules": [{"field":"nameOrId","rule":"rule_name","description":"aturan"}],
  "warnings": ["peringatan jika ada"],
  "simulation_values": {"uid_field": "nilai simulasi"}
}
PENTING: simulation_values WAJIB berisi nilai untuk SEMUA field uid, berdasarkan tipe dan label:
- select: pilih opsi pertama yang masuk akal
- checkbox/radio: true
- number: angka wajar (0 untuk pajak, 1 untuk kuantitas)
- date: format DD-MM-YYYY
- email: test@example.com
- tel: 081234567890
- text/other: teks yang sesuai konteks label field (nama orang, nama perusahaan, alamat, dll)
Jangan ada field yang tidak punya simulation_value.`;

    const userContent = `Page info: ${JSON.stringify(scan.pageInfo)}
Forms: ${JSON.stringify(scan.forms)}
Fields: ${JSON.stringify(fieldData)}
Goal: Screening & validation form tanpa submit otomatis. Isi SEMUA simulation_values sesuai konteks field.`;

    const text = await chatCompletion(settings, systemPrompt, userContent);
    const data = extractJsonFromResponse(text) as Partial<AiAnalysis>;

    if (!data || typeof data !== "object") throw new AiResponseError("Response AI tidak valid.");
    if (typeof data.page_summary !== "string" || typeof data.detected_purpose !== "string") {
      throw new AiResponseError("Response AI tidak valid: page_summary dan detected_purpose wajib ada.");
    }
    if (!Array.isArray(data.important_fields)) {
      throw new AiResponseError("Response AI tidak valid: important_fields harus array.");
    }

    return {
      page_summary: data.page_summary,
      detected_purpose: data.detected_purpose,
      important_fields: enrichImportantFields(
        scan,
        data.important_fields.map((f) => ({ ...f, status: f.status || "unknown" })),
      ),
      validation_rules: data.validation_rules,
      warnings: data.warnings,
      simulation_values: data.simulation_values,
    };
  } catch (err) {
    if (err instanceof AiConfigError || err instanceof AiResponseError) {
      if (err instanceof AiResponseError && err.message.includes("HTTP")) {
        await new Promise((r) => setTimeout(r, 400));
        const local = localAnalyze(scan);
        local.warnings = [...(local.warnings || []), `Remote AI gagal (${err.message}). Menggunakan engine analisis lokal (demo).`];
        return local;
      }
      throw err;
    }
    await new Promise((r) => setTimeout(r, 400));
    const local = localAnalyze(scan);
    local.warnings = [...(local.warnings || []), "Remote AI tidak terjangkau. Menggunakan engine analisis lokal (demo)."];
    return local;
  }
}

export async function validatePage(
  settings: AiSettings,
  scan: ScanResult,
  analysis: AiAnalysis | null,
  options?: { forceLocal?: boolean }
): Promise<ValidationResult> {
  if (options?.forceLocal || !settings.apiUrl.trim() || isLocalDemoUrl(settings.apiUrl)) {
    if (!settings.enabled) {
      throw new AiConfigError("AI belum diaktifkan. Aktifkan Enable AI Analysis di Settings.");
    }
    await new Promise((r) => setTimeout(r, 550));
    return localValidate(scan, analysis);
  }

  try {
    const fieldData = scan.fields.map((f) => ({
      uid: f.uid, name: f.name, id: f.id, type: f.type, label: f.label,
      required: f.required, value: f.type === "checkbox" || f.type === "radio" ? f.checked : f.value,
    }));

    const systemPrompt = `Kamu adalah AI validator form. Tugas: validasi field sesuai aturan form/pajak.
Return HANYA JSON valid (tanpa markdown fence, tanpa teks tambahan) dengan struktur:
{
  "overall": "pass" atau "fail",
  "summary": "ringkasan hasil validasi",
  "fields": [{"nameOrId":"...","status":"ok atau invalid atau missing atau warning","message":"pesan","value":"nilai saat ini"}]
}`;

    const userContent = `Page info: ${JSON.stringify(scan.pageInfo)}
Fields: ${JSON.stringify(fieldData)}
${analysis?.important_fields ? `Important fields: ${JSON.stringify(analysis.important_fields)}` : ""}
${analysis?.validation_rules ? `Validation rules: ${JSON.stringify(analysis.validation_rules)}` : ""}`;

    const text = await chatCompletion(settings, systemPrompt, userContent);
    const data = extractJsonFromResponse(text) as Partial<ValidationResult>;

    if (!data || !data.overall || !Array.isArray(data.fields)) {
      throw new AiResponseError("Response AI tidak valid untuk validasi.");
    }
    return {
      overall: data.overall,
      summary: data.summary || (data.overall === "pass" ? "Validasi LULUS" : "Validasi GAGAL"),
      fields: data.fields,
    };
  } catch (err) {
    if (err instanceof AiConfigError) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return localValidate(scan, analysis);
  }
}

export function buildSimulationPreview(
  scan: ScanResult,
  analysis: AiAnalysis | null
): Array<{ uid: string; label: string; nameOrId: string; value: string | boolean }> {
  const values = analysis?.simulation_values || localAnalyze(scan).simulation_values || {};
  return Object.entries(values)
    .map(([uid, value]) => {
      const field = scan.fields.find((f) => f.uid === uid);
      if (!field) return null;
      return {
        uid,
        label: field.label,
        nameOrId: field.name || field.id || uid,
        value,
      };
    })
    .filter(Boolean) as Array<{
    uid: string;
    label: string;
    nameOrId: string;
    value: string | boolean;
  }>;
}
