"use client";

import { Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import {
  bunkerSecurityStatus,
  changeMasterPin,
  removeDuressPin,
  setDuressPin,
  type UnlockResult,
} from "@/app/actions/bunker";
import { useBunkerLock } from "@/app/bunker/_components/BunkerLock";
import { useBunkerToast } from "@/app/bunker/_components/toast";
import { Button, ConfirmButton, Sheet, cx, inputClass } from "@/app/bunker/_components/ui";
import { bunkerDb } from "@/app/bunker/_lib/db";
import { createVaultKeyMaterial, decryptSecret, encryptSecret, isValidPin, unlockVault } from "@/lib/bunker/crypto";
import { buildDecoySeed } from "@/lib/bunker/decoy";
import type { BunkerVaultKeys, BunkerVaultRow } from "@/lib/bunker/types";

/* ──────────────────────────────────────────────────────────────────────
 * «Безопасность»: смена Master PIN и Duress PIN.
 *
 * В режиме Duress этот экран выглядит так же, а Duress PIN в нём
 * «не задан»; любые изменения отвечают «Неверный Master PIN».
 * ──────────────────────────────────────────────────────────────────── */

function message(res: UnlockResult, fallback = "Неверный Master PIN") {
  if (res.status === "locked") return `Слишком много попыток. Подожди ${res.retryAfter} с`;
  if (res.status === "error") return res.message;
  return fallback;
}

function PinInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={8}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder={placeholder}
      className={cx(inputClass, "font-mono tracking-[0.35em] placeholder:tracking-normal")}
    />
  );
}

