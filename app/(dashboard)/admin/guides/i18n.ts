"use client";

import { useMemo } from "react";
import { useLanguage, type Lang } from "@/app/context/LanguageContext";
import type { GuideActionError } from "@/app/actions/guides";

/* Тексты раздела /admin/guides на RU/EN/ES/PT */

const dict = {
  EN: {
    eyebrow: "Club Library · Content", title: "Guides & cheat sheets", intro: "Articles for the “Guides & Cheat Sheets” block on the home page. Published guides appear on the site right away, in the language they are written in.",
    create: "New guide", refresh: "Refresh", library: "Library", guides: "guides",
    colTitle: "Guide", colLanguage: "Language", colStatus: "Status", colDate: "Created", colActions: "Actions",
    published: "Published", draft: "Draft", publish: "Publish", unpublish: "Hide", open: "Open on site", edit: "Edit", delete: "Delete",
    loading: "Loading guides…", empty: "No guides yet. Create the first one — it will appear on the home page.",
    noAccess: "Only administrators and the owner can manage guides.",
    modalCreate: "New guide", modalEdit: "Edit guide",
    fTitle: "Title", fSlug: "URL (slug)", fSlugHint: "Latin letters, digits and hyphens. Leave empty to generate from the title.",
    fDescription: "Short description for the card", fContent: "Full text (Markdown + HTML)", fContentHint: "# heading, ## subheading, - list, 1. numbered list, > quote, **bold**, *italic*, [link](https://…), --- divider",
    fReadingTime: "Reading time", fReadingTimePlaceholder: "7 min read", fTags: "Tags", fTagsHint: "Comma-separated: looks, beauty, documents",
    fLanguage: "Language", fPublished: "Published on the site", fPdf: "PDF file",
    pdfUpload: "Upload PDF", pdfReplace: "Replace PDF", pdfRemove: "Remove", pdfUploading: "Uploading…", pdfCurrent: "Attached file", pdfHint: "PDF only, up to 20 MB. Stored in Supabase Storage (guide-files).",
    cancel: "Cancel", save: "Save", saving: "Saving…", close: "Close",
    confirmDelete: "Delete “{title}”? The guide and its PDF will be removed for good.",
    saved: "Guide saved.", deleted: "Guide deleted.", publishedNotice: "Guide published.", hiddenNotice: "Guide hidden from the site.",
    err_unauthorized: "Not enough rights. Sign in as an administrator or owner.", err_validation: "Check the fields: title from 3 characters, description up to 1000.",
    err_invalid_slug: "The URL may contain only Latin letters, digits and hyphens.", err_slug_taken: "This URL is already used by another guide.",
    err_not_found: "The guide was not found — it may have been deleted.", err_failed: "The operation failed. Try again or check the server logs.",
    err_pdf_type: "Only PDF files can be uploaded.", err_pdf_size: "The file is larger than 20 MB.", err_pdf_upload: "The PDF could not be uploaded. Check the guide-files bucket and permissions.",
  },
  RU: {
    eyebrow: "Библиотека клуба · Контент", title: "Гайды и шпаргалки", intro: "Статьи для блока «Гайды и шпаргалки» на главной. Опубликованные гайды сразу появляются на сайте — на том языке, на котором написаны.",
    create: "Новый гайд", refresh: "Обновить", library: "Библиотека", guides: "гайдов",
    colTitle: "Гайд", colLanguage: "Язык", colStatus: "Статус", colDate: "Создан", colActions: "Управление",
    published: "Опубликован", draft: "Черновик", publish: "Опубликовать", unpublish: "Скрыть", open: "Открыть на сайте", edit: "Редактировать", delete: "Удалить",
    loading: "Загрузка гайдов…", empty: "Гайдов пока нет. Создайте первый — он появится на главной.",
    noAccess: "Управлять гайдами могут только администраторы и владелец.",
    modalCreate: "Новый гайд", modalEdit: "Редактирование гайда",
    fTitle: "Заголовок", fSlug: "Адрес (slug)", fSlugHint: "Латиница, цифры и дефисы. Если оставить пустым, адрес соберётся из заголовка.",
    fDescription: "Краткое описание для карточки", fContent: "Полный текст (Markdown + HTML)", fContentHint: "# заголовок, ## подзаголовок, - список, 1. нумерованный список, > цитата, **жирный**, *курсив*, [ссылка](https://…), --- разделитель",
    fReadingTime: "Время чтения", fReadingTimePlaceholder: "7 мин чтения", fTags: "Теги", fTagsHint: "Через запятую: образы, бьюти, документы",
    fLanguage: "Язык", fPublished: "Опубликован на сайте", fPdf: "PDF-файл",
    pdfUpload: "Загрузить PDF", pdfReplace: "Заменить PDF", pdfRemove: "Убрать", pdfUploading: "Загрузка…", pdfCurrent: "Прикреплённый файл", pdfHint: "Только PDF, до 20 МБ. Файл хранится в Supabase Storage (guide-files).",
    cancel: "Отмена", save: "Сохранить", saving: "Сохранение…", close: "Закрыть",
    confirmDelete: "Удалить «{title}»? Гайд и его PDF будут удалены безвозвратно.",
    saved: "Гайд сохранён.", deleted: "Гайд удалён.", publishedNotice: "Гайд опубликован.", hiddenNotice: "Гайд скрыт с сайта.",
    err_unauthorized: "Недостаточно прав. Войдите как администратор или владелец.", err_validation: "Проверьте поля: заголовок от 3 символов, описание до 1000.",
    err_invalid_slug: "Адрес может содержать только латиницу, цифры и дефисы.", err_slug_taken: "Такой адрес уже занят другим гайдом.",
    err_not_found: "Гайд не найден — возможно, его уже удалили.", err_failed: "Не удалось выполнить операцию. Повторите или проверьте серверные логи.",
    err_pdf_type: "Можно загрузить только PDF.", err_pdf_size: "Файл больше 20 МБ.", err_pdf_upload: "Не удалось загрузить PDF. Проверьте бакет guide-files и права доступа.",
  },
  ES: {
    eyebrow: "Biblioteca del club · Contenido", title: "Guías y apuntes", intro: "Artículos para el bloque «Guías y apuntes» de la portada. Las guías publicadas aparecen en el sitio al instante, en el idioma en que están escritas.",
    create: "Nueva guía", refresh: "Actualizar", library: "Biblioteca", guides: "guías",
    colTitle: "Guía", colLanguage: "Idioma", colStatus: "Estado", colDate: "Creada", colActions: "Acciones",
    published: "Publicada", draft: "Borrador", publish: "Publicar", unpublish: "Ocultar", open: "Abrir en el sitio", edit: "Editar", delete: "Eliminar",
    loading: "Cargando guías…", empty: "Aún no hay guías. Crea la primera: aparecerá en la portada.",
    noAccess: "Solo los administradores y el propietario pueden gestionar las guías.",
    modalCreate: "Nueva guía", modalEdit: "Editar guía",
    fTitle: "Título", fSlug: "URL (slug)", fSlugHint: "Letras latinas, números y guiones. Si lo dejas vacío, se genera a partir del título.",
    fDescription: "Descripción breve para la tarjeta", fContent: "Texto completo (Markdown + HTML)", fContentHint: "# título, ## subtítulo, - lista, 1. lista numerada, > cita, **negrita**, *cursiva*, [enlace](https://…), --- separador",
    fReadingTime: "Tiempo de lectura", fReadingTimePlaceholder: "7 min de lectura", fTags: "Etiquetas", fTagsHint: "Separadas por comas: looks, belleza, documentos",
    fLanguage: "Idioma", fPublished: "Publicada en el sitio", fPdf: "Archivo PDF",
    pdfUpload: "Subir PDF", pdfReplace: "Reemplazar PDF", pdfRemove: "Quitar", pdfUploading: "Subiendo…", pdfCurrent: "Archivo adjunto", pdfHint: "Solo PDF, hasta 20 MB. Se guarda en Supabase Storage (guide-files).",
    cancel: "Cancelar", save: "Guardar", saving: "Guardando…", close: "Cerrar",
    confirmDelete: "¿Eliminar «{title}»? La guía y su PDF se borrarán definitivamente.",
    saved: "Guía guardada.", deleted: "Guía eliminada.", publishedNotice: "Guía publicada.", hiddenNotice: "Guía oculta del sitio.",
    err_unauthorized: "Permisos insuficientes. Inicia sesión como administrador o propietario.", err_validation: "Revisa los campos: título de al menos 3 caracteres, descripción hasta 1000.",
    err_invalid_slug: "La URL solo puede contener letras latinas, números y guiones.", err_slug_taken: "Esta URL ya la usa otra guía.",
    err_not_found: "No se encontró la guía; puede que ya se haya eliminado.", err_failed: "No se pudo completar la operación. Inténtalo de nuevo o revisa los registros.",
    err_pdf_type: "Solo se pueden subir archivos PDF.", err_pdf_size: "El archivo supera los 20 MB.", err_pdf_upload: "No se pudo subir el PDF. Revisa el bucket guide-files y los permisos.",
  },
  PT: {
    eyebrow: "Biblioteca do clube · Conteúdo", title: "Guias e resumos", intro: "Artigos para o bloco «Guias e resumos» da página inicial. Os guias publicados aparecem no site na hora, no idioma em que foram escritos.",
    create: "Novo guia", refresh: "Atualizar", library: "Biblioteca", guides: "guias",
    colTitle: "Guia", colLanguage: "Idioma", colStatus: "Status", colDate: "Criado", colActions: "Ações",
    published: "Publicado", draft: "Rascunho", publish: "Publicar", unpublish: "Ocultar", open: "Abrir no site", edit: "Editar", delete: "Excluir",
    loading: "Carregando guias…", empty: "Ainda não há guias. Crie o primeiro: ele aparecerá na página inicial.",
    noAccess: "Somente administradores e o proprietário podem gerenciar os guias.",
    modalCreate: "Novo guia", modalEdit: "Editar guia",
    fTitle: "Título", fSlug: "URL (slug)", fSlugHint: "Letras latinas, números e hifens. Se ficar vazio, será gerado a partir do título.",
    fDescription: "Descrição curta para o card", fContent: "Texto completo (Markdown + HTML)", fContentHint: "# título, ## subtítulo, - lista, 1. lista numerada, > citação, **negrito**, *itálico*, [link](https://…), --- divisor",
    fReadingTime: "Tempo de leitura", fReadingTimePlaceholder: "7 min de leitura", fTags: "Tags", fTagsHint: "Separadas por vírgula: looks, beleza, documentos",
    fLanguage: "Idioma", fPublished: "Publicado no site", fPdf: "Arquivo PDF",
    pdfUpload: "Enviar PDF", pdfReplace: "Substituir PDF", pdfRemove: "Remover", pdfUploading: "Enviando…", pdfCurrent: "Arquivo anexado", pdfHint: "Somente PDF, até 20 MB. Fica no Supabase Storage (guide-files).",
    cancel: "Cancelar", save: "Salvar", saving: "Salvando…", close: "Fechar",
    confirmDelete: "Excluir «{title}»? O guia e o PDF serão removidos definitivamente.",
    saved: "Guia salvo.", deleted: "Guia excluído.", publishedNotice: "Guia publicado.", hiddenNotice: "Guia ocultado do site.",
    err_unauthorized: "Permissões insuficientes. Entre como administrador ou proprietário.", err_validation: "Confira os campos: título com pelo menos 3 caracteres, descrição até 1000.",
    err_invalid_slug: "A URL só pode conter letras latinas, números e hifens.", err_slug_taken: "Esta URL já é usada por outro guia.",
    err_not_found: "O guia não foi encontrado; talvez já tenha sido excluído.", err_failed: "Não foi possível concluir a operação. Tente novamente ou verifique os logs.",
    err_pdf_type: "Só é possível enviar arquivos PDF.", err_pdf_size: "O arquivo tem mais de 20 MB.", err_pdf_upload: "Não foi possível enviar o PDF. Verifique o bucket guide-files e as permissões.",
  },
} as const;

