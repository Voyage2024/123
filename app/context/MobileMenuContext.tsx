"use client";

/* ──────────────────────────────────────────────────────────────────────
 * MOBILE MENU — связь «гамбургер в Navbar ↔ шторка Sidebar»
 * app/context/MobileMenuContext.tsx
 *
 * Navbar живёт в корневом layout, Sidebar — в layout кабинета: у них нет
 * общего родителя, куда удобно поставить Provider. Поэтому состояние —
 * крошечный внешний стор (useSyncExternalStore): работает без Provider,
 * в любом месте дерева, без лишних перерисовок приложения.
 *
 *   useMobileMenu()        → { isOpen, setIsOpen, open, close, toggle,
 *                              hasSidebar, hasNavbar }
 *   useRegisterSidebar()   — Sidebar сообщает, что он на странице
 *                            (Navbar показывает гамбургер только тогда)
 *   useRegisterNavbar()    — Navbar сообщает о себе и пишет свою высоту
 *                            в CSS-переменную --nav-h на <html>
 *   useScrollLock(active)  — блокировка прокрутки фона, корректная для iOS
 * ──────────────────────────────────────────────────────────────────── */

import { useEffect, useLayoutEffect, useSyncExternalStore, type RefObject } from "react";

type MenuState = Readonly<{ open: boolean; sidebars: number; navbars: number }>;

const SERVER_STATE: MenuState = { open: false, sidebars: 0, navbars: 0 };
let state: MenuState = SERVER_STATE;
const listeners = new Set<() => void>();

function update(patch: Partial<MenuState>) {
  const next = { ...state, ...patch };
  if (next.open === state.open && next.sidebars === state.sidebars && next.navbars === state.navbars) return;
  state = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const mobileMenu = {
  open: () => update({ open: true }),
  close: () => update({ open: false }),
  toggle: () => update({ open: !state.open }),
  setOpen: (v: boolean) => update({ open: v }),
};

export function useMobileMenu() {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
  return {
    isOpen: s.open,
    setIsOpen: mobileMenu.setOpen,
    open: mobileMenu.open,
    close: mobileMenu.close,
    toggle: mobileMenu.toggle,
    hasSidebar: s.sidebars > 0,
    hasNavbar: s.navbars > 0,
  };
}

/** Sidebar на странице → в Navbar появляется гамбургер */
export function useRegisterSidebar() {
  useEffect(() => {
    update({ sidebars: state.sidebars + 1 });
    return () => {
      const left = Math.max(0, state.sidebars - 1);
      update({ sidebars: left, open: left > 0 ? state.open : false });
    };
  }, []);
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Navbar на странице: регистрирует себя и держит --nav-h равной своей
 * реальной высоте (с вырезом iPhone). Layout кабинета и Sidebar отступают
 * ровно на неё — без магических чисел.
 */
export function useRegisterNavbar(ref: RefObject<HTMLElement | null>) {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    update({ navbars: state.navbars + 1 });

    const apply = () => {
      if (el) root.style.setProperty("--nav-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" && el ? new ResizeObserver(apply) : null;
    if (ro && el) ro.observe(el);

    return () => {
      ro?.disconnect();
      update({ navbars: Math.max(0, state.navbars - 1) });
      if (state.navbars === 0) root.style.removeProperty("--nav-h");
    };
  }, [ref]);
}

/* ── true только на клиенте (для порталов) ──────────────────────── */

const noopSubscribe = () => () => {};
export function useIsClient() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/* ── Блокировка прокрутки фона ──────────────────────────────────── */
// overflow:hidden на body iOS Safari игнорирует — фон всё равно едет.
// Надёжный способ: зафиксировать body на текущей позиции и вернуть её.
// Счётчик — чтобы шторка профиля и меню могли быть открыты вместе.

let locks = 0;
let savedY = 0;
let savedStyle: Partial<CSSStyleDeclaration> = {};

export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const b = document.body.style;
    if (locks++ === 0) {
      savedY = window.scrollY;
      savedStyle = { position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
      b.position = "fixed";
      b.top = `-${savedY}px`;
      b.left = "0";
      b.right = "0";
      b.width = "100%";
      b.overflow = "hidden";
    }
    return () => {
      if (--locks > 0) return;
      b.position = savedStyle.position ?? "";
      b.top = savedStyle.top ?? "";
      b.left = savedStyle.left ?? "";
      b.right = savedStyle.right ?? "";
      b.width = savedStyle.width ?? "";
      b.overflow = savedStyle.overflow ?? "";
      window.scrollTo(0, savedY);
    };
  }, [active]);
}
