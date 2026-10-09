"use client";

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN · INVITATIONS — клиентский интерфейс
 * app/(dashboard)/admin/invites/AdminInvitesClient.tsx
 *
 * Три вкладки:
 *   1. Модерация      — анкеты, открытые по ключу (pending): кто гостья,
 *                       кто поручительница, её Circle, репутация и вся
 *                       цепочка. Одобрить / отклонить.
 *   2. Все ключи      — реестр ключей по сезонам и статусам; отозвать
 *                       ключ, сжечь или восстановить поручительство.
 *   3. Поручительницы — кто кого привёл: квота сезона, итоги, протеже.
 *
 * Все действия — RPC club_invite_action (миграция 20261009_club_invites):
 * сервер проверяет права и допустимость перехода, а Индекс поручительницы
 * пересчитывает вью v_global_leaderboard — дивиденды начисляются или
 * снимаются в момент решения.
 * ──────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  Crown,
  DoorOpen,
  Flame,
  Hourglass,
  Inbox,
  KeyRound,
  ListFilter,
  Loader2,
  Mail,
  Plane,
  Search,
  ShieldAlert,
  Undo2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/app/context/LanguageContext";
import { normalizeLang, type CircleConfig, type CircleKey, type Lang } from "@/lib/gamification";
import {
  ACTIONS_BY_STATUS,
  INVITE_STATUSES,
  MILESTONES,
  buildChains,
  inviteErrorCode,
  type ClubInvite,
  type ClubInviteStatus,
  type InviteAction,
  type Milestone,
} from "@/lib/patronage";

// Шрифт объявлен один раз и экспортируется — page.tsx берёт его отсюда.
export const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

/* ══════════════════════════════════════════════════════════════════
 * i18n
 * ══════════════════════════════════════════════════════════════════ */

const LOCALES: Record<Lang, string> = { en: "en-US", ru: "ru-RU", es: "es-ES", pt: "pt-BR" };

const en = {
  // страница
  eyebrow: "Voyage · Admin",
  title: "Invitations",
  subtitle:
    "Season keys, sponsorship chains and the moderation queue. A decision credits or withdraws the sponsor's Influence Index instantly.",
  refresh: "Refresh",
  loading: "Loading keys and applications…",
  loadFailed: "Failed to load invitations",
  refreshFailed: "Failed to refresh — showing the last loaded version",
  retry: "Retry",
  networkError: "Network error",
  migrationHint: "It looks like the club_invites migration hasn't been applied in Supabase yet.",
  noAccessTitle: "Owner and administrators only",
  noAccessBody:
    "Invitations, sponsorship chains and their dividends are managed by the club's owner and administrators.",
  backToConsole: "Back to the console",
  live: "Live",
  offline: "Offline",
  statPending: "Awaiting review",
  statSealed: "Keys in circulation",
  statAdmitted: (y: number) => `Admitted · ${y}`,
  statDividends: "Dividends credited",
  // вкладки
  tabQueue: "Moderation",
  tabLedger: "All keys",
  tabPatrons: "Sponsors",
  // статусы
  status: {
    sealed: "Sealed",
    pending: "Awaiting review",
    approved: "Admitted",
    declined: "Declined",
    expired: "Expired",
    burned: "Sponsorship burned",
  } as Record<ClubInviteStatus, string>,
  touring: "On tour",
  milestone: {
    approved: "Admitted",
    firstStamp: "First visa stamp",
    innerCircle: "Inner Circle",
  } as Record<Milestone, string>,
  milestoneState: (label: string, done: boolean) => `${label}: ${done ? "reached" : "not yet"}`,
  // очередь
  queueEmptyTitle: "The queue is clear",
  queueEmptyNote: "Applications opened with a key appear here on their own.",
  applied: (d: string) => `Applied ${d}`,
  keyLabel: "Key",
  nameOnKey: (n: string) => `on the key: ${n}`,
  invitedBy: "Invited by resident",
  sponsorRecord: (a: number, d: number, b: number) => `Record: ${a} admitted · ${d} declined · ${b} burned`,
  firstProtege: "Her first protégée",
  chain: "Chain",
  approve: "Approve",
  decline: "Decline",
  approveHint: (name: string) => `to ${name}'s Influence Index`,
  declineTitle: "Decline the application",
  declineWarn: (name: string) => `The key burns — it will not return to ${name}.`,
  notePlaceholder: "Reason — visible to staff only",
  cancel: "Cancel",
  // реестр
  searchPlaceholder: "Guest, sponsor or key…",
  searchAria: "Search keys",
  allSeasons: "All seasons",
  season: (y: number) => `Season ${y}`,
  filterAll: "All",
  filterAttention: "Need attention",
  colKey: "Key",
  colGuest: "Guest",
  colSponsor: "Sponsor",
  colStatus: "Status",
  colDividends: "Dividends",
  ledgerEmpty: "No keys have been issued yet.",
  noResults: "No keys match the filters.",
  details: "Details",
  issued: "Issued",
  validUntil: "Valid until",
  redeemed: "Key opened",
  decided: "Decision",
  burnedAt: "Burned",
  by: (n: string) => `by ${n}`,
  note: "Note",
  email: "Email",
  guestBlocked: "Guest blocked",
  blockedHint: "The guest is blocked, yet her sponsor still receives dividends.",
  notRedeemed: "Not opened yet",
  // действия
  burn: "Burn sponsorship",
  burnTitle: "Burn the sponsorship",
  burnWarn: (name: string, points: string) =>
    `${name} loses ${points} of Influence Index — everything this protégée brought. The key will not return.`,
  burnWarnZero: (name: string) => `${name} has no dividends from her yet. The key will not return.`,
  blockGuest: "Also block the guest in the club",
  restore: "Restore",
  restoreWarn: (name: string, points: string) => `${name} gets ${points} back.`,
  revoke: "Revoke key",
  revokeWarn: (name: string) => `The key stops working and returns to ${name}.`,
  confirm: "Confirm",
  // уведомления
  toast: {
    approve: (guest: string, patron: string, points: string) => `${guest} admitted · ${points} to ${patron}`,
    decline: (guest: string) => `${guest} declined · the key has burned`,
    burn: (guest: string, patron: string, points: string) => `Sponsorship of ${guest} burned · ${points} for ${patron}`,
    restore: (guest: string, patron: string, points: string) =>
      `Sponsorship of ${guest} restored · ${points} to ${patron}`,
    revoke: (guest: string, patron: string) => `Key for ${guest} revoked · returned to ${patron}`,
  },
  errForbidden: "Staff only — no permission for this action.",
  errTransition: "The status has already changed. Data refreshed.",
  errMigration: "The club_invites migration hasn't been applied in Supabase yet.",
  errGeneric: "The action failed. Try again.",
  // поручительницы
  patronsEmpty: "No sponsors yet — keys appear as residents issue them.",
  invitedByName: (n: string) => `invited by ${n}`,
  founder: "Founding member",
  seasonKeys: (y: number) => `Keys · ${y}`,
  keysOf: (used: number, total: number) => `${used} of ${total}`,
  admittedN: "admitted",
  pendingN: "in review",
  declinedN: "declined",
  burnedN: "burned",
  credited: "credited",
  protegees: "Protégées",
  showInLedger: (n: string) => `Show ${n} in the ledger`,
};

type Dict = typeof en;

