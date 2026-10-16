import type { Lang } from "@/lib/gamification";

/** The exact confirmation phrase is checked again inside the Server Action. */
export const DELETE_RESIDENT_PHRASES: Record<Lang, string> = {
  ru: "Я ТРЕЗВ, ЭТО НЕ ТЕСТОВАЯ БАЗА",
  en: "I AM SOBER, THIS IS NOT A TEST DATABASE",
  es: "ESTOY SOBRIO, ESTO NO ES UNA BASE DE PRUEBA",
  pt: "ESTOU SÓBRIO, ISTO NÃO É UM BANCO DE TESTE",
};

export type ResidentDeletionCopy = {
  protocolLabel: string;
  modalEyebrow: string;
  dangerTitle: string;
  dangerBodyBefore: string;
  dangerBodyAfter: string;
  deleteButton: string;
  modalTitle: string;
  subjectLabel: string;
  close: string;
  stepAria: string;
  confirmationLevel: string;
  step1Title: string;
  step1BodyBefore: string;
  step1BodyAfter: string;
  step1Conscience: string;
  step1MafiaNote: string;
  cancel: string;
  step1Continue: string;
  step2Title: string;
  step2Body: string;
  bulletKyc: string;
  bulletTelegram: string;
  bulletAuth: string;
  restoreWarning: string;
  back: string;
  step2Continue: string;
  step3Title: string;
  step3Body: string;
  phraseLabel: string;
  phrasePlaceholder: string;
  pending: string;
  finalButton: string;
  footer: string;
  errorInvalid: string;
  errorUnauthenticated: string;
  errorForbidden: string;
  errorNotFound: string;
  errorNotResident: string;
  errorServer: string;
};

