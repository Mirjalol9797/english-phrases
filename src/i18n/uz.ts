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

  // 2.6 — занятие
  'Знакомство': 'Tanishuv',
  // Счётчик шагов: дословное «10 dan 1» по-узбекски не говорят, дробь понятнее.
  '{n} из {total}': '{n} / {total}',
  'Этап {n} из {total}': '{total} bosqichdan {n}-bosqich',
  'Выбор перевода': 'Tarjimani tanlash',
  'На слух': 'Eshitib tushunish',
  'Выбор фразы': 'Iborani tanlash',
  'Сборка из слов': 'Soʻzlardan yigʻish',
  'Письмо': 'Yozma',
  'Формы глагола': 'Feʼl shakllari',
  'Enter — дальше': 'Enter — keyingisi',
  'Цифры — ответ, пробел — повторить': 'Raqamlar — javob, boʻshliq — qaytarish',
  'Цифры — ответ, Enter — дальше': 'Raqamlar — javob, Enter — keyingisi',
  'Enter — проверить, Backspace — убрать слово': 'Enter — tekshirish, Backspace — soʻzni olib tashlash',
  'Enter — проверить': 'Enter — tekshirish',
  'Выйти из занятия': 'Mashgʻulotdan chiqish',
  'Прогресс занятия': 'Mashgʻulot jarayoni',
  'Выключить автоозвучку': 'Avtomatik ovozni oʻchirish',
  'Включить автоозвучку': 'Avtomatik ovozni yoqish',
  'Завершить': 'Yakunlash',
  'Дальше': 'Keyingisi',
  'Ответьте, чтобы продолжить.': 'Davom etish uchun javob bering.',
  'Напишите по-английски': 'Inglizcha yozing',
  'Английская фраза': 'Inglizcha ibora',
  'Проверить': 'Tekshirish',
  'Вы написали': 'Siz yozdingiz',
  'Правильно': 'Toʻgʻri',
  'Правильно:': 'Toʻgʻri:',
  'Подошло бы и так:': 'Bunday ham toʻgʻri boʻlardi:',
  'В главе записано так:': 'Bobda shunday yozilgan:',
  'Соберите фразу': 'Iborani yigʻing',
  'Нажимайте слова по порядку': 'Soʻzlarni tartib bilan bosing',
  'Напишите вторую и третью формы': 'Ikkinchi va uchinchi shakllarini yozing',
  'Послушайте и выберите перевод': 'Tinglang va tarjimani tanlang',
  'Послушать ещё раз': 'Yana bir marta tinglash',
  'Нажмите, чтобы послушать ещё раз': 'Yana tinglash uchun bosing',
  'Выберите перевод': 'Tarjimani tanlang',
  'Выберите английскую фразу': 'Inglizcha iborani tanlang',
  'Произнести фразу': 'Iborani talaffuz qilish',

  // 2.7 — итоги занятия
  'Урок': 'Dars',
  'Урок: {title}': 'Dars: {title}',
  'Часть {n} из {total} пройдена': '{total} qismdan {n}-qismi bajarildi',
  'Урок пройден': 'Dars bajarildi',
  '{done} из {total}': '{total} dan {done} tasi',
  'Без единой ошибки.': 'Birorta ham xato yoʻq.',
  'Стоит повторить {items}.': '{items} takrorlagan maʼqul.',
  'Следующее повторение — {day}.': 'Keyingi takrorlash — {day}.',
  'Повторить ошибки': 'Xatolarni takrorlash',
  'Следующая часть': 'Keyingi qism',
  'Пройти часть заново': 'Qismni qaytadan oʻtish',
  'Пройти заново': 'Qaytadan oʻtish',
  'К уроку': 'Darsga',
  'К главе': 'Bobga',

  // 2.8 — повторение
  'Здесь появятся фразы, которые пора освежить. Система сама решает когда: чем увереннее отвечаете, тем реже спрашивает — от следующего дня до трёх недель.':
    'Bu yerda yangilash vaqti kelgan iboralar paydo boʻladi. Qachonligini tizim oʻzi hal qiladi: qanchalik ishonchli javob bersangiz, shunchalik kam soʻraydi — ertangi kundan uch haftagacha.',
  'Начать первый урок': 'Birinchi darsni boshlash',
  'Глава для повторения': 'Takrorlash uchun bob',
  'Сегодня повторять нечего.': 'Bugun takrorlaydigan narsa yoʻq.',
  'Учить новое': 'Yangisini oʻrganish',
  'Пора повторить {items}.': '{items} takrorlash vaqti keldi.',
  'За один заход — {n}.': 'Bir martada — {n} ta.',
  'Начать повторение': 'Takrorlashni boshlash',
  'Слева — нынешний перерыв: через столько дней фраза вернётся, если ответить верно.':
    'Chapda — hozirgi tanaffus: toʻgʻri javob bersangiz, ibora shuncha kundan keyin qaytadi.',
  'Трудные': 'Qiyinlari',
  'Глава для трудных': 'Qiyinlari uchun bob',
  'Здесь ошибались чаще всего — {items} в этой главе.':
    'Bu yerda eng koʻp xato qilingan — shu bobda {items}.',
  'Здесь ошибались чаще всего — {items}.': 'Bu yerda eng koʻp xato qilingan — {items}.',
  'Показаны самые трудные {n}, заход тоже из них.':
    'Eng qiyin {n} tasi koʻrsatilgan, mashgʻulot ham shulardan.',
  'Повторить трудные': 'Qiyinlarini takrorlash',
  'Слева — на скольких занятиях из пройденных была ошибка. Запись уходит отсюда после двух верных ответов подряд; новая ошибка возвращает её обратно.':
    'Chapda — oʻtilgan mashgʻulotlarning nechtasida xato boʻlgani. Yozuv ketma-ket ikkita toʻgʻri javobdan soʻng bu yerdan chiqadi; yangi xato uni qaytaradi.',

  // 2.9 — словарь
  'Поиск по фразам': 'Iboralar boʻyicha qidiruv',
  'Фраза на английском или русском': 'Inglizcha yoki ruscha ibora',
  'Очистить поиск': 'Qidiruvni tozalash',
  'Глава': 'Bob',
  'Найдено {items}': '{items} topildi',
  'Ничего не нашлось': 'Hech narsa topilmadi',
  'Попробуйте другое слово или уберите фильтр по главе — поиск идёт и по английскому тексту, и по переводу.':
    'Boshqa soʻzni sinab koʻring yoki bob filtrini olib tashlang — qidiruv ham inglizcha matn, ham tarjima boʻyicha boradi.',
  'Показать ещё {n}': 'Yana {n} tasini koʻrsatish',
}