const ru: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Приглашения",
  subtitle:
    "Ключи сезона, цепочки поручительства и очередь модерации. Решение сразу начисляет или снимает баллы Influence Index поручительницы.",
  refresh: "Обновить",
  loading: "Загружаем ключи и анкеты…",
  loadFailed: "Не удалось загрузить приглашения",
  refreshFailed: "Не удалось обновить — показана последняя загруженная версия",
  retry: "Повторить",
  networkError: "Ошибка сети",
  migrationHint: "Похоже, миграция club_invites ещё не применена в Supabase.",
  noAccessTitle: "Только для владельца и администраторов",
  noAccessBody: "Приглашениями, цепочками поручительства и дивидендами управляют владелец клуба и администраторы.",
  backToConsole: "Вернуться в консоль",
  live: "Live",
  offline: "Offline",
  statPending: "На модерации",
  statSealed: "Ключей в обороте",
  statAdmitted: (y) => `Принято · ${y}`,
  statDividends: "Начислено дивидендов",
  tabQueue: "Модерация",
  tabLedger: "Все ключи",
  tabPatrons: "Поручительницы",
  status: {
    sealed: "Запечатан",
    pending: "На модерации",
    approved: "Принята",
    declined: "Отклонена",
    expired: "Истёк",
    burned: "Поручительство сожжено",
  },
  touring: "Летит в тур",
  milestone: {
    approved: "Принята в клуб",
    firstStamp: "Первый визовый штамп",
    innerCircle: "Inner Circle",
  },
  milestoneState: (label, done) => `${label}: ${done ? "да" : "пока нет"}`,
  queueEmptyTitle: "Очередь пуста",
  queueEmptyNote: "Анкеты, открытые по ключу, появятся здесь сами.",
  applied: (d) => `Анкета от ${d}`,
  keyLabel: "Ключ",
  nameOnKey: (n) => `на ключе: ${n}`,
  invitedBy: "Приглашена резидентом",
  sponsorRecord: (a, d, b) => `Репутация: принято ${a} · отклонено ${d} · сожжено ${b}`,
  firstProtege: "Её первая протеже",
  chain: "Цепочка",
  approve: "Одобрить",
  decline: "Отклонить",
  approveHint: (name) => `к Influence Index · ${name}`,
  declineTitle: "Отклонить анкету",
  declineWarn: (name) => `Ключ сгорит — к ${name} он не вернётся.`,
  notePlaceholder: "Причина — видна только персоналу",
  cancel: "Отмена",
  searchPlaceholder: "Гостья, поручительница или ключ…",
  searchAria: "Поиск по ключам",
  allSeasons: "Все сезоны",
  season: (y) => `Сезон ${y}`,
  filterAll: "Все",
  filterAttention: "Требуют внимания",
  colKey: "Ключ",
  colGuest: "Гостья",
  colSponsor: "Поручительница",
  colStatus: "Статус",
  colDividends: "Дивиденды",
  ledgerEmpty: "Ключей ещё не выдавали.",
  noResults: "Под фильтры ничего не подходит.",
  details: "Подробнее",
  issued: "Выдан",
  validUntil: "Действует до",
  redeemed: "Ключ открыт",
  decided: "Решение",
  burnedAt: "Сожжено",
  by: (n) => `· ${n}`,
  note: "Заметка",
  email: "Почта",
  guestBlocked: "Гостья заблокирована",
  blockedHint: "Гостья заблокирована, а поручительница всё ещё получает дивиденды.",
  notRedeemed: "Ещё не открыт",
  burn: "Сжечь поручительство",
  burnTitle: "Сжечь поручительство",
  burnWarn: (name, points) =>
    `${name} потеряет ${points} Influence Index — всё, что принесла эта протеже. Ключ не вернётся.`,
  burnWarnZero: (name) => `${name} ещё не получала дивидендов от неё. Ключ не вернётся.`,
  blockGuest: "Заодно заблокировать гостью в клубе",
  restore: "Восстановить",
  restoreWarn: (name, points) => `${name} получит обратно ${points}.`,
  revoke: "Отозвать ключ",
  revokeWarn: (name) => `Ключ перестанет работать и вернётся к ${name}.`,
  confirm: "Подтвердить",
  toast: {
    approve: (guest, patron, points) => `${guest} принята · ${points} у ${patron}`,
    decline: (guest) => `${guest} отклонена · ключ сгорел`,
    burn: (guest, patron, points) => `Поручительство за ${guest} сожжено · ${points} у ${patron}`,
    restore: (guest, patron, points) => `Поручительство за ${guest} восстановлено · ${points} у ${patron}`,
    revoke: (guest, patron) => `Ключ для ${guest} отозван и вернулся к ${patron}`,
  },
  errForbidden: "Только для персонала — нет прав на это действие.",
  errTransition: "Статус уже изменился. Данные обновлены.",
  errMigration: "Миграция club_invites ещё не применена в Supabase.",
  errGeneric: "Не получилось. Попробуйте ещё раз.",
  patronsEmpty: "Поручительниц пока нет — они появятся, когда резиденты начнут выдавать ключи.",
  invitedByName: (n) => `её привела ${n}`,
  founder: "Основательница цепочки",
  seasonKeys: (y) => `Ключи · ${y}`,
  keysOf: (used, total) => `${used} из ${total}`,
  admittedN: "приняты",
  pendingN: "на модерации",
  declinedN: "отклонены",
  burnedN: "сожжены",
  credited: "начислено",
  protegees: "Протеже",
  showInLedger: (n) => `Показать ${n} в реестре`,
};

const es: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Invitaciones",
  subtitle:
    "Llaves de la temporada, cadenas de madrinas y la cola de moderación. Cada decisión suma o resta al Influence Index de la madrina al instante.",
  refresh: "Actualizar",
  loading: "Cargando llaves y solicitudes…",
  loadFailed: "No se pudieron cargar las invitaciones",
  refreshFailed: "No se pudo actualizar: se muestra la última versión cargada",
  retry: "Reintentar",
  networkError: "Error de red",
  migrationHint: "Parece que la migración club_invites aún no se aplicó en Supabase.",
  noAccessTitle: "Solo para el propietario y los administradores",
  noAccessBody:
    "Las invitaciones, las cadenas de madrinas y sus dividendos los gestionan el propietario del club y los administradores.",
  backToConsole: "Volver a la consola",
  live: "Live",
  offline: "Offline",
  statPending: "En moderación",
  statSealed: "Llaves en circulación",
  statAdmitted: (y) => `Admitidas · ${y}`,
  statDividends: "Dividendos abonados",
  tabQueue: "Moderación",
  tabLedger: "Todas las llaves",
  tabPatrons: "Madrinas",
  status: {
    sealed: "Sellada",
    pending: "En moderación",
    approved: "Admitida",
    declined: "Rechazada",
    expired: "Caducada",
    burned: "Madrinazgo quemado",
  },
  touring: "De gira",
  milestone: {
    approved: "Admitida en el club",
    firstStamp: "Primer sello de visado",
    innerCircle: "Inner Circle",
  },
  milestoneState: (label, done) => `${label}: ${done ? "sí" : "todavía no"}`,
  queueEmptyTitle: "La cola está vacía",
  queueEmptyNote: "Las solicitudes abiertas con llave aparecerán aquí solas.",
  applied: (d) => `Solicitud del ${d}`,
  keyLabel: "Llave",
  nameOnKey: (n) => `en la llave: ${n}`,
  invitedBy: "Invitada por la residente",
  sponsorRecord: (a, d, b) => `Historial: ${a} admitidas · ${d} rechazadas · ${b} quemadas`,
  firstProtege: "Su primera protegida",
  chain: "Cadena",
  approve: "Aprobar",
  decline: "Rechazar",
  approveHint: (name) => `al Influence Index · ${name}`,
  declineTitle: "Rechazar la solicitud",
  declineWarn: (name) => `La llave se quema: no volverá a ${name}.`,
  notePlaceholder: "Motivo: solo lo ve el personal",
  cancel: "Cancelar",
  searchPlaceholder: "Invitada, madrina o llave…",
  searchAria: "Buscar llaves",
  allSeasons: "Todas las temporadas",
  season: (y) => `Temporada ${y}`,
  filterAll: "Todas",
  filterAttention: "Requieren atención",
  colKey: "Llave",
  colGuest: "Invitada",
  colSponsor: "Madrina",
  colStatus: "Estado",
  colDividends: "Dividendos",
  ledgerEmpty: "Todavía no se ha emitido ninguna llave.",
  noResults: "Ninguna llave coincide con los filtros.",
  details: "Detalles",
  issued: "Emitida",
  validUntil: "Válida hasta",
  redeemed: "Llave abierta",
  decided: "Decisión",
  burnedAt: "Quemado",
  by: (n) => `· ${n}`,
  note: "Nota",
  email: "Correo",
  guestBlocked: "Invitada bloqueada",
  blockedHint: "La invitada está bloqueada, pero su madrina sigue recibiendo dividendos.",
  notRedeemed: "Aún sin abrir",
  burn: "Quemar madrinazgo",
  burnTitle: "Quemar el madrinazgo",
  burnWarn: (name, points) =>
    `${name} pierde ${points} de Influence Index: todo lo que aportó esta protegida. La llave no volverá.`,
  burnWarnZero: (name) => `${name} aún no recibió dividendos de ella. La llave no volverá.`,
  blockGuest: "Bloquear también a la invitada en el club",
  restore: "Restaurar",
  restoreWarn: (name, points) => `${name} recupera ${points}.`,
  revoke: "Revocar llave",
  revokeWarn: (name) => `La llave deja de funcionar y vuelve a ${name}.`,
  confirm: "Confirmar",
  toast: {
    approve: (guest, patron, points) => `${guest} admitida · ${points} para ${patron}`,
    decline: (guest) => `${guest} rechazada · la llave se quemó`,
    burn: (guest, patron, points) => `Madrinazgo de ${guest} quemado · ${points} para ${patron}`,
    restore: (guest, patron, points) => `Madrinazgo de ${guest} restaurado · ${points} para ${patron}`,
    revoke: (guest, patron) => `Llave de ${guest} revocada · vuelve a ${patron}`,
  },
  errForbidden: "Solo personal: no tiene permiso para esta acción.",
  errTransition: "El estado ya cambió. Datos actualizados.",
  errMigration: "La migración club_invites aún no se aplicó en Supabase.",
  errGeneric: "No se pudo completar. Inténtelo de nuevo.",
  patronsEmpty: "Aún no hay madrinas: aparecerán cuando las residentes emitan llaves.",
  invitedByName: (n) => `la invitó ${n}`,
  founder: "Fundadora de la cadena",
  seasonKeys: (y) => `Llaves · ${y}`,
  keysOf: (used, total) => `${used} de ${total}`,
  admittedN: "admitidas",
  pendingN: "en moderación",
  declinedN: "rechazadas",
  burnedN: "quemadas",
  credited: "abonado",
  protegees: "Protegidas",
  showInLedger: (n) => `Mostrar ${n} en el registro`,
};

