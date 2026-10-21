-- ════════════════════════════════════════════════════════════════════════
-- VOYAGE · Гайд «Чемодан в тур»: интерактивный чек-лист перед вылетом
-- supabase/migrations/20261021120000_guides_suitcase_checklist.sql
--
-- Накатывается после 20261021100000_guides_cms.sql и
-- 20261021110000_guides_seo_images.sql. Только данные, схема не меняется.
--
-- В 4 стартовых гайдах (RU/EN/ES/PT) ставит блок
-- <div class="guide-checklist"> на 20 пунктов в 5 категориях. Его сайт
-- рисует интерактивным «Проверка готовности».
--
-- Куда ставится (для каждого гайда отдельно):
--   1. Если в тексте уже есть блок guide-checklist — заменяется он.
--   2. Иначе, если есть раздел «Финальный чек-лист…» (любой уровень #),
--      заменяется текст этого раздела до следующего заголовка того же
--      или более высокого уровня. Сам заголовок остаётся.
--   3. Иначе раздел дописывается в конец статьи.
-- Повторный запуск безопасен: сработает пункт 1.
-- ════════════════════════════════════════════════════════════════════════

begin;

create or replace function pg_temp.voyage_put_checklist(
  p_slug     text,
  p_pattern  text,   -- регулярка заголовка раздела (без учёта регистра)
  p_heading  text,   -- заголовок для дописывания в конец
  p_intro    text,
  p_block    text
) returns void
language plpgsql
as $$
declare
  c          text;
  v_start    int;
  v_end      int;
  v_line_end int;
  v_level    int;
  v_next     int;
begin
  select content into c from public.guides where slug = p_slug;
  if not found then
    return;
  end if;
  c := coalesce(c, '');

  -- 1. Уже есть блок чек-листа → заменить блок
  v_start := strpos(c, '<div class="guide-checklist"');
  if v_start > 0 then
    v_end := strpos(substr(c, v_start), '</div>');
    if v_end > 0 then
      c := left(c, v_start - 1) || p_block || substr(c, v_start + v_end - 1 + length('</div>'));
      update public.guides set content = c where slug = p_slug;
      return;
    end if;
  end if;

  -- 2. Есть раздел «Финальный чек-лист…» → заменить его текст
  v_start := regexp_instr(c, '(^|\n)#{1,6}[^\n]*(' || p_pattern || ')', 1, 1, 0, 'i');
  if v_start > 0 then
    if substr(c, v_start, 1) = E'\n' then
      v_start := v_start + 1;
    end if;
    v_level := length(substring(substr(c, v_start) from '^(#+)'));
    v_line_end := strpos(substr(c, v_start), E'\n');
    if v_line_end = 0 then
      c := c || E'\n\n' || p_intro || E'\n\n' || p_block || E'\n';
    else
      v_line_end := v_start + v_line_end - 1; -- позиция \n после заголовка
      v_next := regexp_instr(c, '\n#{1,' || v_level || '}\s', v_line_end + 1);
      c := left(c, v_line_end) || E'\n' || p_intro || E'\n\n' || p_block || E'\n'
        || case when v_next > 0 then substr(c, v_next) else '' end;
    end if;
    update public.guides set content = c where slug = p_slug;
    return;
  end if;

  -- 3. Дописать раздел в конец
  c := rtrim(c, E'\n ') ;
  c := c || case when c = '' then '' else E'\n\n' end
         || '## ' || p_heading || E'\n\n' || p_intro || E'\n\n' || p_block || E'\n';
  update public.guides set content = c where slug = p_slug;
end;
$$;

-- ─── RU ────────────────────────────────────────────────────────────────
select pg_temp.voyage_put_checklist(
  'chemodan-v-tur-bez-paniki',
  'финальный чек-лист|чек-лист перед вылетом|проверка готовности',
  'Финальный чек-лист перед вылетом',
  'Этот список удобно пройти вечером накануне поездки. Отмечайте пункты: прогресс сохранится на этом устройстве, а готовый список можно скопировать в «Избранное» Telegram или в Заметки.',
  $block$<div class="guide-checklist" data-title="Проверка готовности">

### Документы и деньги
- [ ] Паспорт, виза и документы для въезда проверены
- [ ] Билеты, адрес проживания и контакты сохранены офлайн
- [ ] Основная и резервная оплата подготовлены
- [ ] Есть резерв на транспорт и непредвиденные расходы

### Одежда и уход
- [ ] Рабочие комплекты собраны и проверены
- [ ] Обувь удобная, все пары исправны
- [ ] Повседневная одежда и бельё упакованы
- [ ] Косметика, уход и необходимые средства гигиены на месте

### Техника и здоровье
- [ ] Телефон и зарядные устройства исправны
- [ ] Проверены связь, роуминг или eSIM
- [ ] Необходимые лекарства собраны
- [ ] Проверены ограничения на аккумуляторы и жидкости

### Работа и безопасность
- [ ] С менеджером согласованы условия и порядок связи
- [ ] Понятно, как фиксируются встречи и расчёты
- [ ] Есть контакты экстренных служб и доверенного человека
- [ ] Сохранена возможность самостоятельно добраться до безопасного места

### Багаж и дорога
- [ ] Вес багажа соответствует правилам перевозчика
- [ ] Документы, деньги и ценные вещи в ручной клади
- [ ] На первые сутки есть сменное бельё и базовые вещи
- [ ] Трансфер в аэропорт и время выезда проверены

</div>$block$
);

-- ─── EN ────────────────────────────────────────────────────────────────
select pg_temp.voyage_put_checklist(
  'packing-for-a-tour-without-panic',
  'final checklist|checklist before (the )?flight|readiness check',
  'Final checklist before the flight',
  'This list is easiest to go through the evening before the trip. Tick items as you go: progress is saved on this device, and the finished list can be copied to Telegram “Saved Messages” or to your Notes.',
  $block$<div class="guide-checklist" data-title="Readiness check">

### Documents & money
- [ ] Passport, visa and entry documents checked
- [ ] Tickets, accommodation address and contacts saved offline
- [ ] Main and backup payment methods ready
- [ ] A reserve for transport and unexpected expenses

### Clothes & care
- [ ] Work outfits packed and checked
- [ ] Comfortable shoes, every pair in good shape
- [ ] Everyday clothes and underwear packed
- [ ] Cosmetics, skincare and hygiene essentials in place

### Tech & health
- [ ] Phone and chargers working
- [ ] Mobile connection, roaming or eSIM checked
- [ ] Necessary medicines packed
- [ ] Battery and liquid restrictions checked

### Work & safety
- [ ] Terms and how to stay in touch agreed with the manager
- [ ] Clear how meetings and payments are recorded
- [ ] Emergency numbers and a trusted contact saved
- [ ] A way to get to a safe place on your own

### Luggage & travel
- [ ] Luggage weight meets the airline rules
- [ ] Documents, money and valuables in hand luggage
- [ ] A change of underwear and basics for the first day
- [ ] Airport transfer and departure time checked

</div>$block$
);

-- ─── ES ────────────────────────────────────────────────────────────────
select pg_temp.voyage_put_checklist(
  'la-maleta-del-tour-sin-panico',
  'checklist final|lista final|antes del vuelo|lista de preparación',
  'Checklist final antes del vuelo',
  'Esta lista es más cómoda la noche antes del viaje. Marca los puntos: el progreso se guarda en este dispositivo y la lista terminada se puede copiar a «Mensajes guardados» de Telegram o a tus Notas.',
  $block$<div class="guide-checklist" data-title="Lista de preparación">

### Documentos y dinero
- [ ] Pasaporte, visado y documentos de entrada revisados
- [ ] Billetes, dirección del alojamiento y contactos guardados sin conexión
- [ ] Medio de pago principal y de reserva preparados
- [ ] Reserva para transporte e imprevistos

### Ropa y cuidado
- [ ] Conjuntos de trabajo listos y revisados
- [ ] Calzado cómodo, todos los pares en buen estado
- [ ] Ropa de diario y ropa interior en la maleta
- [ ] Cosmética, cuidado y artículos de higiene a mano

### Tecnología y salud
- [ ] Teléfono y cargadores funcionando
- [ ] Conexión, roaming o eSIM comprobados
- [ ] Medicamentos necesarios en la maleta
- [ ] Revisadas las restricciones de baterías y líquidos

### Trabajo y seguridad
- [ ] Condiciones y forma de contacto acordadas con el mánager
- [ ] Claro cómo se registran los encuentros y los pagos
- [ ] Contactos de emergencia y de una persona de confianza guardados
- [ ] Posibilidad de llegar por tu cuenta a un lugar seguro

### Equipaje y viaje
- [ ] El peso del equipaje cumple las normas de la aerolínea
- [ ] Documentos, dinero y objetos de valor en el equipaje de mano
- [ ] Muda de ropa interior y lo básico para el primer día
- [ ] Traslado al aeropuerto y hora de salida comprobados

</div>$block$
);

-- ─── PT ────────────────────────────────────────────────────────────────
select pg_temp.voyage_put_checklist(
  'a-mala-do-tour-sem-panico',
  'checklist final|lista final|antes do voo|checklist de preparação',
  'Checklist final antes do voo',
  'Esta lista é mais prática na noite anterior à viagem. Marque os itens: o progresso fica salvo neste dispositivo e a lista pronta pode ser copiada para «Mensagens salvas» do Telegram ou para as Notas.',
  $block$<div class="guide-checklist" data-title="Checklist de preparação">

### Documentos e dinheiro
- [ ] Passaporte, visto e documentos de entrada conferidos
- [ ] Passagens, endereço da hospedagem e contatos salvos offline
- [ ] Forma de pagamento principal e reserva preparadas
- [ ] Reserva para transporte e imprevistos

### Roupas e cuidados
- [ ] Looks de trabalho prontos e conferidos
- [ ] Sapatos confortáveis, todos os pares em bom estado
- [ ] Roupas do dia a dia e roupa íntima na mala
- [ ] Maquiagem, skincare e itens de higiene separados

### Tecnologia e saúde
- [ ] Celular e carregadores funcionando
- [ ] Conexão, roaming ou eSIM verificados
- [ ] Remédios necessários na mala
- [ ] Verificadas as regras para baterias e líquidos

### Trabalho e segurança
- [ ] Condições e forma de contato combinadas com o gerente
- [ ] Claro como os encontros e pagamentos são registrados
- [ ] Contatos de emergência e de uma pessoa de confiança salvos
- [ ] Possibilidade de chegar sozinha a um lugar seguro

### Bagagem e viagem
- [ ] Peso da bagagem dentro das regras da companhia aérea
- [ ] Documentos, dinheiro e objetos de valor na bagagem de mão
- [ ] Muda de roupa íntima e o básico para o primeiro dia
- [ ] Transfer para o aeroporto e horário de saída conferidos

</div>$block$
);

commit;