export function SecuritySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useBunkerToast();
  const { vault, setVault, lock } = useBunkerLock();
  const [hasDuress, setHasDuress] = useState<boolean | null>(null);

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [masterBusy, setMasterBusy] = useState(false);
  const [masterError, setMasterError] = useState<string | null>(null);

  const [dMaster, setDMaster] = useState("");
  const [duress, setDuress] = useState("");
  const [duress2, setDuress2] = useState("");
  const [duressBusy, setDuressBusy] = useState(false);
  const [duressError, setDuressError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setHasDuress(null);
    bunkerSecurityStatus()
      .then((s) => setHasDuress(s.hasDuress))
      .catch(() => setHasDuress(false));
  }, [open]);

  /* ── смена Master PIN: перешифровываем сейф и меняем PIN одной транзакцией ── */
  const changeMaster = async () => {
    setMasterError(null);
    if (!isValidPin(next) || next !== next2) return setMasterError("Новый PIN: 4–8 цифр, оба раза одинаково");
    setMasterBusy(true);
    try {
      const keysRes = await bunkerDb<BunkerVaultKeys[]>({ kind: "select", table: "bunker_vault_keys" });
      const keys = keysRes.data?.[0] ?? null;
      let payload = null;
      let newKey: CryptoKey | null = null;
      let newRow = null;
      if (keys) {
        const oldKey = await unlockVault(cur, keys, keys.uses_pepper ? (vault?.pepper ?? null) : null);
        if (oldKey) {
          const rowsRes = await bunkerDb<BunkerVaultRow[]>({ kind: "select", table: "bunker_vault" });
          const material = await createVaultKeyMaterial(next, vault?.pepper ?? null);
          const items = [];
          for (const row of rowsRes.data ?? []) {
            const secret = await decryptSecret(oldKey, row.category, row.ciphertext, row.iv);
            items.push({ id: row.id, ...(await encryptSecret(material.key, row.category, secret)) });
          }
          payload = { ...material.row, items };
          newKey = material.key;
          newRow = material.row;
        }
      }
      const res = await changeMasterPin(cur, next, payload);
      if (res.status !== "ok") return setMasterError(message(res));
      if (newKey && newRow && keys) setVault({ key: newKey, keys: { ...keys, ...newRow }, pepper: vault?.pepper ?? null, status: "ready" });
      setCur("");
      setNext("");
      setNext2("");
      notify("Master PIN изменён, сейф перешифрован");
    } catch {
      setMasterError("Не получилось, обнови страницу");
    } finally {
      setMasterBusy(false);
    }
  };

  /* ── Duress PIN: камуфляж собирается и шифруется здесь же ── */
  const saveDuress = async () => {
    setDuressError(null);
    if (!isValidPin(duress) || duress !== duress2) return setDuressError("Duress PIN: 4–8 цифр, оба раза одинаково");
    if (duress === dMaster) return setDuressError("Duress PIN должен отличаться от Master PIN");
    setDuressBusy(true);
    try {
      const seed = await buildDecoySeed(duress, vault?.pepper ?? null);
      const res = await setDuressPin(dMaster, duress, seed);
      if (res.status !== "ok") return setDuressError(message(res));
      setHasDuress(true);
      setDMaster("");
      setDuress("");
      setDuress2("");
      notify("Duress PIN сохранён, камуфляж готов");
    } catch {
      setDuressError("Не получилось, обнови страницу");
    } finally {
      setDuressBusy(false);
    }
  };

  const dropDuress = async () => {
    setDuressError(null);
    setDuressBusy(true);
    const res = await removeDuressPin(dMaster).catch(() => ({ status: "error", message: "Нет связи" }) as UnlockResult);
    setDuressBusy(false);
    if (res.status !== "ok") return setDuressError(message(res));
    setHasDuress(false);
    setDMaster("");
    notify("Duress PIN удалён вместе с камуфляжем");
  };

  return (
    <Sheet open={open} onClose={onClose} title="Безопасность">
      <div className="space-y-6">
        <Button tone="outline" className="w-full" onClick={lock}>
          <Lock className="h-4 w-4" /> Заблокировать сейчас
        </Button>

        <section className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-[#c9a961]" /> Master PIN
          </p>
          <PinInput value={cur} onChange={setCur} placeholder="Текущий Master PIN" />
          <PinInput value={next} onChange={setNext} placeholder="Новый PIN (4–8 цифр)" />
          <PinInput value={next2} onChange={setNext2} placeholder="Новый PIN ещё раз" />
          {masterError && <p className="text-sm text-red-300">{masterError}</p>}
          <Button className="w-full" disabled={masterBusy || !cur || !next} onClick={changeMaster}>
            {masterBusy ? "Перешифровываю…" : "Сменить Master PIN"}
          </Button>
        </section>

        <section className="space-y-3 rounded-2xl border border-white/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <ShieldAlert className="h-4 w-4 text-[#c9a961]" /> Duress PIN
            <span className="ml-auto text-xs font-normal text-zinc-500">
              {hasDuress === null ? "…" : hasDuress ? "задан" : "не задан"}
            </span>
          </p>
          <p className="text-[13px] leading-relaxed text-zinc-500">
            Код для принуждения. Он открывает бункер без ошибок, но показывает обычную бытовую жизнь: продукты,
            автомойка, мелкие расходы, пара Wi-Fi паролей. Настоящие данные в этом режиме недоступны даже серверу.
            Задать заново — значит пересоздать камуфляж.
          </p>
          <PinInput value={dMaster} onChange={setDMaster} placeholder="Master PIN для подтверждения" />
          <PinInput value={duress} onChange={setDuress} placeholder="Duress PIN (4–8 цифр)" />
          <PinInput value={duress2} onChange={setDuress2} placeholder="Duress PIN ещё раз" />
          {duressError && <p className="text-sm text-red-300">{duressError}</p>}
          <Button className="w-full" disabled={duressBusy || !dMaster || !duress} onClick={saveDuress}>
            {duressBusy ? "Готовлю камуфляж…" : hasDuress ? "Заменить Duress PIN" : "Задать Duress PIN"}
          </Button>
          {hasDuress && (
            <div className="flex justify-center">
              <ConfirmButton onConfirm={dropDuress} confirmLabel="Удалить Duress PIN?">
                Убрать Duress PIN
              </ConfirmButton>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