// Редактор: режимы «Быстро» / «SEO-профи», панель разметки, SEO-блок
const editorDict = {
  EN: {
    modeQuick: "Quick", modePro: "SEO pro", modeQuickHint: "Only the essentials. SEO fills itself from the title and description.", modeProHint: "Full control over the URL, meta tags, keywords and tags.",
    sectionMain: "Main", sectionContent: "Article text", sectionSeo: "SEO & tags", sectionFiles: "PDF & publication",
    fPreview: "Card preview text", slugAuto: "Address", slugEdit: "Change",
    tabWrite: "Text", tabPreview: "Preview", previewEmpty: "Nothing to preview yet.", previewLoading: "Rendering…",
    tbH2: "Heading", tbH3: "Subheading", tbBold: "Bold", tbItalic: "Italic", tbList: "List", tbOl: "Numbered list", tbQuote: "Quote", tbLink: "Link", tbTable: "Table", tbHr: "Divider", tbNote: "Highlight box", tbImage: "Upload image into article", tbImageUploading: "Uploading image…",
    tbChecklist: "Interactive checklist", tbChecklistHint: "Inserts a “Readiness check” block: groups with ###, items with - [ ]. Readers tick items, progress is saved in their browser.",
    sampleChecklist: "<div class=\"guide-checklist\" data-title=\"Readiness check\">\n\n### Documents & money\n- [ ] Passport and visa checked\n- [ ] Tickets saved offline\n\n### Clothes & care\n- [ ] Work outfits packed\n- [ ] Comfortable shoes\n\n</div>",
    contentHelp: "Markdown and HTML both work: ## heading, - list, | table |, ![](image), <figure>, <table>. Scripts and styles are stripped on the site. Checklists: - [ ] item, or the “Interactive checklist” button.",
    readingAuto: "Calculate", readingAutoHint: "If left empty, it is calculated from the text when you save.",
    fSeoTitle: "SEO Title", fSeoTitleHint: "Search result headline. Empty → the guide title is used.",
    fSeoDescription: "SEO Description", fSeoDescriptionHint: "Snippet text in Google/Yandex. Empty → the card preview is used.",
    fSeoKeywords: "SEO Keywords", fSeoKeywordsHint: "Keyword core, comma-separated.",
    seoFromTitle: "From title", seoFromPreview: "From preview",
    snippet: "Search snippet preview", chars: "chars", seoAutoSummary: "Meta tags will be generated from the title and the card preview. Switch to “SEO pro” to fine-tune them.",
    sampleTable: "| Item | Why | Tip |\n| --- | --- | --- |\n| Item 1 | … | … |\n| Item 2 | … | … |",
    sampleNote: "<div class=\"guide-note\">\n\n**Tip.** Text of the highlight box.\n\n</div>",
    sampleLink: "link text", sampleText: "text", sampleItem: "item", sampleHeading: "Heading",
    err_image_type: "Images only: JPG, PNG, WEBP, GIF or AVIF.", err_image_size: "The image is larger than 5 MB.", err_image_upload: "The image could not be uploaded. Check the guide-images bucket and permissions.",
    err_seoTitle: "SEO Title is too long (max 120 characters).", err_seoDescription: "SEO Description is too long (max 320 characters).",
  },
  RU: {
    modeQuick: "Быстро", modePro: "SEO-профи", modeQuickHint: "Только главное. SEO заполнится само из заголовка и превью.", modeProHint: "Полный контроль: адрес, мета-теги, SEO-ядро и теги.",
    sectionMain: "Основное", sectionContent: "Текст статьи", sectionSeo: "SEO и теги", sectionFiles: "PDF и публикация",
    fPreview: "Превью для карточки", slugAuto: "Адрес", slugEdit: "Изменить",
    tabWrite: "Текст", tabPreview: "Предпросмотр", previewEmpty: "Пока нечего показывать.", previewLoading: "Собираю предпросмотр…",
    tbH2: "Заголовок", tbH3: "Подзаголовок", tbBold: "Жирный", tbItalic: "Курсив", tbList: "Список", tbOl: "Нумерованный список", tbQuote: "Цитата", tbLink: "Ссылка", tbTable: "Таблица", tbHr: "Разделитель", tbNote: "Врезка", tbImage: "Загрузить картинку в статью", tbImageUploading: "Загружаю картинку…",
    tbChecklist: "Интерактивный чек-лист", tbChecklistHint: "Вставляет блок «Проверка готовности»: группы через ###, пункты через - [ ]. Читательница отмечает пункты, прогресс сохраняется в её браузере.",
    sampleChecklist: "<div class=\"guide-checklist\" data-title=\"Проверка готовности\">\n\n### Документы и деньги\n- [ ] Паспорт и виза проверены\n- [ ] Билеты сохранены офлайн\n\n### Одежда и уход\n- [ ] Рабочие комплекты собраны\n- [ ] Удобная обувь\n\n</div>",
    contentHelp: "Работают и Markdown, и HTML: ## заголовок, - список, | таблица |, ![](картинка), <figure>, <table>. Скрипты и стили на сайте вырезаются. Чек-листы: - [ ] пункт или кнопка «Интерактивный чек-лист».",
    readingAuto: "Посчитать", readingAutoHint: "Если оставить пустым, посчитается по тексту при сохранении.",
    fSeoTitle: "SEO Title", fSeoTitleHint: "Заголовок в поисковой выдаче. Пусто → берётся заголовок гайда.",
    fSeoDescription: "SEO Description", fSeoDescriptionHint: "Текст сниппета в Google/Yandex. Пусто → берётся превью карточки.",
    fSeoKeywords: "SEO Keywords", fSeoKeywordsHint: "SEO-ядро через запятую.",
    seoFromTitle: "Из заголовка", seoFromPreview: "Из превью",
    snippet: "Так гайд будет выглядеть в поиске", chars: "симв.", seoAutoSummary: "Мета-теги соберутся из заголовка и превью карточки. Чтобы настроить их вручную, переключитесь на «SEO-профи».",
    sampleTable: "| Что взять | Зачем | Совет |\n| --- | --- | --- |\n| Вещь 1 | … | … |\n| Вещь 2 | … | … |",
    sampleNote: "<div class=\"guide-note\">\n\n**Совет.** Текст врезки.\n\n</div>",
    sampleLink: "текст ссылки", sampleText: "текст", sampleItem: "пункт", sampleHeading: "Заголовок",
    err_image_type: "Только картинки: JPG, PNG, WEBP, GIF или AVIF.", err_image_size: "Картинка больше 5 МБ.", err_image_upload: "Не удалось загрузить картинку. Проверьте бакет guide-images и права доступа.",
    err_seoTitle: "SEO Title слишком длинный (до 120 символов).", err_seoDescription: "SEO Description слишком длинный (до 320 символов).",
  },
  ES: {
    modeQuick: "Rápido", modePro: "SEO pro", modeQuickHint: "Solo lo esencial. El SEO se rellena con el título y la vista previa.", modeProHint: "Control total: URL, metaetiquetas, palabras clave y etiquetas.",
    sectionMain: "Principal", sectionContent: "Texto del artículo", sectionSeo: "SEO y etiquetas", sectionFiles: "PDF y publicación",
    fPreview: "Vista previa para la tarjeta", slugAuto: "Dirección", slugEdit: "Cambiar",
    tabWrite: "Texto", tabPreview: "Vista previa", previewEmpty: "Aún no hay nada que mostrar.", previewLoading: "Generando vista previa…",
    tbH2: "Título", tbH3: "Subtítulo", tbBold: "Negrita", tbItalic: "Cursiva", tbList: "Lista", tbOl: "Lista numerada", tbQuote: "Cita", tbLink: "Enlace", tbTable: "Tabla", tbHr: "Separador", tbNote: "Recuadro", tbImage: "Subir imagen al artículo", tbImageUploading: "Subiendo imagen…",
    tbChecklist: "Checklist interactivo", tbChecklistHint: "Inserta un bloque «Lista de preparación»: grupos con ###, elementos con - [ ]. La lectora marca los puntos y el progreso se guarda en su navegador.",
    sampleChecklist: "<div class=\"guide-checklist\" data-title=\"Lista de preparación\">\n\n### Documentos y dinero\n- [ ] Pasaporte y visado revisados\n- [ ] Billetes guardados sin conexión\n\n### Ropa y cuidado\n- [ ] Conjuntos de trabajo listos\n- [ ] Calzado cómodo\n\n</div>",
    contentHelp: "Funcionan Markdown y HTML: ## título, - lista, | tabla |, ![](imagen), <figure>, <table>. Los scripts y estilos se eliminan en el sitio. Checklists: - [ ] elemento o el botón «Checklist interactivo».",
    readingAuto: "Calcular", readingAutoHint: "Si lo dejas vacío, se calcula a partir del texto al guardar.",
    fSeoTitle: "SEO Title", fSeoTitleHint: "Título en los resultados de búsqueda. Vacío → se usa el título de la guía.",
    fSeoDescription: "SEO Description", fSeoDescriptionHint: "Texto del snippet en Google/Yandex. Vacío → se usa la vista previa.",
    fSeoKeywords: "SEO Keywords", fSeoKeywordsHint: "Palabras clave separadas por comas.",
    seoFromTitle: "Del título", seoFromPreview: "De la vista previa",
    snippet: "Así se verá en el buscador", chars: "car.", seoAutoSummary: "Las metaetiquetas se generan a partir del título y la vista previa. Cambia a «SEO pro» para ajustarlas.",
    sampleTable: "| Qué llevar | Para qué | Consejo |\n| --- | --- | --- |\n| Artículo 1 | … | … |\n| Artículo 2 | … | … |",
    sampleNote: "<div class=\"guide-note\">\n\n**Consejo.** Texto del recuadro.\n\n</div>",
    sampleLink: "texto del enlace", sampleText: "texto", sampleItem: "elemento", sampleHeading: "Título",
    err_image_type: "Solo imágenes: JPG, PNG, WEBP, GIF o AVIF.", err_image_size: "La imagen supera los 5 MB.", err_image_upload: "No se pudo subir la imagen. Revisa el bucket guide-images y los permisos.",
    err_seoTitle: "El SEO Title es demasiado largo (máx. 120 caracteres).", err_seoDescription: "La SEO Description es demasiado larga (máx. 320 caracteres).",
  },
  PT: {
    modeQuick: "Rápido", modePro: "SEO pro", modeQuickHint: "Só o essencial. O SEO é preenchido a partir do título e da prévia.", modeProHint: "Controle total: URL, metatags, palavras-chave e tags.",
    sectionMain: "Principal", sectionContent: "Texto do artigo", sectionSeo: "SEO e tags", sectionFiles: "PDF e publicação",
    fPreview: "Prévia para o card", slugAuto: "Endereço", slugEdit: "Alterar",
    tabWrite: "Texto", tabPreview: "Prévia", previewEmpty: "Ainda não há nada para mostrar.", previewLoading: "Gerando prévia…",
    tbH2: "Título", tbH3: "Subtítulo", tbBold: "Negrito", tbItalic: "Itálico", tbList: "Lista", tbOl: "Lista numerada", tbQuote: "Citação", tbLink: "Link", tbTable: "Tabela", tbHr: "Divisor", tbNote: "Destaque", tbImage: "Enviar imagem para o artigo", tbImageUploading: "Enviando imagem…",
    tbChecklist: "Checklist interativo", tbChecklistHint: "Insere um bloco «Checklist de preparação»: grupos com ###, itens com - [ ]. A leitora marca os itens e o progresso fica salvo no navegador dela.",
    sampleChecklist: "<div class=\"guide-checklist\" data-title=\"Checklist de preparação\">\n\n### Documentos e dinheiro\n- [ ] Passaporte e visto conferidos\n- [ ] Passagens salvas offline\n\n### Roupas e cuidados\n- [ ] Looks de trabalho prontos\n- [ ] Sapatos confortáveis\n\n</div>",
    contentHelp: "Markdown e HTML funcionam: ## título, - lista, | tabela |, ![](imagem), <figure>, <table>. Scripts e estilos são removidos no site. Checklists: - [ ] item ou o botão «Checklist interativo».",
    readingAuto: "Calcular", readingAutoHint: "Se ficar vazio, é calculado a partir do texto ao salvar.",
    fSeoTitle: "SEO Title", fSeoTitleHint: "Título nos resultados de busca. Vazio → usa o título do guia.",
    fSeoDescription: "SEO Description", fSeoDescriptionHint: "Texto do snippet no Google/Yandex. Vazio → usa a prévia do card.",
    fSeoKeywords: "SEO Keywords", fSeoKeywordsHint: "Palavras-chave separadas por vírgula.",
    seoFromTitle: "Do título", seoFromPreview: "Da prévia",
    snippet: "Assim o guia aparece na busca", chars: "car.", seoAutoSummary: "As metatags são geradas a partir do título e da prévia. Mude para «SEO pro» para ajustá-las.",
    sampleTable: "| O que levar | Para quê | Dica |\n| --- | --- | --- |\n| Item 1 | … | … |\n| Item 2 | … | … |",
    sampleNote: "<div class=\"guide-note\">\n\n**Dica.** Texto do destaque.\n\n</div>",
    sampleLink: "texto do link", sampleText: "texto", sampleItem: "item", sampleHeading: "Título",
    err_image_type: "Somente imagens: JPG, PNG, WEBP, GIF ou AVIF.", err_image_size: "A imagem tem mais de 5 MB.", err_image_upload: "Não foi possível enviar a imagem. Verifique o bucket guide-images e as permissões.",
    err_seoTitle: "O SEO Title é longo demais (máx. 120 caracteres).", err_seoDescription: "A SEO Description é longa demais (máx. 320 caracteres).",
  },
} as const;

