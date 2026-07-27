import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { SANDBOX_TITLE } from "../types";

export interface SandboxHandle {
  getDocument: () => Document | null;
  getContainer: () => HTMLElement | null;
}

export const SandboxPage = forwardRef<SandboxHandle>(function SandboxPage(_, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getDocument: () => rootRef.current?.ownerDocument ?? null,
    getContainer: () => rootRef.current,
  }));

  const onManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setToast("Form disubmit secara MANUAL oleh Anda — extension tidak pernah auto-submit.");
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div ref={rootRef} className="min-h-full bg-[#f4f6f8]" data-sandbox-root="true">
      {/* Fake browser chrome */}
      <div className="sticky top-0 z-20 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-ink-50 px-3 py-1.5 text-xs text-ink-500">
            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
              HTTPS
            </span>
            <span className="truncate font-mono">
              sandbox://coretax-djp.go.id/spt-masa/pph21
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[#0b3b6a] to-[#0c5a8f] px-4 py-3 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
              DJP
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">Coretax DJP</div>
              <div className="text-[11px] text-white/75">Direktorat Jenderal Pajak — Sandbox Demo</div>
            </div>
          </div>
          <div className="hidden text-right text-[11px] text-white/80 sm:block">
            <div>NPWP Login: 01.234.567.8-901.000</div>
            <div>Sesi demo · tidak tersambung ke server asli</div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>Sandbox target page.</strong> Halaman ini mensimulasikan form SPT Masa agar extension
          dapat scan DOM, analisis AI, validasi, dan simulate fill — tanpa submit otomatis.
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
          <div className="border-b border-ink-100 bg-ink-50 px-5 py-4">
            <h1 className="text-lg font-semibold text-ink-900">{SANDBOX_TITLE}</h1>
            <p className="mt-1 text-sm text-ink-500" data-description>
              Formulir pelaporan SPT Masa PPh Pasal 21 untuk masa pajak berjalan. Lengkapi identitas
              pemotong, masa pajak, dan nilai penghasilan/pajak terutang. Untuk skenario nihil, isi
              dasar pengenaan dan pajak terutang dengan 0 lalu centang status nil report.
            </p>
          </div>

          <form
            id="form-spt-masa"
            name="sptMasaPph21"
            action="/sandbox/submit"
            method="post"
            onSubmit={onManualSubmit}
            className="space-y-6 p-5"
            noValidate
          >
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ext-700">
                Identitas Pemotong
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="NPWP Pemotong" required>
                  <input
                    id="npwp_pemotong"
                    name="npwp_pemotong"
                    type="text"
                    placeholder="15/16 digit NPWP"
                    required
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Nama Wajib Pajak / Pemotong" required>
                  <input
                    id="nama_pemotong"
                    name="nama_pemotong"
                    type="text"
                    placeholder="Nama perusahaan / individu"
                    required
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Email Kontak" className="sm:col-span-2">
                  <input
                    id="email_kontak"
                    name="email_kontak"
                    type="email"
                    placeholder="finance@perusahaan.co.id"
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="No. Telepon">
                  <input
                    id="telepon"
                    name="telepon"
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Tanggal Dokumen">
                  <input
                    id="tanggal_dokumen"
                    name="tanggal_dokumen"
                    type="text"
                    placeholder="DD-MM-YYYY"
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Alamat Pemotong" className="sm:col-span-2">
                  <textarea
                    id="alamat_pemotong"
                    name="alamat_pemotong"
                    rows={2}
                    placeholder="Alamat domisili / kedudukan"
                    className={inputCls}
                  />
                </FieldWrap>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ext-700">
                Masa & Jenis Pajak
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <FieldWrap label="Masa Pajak (Bulan)" required>
                  <select id="masa_pajak" name="masa_pajak" required className={inputCls} defaultValue="">
                    <option value="" disabled>
                      Pilih bulan
                    </option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const v = String(i + 1).padStart(2, "0");
                      return (
                        <option key={v} value={v}>
                          {v} —{" "}
                          {
                            [
                              "Januari",
                              "Februari",
                              "Maret",
                              "April",
                              "Mei",
                              "Juni",
                              "Juli",
                              "Agustus",
                              "September",
                              "Oktober",
                              "November",
                              "Desember",
                            ][i]
                          }
                        </option>
                      );
                    })}
                  </select>
                </FieldWrap>
                <FieldWrap label="Tahun Pajak" required>
                  <input
                    id="tahun_pajak"
                    name="tahun_pajak"
                    type="number"
                    placeholder="2026"
                    required
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Jenis Pajak / Pasal" required>
                  <select id="jenis_pajak" name="jenis_pajak" required className={inputCls} defaultValue="PPh 21">
                    <option>PPh 21</option>
                    <option>PPh 23</option>
                    <option>PPh 26</option>
                    <option>PPh Unifikasi</option>
                  </select>
                </FieldWrap>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ext-700">
                Penghitungan
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldWrap label="Penghasilan Bruto / DPP" required>
                  <input
                    id="penghasilan_bruto"
                    name="penghasilan_bruto"
                    type="number"
                    min={0}
                    placeholder="0"
                    required
                    className={inputCls}
                  />
                  <p className="form-hint mt-1 text-xs text-ink-400">
                    Dasar pengenaan pajak. Isi 0 untuk skenario pelaporan nihil.
                  </p>
                </FieldWrap>
                <FieldWrap label="Pajak Terutang (PPh)" required>
                  <input
                    id="pajak_terutang"
                    name="pajak_terutang"
                    type="number"
                    min={0}
                    placeholder="0"
                    required
                    className={inputCls}
                  />
                </FieldWrap>
                <FieldWrap label="Status Nil Report" className="sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2.5 text-sm text-ink-700">
                    <input id="status_nil_report" name="status_nil_report" type="checkbox" value="yes" />
                    Tandai sebagai SPT Nihil (pajak terutang = 0)
                  </label>
                </FieldWrap>
                <FieldWrap label="Keterangan Tambahan" className="sm:col-span-2">
                  <textarea
                    id="keterangan"
                    name="keterangan"
                    rows={2}
                    placeholder="Catatan internal / penjelasan koreksi"
                    className={inputCls}
                  />
                </FieldWrap>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <p className="max-w-md text-xs leading-relaxed text-ink-400">
                Tombol di bawah adalah submit <strong>manual</strong> milik halaman target. Extension
                scratchpad tidak memanggil aksi ini.
              </p>
              <div className="flex gap-2">
                <button
                  type="reset"
                  className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0b3b6a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0a335c]"
                >
                  Kirim SPT (Manual)
                </button>
              </div>
            </div>

            {submitted && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Draft diterima di sandbox (simulasi). Tidak ada data yang dikirim ke server eksternal.
              </div>
            )}
          </form>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
});

function FieldWrap({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className} data-field-wrap>
      <label className="mb-1.5 block text-sm font-medium text-ink-700">
        <span data-label>{label}</span>
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition placeholder:text-ink-300 focus:border-ext-400 focus:ring-2 focus:ring-ext-100";
