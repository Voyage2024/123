"use client";

/* ──────────────────────────────────────────────────────────────────────
 * Сейф тура: готовность моделей (билет / апарты / заселение), билеты и
 * посадочные в приватном бакете tour-vault, карточки апартаментов.
 *
 *   менеджер тура, owner — всё: загрузка, апарты, назначение, заселение;
 *   оператор             — апарты и заселение своих моделей, без билетов.
 *
 * Файлы грузятся напрямую в Storage (политики tour_vault_*), ссылка на
 * скачивание — подписанная, на 2 минуты.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Plus, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BTN_GHOST, BTN_GOLD, Panel } from "@/app/(dashboard)/partner/_components/PartnerUI";
import { assignApartment, deleteApartment, saveApartment, setCheckedIn, type ApartmentInput } from "@/app/actions/tour-ops";
import { DOC_KINDS, errorCode, obj, parseApartment, parseDocuments, parseLogistics, type Apartment, type DocKind, type Logistics, type TourBoard, type TourDocument } from "@/lib/tour-ops/types";
import { opsError, type OpsDict } from "@/lib/tour-ops/i18n";
import { Field, INPUT, Modal, Notice, useOps } from "@/app/components/tour-ops/ops-ui";
import ApartmentCard from "@/app/components/tour-ops/ApartmentCard";

export const VAULT_BUCKET = "tour-vault";
export const VAULT_MAX_BYTES = 15 * 1024 * 1024;
export const VAULT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

/** Загрузка файла в сейф + запись в tour_documents. Возвращает код ошибки или null. */
export async function uploadVaultFile(tourId: string, modelId: string, kind: DocKind, file: File): Promise<string | null> {
  if (file.size > VAULT_MAX_BYTES) return "too_large";
  if (!VAULT_TYPES.includes(file.type)) return "bad_type";
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `tours/${tourId}/${modelId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upError } = await supabase.storage.from(VAULT_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upError) return errorCode(upError.message);
  const { error } = await supabase.from("tour_documents").insert({
    tour_id: tourId,
    model_id: modelId,
    kind,
    storage_path: path,
    file_name: file.name.slice(0, 160) || "file",
    mime_type: file.type,
    size_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from(VAULT_BUCKET).remove([path]);
    return errorCode(error.message);
  }
  return null;
}

export async function openVaultFile(path: string): Promise<void> {
  const { data } = await supabase.storage.from(VAULT_BUCKET).createSignedUrl(path, 120);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

export function vaultError(t: OpsDict, code: string): string {
  if (code === "too_large") return t.vault.tooLarge;
  if (code === "bad_type") return t.vault.badType;
  return opsError(t, code);
}

export default function VaultPanel({ board }: { board: TourBoard; reload: () => Promise<void> }) {
  const { t } = useOps();
  const manage = board.access === "owner" || board.access === "manager";
  const [docs, setDocs] = useState<TourDocument[]>([]);
  const [logistics, setLogistics] = useState<Logistics[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Apartment> | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: rpcError } = await supabase.rpc(manage ? "voyage_tour_vault" : "voyage_tour_apartments", { p_tour: board.tour.id });
    setLoading(false);
    if (rpcError) {
      setError(opsError(t, errorCode(rpcError.message)));
      return;
    }
    const d = obj(data);
    setDocs(parseDocuments(d.documents));
    setLogistics(parseLogistics(d.logistics));
    setApartments((Array.isArray(d.apartments) ? d.apartments : []).map(parseApartment));
  }, [board.tour.id, manage, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const logisticsOf = (modelId: string) => logistics.find((l) => l.modelId === modelId);

  const toggleCheckIn = async (modelId: string, on: boolean) => {
    const r = await setCheckedIn(board.tour.id, modelId, on);
    if (!r.ok) setError(opsError(t, r.code));
    else await load();
  };

  const pickApartment = async (modelId: string, apartmentId: string) => {
    const r = await assignApartment(board.tour.id, modelId, apartmentId || null);
    if (!r.ok) setError(opsError(t, r.code));
    else await load();
  };

  const removeApartment = async (id: string) => {
    if (!window.confirm(`${t.common.remove}?`)) return;
    const r = await deleteApartment(id);
    if (!r.ok) setError(opsError(t, r.code));
    else await load();
  };

  if (loading) return <p className="text-sm text-zinc-500">{t.common.loading}</p>;

  return (
    <div className="space-y-5">
      {error && <Notice tone="rose">{error}</Notice>}

      <Panel className="p-5">
        <p className="mb-3 text-base text-zinc-50">{t.vault.checklist}</p>
        <ul className="divide-y divide-zinc-800/80">
          {board.models.map((m) => {
            const lg = logisticsOf(m.id);
            const myDocs = docs.filter((d) => d.modelId === m.id);
            const hasTicket = manage ? myDocs.some((d) => d.kind === "ticket" || d.kind === "boarding_pass") : m.ticketUploaded;
            const checked = Boolean(lg?.checkedInAt ?? m.checkedInAt);
            return (
              <li key={m.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="min-w-[8rem] flex-1 text-sm text-zinc-100">{m.name}</span>
                  <span className={`inline-flex items-center gap-1 text-[12px] ${hasTicket ? "text-emerald-300" : "text-zinc-500"}`}>
                    {hasTicket ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />} {t.vault.ticket}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCheckIn(m.id, !checked)}
                    className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[12px] ${checked ? "border-emerald-400/40 text-emerald-200" : "border-zinc-800 text-zinc-400 hover:text-zinc-200"}`}
                    title={checked ? t.vault.unmarkCheckedIn : t.vault.markCheckedIn}
                  >
                    {checked ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />} {t.vault.checkedIn}
                  </button>
                  {manage ? (
                    <select className={`${INPUT} w-auto min-w-[9rem]`} value={lg?.apartmentId ?? ""} onChange={(e) => pickApartment(m.id, e.target.value)} aria-label={t.vault.assign}>
                      <option value="">{t.vault.noApartment}</option>
                      {apartments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                  ) : (
                    <span className="text-[12px] text-zinc-400">{apartments.find((a) => a.id === lg?.apartmentId)?.title ?? t.vault.noApartment}</span>
                  )}
                  {manage && (
                    <button type="button" className={BTN_GHOST} onClick={() => setUploadFor(m.id)}><Upload className="size-3.5" /> {t.vault.upload}</button>
                  )}
                </div>
                {manage && myDocs.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {myDocs.map((d) => (
                      <li key={d.id}>
                        <button type="button" onClick={() => openVaultFile(d.storagePath)} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-zinc-800 px-3 text-[11px] text-zinc-300 hover:border-amber-200/40">
                          <Download className="size-3" /> {t.vault.kind[d.kind]} · {d.fileName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-base text-zinc-50">{t.vault.apartments}</p>
          {manage && <button type="button" className={BTN_GHOST} onClick={() => setEditing({})}><Plus className="size-3.5" /> {t.vault.addApartment}</button>}
        </div>
        {apartments.length === 0 && <p className="text-sm text-zinc-500">{t.vault.noApartments}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {apartments.map((a) => (
            <ApartmentCard key={a.id} a={a} t={t} onEdit={manage ? () => setEditing(a) : undefined} onDelete={manage ? () => removeApartment(a.id) : undefined} />
          ))}
        </div>
      </div>

      {editing && (
        <ApartmentForm
          tourId={board.tour.id}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
      {uploadFor && (
        <UploadDialog
          tourId={board.tour.id}
          modelId={uploadFor}
          modelName={board.models.find((m) => m.id === uploadFor)?.name ?? ""}
          onClose={() => setUploadFor(null)}
          onDone={async () => {
            setUploadFor(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function UploadDialog({ tourId, modelId, modelName, onClose, onDone }: { tourId: string; modelId: string; modelName: string; onClose: () => void; onDone: () => void }) {
  const { t } = useOps();
  const [kind, setKind] = useState<DocKind>("ticket");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!file) return;
    setBusy(true);
    const code = await uploadVaultFile(tourId, modelId, kind, file);
    setBusy(false);
    if (code) setError(vaultError(t, code));
    else onDone();
  };
  return (
    <Modal open title={`${t.vault.upload} · ${modelName}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label={t.vault.title}>
          <select className={INPUT} value={kind} onChange={(e) => setKind(e.target.value as DocKind)}>
            {DOC_KINDS.map((k) => <option key={k} value={k}>{t.vault.kind[k]}</option>)}
          </select>
        </Field>
        <input type="file" accept={VAULT_TYPES.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-zinc-300 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-zinc-100" />
        {error && <Notice tone="rose">{error}</Notice>}
        <button type="button" className={BTN_GOLD} disabled={busy || !file} onClick={submit}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {busy ? t.vault.uploading : t.vault.upload}
        </button>
      </div>
    </Modal>
  );
}

function ApartmentForm({ tourId, initial, onClose, onSaved }: { tourId: string; initial: Partial<Apartment>; onClose: () => void; onSaved: () => void }) {
  const { t } = useOps();
  const [f, setF] = useState<ApartmentInput>({
    id: initial.id ?? null,
    tourId,
    title: initial.title ?? "",
    address: initial.address ?? "",
    mapUrl: initial.mapUrl ?? "",
    entranceCode: initial.entranceCode ?? "",
    intercomCode: initial.intercomCode ?? "",
    safeCode: initial.safeCode ?? "",
    wifi: initial.wifi ?? "",
    hostContact: initial.hostContact ?? "",
    notes: initial.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof ApartmentInput) => (e: { target: { value: string } }) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    const r = await saveApartment(f);
    setBusy(false);
    if (!r.ok) setError(opsError(t, r.code));
    else onSaved();
  };
  return (
    <Modal open wide title={initial.id ? t.common.edit : t.vault.addApartment} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.apartment.title}><input className={INPUT} value={f.title} onChange={set("title")} placeholder={t.apartment.namePlaceholder} maxLength={80} /></Field>
        <Field label={t.apartment.map}><input className={INPUT} value={f.mapUrl ?? ""} onChange={set("mapUrl")} placeholder="https://maps.google.com/…" maxLength={500} /></Field>
        <Field label={t.apartment.address} className="sm:col-span-2"><input className={INPUT} value={f.address} onChange={set("address")} maxLength={300} /></Field>
        <Field label={t.apartment.entrance}><input className={INPUT} value={f.entranceCode ?? ""} onChange={set("entranceCode")} maxLength={60} /></Field>
        <Field label={t.apartment.intercom}><input className={INPUT} value={f.intercomCode ?? ""} onChange={set("intercomCode")} maxLength={60} /></Field>
        <Field label={t.apartment.safe}><input className={INPUT} value={f.safeCode ?? ""} onChange={set("safeCode")} maxLength={60} /></Field>
        <Field label={t.apartment.wifi}><input className={INPUT} value={f.wifi ?? ""} onChange={set("wifi")} maxLength={120} /></Field>
        <Field label={t.apartment.host} className="sm:col-span-2"><input className={INPUT} value={f.hostContact ?? ""} onChange={set("hostContact")} maxLength={200} /></Field>
        <Field label={t.apartment.notes} className="sm:col-span-2"><textarea className={`${INPUT} min-h-20 py-2`} value={f.notes ?? ""} onChange={set("notes")} maxLength={1000} /></Field>
      </div>
      {error && <div className="mt-3"><Notice tone="rose">{error}</Notice></div>}
      <div className="mt-4 flex gap-2">
        <button type="button" className={BTN_GOLD} disabled={busy || !f.title.trim() || !f.address.trim()} onClick={submit}>{busy ? t.common.saving : t.common.save}</button>
        <button type="button" className={BTN_GHOST} onClick={onClose}>{t.common.cancel}</button>
      </div>
    </Modal>
  );
}