export type GuidesAdminCopy = Record<keyof (typeof dict)["EN"] | keyof (typeof editorDict)["EN"], string>;

const LANGUAGE_NAMES: Record<Lang, Record<"ru" | "en" | "es" | "pt", string>> = {
  EN: { ru: "Russian", en: "English", es: "Spanish", pt: "Portuguese" },
  RU: { ru: "Русский", en: "Английский", es: "Испанский", pt: "Португальский" },
  ES: { ru: "Ruso", en: "Inglés", es: "Español", pt: "Portugués" },
  PT: { ru: "Russo", en: "Inglês", es: "Espanhol", pt: "Português" },
};

const LOCALES: Record<Lang, string> = { EN: "en-US", RU: "ru-RU", ES: "es-ES", PT: "pt-BR" };

export function useGuidesAdminI18n() {
  const { lang } = useLanguage();
  const key: Lang = lang in dict ? lang : "EN";
  return useMemo(() => {
    const t: GuidesAdminCopy = { ...dict[key], ...editorDict[key] };
    const errorText = (reason: GuideActionError | string) =>
      (t as Record<string, string>)[`err_${reason}`] ?? t.err_failed;
    const formatDate = (iso: string) =>
      new Date(iso).toLocaleDateString(LOCALES[key], { day: "numeric", month: "short", year: "numeric" });
    return { t, lang: key, languageNames: LANGUAGE_NAMES[key], errorText, formatDate };
  }, [key]);
}