const pt: Dict = {
  eyebrow: "Voyage · Admin",
  title: "Convites",
  subtitle:
    "Chaves da temporada, cadeias de madrinhas e a fila de moderação. Cada decisão credita ou retira pontos do Influence Index da madrinha na hora.",
  refresh: "Atualizar",
  loading: "Carregando chaves e candidaturas…",
  loadFailed: "Falha ao carregar os convites",
  refreshFailed: "Falha ao atualizar — exibindo a última versão carregada",
  retry: "Tentar de novo",
  networkError: "Erro de rede",
  migrationHint: "Parece que a migração club_invites ainda não foi aplicada no Supabase.",
  noAccessTitle: "Só para o proprietário e administradores",
  noAccessBody:
    "Convites, cadeias de madrinhas e seus dividendos são geridos pelo proprietário do clube e pelos administradores.",
  backToConsole: "Voltar ao console",
  live: "Live",
  offline: "Offline",
  statPending: "Em moderação",
  statSealed: "Chaves em circulação",
  statAdmitted: (y) => `Aceitas · ${y}`,
  statDividends: "Dividendos creditados",
  tabQueue: "Moderação",
  tabLedger: "Todas as chaves",
  tabPatrons: "Madrinhas",
  status: {
    sealed: "Selada",
    pending: "Em moderação",
    approved: "Aceita",
    declined: "Recusada",
    expired: "Expirada",
    burned: "Apadrinhamento queimado",
  },
  touring: "Em turnê",
  milestone: {
    approved: "Aceita no clube",
    firstStamp: "Primeiro carimbo de visto",
    innerCircle: "Inner Circle",
  },
  milestoneState: (label, done) => `${label}: ${done ? "sim" : "ainda não"}`,
  queueEmptyTitle: "A fila está vazia",
  queueEmptyNote: "Candidaturas abertas com chave aparecem aqui sozinhas.",
  applied: (d) => `Candidatura de ${d}`,
  keyLabel: "Chave",
  nameOnKey: (n) => `na chave: ${n}`,
  invitedBy: "Convidada pela residente",
  sponsorRecord: (a, d, b) => `Histórico: ${a} aceitas · ${d} recusadas · ${b} queimadas`,
  firstProtege: "A primeira protegida dela",
  chain: "Cadeia",
  approve: "Aprovar",
  decline: "Recusar",
  approveHint: (name) => `no Influence Index · ${name}`,
  declineTitle: "Recusar a candidatura",
  declineWarn: (name) => `A chave queima — não volta para ${name}.`,
  notePlaceholder: "Motivo — visível só para a equipe",
  cancel: "Cancelar",
  searchPlaceholder: "Convidada, madrinha ou chave…",
  searchAria: "Buscar chaves",
  allSeasons: "Todas as temporadas",
  season: (y) => `Temporada ${y}`,
  filterAll: "Todas",
  filterAttention: "Pedem atenção",
  colKey: "Chave",
  colGuest: "Convidada",
  colSponsor: "Madrinha",
  colStatus: "Status",
  colDividends: "Dividendos",
  ledgerEmpty: "Nenhuma chave foi emitida ainda.",
  noResults: "Nenhuma chave corresponde aos filtros.",
  details: "Detalhes",
  issued: "Emitida",
  validUntil: "Válida até",
  redeemed: "Chave aberta",
  decided: "Decisão",
  burnedAt: "Queimado",
  by: (n) => `· ${n}`,
  note: "Nota",
  email: "E-mail",
  guestBlocked: "Convidada bloqueada",
  blockedHint: "A convidada está bloqueada, mas a madrinha ainda recebe dividendos.",
  notRedeemed: "Ainda não aberta",
  burn: "Queimar apadrinhamento",
  burnTitle: "Queimar o apadrinhamento",
  burnWarn: (name, points) =>
    `${name} perde ${points} de Influence Index — tudo o que esta protegida trouxe. A chave não volta.`,
  burnWarnZero: (name) => `${name} ainda não recebeu dividendos dela. A chave não volta.`,
  blockGuest: "Bloquear também a convidada no clube",
  restore: "Restaurar",
  restoreWarn: (name, points) => `${name} recebe de volta ${points}.`,
  revoke: "Revogar chave",
  revokeWarn: (name) => `A chave deixa de funcionar e volta para ${name}.`,
  confirm: "Confirmar",
  toast: {
    approve: (guest, patron, points) => `${guest} aceita · ${points} para ${patron}`,
    decline: (guest) => `${guest} recusada · a chave queimou`,
    burn: (guest, patron, points) => `Apadrinhamento de ${guest} queimado · ${points} para ${patron}`,
    restore: (guest, patron, points) => `Apadrinhamento de ${guest} restaurado · ${points} para ${patron}`,
    revoke: (guest, patron) => `Chave de ${guest} revogada · voltou para ${patron}`,
  },
  errForbidden: "Só para a equipe — sem permissão para esta ação.",
  errTransition: "O status já mudou. Dados atualizados.",
  errMigration: "A migração club_invites ainda não foi aplicada no Supabase.",
  errGeneric: "Não deu certo. Tente novamente.",
  patronsEmpty: "Ainda não há madrinhas — aparecem quando as residentes emitirem chaves.",
  invitedByName: (n) => `convidada por ${n}`,
  founder: "Fundadora da cadeia",
  seasonKeys: (y) => `Chaves · ${y}`,
  keysOf: (used, total) => `${used} de ${total}`,
  admittedN: "aceitas",
  pendingN: "em moderação",
  declinedN: "recusadas",
  burnedN: "queimadas",
  credited: "creditado",
  protegees: "Protegidas",
  showInLedger: (n) => `Mostrar ${n} no registro`,
};

