import type { Noun } from './core'

/**
 * Узбекский не согласует существительное с числом: после числительного
 * слово стоит в единственном. Поэтому форма одна, а не три.
 */
export const UZ_NOUNS: Record<Noun, string> = {
  phrase: 'ibora',
  phraseAcc: 'ibora',
  expression: 'ibora',
  word: 'soʻz',
  verb: 'feʼl',
  entry: 'yozuv',
  lesson: 'dars',
  stage: 'bosqich',
  match: 'moslik',
  day: 'kun',
  answer: 'javob',
}

/**
 * Перевод интерфейса. Ключ — русская строка из шаблона, значение — узбекская.
 *
 * Заполняется по экранам; пока пусто — приложение работает по-русски,
 * а при выборе узбекского непереведённое остаётся русским.
 */
export const UZ_TEXT: Record<string, string> = {
  // Разделы
  'Главная': 'Bosh sahifa',
  'Главы': 'Boblar',
  'Повторение': 'Takrorlash',
  'Словарь': 'Lugʻat',
  'Настройки': 'Sozlamalar',
  'Статистика': 'Statistika',

  // 2.1 — переключатель языка
  'Язык': 'Til',
  'Язык интерфейса': 'Interfeys tili',
  'Переводы, которых ещё нет, остаются на русском.': 'Hali tarjima qilinmagani ruscha qoladi.',

  // 2.2 — шапка и общие части
  'Основная навигация': 'Asosiy menyu',
  'Загружаем фразы…': 'Iboralar yuklanmoqda…',
  'Возможно, ссылка устарела или глава ещё не добавлена.':
    'Havola eskirgan yoki bob hali qoʻshilmagan boʻlishi mumkin.',
  'Открыть список глав': 'Boblar roʻyxatini ochish',
  'Данные не загрузились': 'Maʼlumotlar yuklanmadi',
  'Проверьте, что в папке public/data есть файлы глав (их создаёт команда':
    'public/data papkasida bob fayllari borligini tekshiring (ularni quyidagi buyruq yaratadi:',
  ', и попробуйте ещё раз.': '), soʻng qayta urinib koʻring.',
  'Загрузить снова': 'Qayta yuklash',
  'Вышла новая версия.': 'Yangi versiya chiqdi.',
  'Обновить': 'Yangilash',
  'Приложение готово работать без интернета.': 'Ilova internetsiz ishlashga tayyor.',
  'Позже': 'Keyinroq',
  'Понятно': 'Tushunarli',
  'Страница не найдена': 'Sahifa topilmadi',
  'Такой страницы нет': 'Bunday sahifa yoʻq',
  'Проверьте адрес или вернитесь на главную.': 'Manzilni tekshiring yoki bosh sahifaga qayting.',
  'На главную': 'Bosh sahifaga',
  'Экран появится на этапе': 'Bu ekran keyingi bosqichda paydo boʻladi:',
  'Перейти к главам': 'Boblarga oʻtish',
  'Включить тёмную тему': 'Tungi mavzuni yoqish',
  'Включить светлую тему': 'Kunduzgi mavzuni yoqish',

  // 2.3 — главная
  'Серия': 'Ketma-ketlik',
  // Порядок слов в узбекском другой, поэтому числа подставляются внутрь строки.
  'Выучено {done} из {total}': '{total} tadan {done} tasi oʻrganildi',
  'Новых сегодня {done} из {total}': 'Bugungi yangilar: {done} / {total}',
  'Повторить': 'Takrorlash',
  'Первая фраза урока «{title}»': '«{title}» darsining birinchi iborasi',
  'Открыть урок {n}': '{n}-darsni ochish',
  'Глав пока нет': 'Hozircha boblar yoʻq',
  'Положите Word-файлы с фразами в папку content/source и выполните':
    'Iboralar yozilgan Word fayllarini content/source papkasiga qoʻying va quyidagini bajaring:',
  'Добавлено {done} из {total}': '{total} tadan {done} tasi qoʻshilgan',

  // 2.4 — главы и глава
  'Все главы': 'Barcha boblar',
  '{count} фраз и выражений': '{count} ta ibora va soʻz birikmasi',
  'Добавлено {done} из {total}, всего {count}.': '{total} tadan {done} tasi qoʻshilgan, jami {count}.',
  'Каждая глава разбита на уроки, в уроке от пяти до двадцати записей.':
    'Har bir bob darslarga boʻlingan, bir darsda besh tadan yigirma tagacha yozuv bor.',
  'начато {started}, выучено {learned}': 'boshlangan {started}, oʻrganilgan {learned}',
  'Пока не добавлена': 'Hali qoʻshilmagan',
  'Урок выучен': 'Dars oʻrganildi',
  'Пройдено {done} из {total}': '{total} tadan {done} tasi bajarildi',

  // 2.5 — урок
  'Урок {n} из {total}': '{total} tadan {n}-dars',
  'Часть {n} из {total}': '{total} qismdan {n}-qismi',
  'Часть {n}': '{n}-qism',
  'Начать урок': 'Darsni boshlash',
  'карточки и {stages}.': 'kartochkalar va {stages}.',
  'На сегодня новых фраз хватит — взяли {done} из {total}. Так материал успевает улечься.':
    'Bugunga yangi iboralar yetarli: {total} tadan {done} tasi olindi. Shunda material joylashib ulguradi.',
  'Повторить пройденное': 'Oʻtilganni takrorlash',
  'или изменить предел в': 'yoki chegarani oʻzgartirish —',
  'настройках': 'sozlamalarda',
  'Новых сегодня: {done} из {total}.': 'Bugungi yangilar: {done} / {total}.',
  'Соседние уроки': 'Qoʻshni darslar',
  'Предыдущий урок': 'Oldingi dars',
  'Следующий урок': 'Keyingi dars',
}
