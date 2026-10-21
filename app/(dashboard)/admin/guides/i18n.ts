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
    fDescription: "Short description for the card", fContent: "Full text (markdown)", fContentHint: "# heading, ## subheading, - list, 1. numbered list, > quote, **bold**, *italic*, [link](https://…), --- divider",
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
    fDescription: "Краткое описание для карточки", fContent: "Полный текст (markdown)", fContentHint: "# заголовок, ## подзаголовок, - список, 1. нумерованный список, > цитата, **жирный**, *курсив*, [ссылка](https://…), --- разделитель",
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
    fDescription: "Descripción breve para la tarjeta", fContent: "Texto completo (markdown)", fContentHint: "# título, ## subtítulo, - lista, 1. lista numerada, > cita, **negrita**, *cursiva*, [enlace](https://…), --- separador",
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
    fDescription: "Descrição curta para o card", fContent: "Texto completo (markdown)", fContentHint: "# título, ## subtítulo, - lista, 1. lista numerada, > citação, **negrito**, *itálico*, [link](https://…), --- divisor",
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

export type GuidesAdminCopy = Record<keyof (typeof dict)["EN"], string>;

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
    const t: GuidesAdminCopy = dict[key];
    const errorText = (reason: GuideActionError | string) =>
      (t as Record<string, string>)[`err_${reason}`] ?? t.err_failed;
    const formatDate = (iso: string) =>
      new Date(iso).toLocaleDateString(LOCALES[key], { day: "numeric", month: "short", year: "numeric" });
    return { t, lang: key, languageNames: LANGUAGE_NAMES[key], errorText, formatDate };
  }, [key]);
}