const T: Record<Lang, Dict> = { en, ru, es, pt };

/** Словарь + форматтеры для текущего языка. Экспортируется для page.tsx. */
export function useInvitesI18n() {
  const ctx: unknown = useLanguage();
  const raw =
    ctx && typeof ctx === "object"
      ? ((ctx as Record<string, unknown>).lang ?? (ctx as Record<string, unknown>).language)
      : ctx;
  const lang = normalizeLang(raw);
  const locale = LOCALES[lang];
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const df = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
    return { format: (d: Date) => f.format(d).replace(/\s?г\.$/, "") };
  }, [locale]);
  const dtf = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
    [locale],
  );
  return { lang, locale, t: T[lang], nf, df, dtf };
}

type I18n = ReturnType<typeof useInvitesI18n>;

/* ══════════════════════════════════════════════════════════════════
 * Типы
 * ══════════════════════════════════════════════════════════════════ */

export type InvitesTab = "queue" | "ledger" | "patrons";

export type AdminInvitesProps = {
  invites: ClubInvite[];
  /** пороги и названия Circle из БД (resolveCircles) */
  circles: CircleConfig[];
  /** дивиденды за этапы (resolveDividends) */
  dividends: Record<Milestone, number>;
  /** ключей на сезон по Circle (resolveQuota) */
  quota: Record<CircleKey, number>;
  /** текущий сезон (календарный год) */
  season: number;
  defaultTab?: InvitesTab;
  /** решение принято — патч строки сразу, затем страница перечитает витрину */
  onChanged?: (id: string, patch: Partial<ClubInvite>) => void;
};

type StatusFilter = ClubInviteStatus | "all" | "attention";

/* ══════════════════════════════════════════════════════════════════
 * Оформление
 * ══════════════════════════════════════════════════════════════════ */

/** container queries: строки реестра и карточки очереди подстраиваются под
 * ширину контента (у дашборда сайдбар), а не под ширину окна */
const INVITES_CSS = `
.inv-ledger { container: inv-ledger / inline-size }
.inv-row {
  display: grid; gap: .75rem 1rem; align-items: center;
  grid-template-columns: minmax(0, 1fr) 5.5rem 2.25rem;
  grid-template-areas: "guest guest chev" "patron patron patron" "status div div" "key key key";
}
.inv-c-key { grid-area: key } .inv-c-guest { grid-area: guest } .inv-c-patron { grid-area: patron }
.inv-c-status { grid-area: status } .inv-c-div { grid-area: div } .inv-c-chev { grid-area: chev }
.inv-head { display: none }
@container inv-ledger (min-width: 38rem) {
  .inv-row {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 6rem 2.25rem;
    grid-template-areas: "guest patron div chev" "key status status status";
  }
}
@container inv-ledger (min-width: 56rem) {
  .inv-row, .inv-head { grid-template-columns: 8.5rem minmax(0, 1.3fr) minmax(0, 1fr) 12.5rem 6rem 2.25rem; gap: 1rem; align-items: center }
  .inv-row { grid-template-areas: "key guest patron status div chev" }
  .inv-head { display: grid }
}
.inv-queue { container: inv-queue / inline-size }
.inv-card-body { display: grid; gap: 1.25rem; grid-template-columns: minmax(0, 1fr) }
@container inv-queue (min-width: 44rem) {
  .inv-card-body { grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 2rem }
}
`;

const CIRCLE_BADGE: Record<CircleKey, string> = {
  voyager: "border-zinc-700/80 bg-zinc-800/50 text-zinc-400",
  resident: "border-zinc-600/70 bg-zinc-800/60 text-zinc-200",
  preferred: "border-amber-200/20 bg-amber-200/[0.04] text-amber-200/70",
  inner: "border-amber-200/35 bg-amber-200/[0.07] text-amber-200",
  private: "border-slate-200/30 bg-slate-200/[0.06] text-slate-100",
  black: "border-amber-100/50 bg-black text-amber-100",
};

const STATUS_STYLE: Record<ClubInviteStatus, { icon: LucideIcon; cls: string; dot: string }> = {
  sealed: { icon: Mail, cls: "border-slate-200/20 text-slate-300", dot: "bg-slate-300" },
  pending: { icon: Hourglass, cls: "border-amber-200/30 bg-amber-200/[0.05] text-amber-200", dot: "bg-amber-200" },
  approved: { icon: DoorOpen, cls: "border-slate-200/25 text-slate-100", dot: "bg-slate-100" },
  declined: { icon: X, cls: "border-zinc-800 text-zinc-500", dot: "bg-zinc-600" },
  expired: { icon: Undo2, cls: "border-zinc-800 text-zinc-500", dot: "bg-zinc-700" },
  burned: { icon: Flame, cls: "border-red-400/25 bg-red-500/[0.05] text-red-300/90", dot: "bg-red-400/80" },
};

const ACTION_ICON: Record<InviteAction, LucideIcon> = {
  approve: Check,
  decline: X,
  burn: Flame,
  restore: Undo2,
  revoke: Ban,
};

const FOCUS = "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/30";

/* ══════════════════════════════════════════════════════════════════
 * Мелкие элементы
 * ══════════════════════════════════════════════════════════════════ */

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
}

function Avatar({ src, name, size = "md" }: { src: string | null; name: string; size?: "sm" | "md" }) {
  const [broken, setBroken] = useState(false);
  const box = size === "sm" ? "h-8 w-8 text-[11px]" : "h-11 w-11 text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700/80 bg-zinc-900 ${box}`}
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="font-medium tracking-wide text-zinc-400">{initials(name) || "·"}</span>
      )}
    </span>
  );
}

function CircleBadge({ circleKey, circles }: { circleKey: CircleKey | null; circles: CircleConfig[] }) {
  if (!circleKey) return null;
  const c = circles.find((x) => x.key === circleKey);
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${CIRCLE_BADGE[circleKey]}`}
    >
      {c?.title ?? circleKey}
    </span>
  );
}

function StatusPill({ invite, t }: { invite: ClubInvite; t: Dict }) {
  const { icon: Icon, cls } = STATUS_STYLE[invite.status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs ${cls}`}
    >
      <Icon size={13} strokeWidth={1.6} aria-hidden />
      {t.status[invite.status]}
    </span>
  );
}

/** «В туре» / Inner Circle — путь протеже после одобрения */
function JourneyBadge({ invite, t }: { invite: ClubInvite; t: Dict }) {
  if (invite.status !== "approved" && invite.status !== "burned") return null;
  if (invite.milestones.innerCircle) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-amber-200/80">
        <Crown size={12} strokeWidth={1.6} aria-hidden />
        Inner Circle
      </span>
    );
  }
  if (invite.milestones.firstStamp) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] text-slate-300/80">
        <Plane size={12} strokeWidth={1.6} aria-hidden />
        {t.touring}
      </span>
    );
  }
  return null;
}

