"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Globe,
  ShieldCheck,
  Plane,
  Crown,
  MapPin,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Lang = "EN" | "RU";

interface Hub {
  id: string;
  name: { EN: string; RU: string };
  subtitle: { EN: string; RU: string };
  description: { EN: string; RU: string };
  rates: { split: string; shot: string; incall: string; outcall: string };
  accommodation: { EN: string; RU: string };
  services: { EN: string; RU: string };
  x: number;
  y: number;
}

interface Highlight {
  icon: React.ReactNode;
  title: { EN: string; RU: string };
  body: { EN: string; RU: string };
}

// ─────────────────────────────────────────────────────────────
// Map — карта Европы вписывается ЦЕЛИКОМ в контейнер 4:3 (object-contain).
// Реальный файл /map-europe.jpg = 1696×1256 (≈ 1.35:1), поэтому при object-contain
// карта заполняет контейнер по ширине, по высоте остаётся минимальный леттербокс
// (~0.6% сверху и снизу); в кадр входят и Испания слева, и Прибалтика справа.
// «Сцена» равна контейнеру; координаты точек (x,y в %) измерены напрямую по карте.
// ─────────────────────────────────────────────────────────────
const STAGE_STYLE: React.CSSProperties = { width: "100%", height: "100%" };

// ─────────────────────────────────────────────────────────────
// Data — координаты измерены напрямую по /map-europe.jpg (1696×1256),
// каждая точка стоит на своей стране (object-contain).
// ─────────────────────────────────────────────────────────────
const HUBS: Hub[] = [
  {
    id: "paris",
    name: { EN: "PARIS", RU: "ПАРИЖ" },
    subtitle: { EN: "Confidential Prestige", RU: "Конфиденциальный престиж" },
    description: {
      EN: "The classic European capital of romance and high earnings. Strict privacy with UA/RU/BY geo-blocking, daily payouts, and carefully vetted clientele.",
      RU: "Классическая европейская столица романтики и высоких заработков. Строгая конфиденциальность (блок по гео UA/RU/BY), ежедневные выплаты и тщательно проверенная клиентура."
    },
    rates: {
      split: "50/50",
      shot: "30m: 150€ / 40m: 200€",
      incall: "1h: 250€",
      outcall: "Optional / On demand",
    },
    accommodation: {
      EN: "Apartments (~60-80€/day for your 50% share). 50/50 crediting available for tickets, ads, and living.",
      RU: "Апартаменты (~60-80€/сутки за вашу 50% долю). Возможна кредитация 50/50 на билеты, рекламу и жилье."
    },
    services: {
      EN: "Hours: 09:00 - 23:00. Min tour: 14 days. Includes: classic, MBR, kissing.",
      RU: "График: 09:00 - 23:00. Мин. тур: 14 дней. В базовый прайс включены классика, МБР, поцелуи."
    },
    x: 35.2,
    y: 52.4,
  },
  {
    id: "nice",
    name: { EN: "NICE", RU: "НИЦЦА" },
    subtitle: { EN: "Luxury Riviera", RU: "Люксовая Ривьера" },
    description: {
      EN: "The glittering French Riviera. High-ticket clients on the level of Israel, strict safety, and beautiful atmospheric encounters.",
      RU: "Блистательное Лазурное побережье. Клиенты с высокими чеками (уровень Израиля), строгая безопасность и красивые атмосферные встречи."
    },
    rates: {
      split: "50/50 (Tips & extras 100% yours)",
      shot: "Tours from 1 week",
      incall: "1h: 250€+",
      outcall: "1h: 350€+",
    },
    accommodation: {
      EN: "Comfortable apartments. Living expenses split 50/50.",
      RU: "Комфортные апартаменты. Расходы на проживание делятся 50/50."
    },
    services: {
      EN: "Work on real photos. Solid guests, beautiful classic & MBR. Costumes welcomed. No BDSM or extremes.",
      RU: "Работа строго по реальным фото. Солидные гости, красивая классика и МБР. Приветствуются костюмы. Никакой жести."
    },
    x: 45.4,
    y: 72,
  },
  {
    id: "monaco",
    name: { EN: "MONACO", RU: "МОНАКО" },
    subtitle: { EN: "Azure Coast Elite", RU: "Элита Лазурного берега" },
    description: {
      EN: "The absolute pinnacle of luxury. High-intensity work with the wealthiest guests. Excellent conditions for those who charm and shine.",
      RU: "Абсолютная вершина роскоши. Интенсивная работа с богатейшими гостями Лазурного берега. Идеальные условия для тех, кто умеет очаровывать."
    },
    rates: {
      split: "50/50 (Extras 100% yours)",
      shot: "30m: 200€",
      incall: "1h: 300€",
      outcall: "1h: 350 - 400€",
    },
    accommodation: {
      EN: "Apartments. Flights, taxi, and living expenses split 50/50.",
      RU: "Апартаменты. Билеты, такси, переезды и проживание делятся 50/50."
    },
    services: {
      EN: "Hours: 11:00 - 02:00. 3-7 guests/day. Min tour: 10 days. Own vetted database, strict checks for new guests.",
      RU: "График: 11:00 - 02:00. 3-7 гостей в день. Мин. тур: 10 дней. Своя проверенная база, жесткая проверка новых гостей."
    },
    x: 47.7,
    y: 70,
  }, 
{
    id: "london",
    name: { EN: "LONDON", RU: "ЛОНДОН" },
    subtitle: { EN: "Royal Discretion", RU: "Королевская приватность" },
    description: {
      EN: "Luxe central districts (Kensington, Chelsea). Premium individual promotion, exceptionally high hourly rates, and a thoroughly vetted elite clientele.",
      RU: "Люксовые районы центра (Кенсингтон, Челси). Премиальное индивидуальное промо, очень высокие ставки и тщательно проверенная элита."
    },
    rates: {
      split: "50/50",
      shot: "Min tour: 14 days",
      incall: "1h: £250 - £600 (Depends on English & look)",
      outcall: "Outcall available (Taxi paid by client)",
    },
    accommodation: {
      EN: "Luxe apartments (£450-£600/week). Financial support and crediting available upon request.",
      RU: "Luxe-апартаменты (£450-£600 в неделю). Возможна финансовая поддержка и кредитация по запросу."
    },
    services: {
      EN: "Hours: 11:00 - 02:00. Total confidentiality. Individual pricing based on girl's preference and portfolio.",
      RU: "График: 11:00 - 02:00. Абсолютная конфиденциальность. Ценник выбирает сама девушка исходя из рекомендаций."
    },
    x: 30.4,
    y: 41.6,
  },
  {
    id: "latvia",
    name: { EN: "LATVIA (RIGA)", RU: "ЛАТВИЯ (РИГА)" },
    subtitle: { EN: "Baltic Elegance", RU: "Балтийская элегантность" },
    description: {
      EN: "Quiet, safe European environment. Intelligent, wealthy guests who value top-tier service, charm, and atmosphere.",
      RU: "Спокойная, безопасная Европа. Интеллигентные, платежеспособные гости, ценящие высокий сервис, обаяние и атмосферу."
    },
    rates: {
      split: "50/50 (Daily payouts)",
      shot: "Clean income: 400-600€ / day",
      incall: "1h: 150€ - 200€",
      outcall: "Tips & extras 100% yours",
    },
    accommodation: {
      EN: "City center Luxe apartments. Separate private room. Rent split 50/50.",
      RU: "Luxe-апартаменты в центре города. Отдельная личная комната. Оплата 50/50."
    },
    services: {
      EN: "Basic English required. Direct employer (10 years experience). Vetted regulars, transparent conditions.",
      RU: "Требуется базовый английский. Прямой работодатель (10 лет опыта). Проверенные постоянники, без сказок."
    },
    x: 79.1,
    y: 19.0,
  },
  {
    id: "lithuania",
    name: { EN: "LITHUANIA (VILNIUS)", RU: "ЛИТВА (ВИЛЬНЮС)" },
    subtitle: { EN: "European Comfort", RU: "Европейский комфорт" },
    description: {
      EN: "A transparent and stable market in clean Europe. Generous guests and straightforward, highly respectful working conditions.",
      RU: "Прозрачный и стабильный рынок в чистой Европе. Щедрые гости и предельно уважительные условия работы."
    },
    rates: {
      split: "50/50 (Daily payouts)",
      shot: "Clean income: 400-600€ / day",
      incall: "1h: 150€ - 200€",
      outcall: "Tips & extras 100% yours",
    },
    accommodation: {
      EN: "Luxe city center apartments with a private room. Rent split 50/50. Everything nearby (cafes, shops).",
      RU: "Luxe-апартаменты в центре города с личной комнатой. Аренда 50/50. Вся инфраструктура в шаговой доступности."
    },
    services: {
      EN: "24/7 Russian-speaking admin support. Incall and Outcall available. Focus on style and confidence.",
      RU: "Русскоязычный админ 24/7. Доступны Incall и Outcall. Ставка на стиль и уверенность девушки."
    },
    x: 81.5,
    y: 28.8,
  },
  {
    id: "estonia",
    name: { EN: "ESTONIA (TALLINN)", RU: "ЭСТОНИЯ (ТАЛЛИНН)" },
    subtitle: { EN: "Baltic Premium", RU: "Балтийский премиум" },
    description: {
      EN: "High earning potential in a calm environment. Expected clean income of 400–600€ per day focusing on real work without fairy tales.",
      RU: "Высокий потенциал заработка в спокойной атмосфере. Реальный чистый доход 400-600€ в день — честная работа без иллюзий."
    },
    rates: {
      split: "50/50 (Daily payouts)",
      shot: "Clean income: 400-600€ / day",
      incall: "1h: 150€ - 200€",
      outcall: "Tips & extras 100% yours",
    },
    accommodation: {
      EN: "Premium central apartments (split 50/50). Safe, clean, with the option to extend the stay at a reduced price.",
      RU: "Премиальные апартаменты в центре (50/50). Безопасно, чисто, есть возможность продления аренды со скидкой."
    },
    services: {
      EN: "Intelligent clientele. Vetted guests only. Basic English and a well-groomed appearance are required.",
      RU: "Интеллигентная клиентура. Только проверенные гости. Обязательна ухоженность и минимальный английский."
    },
    x: 80.2,
    y: 8.3,
  },
 {
    id: "germany",
    name: { EN: "GERMANY (BERLIN)", RU: "ГЕРМАНИЯ (БЕРЛИН)" },
    subtitle: { EN: "Precise & Profitable", RU: "Немецкая стабильность" },
    description: {
      EN: "Massive client base (50,000+) and excellent conditions. Perfect for active girls ready for high-volume, safe work with a 60/40 split in their favor.",
      RU: "Огромная база (50,000+ клиентов) и шикарные условия. Идеально для активных девушек: высокий поток, полная безопасность и 60% заработка в вашу пользу."
    },
    rates: {
      split: "60/40 (Girl 60% / Agency 40%)",
      shot: "1h: 130€ - 150€ (Classic)",
      incall: "MBR is always extra",
      outcall: "Tips & extras 100% yours",
    },
    accommodation: {
      EN: "Free central apartments (private room). Promo campaigns paid by the agency.",
      RU: "Бесплатные апартаменты в центре (личная комната). Реклама полностью за счет агентства."
    },
    services: {
      EN: "Hours: 12:00 - 23:00. 80% incall / 20% outcall. Min tour: 2 weeks. 24/7 Russian-speaking support.",
      RU: "График: 12:00 - 23:00. 80% апарты / 20% выезды. Мин. тур 2 недели. Русскоязычная поддержка 24/7."
    },
    x: 57.7,
    y: 37.9,
  },
  {
    id: "italy",
    name: { EN: "ITALY", RU: "ИТАЛИЯ" },
    subtitle: { EN: "Escorts Royal", RU: "Королевский эскорт" },
    description: {
      EN: "Top-tier European agency (7+ years). Long bookings, ultra-wealthy loyal clients, and massive weekend payouts. Pure luxury.",
      RU: "Топовое агентство Европы (7+ лет). Длительные букинги, лояльные сверхбогатые клиенты и огромные чеки за выходные. Чистый люкс."
    },
    rates: {
      split: "60/40 (Girl 60%)",
      shot: "1h: 250€ - 300€ / Extras: +50-150€ each",
      incall: "Day: 2,500€",
      outcall: "Weekend: 4,500€",
    },
    accommodation: {
      EN: "4-5* Hotels. Living expenses split 50/50. Many other expenses covered 100% by agency.",
      RU: "Отели 4-5*. Расходы на проживание 50/50. Многие другие расходы агентство берет на себя."
    },
    services: {
      EN: "Absolute safety and privacy. High-performing models receive 500€ - 1000€ bonuses. Tour prep support.",
      RU: "Абсолютная безопасность. Бонусы лучшим моделям от 500€ до 1000€. Помощь с визой и дорогой."
    },
    x: 56.2,
    y: 78.7,
  },
  {
    id: "switzerland",
    name: { EN: "SWITZERLAND", RU: "ШВЕЙЦАРИЯ" },
    subtitle: { EN: "Alpine Wealth", RU: "Альпийское богатство" },
    description: {
      EN: "Geneva's most respectful and highly paid guests. Calm daytime work without night shifts. For fit, well-groomed girls with basic English.",
      RU: "Самые уважаемые и щедрые гости Женевы. Спокойная дневная работа без ночных смен. Для стройных, ухоженных девушек с базовым английским."
    },
    rates: {
      split: "50/50",
      shot: "30m: 200 CHF (~$230)",
      incall: "1h: 300 CHF (~$340)",
      outcall: "2h: 500 CHF (~$560)",
    },
    accommodation: {
      EN: "Apartments (~700 CHF/week). Split 50/50. Long-term stays reduce rental costs.",
      RU: "Апартаменты (~700 CHF в неделю). Оплата 50/50. При длительном туре аренда дешевле."
    },
    services: {
      EN: "Hours: 10:00 - 00:00. No credit/loans. Professional photos strictly required. Respectful management.",
      RU: "График: 10:00 - 00:00. Без ночных смен. Никаких кредитов. Обязательны проф. фото. Адекватное руководство."
    },
    x: 47.0,
    y: 59.5,
  },
  {
    id: "spain",
    name: { EN: "SPAIN", RU: "ИСПАНИЯ" },
    subtitle: { EN: "VIP Coast", RU: "VIP-побережье" },
    description: {
      EN: "Sunny resorts of Marbella and Barcelona. Yacht parties, wealthy expats, and a relaxed luxury vibe. Perfect for girls who love combining high earnings with a vacation feel.",
      RU: "Солнечные курорты Марбельи и Барселоны. Яхтенные тусовки, богатые экспаты и расслабленный люксовый вайб. Идеально для тех, кто хочет совместить высокие доходы с отдыхом."
    },
    rates: {
      split: "50/50 (Tips 100% yours)",
      shot: "1h: 200€ - 250€",
      incall: "2h: 400€",
      outcall: "Night/Yacht: 1,500€+",
    },
    accommodation: {
      EN: "Luxury villas or premium apartments. Costs split 50/50.",
      RU: "Люксовые виллы или премиум-апартаменты. Расходы делятся 50/50."
    },
    services: {
      EN: "Flexible schedule. Vetted resort clientele. High demand for atmospheric and elegant girls.",
      RU: "Гибкий график. Проверенная курортная клиентура. Высокий спрос на атмосферных и элегантных девушек."
    },
    x: 22.5,
    y: 84.1,
  },
   {
    id: "greece",
    name: { EN: "GREECE (ATHENS)", RU: "ГРЕЦИЯ (АФИНЫ)" },
    subtitle: { EN: "Mediterranean Elite", RU: "Средиземноморская элита" },
    description: {
      EN: "100% safety with an agency trusted for over 13 years. High daily volume in the capital with daily payouts and premium hotel living.",
      RU: "100% безопасность с агентством, работающим более 13 лет. Высокий поток в столице, ежедневные выплаты и проживание в премиальном отеле."
    },
    rates: {
      split: "50/50 (Money immediately on hand)",
      shot: "Up to 10 meetings/day",
      incall: "High earning potential",
      outcall: "Free return ticket for 4-week tours",
    },
    accommodation: {
      EN: "4* Hotel in the city center (Free or 35€/day). Solo or with one roommate.",
      RU: "Отель 4* в центре города (Бесплатно или 35€/сутки). Проживание по одной или с соседкой."
    },
    services: {
      EN: "Reliable driver provided for total safety. 24/7 operator support.",
      RU: "Для полной безопасности предоставляется личный водитель. Поддержка 24/7."
    },
    x: 79.6,
    y: 92.4,
  },
  {
    id: "belgium",
    name: { EN: "BELGIUM (BRUSSELS)", RU: "БЕЛЬГИЯ (БРЮССЕЛЬ)" },
    subtitle: { EN: "European Capital", RU: "Европейская столица" },
    description: {
      EN: "Comfortable daytime schedule in the heart of Europe. Relaxed apartment-based system with freedom to explore the city on weekends.",
      RU: "Комфортный дневной график в самом сердце Европы. Спокойная апартаментная система со свободным выходом в город в выходные."
    },
    rates: {
      split: "50/50",
      shot: "1h: 150€ - 200€",
      incall: "Daytime schedule only",
      outcall: "N/A",
    },
    accommodation: {
      EN: "Apartment system (20€/day). 1-2 girls, separate private rooms.",
      RU: "Апартаменты (20€/сутки). 1-2 девушки, проживание в разных комнатах."
    },
    services: {
      EN: "Hours: 10:00 - 00:00. Free city walks on weekends.",
      RU: "График: 10:00 - 00:00. Свободный выход в город в выходные дни."
    },
    x: 39.3,
    y: 44.3,
  },
  {
    id: "norway",
    name: { EN: "NORWAY (OSLO)", RU: "НОРВЕГИЯ (ОСЛО)" },
    subtitle: { EN: "Nordic Premium", RU: "Норвежский премиум" },
    description: {
      EN: "High-income Scandinavian market. Exceptional local support, strict discipline, and a highly profitable working structure.",
      RU: "Высокодоходный скандинавский рынок. Отличная локальная поддержка, строгая дисциплина и невероятно прибыльная структура работы."
    },
    rates: {
      split: "Extremely high local rates",
      shot: "30m: 1200 - 1500 NOK",
      incall: "1h: 2000 NOK",
      outcall: "1h: 2500 NOK + Taxi",
    },
    accommodation: {
      EN: "Apartment or hotel arrangements. Professional approach to living conditions.",
      RU: "Апартаменты или отель. Профессиональный подход к условиям проживания."
    },
    services: {
      EN: "Strict hours: 12:00 - 03:00. Zero tolerance for unprofessional behavior. Extras 100% yours.",
      RU: "Строгий график: 12:00 - 03:00. Полная нетерпимость к асоциальному поведению. Допы 100% ваши."
    },
    x: 51.7,
    y: 10,
  },
  {
    id: "sweden",
    name: { EN: "SWEDEN (STOCKHOLM)", RU: "ШВЕЦИЯ (СТОКГОЛЬМ)" },
    subtitle: { EN: "Scandinavian Safety", RU: "Скандинавская безопасность" },
    description: {
      EN: "Maximum safety with polite authorities and a calm environment. High demand for fit, well-groomed girls in the capital.",
      RU: "Максимальная безопасность (вежливая полиция, соцзащита) и спокойная атмосфера. Высокий спрос на стройных, ухоженных девушек в столице."
    },
    rates: {
      split: "Extras 100% yours",
      shot: "30m: 1500 SEK",
      incall: "1h: 2500 SEK",
      outcall: "1h: 3000 SEK + Taxi",
    },
    accommodation: {
      EN: "Apartments from 1000 SEK. Crediting available for trusted models. 50/50 split on flights and living.",
      RU: "Апартаменты от 1000 SEK. Кредитация для проверенных моделей. Оплата билетов и жилья 50/50."
    },
    services: {
      EN: "Hours: 11:00 - 02:00. Tour 15 days. Strict location policy (Stockholm only) for safety.",
      RU: "График: 11:00 - 02:00. Тур 15 дней. Строго только Стокгольм ради вашей безопасности."
    },
    x: 66.7,
    y: 10,
  },
  {
    id: "czechia",
    name: { EN: "CZECHIA (PRAGUE)", RU: "ЧЕХИЯ (ПРАГА)" },
    subtitle: { EN: "Legal & Safe", RU: "Легально и безопасно" },
    description: {
      EN: "Fully legal market ensuring 100% security. High daily volume (5-6 guests) and a massive base of verified regulars.",
      RU: "Полностью легальный рынок, гарантирующий 100% безопасность. Высокий поток (5-6 гостей в день) и огромная база постоянников."
    },
    rates: {
      split: "50/50 (Tips & gifts 100% yours)",
      shot: "30m: 130€ (Prague) / 90€ (Other)",
      incall: "1h: 210€ (Prague) / 130€ (Other)",
      outcall: "1h: 230€ (Taxi paid by guest)",
    },
    accommodation: {
      EN: "City center apartments paid by agency. Option to live with a friend.",
      RU: "Апартаменты в центре города, оплаченные агентством. Можно жить с подругой."
    },
    services: {
      EN: "Hours: 11:00 - 02:00 (Prague) / 10:00 - 23:00 (Other cities). Min tour: 14 days.",
      RU: "График: 11:00 - 02:00 (Прага) / 10:00 - 23:00 (Другие города). Мин. тур: 14 дней."
    },
    x: 60.0,
    y: 47.5,
  },
  {
    id: "albania",
    name: { EN: "ALBANIA", RU: "АЛБАНИЯ" },
    subtitle: { EN: "Balkan Network", RU: "Балканская сеть" },
    description: {
      EN: "Part of an extensive Balkan network. Excellent conditions, flexible splits, and a continuous stream of verified guests.",
      RU: "Часть обширной Балканской сети. Отличные условия, гибкие ставки и постоянный поток проверенных гостей."
    },
    rates: {
      split: "50/50 or 70/30 (if self-paid)",
      shot: "30m: 150€",
      incall: "1h: 200 - 250€",
      outcall: "2h: 350 - 500€ / 3h: 450 - 600€",
    },
    accommodation: {
      EN: "City center apartments (40-100€/day). Solo living, or with a friend by request.",
      RU: "Апартаменты в центре города (40-100€/сутки). Проживание по одной или с подругой по желанию."
    },
    services: {
      EN: "Tour 15+ days. Hours: 12:00 to last client. Work on real or curated photo sets.",
      RU: "Тур от 15 дней. График: с 12:00 до упора. Работа по своим или типажным фото."
    },
    x: 70.6,
    y: 81.2,
  },
  {
    id: "bosnia",
    name: { EN: "BOSNIA (SARAJEVO)", RU: "БОСНИЯ (САРАЕВО)" },
    subtitle: { EN: "Elite Apartments", RU: "Элитные апартаменты" },
    description: {
      EN: "Magical Bosnia with elite apartments and high volume. Expect 3-6 verified guests daily and massive clean income.",
      RU: "Волшебная Босния с элитными апартаментами и высоким потоком. 3-6 проверенных гостей в день и огромный чистый доход."
    },
    rates: {
      split: "50/50 (Clean income 7k-16k€ / 2 weeks)",
      shot: "30m: 100 - 150€ / 45m: 150 - 180€",
      incall: "1h: 200 - 250€",
      outcall: "Tips & extras 100% yours",
    },
    accommodation: {
      EN: "Elite apartments. Crediting available on a case-by-case basis.",
      RU: "Элитные апартаменты. Кредитация рассматривается индивидуально."
    },
    services: {
      EN: "Hours: 11:00 - 02:00. Safe environment with zero police issues. Fake/curated photos allowed.",
      RU: "График: 11:00 - 02:00. Безопасная среда, нет проблем с полицией. Возможна работа по типажным фото."
    },
    x: 67.3,
    y: 71.8,
  },
  {
    id: "serbia",
    name: { EN: "SERBIA (BELGRADE)", RU: "СЕРБИЯ (БЕЛГРАД)" },
    subtitle: { EN: "Verified Trust", RU: "Проверенное доверие" },
    description: {
      EN: "Solid market where 70% are wealthy regular clients. High trust, comfortable night shifts, and reliable crypto payouts.",
      RU: "Стабильный рынок, где 70% — богатые постоянные клиенты. Высокое доверие, комфортные ночные смены и вывод на крипту."
    },
    rates: {
      split: "50/50",
      shot: "Night (6-7h): 1200 - 1500€+",
      incall: "1h: 200 - 250€",
      outcall: "1h: 250 - 300€ + Taxi",
    },
    accommodation: {
      EN: "City center apartments (~30-35€/day for model). Living and flights split 50/50.",
      RU: "Апартаменты в центре (~30-35€/сутки для модели). Расходы на жилье и перелет 50/50."
    },
    services: {
      EN: "Night schedule: 16:00 - 04:00. Min tour: 14 days. Withdrawal to crypto or CIS cards.",
      RU: "Ночной график: 16:00 - 04:00. Мин. тур: 14 дней. Помощь с выводом на крипту или карты СНГ."
    },
    x: 72.5,
    y: 68.0,
  },
  {
    id: "montenegro",
    name: { EN: "MONTENEGRO (BUDVA)", RU: "ЧЕРНОГОРИЯ (БУДВА)" },
    subtitle: { EN: "Adriatic Gem", RU: "Жемчужина Адриатики" },
    description: {
      EN: "Visa-free entry for 30 days. Perfect resort vibe mixed with high-earning potential in a safe, vetted environment.",
      RU: "Безвизовый въезд на 30 дней. Идеальный курортный вайб, совмещенный с высокими заработками в безопасной среде."
    },
    rates: {
      split: "50/50",
      shot: "Solid database of regulars",
      incall: "1h: 200 - 250€",
      outcall: "Tour across the Balkans available",
    },
    accommodation: {
      EN: "High-quality apartments. Everything split 50/50.",
      RU: "Хорошие апартаменты. Все расходы делятся 50/50."
    },
    services: {
      EN: "Part of the 21-day Balkan tour. Mandatory verification of new clients. 24/7 support.",
      RU: "Часть 21-дневного Балканского тура. Обязательная пробивка новых клиентов. Поддержка 24/7."
    },
    x: 70.0,
    y: 77,
  }
];

