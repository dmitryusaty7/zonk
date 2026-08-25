/**
 * tg-setup.mjs — ПРИПИСКА БОТА К БУХТЕ
 * ------------------------------------------------------------------
 * Настраивает бота под Mini App через Bot API: кнопку меню, описание,
 * короткое описание и список команд. То же самое можно сделать руками
 * в @BotFather, но здесь это одна команда и без промахов.
 *
 * Запуск:
 *   node tools/tg-setup.mjs <https-адрес-приложения>
 *
 * Токен берётся из переменной окружения (в код он не попадает никогда):
 *   Windows PowerShell:  $env:BOT_TOKEN = "123:ABC"
 *   Git Bash:            export BOT_TOKEN=123:ABC
 *
 * Проверить, что вышло, ничего не меняя:
 *   node tools/tg-setup.mjs --check
 */

const TOKEN = process.env.BOT_TOKEN
const arg = process.argv[2]

if (!TOKEN) {
  console.error('Нет BOT_TOKEN в окружении. Токен в файлы не кладём — только в переменную.')
  process.exit(1)
}

const api = async (method, body) => {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method}: ${json.description}`)
  return json.result
}

/** Что показываем в боте. */
const TEXTS = {
  short: 'Счёт для игры в кости ЗОНК. Пиратская Бухта Южных Морей.',
  full:
    'ЗОНК — Золото Южных Морей.\n\n' +
    'Судовой журнал для игры в кости: считает золото, следит за бочкой ' +
    'и помнит, кто сколько раз забирал Главный Сундук.\n\n' +
    'Жми кнопку меню — и за стол.',
  button: 'За стол',
}

async function show() {
  const me = await api('getMe')
  const menu = await api('getChatMenuButton')
  console.log(`бот:            @${me.username} (${me.first_name})`)
  console.log(`кнопка меню:    ${menu.type}${menu.web_app ? ` → ${menu.web_app.url}` : ''}`)
  if (menu.text) console.log(`подпись:        ${menu.text}`)
  const short = await api('getMyShortDescription')
  const full = await api('getMyDescription')
  console.log(`краткое:        ${short.short_description || '—'}`)
  console.log(`описание:       ${(full.description || '—').split('\n')[0]}`)
}

async function main() {
  if (!arg || arg === '--check') {
    await show()
    if (!arg) {
      console.log('\nЧтобы настроить: node tools/tg-setup.mjs https://твой-адрес')
    }
    return
  }

  let url
  try {
    url = new URL(arg)
  } catch {
    throw new Error(`Это не адрес: ${arg}`)
  }
  if (url.protocol !== 'https:') {
    throw new Error('Telegram открывает Mini App только по https — http не годится.')
  }

  const me = await api('getMe')
  console.log(`Настраиваю @${me.username} на ${url.href}\n`)

  await api('setChatMenuButton', {
    menu_button: { type: 'web_app', text: TEXTS.button, web_app: { url: url.href } },
  })
  console.log(`  ✓ кнопка меню → «${TEXTS.button}»`)

  await api('setMyShortDescription', { short_description: TEXTS.short })
  console.log('  ✓ краткое описание')

  await api('setMyDescription', { description: TEXTS.full })
  console.log('  ✓ описание для пустого чата')

  await api('setMyCommands', {
    commands: [{ command: 'start', description: 'Открыть Бухту' }],
  })
  console.log('  ✓ команда /start')

  console.log('\nГотово. Открой @' + me.username + ' в Telegram и жми кнопку меню.')
  console.log('Прямую ссылку вида t.me/бот/имя даёт только /newapp в @BotFather —')
  console.log('через Bot API её не создать.')
}

main().catch((e) => {
  console.error('Не вышло:', e.message)
  process.exit(1)
})