function Milestones({ invite, t }: { invite: ClubInvite; t: Dict }) {
  return (
    <span className="inline-flex items-center gap-1">
      {MILESTONES.map((m, i) => {
        const done = invite.milestones[m];
        const label = t.milestoneState(t.milestone[m], done);
        return (
          <span key={m} className="inline-flex items-center gap-1">
            {i > 0 && <span className={`h-px w-2.5 ${done ? "bg-amber-200/50" : "bg-zinc-800"}`} aria-hidden />}
            <span
              title={label}
              className={`h-1.5 w-1.5 rotate-45 ${done ? "bg-amber-200" : "border border-zinc-600"}`}
            />
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </span>
  );
}

function Dividends({ invite, nf }: { invite: ClubInvite; nf: Intl.NumberFormat }) {
  if (invite.status === "burned" && invite.dividendsEarned > 0) {
    return (
      <span
        className={`${cormorant.className} text-xl tabular-nums text-red-300/70 line-through decoration-red-300/50`}
      >
        +{nf.format(invite.dividendsEarned)}
      </span>
    );
  }
  if (invite.dividends > 0) {
    return (
      <span className={`${cormorant.className} text-xl tabular-nums text-amber-200`}>
        +{nf.format(invite.dividends)}
      </span>
    );
  }
  return (
    <span className={`${cormorant.className} text-xl text-zinc-700`} aria-hidden>
      —
    </span>
  );
}

function Chain({ links, t }: { links: { id: string | null; name: string }[]; t: Dict }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{t.chain}</p>
      <ol className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px]">
        {links.map((l, i) => {
          const last = i === links.length - 1;
          return (
            <li key={`${l.id ?? "x"}-${i}`} className="flex min-w-0 items-center gap-1.5">
              <span
                className={`truncate ${last ? "text-amber-200" : i === links.length - 2 ? "text-slate-200" : "text-zinc-500"}`}
              >
                {l.name}
              </span>
              {!last && <ArrowRight size={12} strokeWidth={1.5} className="shrink-0 text-zinc-700" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionCaption({ children }: { children: ReactNode }) {
  return <p className="text-[9px] uppercase tracking-[0.3em] text-zinc-600">{children}</p>;
}

function Empty({ icon: Icon, title, note }: { icon: LucideIcon; title: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-16 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800 text-zinc-600">
        <Icon size={20} strokeWidth={1.3} aria-hidden />
      </span>
      <p className={`${cormorant.className} mt-4 text-2xl text-zinc-200`}>{title}</p>
      {note && <p className="mt-2 text-sm text-zinc-500">{note}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Действия модератора
 * ══════════════════════════════════════════════════════════════════ */

type Confirm = { id: string; action: InviteAction } | null;

type ActionState = {
  busyId: string | null;
  confirm: Confirm;
  setConfirm: (c: Confirm) => void;
  errors: Record<string, string>;
  run: (invite: ClubInvite, action: InviteAction, note?: string, blockGuest?: boolean) => Promise<boolean>;
};

const NEXT_STATUS: Record<InviteAction, ClubInviteStatus> = {
  approve: "approved",
  decline: "declined",
  burn: "burned",
  restore: "approved",
  revoke: "expired",
};

/** Кнопки и подтверждение для одного ключа */
function ActionBar({
  invite,
  actions,
  state,
  i18n,
  dividends,
  compact = false,
}: {
  invite: ClubInvite;
  actions: InviteAction[];
  state: ActionState;
  i18n: I18n;
  dividends: Record<Milestone, number>;
  compact?: boolean;
}) {
  const { t, nf } = i18n;
  const [note, setNote] = useState("");
  const [block, setBlock] = useState(invite.guestProfileStatus !== "blocked");
  const open = state.confirm?.id === invite.id ? state.confirm.action : null;
  const busy = state.busyId === invite.id;
  const error = state.errors[invite.id];

  useEffect(() => {
    if (!open) setNote("");
  }, [open]);

  if (actions.length === 0) return null;

  const label: Record<InviteAction, string> = {
    approve: t.approve,
    decline: t.decline,
    burn: t.burn,
    restore: t.restore,
    revoke: t.revoke,
  };

  const warn =
    open === "decline"
      ? t.declineWarn(invite.patronName)
      : open === "burn"
        ? invite.dividends > 0
          ? t.burnWarn(invite.patronName, nf.format(invite.dividends))
          : t.burnWarnZero(invite.patronName)
        : open === "restore"
          ? t.restoreWarn(invite.patronName, `+${nf.format(invite.dividendsEarned)}`)
          : open === "revoke"
            ? t.revokeWarn(invite.patronName)
            : "";

  const needsNote = open === "decline" || open === "burn" || open === "revoke";
  const danger = open === "decline" || open === "burn" || open === "revoke";

  return (
    <div className="min-w-0">
      {!open && (
        <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "gap-y-3"}`}>
          {actions.map((a) => {
            const Icon = ACTION_ICON[a];
            const primary = a === "approve";
            return (
              <button
                key={a}
                type="button"
                disabled={busy}
                onClick={() =>
                  a === "approve" ? void state.run(invite, "approve") : state.setConfirm({ id: invite.id, action: a })
                }
                className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm transition-colors disabled:cursor-wait disabled:opacity-60 ${FOCUS} ${
                  primary
                    ? "bg-amber-200 font-medium text-zinc-950 hover:bg-amber-100"
                    : a === "burn" || a === "decline" || a === "revoke"
                      ? "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-red-400/30 hover:text-red-200"
                      : "border border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                }`}
              >
                {busy && primary ? (
                  <Loader2 size={15} strokeWidth={1.8} className="animate-spin" aria-hidden />
                ) : (
                  <Icon size={15} strokeWidth={1.6} aria-hidden />
                )}
                {label[a]}
              </button>
            );
          })}
          {actions.includes("approve") && (
            <span className="text-xs text-zinc-500">
              <span className="text-amber-200/80">+{nf.format(dividends.approved)}</span>{" "}
              {t.approveHint(invite.patronName)}
            </span>
          )}
        </div>
      )}

      {open && (
        <form
          className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void state.run(invite, open, note, open === "burn" ? block : false);
          }}
        >
          <p className="text-sm font-medium text-zinc-100">
            {open === "decline" ? t.declineTitle : open === "burn" ? t.burnTitle : label[open]}
          </p>
          <p className={`mt-1 text-[13px] leading-relaxed ${danger ? "text-red-200/80" : "text-zinc-400"}`}>{warn}</p>
          {needsNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t.notePlaceholder}
              aria-label={t.notePlaceholder}
              className="mt-3 w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-200/20"
            />
          )}
          {open === "burn" && invite.guestProfileStatus !== "blocked" && (
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] text-zinc-300">
              <input
                type="checkbox"
                checked={block}
                onChange={(e) => setBlock(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-amber-200"
              />
              {t.blockGuest}
            </label>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-wait disabled:opacity-60 ${FOCUS} ${
                danger
                  ? "border border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20"
                  : "bg-amber-200 text-zinc-950 hover:bg-amber-100"
              }`}
            >
              {busy ? (
                <Loader2 size={15} strokeWidth={1.8} className="animate-spin" aria-hidden />
              ) : (
                (() => {
                  const Icon = ACTION_ICON[open];
                  return <Icon size={15} strokeWidth={1.6} aria-hidden />;
                })()
              )}
              {open === "decline" ? t.decline : open === "burn" ? t.burn : open === "restore" ? t.restore : t.revoke}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => state.setConfirm(null)}
              className={`inline-flex h-10 items-center rounded-xl px-4 text-sm text-zinc-400 transition-colors hover:text-zinc-100 ${FOCUS}`}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-300/90">
          <AlertTriangle size={13} strokeWidth={1.6} aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 1. Модерация
 * ══════════════════════════════════════════════════════════════════ */

type PatronRecord = { admitted: number; declined: number; burned: number };

function QueuePanel({
  invites,
  circles,
  dividends,
  chainOf,
  records,
  state,
  i18n,
}: {
  invites: ClubInvite[];
  circles: CircleConfig[];
  dividends: Record<Milestone, number>;
  chainOf: (i: ClubInvite) => { id: string | null; name: string }[];
  records: Map<string, PatronRecord>;
  state: ActionState;
  i18n: I18n;
}) {
  const { t, nf, dtf } = i18n;
  const queue = useMemo(
    () =>
      invites
        .filter((i) => i.status === "pending")
        .sort((a, b) => Date.parse(a.redeemedAt ?? a.issuedAt) - Date.parse(b.redeemedAt ?? b.issuedAt)),
    [invites],
  );

  if (queue.length === 0) return <Empty icon={Inbox} title={t.queueEmptyTitle} note={t.queueEmptyNote} />;

  return (
    <ul className="inv-queue space-y-4">
      {queue.map((inv) => {
        const rec = (inv.patronId && records.get(inv.patronId)) || { admitted: 0, declined: 0, burned: 0 };
        const first = rec.admitted + rec.declined + rec.burned === 0;
        return (
          <li key={inv.id} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6">
            <div className="inv-card-body">
              {/* гостья */}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar src={inv.guestAvatarUrl} name={inv.guestFullName} />
                  <div className="min-w-0">
                    <p className={`${cormorant.className} break-words text-2xl font-medium leading-tight text-zinc-50`}>
                      {inv.guestFullName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {inv.redeemedAt ? t.applied(dtf.format(new Date(inv.redeemedAt))) : t.notRedeemed}
                    </p>
                  </div>
                </div>
                <dl className="mt-4 space-y-1.5 text-[13px]">
                  {inv.guestEmail && (
                    <div className="flex min-w-0 items-center gap-2 text-zinc-400">
                      <Mail size={13} strokeWidth={1.5} className="shrink-0 text-zinc-600" aria-hidden />
                      <span className="truncate">{inv.guestEmail}</span>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-zinc-400">
                    <KeyRound size={13} strokeWidth={1.5} className="shrink-0 text-zinc-600" aria-hidden />
                    <span className="font-mono text-xs tracking-[0.12em] text-zinc-300">{inv.code}</span>
                    {inv.guestName !== inv.guestFullName && (
                      <span className="truncate text-xs text-zinc-500">· {t.nameOnKey(inv.guestName)}</span>
                    )}
                  </div>
                </dl>
              </div>

              {/* поручительница */}
              <div className="min-w-0 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
                <SectionCaption>{t.invitedBy}</SectionCaption>
                <div className="mt-2.5 flex min-w-0 items-center gap-3">
                  <Avatar src={inv.patronAvatarUrl} name={inv.patronName} size="sm" />
                  <p className={`${cormorant.className} min-w-0 break-words text-xl leading-tight text-slate-100`}>
                    {inv.patronName}
                  </p>
                  <CircleBadge circleKey={inv.patronCircleKey} circles={circles} />
                </div>
                <p className="mt-2.5 text-xs text-zinc-500">
                  {first ? t.firstProtege : t.sponsorRecord(rec.admitted, rec.declined, rec.burned)}
                  {inv.patronInfluence !== null && (
                    <>
                      {" · "}
                      <span className="font-mono tabular-nums text-zinc-400">{nf.format(inv.patronInfluence)}</span>
                    </>
                  )}
                </p>
                <div className="mt-3 border-t border-zinc-800/80 pt-3">
                  <Chain links={chainOf(inv)} t={t} />
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-zinc-800/80 pt-5">
              <ActionBar
                invite={inv}
                actions={["approve", "decline"]}
                state={state}
                i18n={i18n}
                dividends={dividends}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 2. Все ключи
 * ══════════════════════════════════════════════════════════════════ */

const needsAttention = (i: ClubInvite) => i.status === "approved" && i.guestProfileStatus === "blocked";

function LedgerPanel({
  invites,
  circles,
  dividends,
  chainOf,
  state,
  i18n,
  query,
  setQuery,
  season,
  setSeason,
  status,
  setStatus,
}: {
  invites: ClubInvite[];
  circles: CircleConfig[];
  dividends: Record<Milestone, number>;
  chainOf: (i: ClubInvite) => { id: string | null; name: string }[];
  state: ActionState;
  i18n: I18n;
  query: string;
  setQuery: (q: string) => void;
  season: number | "all";
  setSeason: (s: number | "all") => void;
  status: StatusFilter;
  setStatus: (s: StatusFilter) => void;
}) {
  const { t, nf, df, dtf } = i18n;
  const [openId, setOpenId] = useState<string | null>(null);

  const seasons = useMemo(() => [...new Set(invites.map((i) => i.season))].sort((a, b) => b - a), [invites]);
  const inSeason = useMemo(() => invites.filter((i) => season === "all" || i.season === season), [invites, season]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: inSeason.length,
      attention: 0,
      sealed: 0,
      pending: 0,
      approved: 0,
      declined: 0,
      expired: 0,
      burned: 0,
    };
    for (const i of inSeason) {
      c[i.status]++;
      if (needsAttention(i)) c.attention++;
    }
    return c;
  }, [inSeason]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inSeason
      .filter((i) => (status === "all" ? true : status === "attention" ? needsAttention(i) : i.status === status))
      .filter(
        (i) =>
          !q ||
          [i.code, i.guestName, i.guestFullName, i.patronName, i.guestEmail ?? ""].some((v) =>
            v.toLowerCase().includes(q),
          ),
      )
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  }, [inSeason, status, query]);

  if (invites.length === 0) return <Empty icon={KeyRound} title={t.ledgerEmpty} />;

  const chips: StatusFilter[] = ["all", ...(counts.attention > 0 ? (["attention"] as const) : []), ...INVITE_STATUSES];

  return (
    <div className="space-y-5">
      {/* фильтры */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-[1_1_16rem]">
          <Search
            size={15}
            strokeWidth={1.6}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchAria}
            className="h-10 w-full rounded-xl border border-zinc-800 bg-zinc-900/60 pl-10 pr-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-200/20"
          />
        </label>
        <label className="relative flex-[0_1_12rem]">
          <select
            value={String(season)}
            onChange={(e) => setSeason(e.target.value === "all" ? "all" : Number(e.target.value))}
            aria-label={t.allSeasons}
            className="h-10 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/60 pl-3.5 pr-9 text-sm text-zinc-200 focus:border-amber-200/30 focus:outline-none"
          >
            <option value="all">{t.allSeasons}</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {t.season(s)}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            strokeWidth={1.6}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t.colStatus}>
        {chips.map((s) => {
          const active = status === s;
          const label = s === "all" ? t.filterAll : s === "attention" ? t.filterAttention : t.status[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(s)}
              className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs transition-colors ${FOCUS} ${
                active
                  ? "border-amber-200/35 bg-amber-200/[0.07] text-amber-200"
                  : s === "attention"
                    ? "border-red-400/25 text-red-300/90 hover:border-red-400/40"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
              }`}
            >
              {s === "attention" ? (
                <ShieldAlert size={12} strokeWidth={1.6} aria-hidden />
              ) : s !== "all" ? (
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_STYLE[s].dot}`} aria-hidden />
              ) : null}
              {label}
              <span className={`font-mono text-[10px] ${active ? "text-amber-200/60" : "text-zinc-600"}`}>
                {nf.format(counts[s])}
              </span>
            </button>
          );
        })}
      </div>

      {/* реестр */}
      {rows.length === 0 ? (
        <Empty icon={ListFilter} title={t.noResults} />
      ) : (
        <div className="inv-ledger overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/30">
          <div className="inv-head border-b border-zinc-800/80 px-5 py-2.5 text-[9px] uppercase tracking-[0.28em] text-zinc-600">
            <span>{t.colKey}</span>
            <span>{t.colGuest}</span>
            <span>{t.colSponsor}</span>
            <span>{t.colStatus}</span>
            <span className="text-right">{t.colDividends}</span>
            <span />
          </div>
          <ul className="divide-y divide-zinc-800/70">
            {rows.map((inv) => {
              const open = openId === inv.id;
              const actions = ACTIONS_BY_STATUS[inv.status];
              const attention = needsAttention(inv);
              return (
                <li key={inv.id} className={open ? "bg-zinc-900/50" : ""}>
                  <div className="inv-row px-5 py-4">
                    <div className="inv-c-key min-w-0">
                      <p className="font-mono text-xs tracking-[0.1em] text-zinc-300">{inv.code}</p>
                      <p className="mt-0.5 text-[11px] text-zinc-600">{df.format(new Date(inv.issuedAt))}</p>
                    </div>

                    <div className="inv-c-guest flex min-w-0 items-center gap-3">
                      <Avatar src={inv.guestAvatarUrl} name={inv.guestFullName} size="sm" />
                      <div className="min-w-0">
                        <p className={`${cormorant.className} break-words text-lg leading-tight text-zinc-100`}>
                          {inv.guestFullName}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500">
                          {attention ? (
                            <span className="inline-flex items-center gap-1 text-red-300/90">
                              <ShieldAlert size={11} strokeWidth={1.6} aria-hidden />
                              {t.guestBlocked}
                            </span>
                          ) : inv.guestName !== inv.guestFullName ? (
                            t.nameOnKey(inv.guestName)
                          ) : (
                            (inv.guestEmail ?? "")
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="inv-c-patron flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 truncate text-sm text-zinc-300" title={inv.patronName}>
                        {inv.patronName}
                      </p>
                      <CircleBadge circleKey={inv.patronCircleKey} circles={circles} />
                    </div>

                    <div className="inv-c-status flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                      <StatusPill invite={inv} t={t} />
                      {(inv.status === "approved" || inv.status === "burned") && <Milestones invite={inv} t={t} />}
                      <JourneyBadge invite={inv} t={t} />
                    </div>

                    <div className="inv-c-div text-right">
                      <Dividends invite={inv} nf={nf} />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(open ? null : inv.id);
                        state.setConfirm(null);
                      }}
                      aria-expanded={open}
                      aria-label={t.details}
                      title={t.details}
                      className={`inv-c-chev inline-flex h-9 w-9 items-center justify-center justify-self-end rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/70 hover:text-zinc-200 ${FOCUS} ${
                        attention ? "text-red-300/90" : ""
                      }`}
                    >
                      <ChevronDown
                        size={16}
                        strokeWidth={1.6}
                        className={`transition-transform ${open ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                  </div>

                  {open && (
                    <div className="space-y-5 border-t border-zinc-800/60 px-5 pb-5 pt-4">
                      {attention && (
                        <p className="flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/[0.05] px-3.5 py-2.5 text-[13px] text-red-200/90">
                          <ShieldAlert size={15} strokeWidth={1.6} className="mt-0.5 shrink-0" aria-hidden />
                          {t.blockedHint}
                        </p>
                      )}
                      <Chain links={chainOf(inv)} t={t} />
                      <dl
                        className="grid gap-x-6 gap-y-3 text-[13px]"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))" }}
                      >
                        <Fact label={t.issued} value={dtf.format(new Date(inv.issuedAt))} />
                        {inv.status === "sealed" && (
                          <Fact label={t.validUntil} value={dtf.format(new Date(inv.expiresAt))} />
                        )}
                        <Fact
                          label={t.redeemed}
                          value={inv.redeemedAt ? dtf.format(new Date(inv.redeemedAt)) : t.notRedeemed}
                        />
                        {inv.moderatedAt && (
                          <Fact
                            label={t.decided}
                            value={`${dtf.format(new Date(inv.moderatedAt))}${inv.moderatedByName ? ` ${t.by(inv.moderatedByName)}` : ""}`}
                          />
                        )}
                        {inv.burnedAt && (
                          <Fact
                            label={t.burnedAt}
                            value={`${dtf.format(new Date(inv.burnedAt))}${inv.burnedByName ? ` ${t.by(inv.burnedByName)}` : ""}`}
                          />
                        )}
                        {inv.guestEmail && <Fact label={t.email} value={inv.guestEmail} />}
                      </dl>
                      {(inv.moderationNote || inv.burnNote) && (
                        <div className="space-y-1.5">
                          <SectionCaption>{t.note}</SectionCaption>
                          {inv.moderationNote && inv.moderationNote !== "revoked" && (
                            <p className="text-[13px] leading-relaxed text-zinc-300">{inv.moderationNote}</p>
                          )}
                          {inv.burnNote && (
                            <p className="text-[13px] leading-relaxed text-red-200/80">{inv.burnNote}</p>
                          )}
                        </div>
                      )}
                      <ActionBar
                        invite={inv}
                        actions={actions}
                        state={state}
                        i18n={i18n}
                        dividends={dividends}
                        compact
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[9px] uppercase tracking-[0.28em] text-zinc-600">{label}</dt>
      <dd className="mt-1 truncate text-zinc-300" title={value}>
        {value}
      </dd>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * 3. Поручительницы
 * ══════════════════════════════════════════════════════════════════ */

type PatronCard = {
  id: string;
  name: string;
  avatarUrl: string | null;
  circleKey: CircleKey | null;
  invitedBy: string | null;
  usedThisSeason: number;
  admitted: number;
  pending: number;
  declined: number;
  burned: number;
  credited: number;
  proteges: ClubInvite[];
};

function PatronsPanel({
  invites,
  circles,
  quota,
  season,
  i18n,
  onShow,
}: {
  invites: ClubInvite[];
  circles: CircleConfig[];
  quota: Record<CircleKey, number>;
  season: number;
  i18n: I18n;
  onShow: (code: string) => void;
}) {
  const { t, nf } = i18n;

  const patrons = useMemo(() => {
    const invitedBy = new Map<string, string>();
    for (const i of invites) {
      if (i.guestId && (i.status === "pending" || i.status === "approved" || i.status === "burned")) {
        invitedBy.set(i.guestId, i.patronName);
      }
    }
    const by = new Map<string, PatronCard>();
    for (const i of invites) {
      if (!i.patronId) continue;
      let p = by.get(i.patronId);
      if (!p) {
        p = {
          id: i.patronId,
          name: i.patronName,
          avatarUrl: i.patronAvatarUrl,
          circleKey: i.patronCircleKey,
          invitedBy: invitedBy.get(i.patronId) ?? null,
          usedThisSeason: 0,
          admitted: 0,
          pending: 0,
          declined: 0,
          burned: 0,
          credited: 0,
          proteges: [],
        };
        by.set(i.patronId, p);
      }
      if (i.season === season && i.status !== "expired") p.usedThisSeason++;
      if (i.status === "approved") p.admitted++;
      if (i.status === "pending") p.pending++;
      if (i.status === "declined") p.declined++;
      if (i.status === "burned") p.burned++;
      p.credited += i.dividends;
      p.proteges.push(i);
    }
    for (const p of by.values()) p.proteges.sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
    return [...by.values()].sort(
      (a, b) => b.credited - a.credited || b.admitted - a.admitted || a.name.localeCompare(b.name),
    );
  }, [invites, season]);

  if (patrons.length === 0) return <Empty icon={Users} title={t.patronsEmpty} />;

  return (
    <ul className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 22rem), 1fr))" }}>
      {patrons.map((p) => {
        const total = quota[p.circleKey ?? "voyager"];
        const stats: Array<[number, string, string]> = [
          [p.admitted, t.admittedN, "text-slate-100"],
          [p.pending, t.pendingN, "text-amber-200"],
          [p.declined, t.declinedN, "text-zinc-400"],
          [p.burned, t.burnedN, "text-red-300/90"],
        ];
        return (
          <li key={p.id} className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar src={p.avatarUrl} name={p.name} />
              <div className="min-w-0 flex-1">
                <p className={`${cormorant.className} break-words text-xl leading-tight text-zinc-50`}>{p.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <CircleBadge circleKey={p.circleKey} circles={circles} />
                  <span className="text-[11px] text-zinc-500">
                    {p.invitedBy ? t.invitedByName(p.invitedBy) : t.founder}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-4">
              <div>
                <SectionCaption>{t.seasonKeys(season)}</SectionCaption>
                <div className="mt-2 flex flex-wrap gap-1" aria-label={t.keysOf(p.usedThisSeason, total)}>
                  {Array.from({ length: Math.max(total, p.usedThisSeason) }, (_, k) => (
                    <span
                      key={k}
                      className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                        k < p.usedThisSeason
                          ? "border-zinc-800 text-zinc-600"
                          : "border-amber-200/30 bg-amber-200/[0.05] text-amber-200"
                      }`}
                    >
                      <KeyRound size={11} strokeWidth={1.5} aria-hidden />
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-zinc-500">{t.keysOf(p.usedThisSeason, total)}</p>
              </div>
              <div className="text-right">
                <p
                  className={`${cormorant.className} text-3xl leading-none tabular-nums ${p.credited > 0 ? "text-amber-200" : "text-zinc-600"}`}
                >
                  {p.credited > 0 ? `+${nf.format(p.credited)}` : nf.format(0)}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-600">{t.credited}</p>
              </div>
            </div>

            <dl className="grid grid-cols-4 gap-2 border-y border-zinc-800/80 py-3 text-center">
              {stats.map(([n, label, tone]) => (
                <div key={label} className="min-w-0">
                  <dd className={`${cormorant.className} text-xl tabular-nums ${n > 0 ? tone : "text-zinc-700"}`}>
                    {nf.format(n)}
                  </dd>
                  <dt className="truncate text-[10px] text-zinc-500" title={label}>
                    {label}
                  </dt>
                </div>
              ))}
            </dl>

            <div>
              <SectionCaption>{t.protegees}</SectionCaption>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {p.proteges.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => onShow(i.code)}
                      title={t.showInLedger(i.guestFullName)}
                      className={`inline-flex max-w-[14rem] items-center gap-1.5 rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 ${FOCUS}`}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLE[i.status].dot}`} aria-hidden />
                      <span className="truncate">{i.guestFullName}</span>
                      <span className="sr-only">· {t.status[i.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Главный компонент
 * ══════════════════════════════════════════════════════════════════ */

export default function AdminInvitesClient({
  invites,
  circles,
  dividends,
  quota,
  season,
  defaultTab,
  onChanged,
}: AdminInvitesProps) {
  const i18n = useInvitesI18n();
  const { t, nf } = i18n;

  const pendingCount = useMemo(() => invites.filter((i) => i.status === "pending").length, [invites]);
  const [tab, setTab] = useState<InvitesTab>(defaultTab ?? (pendingCount > 0 ? "queue" : "ledger"));

  // фильтры реестра живут здесь — переход из «Поручительниц» их выставляет
  const [query, setQuery] = useState("");
  const [ledgerSeason, setLedgerSeason] = useState<number | "all">(season);
  const [status, setStatus] = useState<StatusFilter>("all");

  const chainOf = useMemo(() => buildChains(invites), [invites]);
  const records = useMemo(() => {
    const m = new Map<string, PatronRecord>();
    for (const i of invites) {
      if (!i.patronId) continue;
      const r = m.get(i.patronId) ?? { admitted: 0, declined: 0, burned: 0 };
      if (i.status === "approved") r.admitted++;
      if (i.status === "declined") r.declined++;
      if (i.status === "burned") r.burned++;
      m.set(i.patronId, r);
    }
    return m;
  }, [invites]);

  /* ── действия ── */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const run = useCallback(
    async (inv: ClubInvite, action: InviteAction, note?: string, blockGuest?: boolean) => {
      setBusyId(inv.id);
      setErrors((e) => {
        const next = { ...e };
        delete next[inv.id];
        return next;
      });
      try {
        const { data, error } = await supabase.rpc("club_invite_action", {
          p_invite_id: inv.id,
          p_action: action,
          p_note: note?.trim() || null,
          p_block_guest: !!blockGuest,
        });
        if (error) {
          const code = inviteErrorCode(error);
          const message =
            code === "forbidden"
              ? t.errForbidden
              : code === "invalid_transition"
                ? t.errTransition
                : code === "migration"
                  ? t.errMigration
                  : t.errGeneric;
          console.error("[Invites Admin] Action error:", error);
          setErrors((e) => ({ ...e, [inv.id]: message }));
          if (code === "invalid_transition") onChanged?.(inv.id, {}); // перечитать витрину
          return false;
        }

        const row = (data ?? {}) as { status?: string };
        const nextStatus = (row.status as ClubInviteStatus | undefined) ?? NEXT_STATUS[action];
        const patch: Partial<ClubInvite> = { status: nextStatus };
        if (action === "approve") {
          patch.milestones = { ...inv.milestones, approved: true };
          patch.dividends = dividends.approved;
          patch.dividendsEarned = dividends.approved;
        }
        if (action === "burn") {
          patch.dividends = 0;
          if (blockGuest) patch.guestProfileStatus = "blocked";
        }
        if (action === "restore") patch.dividends = inv.dividendsEarned;
        onChanged?.(inv.id, patch);
        setConfirm(null);

        const guest = inv.guestFullName;
        const patron = inv.patronName;
        showToast(
          action === "approve"
            ? t.toast.approve(guest, patron, `+${nf.format(dividends.approved)}`)
            : action === "decline"
              ? t.toast.decline(guest)
              : action === "burn"
                ? t.toast.burn(guest, patron, `−${nf.format(inv.dividends)}`)
                : action === "restore"
                  ? t.toast.restore(guest, patron, `+${nf.format(inv.dividendsEarned)}`)
                  : t.toast.revoke(guest, patron),
        );
        return true;
      } catch (e) {
        console.error("[Invites Admin] Action exception:", e);
        setErrors((er) => ({ ...er, [inv.id]: t.errGeneric }));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [t, nf, dividends, onChanged, showToast],
  );

  const state: ActionState = { busyId, confirm, setConfirm, errors, run };

  const showInLedger = useCallback((code: string) => {
    setQuery(code);
    setStatus("all");
    setLedgerSeason("all");
    setTab("ledger");
  }, []);

  const tabs: Array<{ id: InvitesTab; label: string; Icon: LucideIcon; count: number; hot?: boolean }> = [
    { id: "queue", label: t.tabQueue, Icon: Inbox, count: pendingCount, hot: pendingCount > 0 },
    { id: "ledger", label: t.tabLedger, Icon: KeyRound, count: invites.length },
    {
      id: "patrons",
      label: t.tabPatrons,
      Icon: Users,
      count: new Set(invites.map((i) => i.patronId).filter(Boolean)).size,
    },
  ];

  return (
    <>
      <style>{INVITES_CSS}</style>

      <div
        role="tablist"
        aria-label={t.title}
        className="mb-8 flex gap-1 overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1"
      >
        {tabs.map(({ id, label, Icon, count, hot }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`inv-tab-${id}`}
              aria-selected={active}
              aria-controls={`inv-panel-${id}`}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm transition-colors ${FOCUS} ${
                active
                  ? "bg-zinc-900 text-amber-200 shadow-[inset_0_0_0_1px_rgba(253,230,138,0.14)]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={15} strokeWidth={1.6} aria-hidden />
              {label}
              <span
                className={`font-mono text-[10px] ${
                  hot
                    ? "rounded-full bg-amber-200 px-1.5 py-px text-zinc-950"
                    : active
                      ? "text-amber-200/60"
                      : "text-zinc-600"
                }`}
              >
                {nf.format(count)}
              </span>
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {toast ?? ""}
      </p>
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <p className="pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-xl border border-amber-200/20 bg-zinc-900/95 px-4 py-3 text-sm text-zinc-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur">
            <Check size={15} strokeWidth={1.8} className="shrink-0 text-amber-200" aria-hidden />
            {toast}
          </p>
        </div>
      )}

      <div role="tabpanel" id={`inv-panel-${tab}`} aria-labelledby={`inv-tab-${tab}`}>
        {tab === "queue" && (
          <QueuePanel
            invites={invites}
            circles={circles}
            dividends={dividends}
            chainOf={chainOf}
            records={records}
            state={state}
            i18n={i18n}
          />
        )}
        {tab === "ledger" && (
          <LedgerPanel
            invites={invites}
            circles={circles}
            dividends={dividends}
            chainOf={chainOf}
            state={state}
            i18n={i18n}
            query={query}
            setQuery={setQuery}
            season={ledgerSeason}
            setSeason={setLedgerSeason}
            status={status}
            setStatus={setStatus}
          />
        )}
        {tab === "patrons" && (
          <PatronsPanel
            invites={invites}
            circles={circles}
            quota={quota}
            season={season}
            i18n={i18n}
            onShow={showInLedger}
          />
        )}
      </div>
    </>
  );
}