const ARTERIES: string[] = [
  // UK → Paris → Switzerland → Italy
  "30.0,41.6 35.0,52.3 46.5,59.4 55.0,77.6",
  // Spain → Nice → Monaco → Italy
  "18.0,82.6 45.0,67.8 45.6,67.6 55.0,77.6",
];

const HIGHLIGHTS: Highlight[] = [
  {
    icon: <ShieldCheck className="w-7 h-7" />,
    title: { EN: "Schengen Access", RU: "Шенгенская зона" },
    body: {
      EN: "Seamless borderless movement across the Schengen area on a single visa.",
      RU: "Свободное передвижение по Шенгенской зоне без границ — по единой визе.",
    },
  },
  {
    icon: <Plane className="w-7 h-7" />,
    title: { EN: "Euro Tours", RU: "Евро-туры" },
    body: {
      EN: "Private charters and curated residences linking every hub in one golden arc.",
      RU: "VIP-чартеры и подобранные резиденции, связывающие хабы в единую золотую дугу.",
    },
  },
  {
    icon: <Crown className="w-7 h-7" />,
    title: { EN: "Exclusive Parties", RU: "Закрытые вечеринки" },
    body: {
      EN: "Invitation-only access to elite image events behind unmarked doors.",
      RU: "Доступ по приглашению на закрытые имидж-мероприятия за неприметными дверями.",
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="relative flex items-center bg-zinc-900/80 border border-zinc-800 rounded-full p-1 w-fit">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute top-1 bottom-1 rounded-full bg-zinc-800"
        style={{ width: "calc(50% - 4px)", left: lang === "EN" ? "4px" : "calc(50%)" }}
      />
      {(["EN", "RU"] as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`relative z-10 px-5 py-1.5 text-xs font-medium tracking-widest transition-colors duration-200 ${
            lang === l ? "text-amber-200" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function RadarNode({ active }: { active: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      <AnimatePresence>
        {active && (
          <motion.div key="waves" className="absolute inset-0 flex items-center justify-center">
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.4, 0], scale: [1, 2.5, 3.5] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inline-flex h-4 w-4 rounded-full bg-amber-400/40"
            />
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.3, 0], scale: [1, 2, 3] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
              className="absolute inline-flex h-4 w-4 rounded-full bg-amber-400/20"
            />
          </motion.div>
        )}
      </AnimatePresence>
      <span
        className={`relative inline-flex rounded-full transition-all duration-500 z-10 ${
          active
            ? "h-4 w-4 bg-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.9)]"
            : "h-2 w-2 bg-amber-200/40 backdrop-blur-sm"
        }`}
      />
    </div>
  );
}

export default function EuropePage() {
  const [lang, setLang] = useState<Lang>("EN");
  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [selected, setSelected] = useState<Hub | null>(null);

  const openHub = (hub: Hub) => {
    setActiveHub(hub.id);
    setSelected(hub);
  };

  useEffect(() => {
    document.body.style.overflow = selected ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selected]);

  const t = useMemo(
    () => ({
      back: { EN: "Back to Global Map", RU: "К глобальной карте" },
      heroTitle: { EN: "EUROPE & GREAT BRITAIN", RU: "ЕВРОПА И ВЕЛИКОБРИТАНИЯ" },
      heroSubtitle: {
        EN: "Twenty destinations curated for VIP travel, image events and private gatherings.",
        RU: "Двадцать направлений для VIP-туров, имидж-вечеринок и закрытых мероприятий.",
      },
      hubsLabel: { EN: "Member Destinations", RU: "Направления клуба" },
      mapLabel: { EN: "Regional Overview", RU: "Обзор региона" },
      highlightsTitle: { EN: "Membership Privileges", RU: "Привилегии членства" },
      drawerEyebrow: { EN: "Location Dossier", RU: "Досье локации" },
      drawerCta: { EN: "Resident Access", RU: "Вход для резидентов" },
      ratesLabel: { EN: "Rates", RU: "Тарифы" },
      accommodationLabel: { EN: "Accommodation", RU: "Проживание" },
      servicesLabel: { EN: "Services", RU: "Условия" },
      splitLabel: { EN: "Split", RU: "Дележ" },
      shotLabel: { EN: "Shot", RU: "Shot" },
      incallLabel: { EN: "Incall", RU: "Incall" },
      outcallLabel: { EN: "Outcall", RU: "Outcall" },
    }),
    []
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-200/20 selection:text-amber-100">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-900/50 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="group flex items-center gap-2 text-xs uppercase tracking-widest font-medium text-zinc-400 transition-colors hover:text-amber-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            {t.back[lang]}
          </Link>
          <div className="flex items-center gap-4">
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-36 pb-16 px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h1 className="font-serif text-6xl font-light tracking-tight text-zinc-100 sm:text-7xl lg:text-8xl">
              {t.heroTitle[lang]}
            </h1>
            <p className="mt-4 max-w-2xl text-lg font-light leading-relaxed text-zinc-400">
              {t.heroSubtitle[lang]}
            </p>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-amber-400/5 blur-[120px]" />
      </section>

      {/* ── Split Section ── */}
      <section className="px-6 pb-24 relative z-10">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
            {/* Left: Hub List */}
            <div className="lg:col-span-5">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <MapPin className="h-3.5 w-3.5" />
                {t.hubsLabel[lang]}
              </div>

              <div className="space-y-1 pr-2 max-h-[600px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {HUBS.map((hub, idx) => {
                  const isActive = activeHub === hub.id;
                  const num = String(idx + 1).padStart(2, "0");
                  return (
                    <motion.div
                      key={hub.id}
                      onMouseEnter={() => setActiveHub(hub.id)}
                      onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                      onClick={() => openHub(hub)}
                      className={`group flex cursor-pointer items-center justify-between rounded-xl px-5 py-4 transition-all duration-300 ${
                        isActive ? "bg-zinc-900/60 border border-zinc-800/80" : "border border-transparent hover:bg-zinc-900/30"
                      }`}
                    >
                      <div className="flex items-center gap-5">
                        <span className={`font-mono text-sm transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-700"}`}>
                          {num}
                        </span>
                        <div>
                          <h3 className={`font-serif text-2xl font-light tracking-wide transition-colors duration-300 ${isActive ? "text-amber-200" : "text-zinc-300 group-hover:text-zinc-100"}`}>
                            {hub.name[lang]}
                          </h3>
                          <p className={`mt-1 text-[11px] uppercase tracking-widest transition-colors duration-300 ${isActive ? "text-amber-200/70" : "text-zinc-600"}`}>
                            {hub.subtitle[lang]}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className={`h-5 w-5 transition-all duration-300 ${isActive ? "translate-x-0 text-amber-200 opacity-100" : "-translate-x-2 text-zinc-700 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`} />
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right: Map */}
            <div className="lg:col-span-7">
              <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/60">
                <Globe className="h-3.5 w-3.5" />
                {t.mapLabel[lang]}
              </div>

              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-950 shadow-2xl">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={STAGE_STYLE}>
                  <Image src="/map-europe.jpg" alt="Europe Map" fill priority className="object-contain opacity-80" />

                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-zinc-950/40 to-zinc-950 pointer-events-none" />

                  <svg className="absolute inset-0 h-full w-full pointer-events-none opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
                        <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {ARTERIES.map((points, i) => (
                      <polyline key={i} points={points} fill="none" stroke="url(#lineGrad)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                    ))}
                  </svg>

                  {HUBS.map((hub) => {
                    const labelAbove = hub.y > 82;
                    return (
                      <div key={hub.id} className="absolute -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${hub.x}%`, top: `${hub.y}%` }}>
                        <button
                          type="button"
                          onMouseEnter={() => setActiveHub(hub.id)}
                          onMouseLeave={() => setActiveHub((cur) => (selected ? cur : null))}
                          onClick={() => openHub(hub)}
                          aria-label={hub.name[lang]}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center"
                        >
                          <RadarNode active={activeHub === hub.id} />
                        </button>
                        <AnimatePresence>
                          {activeHub === hub.id && (
                            <motion.div
                              key={`tooltip-${hub.id}`}
                              initial={{ opacity: 0, y: labelAbove ? -10 : 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: labelAbove ? -10 : 10 }}
                              transition={{ duration: 0.2 }}
                              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap z-20 ${labelAbove ? "bottom-full mb-3" : "top-full mt-3"}`}
                            >
                              <div className="rounded-lg bg-zinc-950/90 px-4 py-2 text-[10px] tracking-widest uppercase font-medium text-amber-200 shadow-xl border border-amber-200/20 backdrop-blur-md">
                                {hub.name[lang]}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="absolute top-6 left-6 z-10 pointer-events-none">
                  <span className="font-serif text-5xl font-light text-zinc-100/10 select-none tracking-widest">EUROPE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Highlights ── */}
      <section className="border-t border-zinc-900 bg-zinc-950/50 px-6 py-24 relative z-10">
        <div className="mx-auto max-w-7xl">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-14 font-serif text-4xl font-light text-zinc-100"
          >
            {t.highlightsTitle[lang]}
          </motion.h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HIGHLIGHTS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-8 transition-all duration-500 hover:border-amber-200/30 hover:bg-zinc-900/50"
              >
                <div className="mb-6 w-12 h-12 rounded-full border border-amber-200/20 flex items-center justify-center text-amber-200/70 transition-colors duration-500 group-hover:border-amber-200/40 group-hover:text-amber-200">
                  {item.icon}
                </div>
                <h3 className="mb-3 font-serif text-2xl font-light text-zinc-100">{item.title[lang]}</h3>
                <p className="text-sm font-light leading-relaxed text-zinc-500">{item.body[lang]}</p>
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/5 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-0 pointer-events-none" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-12" />

      {/* ── Location Drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              key="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              key="drawer-panel"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md overflow-y-auto border-l border-zinc-800/80 bg-zinc-950 p-8 sm:p-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] uppercase tracking-[0.3em] text-amber-200/60">{t.drawerEyebrow[lang]}</span>
                <button onClick={() => setSelected(null)} aria-label="Close" className="-mr-2 -mt-2 rounded-full p-2 text-zinc-500 transition-colors hover:text-amber-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <h2 className="mt-10 font-serif text-5xl font-light leading-tight text-zinc-100">{selected.name[lang]}</h2>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-amber-200/70">{selected.subtitle[lang]}</p>
              <div className="my-8 h-px w-16 bg-amber-200/30" />
              <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.description[lang]}</p>

              {/* Rates */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.ratesLabel[lang]}</h4>
                <div className="space-y-2 text-sm text-zinc-400">
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.splitLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.split}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.shotLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.shot}</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-800/60 pb-2">
                    <span className="text-zinc-500">{t.incallLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.incall}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">{t.outcallLabel[lang]}</span>
                    <span className="text-zinc-300">{selected.rates.outcall}</span>
                  </div>
                </div>
              </div>

              {/* Accommodation */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.accommodationLabel[lang]}</h4>
                <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.accommodation[lang]}</p>
              </div>

              {/* Services */}
              <div className="mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60 mb-3">{t.servicesLabel[lang]}</h4>
                <p className="text-sm font-light leading-relaxed text-zinc-400">{selected.services[lang]}</p>
              </div>

              <Link href="/login" className="mt-10 inline-flex items-center justify-center rounded-full bg-amber-200 px-8 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-950 transition-colors hover:bg-amber-100">
                {t.drawerCta[lang]}
              </Link>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}