export const DELETE_RESIDENT_COPY: Record<Lang, ResidentDeletionCopy> = {
  ru: {
    protocolLabel: "Закрытый протокол · Только owner",
    modalEyebrow: "VOYAGE · Чёрный протокол",
    dangerTitle: "Зона риска",
    dangerBodyBefore: "Полная ликвидация профиля",
    dangerBodyAfter: "из системы VOYAGE. Не деактивация и не отпуск - удаление без кнопки «вернуть как было».",
    deleteButton: "Ликвидировать профиль",
    modalTitle: "Протокол «Тихий выход»",
    subjectLabel: "Объект",
    close: "Закрыть подтверждение",
    stepAria: "Шаг {step} из 3",
    confirmationLevel: "Уровень подтверждения {step}/3",
    step1Title: "Овнер, это не кнопка «передумать».",
    step1BodyBefore: "Вы собираетесь стереть",
    step1BodyAfter: "из клубной реальности VOYAGE. От этого не прибавится ни харизмы, ни очков влияния - только риск услышать ночью голос совести в стиле",
    step1Conscience: "«дон, а бэкап где?»",
    step1MafiaNote: "Даже мафия сначала уточняет, точно ли это не племянница босса. У нас бюрократия строже.",
    cancel: "Я передумал, мафия подождёт",
    step1Continue: "Я осознаю масштаб драмы",
    step2Title: "Протокол «Никогда не было»",
    step2Body: "Будут удалены профиль и, если он привязан, Auth-аккаунт; KYC-записи и файлы, фото, заявки, паспортные штампы, очки и леджер, достижения, история активности, связанные записи и привязка Telegram. Диалог регистрации и сохранённый язык бота тоже уйдут в цифровую мафию.",
    bulletKyc: "KYC и файлы из приватных хранилищ - удалены.",
    bulletTelegram: "Состояние Telegram и языковые предпочтения - забыты.",
    bulletAuth: "Если был связан Auth-аккаунт, его email освободится после удаления.",
    restoreWarning: "Восстановление из интерфейса невозможно. «Я случайно» не считается юридическим аргументом даже у капо.",
    back: "Назад",
    step2Continue: "Передать дело в чёрный архив",
    step3Title: "Последний тест на трезвость",
    step3Body: "Введите фразу вручную. Это капча уровня «я не нажимаю красные кнопки после третьего эспрессо».",
    phraseLabel: "Кодовая фраза",
    phrasePlaceholder: "Напечатайте фразу полностью",
    pending: "Выполняется протокол…",
    finalButton: "ЛИКВИДИРОВАТЬ НАВСЕГДА",
    footer: "Не обновляйте страницу, пока команда выполняется. После завершения система вернёт вас в Полную базу.",
    errorInvalid: "Фраза подтверждения не совпала. Даже у ликвидации есть пароль от сейфа.",
    errorUnauthenticated: "Сессия овнера не найдена. Сначала войдите в клуб.",
    errorForbidden: "Протокол отклонён: удаление доступно только активной роли owner.",
    errorNotFound: "Профиль уже исчез или его ID больше не существует.",
    errorNotResident: "Этот протокол предназначен только для профилей резидентов.",
    errorServer: "Операция прервалась на сервере. Очистка могла начаться частично - проверьте серверный лог перед повтором.",
  },
  en: {
    protocolLabel: "Restricted protocol · Owner only",
    modalEyebrow: "VOYAGE · Black Protocol",
    dangerTitle: "Danger Zone",
    dangerBodyBefore: "Permanently erase the profile of",
    dangerBodyAfter: "from VOYAGE. This is not a deactivation or a vacation - there is no “undo” button.",
    deleteButton: "Erase profile",
    modalTitle: "Protocol “Quiet Exit”",
    subjectLabel: "Subject",
    close: "Close confirmation",
    stepAria: "Step {step} of 3",
    confirmationLevel: "Confirmation level {step}/3",
    step1Title: "Boss, this is not the “change my mind” button.",
    step1BodyBefore: "You're about to erase",
    step1BodyAfter: "from VOYAGE's club reality. This won't boost your charisma or influence score - it may only summon your conscience at 3 a.m. asking,",
    step1Conscience: "“Don, where's the backup?”",
    step1MafiaNote: "Even the Mafia checks whether she's the boss's niece first. Somehow, our paperwork is stricter.",
    cancel: "I've changed my mind; the Mafia can wait",
    step1Continue: "I understand the drama",
    step2Title: "Protocol “Never Existed”",
    step2Body: "The profile and, if linked, its Auth account will be deleted, along with KYC records and files, photos, applications, passport stamps, points and ledger entries, achievements, activity history, related records, and the Telegram link. The bot's registration conversation and saved language will vanish into the digital underworld too.",
    bulletKyc: "KYC records and files in private storage - deleted.",
    bulletTelegram: "Telegram state and language preferences - forgotten.",
    bulletAuth: "If an Auth account is linked, its email is released after deletion.",
    restoreWarning: "Restoring through this interface is impossible. “It was an accident” is not a legal defense, not even for a capo.",
    back: "Back",
    step2Continue: "Send the case to the black archive",
    step3Title: "Final sobriety test",
    step3Body: "Type the phrase manually. This CAPTCHA assumes you're not pressing red buttons after your third espresso.",
    phraseLabel: "Passphrase",
    phrasePlaceholder: "Type the entire phrase",
    pending: "Executing protocol…",
    finalButton: "ERASE FOREVER",
    footer: "Do not refresh while the operation is running. When it finishes, the system will return you to the Full Database.",
    errorInvalid: "The confirmation phrase doesn't match. Even an execution protocol needs a safe code.",
    errorUnauthenticated: "No owner session found. Sign in to the club first.",
    errorForbidden: "Protocol rejected: deletion is restricted to an active owner role.",
    errorNotFound: "The profile has already vanished, or its ID no longer exists.",
    errorNotResident: "This protocol is only for resident profiles.",
    errorServer: "The server interrupted the operation. Cleanup may be partial - check the server log before retrying.",
  },
  es: {
    protocolLabel: "Protocolo restringido · Solo owner",
    modalEyebrow: "VOYAGE · Protocolo negro",
    dangerTitle: "Zona de peligro",
    dangerBodyBefore: "Eliminar definitivamente el perfil de",
    dangerBodyAfter: "del sistema VOYAGE. No es una desactivación ni unas vacaciones: no hay botón para deshacerlo.",
    deleteButton: "Eliminar perfil",
    modalTitle: "Protocolo «Salida silenciosa»",
    subjectLabel: "Objetivo",
    close: "Cerrar confirmación",
    stepAria: "Paso {step} de 3",
    confirmationLevel: "Nivel de confirmación {step}/3",
    step1Title: "Owner, esto no es el botón de «me lo pienso mejor».",
    step1BodyBefore: "Estás a punto de borrar a",
    step1BodyAfter: "de la realidad del club VOYAGE. No ganarás carisma ni puntos de influencia; quizá solo escuches a tu conciencia a las tres de la mañana preguntando:",
    step1Conscience: "«Don, ¿dónde está la copia de seguridad?»",
    step1MafiaNote: "Hasta la Mafia comprueba primero si es la sobrina del jefe. Nuestra burocracia es todavía más estricta.",
    cancel: "Me lo he pensado mejor; que espere la Mafia",
    step1Continue: "Entiendo la magnitud del drama",
    step2Title: "Protocolo «Nunca existió»",
    step2Body: "Se eliminarán el perfil y, si está vinculado, la cuenta de Auth; los registros y archivos KYC, fotos, solicitudes, sellos del pasaporte, puntos y movimientos del ledger, logros, historial de actividad, registros relacionados y la vinculación de Telegram. La conversación de registro del bot y el idioma guardado también desaparecerán en el submundo digital.",
    bulletKyc: "Registros KYC y archivos del almacenamiento privado: eliminados.",
    bulletTelegram: "Estado de Telegram y preferencias de idioma: olvidados.",
    bulletAuth: "Si hay una cuenta Auth vinculada, su correo quedará libre tras la eliminación.",
    restoreWarning: "No es posible restaurarlo desde la interfaz. «Ha sido sin querer» no es una defensa legal, ni siquiera para un capo.",
    back: "Atrás",
    step2Continue: "Enviar el expediente al archivo negro",
    step3Title: "Última prueba de sobriedad",
    step3Body: "Escribe la frase manualmente. Este CAPTCHA supone que no estás pulsando botones rojos después del tercer espresso.",
    phraseLabel: "Frase de confirmación",
    phrasePlaceholder: "Escribe la frase completa",
    pending: "Ejecutando el protocolo…",
    finalButton: "ELIMINAR PARA SIEMPRE",
    footer: "No recargues la página mientras se ejecuta la operación. Al terminar, el sistema te devolverá a la base de datos completa.",
    errorInvalid: "La frase de confirmación no coincide. Hasta una ejecución necesita la clave de la caja fuerte.",
    errorUnauthenticated: "No se encontró una sesión de owner. Primero, inicia sesión en el club.",
    errorForbidden: "Protocolo rechazado: solo un owner activo puede eliminar perfiles.",
    errorNotFound: "El perfil ya ha desaparecido o su ID ya no existe.",
    errorNotResident: "Este protocolo solo sirve para perfiles de residentes.",
    errorServer: "El servidor interrumpió la operación. La limpieza podría ser parcial; revisa el registro del servidor antes de volver a intentarlo.",
  },
  pt: {
    protocolLabel: "Protocolo restrito · Apenas owner",
    modalEyebrow: "VOYAGE · Protocolo negro",
    dangerTitle: "Zona de perigo",
    dangerBodyBefore: "Excluir permanentemente o perfil de",
    dangerBodyAfter: "do sistema VOYAGE. Não é uma desativação nem férias - não existe botão para desfazer.",
    deleteButton: "Excluir perfil",
    modalTitle: "Protocolo «Saída silenciosa»",
    subjectLabel: "Alvo",
    close: "Fechar confirmação",
    stepAria: "Etapa {step} de 3",
    confirmationLevel: "Nível de confirmação {step}/3",
    step1Title: "Owner, este não é o botão «deixa pra lá».",
    step1BodyBefore: "Você está prestes a apagar",
    step1BodyAfter: "da realidade do clube VOYAGE. Isso não aumenta seu carisma nem seus pontos de influência - só pode fazer sua consciência aparecer às três da manhã perguntando:",
    step1Conscience: "«Don, cadê o backup?»",
    step1MafiaNote: "Até a Máfia confirma primeiro se ela é sobrinha do chefe. Nossa burocracia consegue ser ainda mais rigorosa.",
    cancel: "Mudei de ideia; a Máfia pode esperar",
    step1Continue: "Entendi o tamanho do drama",
    step2Title: "Protocolo «Nunca existiu»",
    step2Body: "O perfil e, se estiver vinculada, a conta Auth serão excluídos, junto com registros e arquivos KYC, fotos, solicitações, carimbos do passaporte, pontos e lançamentos do ledger, conquistas, histórico de atividades, registros relacionados e o vínculo com o Telegram. A conversa de cadastro do bot e o idioma salvo também desaparecerão no submundo digital.",
    bulletKyc: "Registros KYC e arquivos do armazenamento privado - excluídos.",
    bulletTelegram: "Estado do Telegram e preferências de idioma - esquecidos.",
    bulletAuth: "Se houver uma conta Auth vinculada, o e-mail será liberado após a exclusão.",
    restoreWarning: "Não é possível restaurar pela interface. «Foi sem querer» não é defesa jurídica, nem mesmo para um capo.",
    back: "Voltar",
    step2Continue: "Enviar o caso para o arquivo negro",
    step3Title: "Último teste de sobriedade",
    step3Body: "Digite a frase manualmente. Este CAPTCHA presume que você não aperta botões vermelhos depois do terceiro espresso.",
    phraseLabel: "Frase de confirmação",
    phrasePlaceholder: "Digite a frase completa",
    pending: "Executando o protocolo…",
    finalButton: "EXCLUIR PARA SEMPRE",
    footer: "Não atualize a página enquanto a operação estiver em andamento. Ao terminar, o sistema levará você de volta à base de dados completa.",
    errorInvalid: "A frase de confirmação não confere. Até uma execução exige a senha do cofre.",
    errorUnauthenticated: "Nenhuma sessão de owner encontrada. Entre no clube primeiro.",
    errorForbidden: "Protocolo rejeitado: a exclusão é permitida somente para um owner ativo.",
    errorNotFound: "O perfil já desapareceu ou seu ID não existe mais.",
    errorNotResident: "Este protocolo é exclusivo para perfis de residentes.",
    errorServer: "O servidor interrompeu a operação. A limpeza pode ter sido parcial - verifique o log do servidor antes de tentar novamente.",
  },
};
