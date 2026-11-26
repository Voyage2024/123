// Заглушка grammy: «отправка» в Telegram записывается в globalThis.__telegram.
export class Api {
  constructor(token) { this.token = token; }
  async sendMessage(chatId, text) { globalThis.__telegram = [...(globalThis.__telegram ?? []), { chatId, body: text }]; return { message_id: 1 }; }
}
export class InlineKeyboard { url() { return this; } text() { return this; } row() { return this; } }
