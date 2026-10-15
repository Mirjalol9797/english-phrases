import { describe, expect, it } from 'vitest'
import type { Phrase } from '@/types/content'
import type {
  AssembleStep,
  ChoiceStep,
  ExerciseKind,
  ListenStep,
  PracticeStep,
  TypingStep,
} from '@/types/practice'
import { EXERCISE_ORDER, buildPractice, buildRepeat, buildReview, shuffle } from './practice'
import { normalizeAnswer } from './answer'

/**
 * Урок с теми же ловушками, что и в настоящих данных:
 * Hi! и Hey! переводятся одинаково, а get up — однословная для сборки фраза.
 */
const lesson: Phrase[] = [
  { id: 'EE001', en: 'Hi!', ru: 'Привет!' },
  { id: 'EE003', en: 'Hey!', ru: 'Привет!' },
  { id: 'EE004', en: 'Good morning!', ru: 'Доброе утро!' },
  { id: 'EE007', en: 'How are you?', ru: 'Как дела?' },
  { id: 'EE010', en: 'It is nice to see you.', ru: 'Рад тебя видеть.' },
]

const otherChapter: Phrase[] = [
  { id: 'UE001', en: 'No way!', ru: 'Ни за что!' },
  { id: 'UE002', en: 'Fair enough.', ru: 'Справедливо.' },
  { id: 'UE003', en: 'Good point.', ru: 'Хорошая мысль.' },
  { id: 'UE004', en: 'What a relief!', ru: 'Какое облегчение!' },
]

const pools = { near: lesson, far: [...lesson, ...otherChapter] }
const withSound = { ...pools, listening: true }

const isChoice = (step: PracticeStep): step is ChoiceStep =>
  step.kind === 'choice-ru' || step.kind === 'choice-en'

/** Упражнения со случайным порядком проверяем на многих прогонах, а не на одном. */
function times(count: number, run: (attempt: number) => void) {
  for (let i = 0; i < count; i++) run(i)
}

describe('shuffle', () => {
  it('сохраняет состав и не трогает исходный массив', () => {
    const source = [1, 2, 3, 4, 5]
    const mixed = shuffle(source)
    expect([...mixed].sort()).toEqual([...source].sort())
    expect(source).toEqual([1, 2, 3, 4, 5])
  })
})

describe('buildPractice', () => {
  it('начинает карточками по всем фразам урока', () => {
    const steps = buildPractice(lesson, { ...pools, withCards: true })
    const cards = steps.filter((s) => s.kind === 'card')
    expect(cards).toHaveLength(lesson.length)
    expect(steps.slice(0, lesson.length).every((s) => s.kind === 'card')).toBe(true)
    expect(cards.map((s) => s.phrase.id).sort()).toEqual(lesson.map((p) => p.id).sort())
  })

  it('для повтора карточки не нужны', () => {
    const steps = buildPractice(lesson, { ...pools, withCards: false })
    expect(steps.some((s) => s.kind === 'card')).toBe(false)
  })

  it('держит этапы строго по порядку', () => {
    times(20, () => {
      const kinds = buildPractice(lesson, { ...pools, withCards: false }).map((s) => s.kind)
      const firstSeen = EXERCISE_ORDER.filter((kind) => kinds.includes(kind)).map((kind) =>
        kinds.indexOf(kind),
      )
      expect(firstSeen).toEqual([...firstSeen].sort((a, b) => a - b))
      // Внутри этапа не должно быть чужих упражнений.
      const grouped = kinds.filter((kind, i) => i === 0 || kinds[i - 1] !== kind)
      expect(grouped).toEqual([...new Set(kinds)])
    })
  })

  it('проводит каждую фразу через все доступные ей этапы', () => {
    const steps = buildPractice(lesson, { ...pools, withCards: false })
    for (const phrase of lesson) {
      const kinds = steps.filter((s) => s.phrase.id === phrase.id).map((s) => s.kind)
      const expected: ExerciseKind[] =
        phrase.en.split(' ').length >= 2
          ? ['choice-ru', 'choice-en', 'assemble', 'typing']
          : ['choice-ru', 'choice-en', 'typing']
      // Без звука заданий на слух быть не должно.
      expect(kinds.sort()).toEqual([...expected].sort())
    }
  })

  it('не отправляет однословную фразу на сборку: её не из чего собрать', () => {
    const steps = buildPractice(lesson, { ...pools, withCards: false })
    const assembled = steps.filter((s) => s.kind === 'assemble').map((s) => s.phrase.en)
    expect(assembled).not.toContain('Hi!')
    expect(assembled).not.toContain('Hey!')
    expect(assembled).toContain('Good morning!')
  })
})

describe('упражнение с выбором', () => {
  it('показывает ровно один верный вариант', () => {
    times(50, () => {
      const steps = buildPractice(lesson, { ...pools, withCards: false }).filter(isChoice)
      for (const step of steps) {
        const correct = step.options.filter((o) => normalizeAnswer(o) === normalizeAnswer(step.answer))
        expect(correct).toHaveLength(1)
      }
    })
  })

  it('не предлагает как неверный вариант фразу с тем же вопросом', () => {
    // Hi! и Hey! оба переводятся «Привет!»: Hey! в вариантах к «Привет!» тоже верен.
    times(50, () => {
      const steps = buildPractice(lesson, { ...pools, withCards: false })
        .filter(isChoice)
        .filter((s) => s.kind === 'choice-en')
      for (const step of steps) {
        const sameQuestion = lesson
          .filter((p) => normalizeAnswer(p.ru) === normalizeAnswer(step.phrase.ru))
          .map((p) => normalizeAnswer(p.en))
        const acceptable = step.options.filter((o) => sameQuestion.includes(normalizeAnswer(o)))
        expect(acceptable).toHaveLength(1)
      }
    })
  })

  it('не повторяет варианты и включает правильный', () => {
    times(30, () => {
      for (const step of buildPractice(lesson, { ...pools, withCards: false }).filter(isChoice)) {
        expect(new Set(step.options.map(normalizeAnswer)).size).toBe(step.options.length)
        expect(step.options).toContain(step.answer)
        expect(step.options.length).toBeGreaterThan(1)
        expect(step.options.length).toBeLessThanOrEqual(4)
      }
    })
  })

  it('добирает варианты из главы, когда в уроке их не хватает', () => {
    const tiny = [lesson[0]!, lesson[2]!]
    times(20, () => {
      const steps = buildPractice(tiny, { near: tiny, far: pools.far, withCards: false }).filter(isChoice)
      expect(steps.every((s) => s.options.length === 4)).toBe(true)
    })
  })
})

describe('сборка из слов', () => {
  it('даёт ровно слова фразы и не в исходном порядке', () => {
    times(50, () => {
      const steps = buildPractice(lesson, { ...pools, withCards: false }).filter(
        (s): s is AssembleStep => s.kind === 'assemble',
      )
      expect(steps.length).toBeGreaterThan(0)
      for (const step of steps) {
        const original = step.phrase.en.split(' ')
        expect([...step.words].sort()).toEqual([...original].sort())
        expect(step.words.join(' ')).not.toBe(original.join(' '))
      }
    })
  })
})

describe('набор с клавиатуры', () => {
  it('принимает любую фразу урока с тем же переводом', () => {
    const steps = buildPractice(lesson, { ...pools, withCards: false }).filter(
      (s): s is TypingStep => s.kind === 'typing',
    )
    const forHi = steps.find((s) => s.phrase.id === 'EE001')!
    // По вопросу «Привет!» нельзя угадать, ждут Hi! или Hey!.
    expect([...forHi.accept].sort()).toEqual(['Hey!', 'Hi!'])

    const forMorning = steps.find((s) => s.phrase.id === 'EE004')!
    expect(forMorning.accept).toEqual(['Good morning!'])
  })
})

describe('buildRepeat', () => {
  it('переспрашивает ровно те упражнения, где была ошибка', () => {
    const mistakes = [
      { phrase: lesson[0]!, kind: 'typing' as const },
      { phrase: lesson[3]!, kind: 'choice-ru' as const },
    ]
    const steps = buildRepeat(mistakes, pools)
    expect(steps).toHaveLength(2)
    expect(steps.map((s) => `${s.phrase.id}:${s.kind}`).sort()).toEqual(['EE001:typing', 'EE007:choice-ru'])
  })

  it('держит порядок этапов и не повторяет одну пару дважды', () => {
    const mistakes = [
      { phrase: lesson[3]!, kind: 'typing' as const },
      { phrase: lesson[3]!, kind: 'choice-ru' as const },
      { phrase: lesson[3]!, kind: 'typing' as const },
    ]
    const steps = buildRepeat(mistakes, pools)
    expect(steps.map((s) => s.kind)).toEqual(['choice-ru', 'typing'])
  })

  it('пропускает сборку для однословной фразы', () => {
    const steps = buildRepeat([{ phrase: lesson[0]!, kind: 'assemble' }], pools)
    expect(steps).toHaveLength(0)
  })
})

describe('buildReview', () => {
  it('усложняет способ проверки по мере роста коробки', () => {
    const phrase = lesson[4]! // многословная, годится для сборки
    const kindFor = (box: number) => buildReview([phrase], () => box, pools)[0]!.kind
    expect(kindFor(1)).toBe('choice-ru')
    expect(kindFor(2)).toBe('choice-ru')
    expect(kindFor(3)).toBe('choice-en')
    expect(kindFor(4)).toBe('assemble')
    expect(kindFor(5)).toBe('typing')
  })

  it('даёт по одному упражнению на фразу', () => {
    const steps = buildReview(lesson, () => 3, pools)
    expect(steps).toHaveLength(lesson.length)
    expect(steps.map((s) => s.phrase.id).sort()).toEqual(lesson.map((p) => p.id).sort())
  })

  it('подменяет сборку выбором, если фраза из одного слова', () => {
    const steps = buildReview([lesson[0]!], () => 4, pools)
    expect(steps[0]!.kind).toBe('choice-en')
  })
})

describe('задания на слух', () => {
  it('без звука их нет вовсе', () => {
    const kinds = buildPractice(lesson, { ...pools, withCards: false }).map((s) => s.kind)
    expect(kinds).not.toContain('listen')
  })

  it('со звуком каждая фраза проходит и этот этап', () => {
    const steps = buildPractice(lesson, { ...withSound, withCards: false })
    const listening = steps.filter((s) => s.kind === 'listen')
    expect(listening).toHaveLength(lesson.length)
    expect(listening.map((s) => s.phrase.id).sort()).toEqual(lesson.map((p) => p.id).sort())
  })

  it('идёт вторым этапом, сразу после выбора перевода', () => {
    const kinds = buildPractice(lesson, { ...withSound, withCards: false }).map((s) => s.kind)
    expect(kinds.indexOf('listen')).toBeGreaterThan(kinds.lastIndexOf('choice-ru'))
    expect(kinds.lastIndexOf('listen')).toBeLessThan(kinds.indexOf('choice-en'))
  })

  it('спрашивает перевод и показывает ровно один верный вариант', () => {
    times(30, () => {
      const steps = buildPractice(lesson, { ...withSound, withCards: false })
      for (const step of steps.filter((s): s is ListenStep => s.kind === 'listen')) {
        expect(step.answer).toBe(step.phrase.ru)
        const correct = step.options.filter((o) => normalizeAnswer(o) === normalizeAnswer(step.answer))
        expect(correct).toHaveLength(1)
      }
    })
  })

  it('в повторении достаётся второй коробке', () => {
    const phrase = lesson[4]!
    const kindFor = (box: number, listening: boolean) =>
      buildReview([phrase], () => box, { ...pools, listening })[0]!.kind
    expect(kindFor(2, true)).toBe('listen')
    // Без звука вместо него обычный выбор перевода.
    expect(kindFor(2, false)).toBe('choice-ru')
  })

  it('в повторе ошибок без звука не переспрашивается', () => {
    const mistakes = [{ phrase: lesson[0]!, kind: 'listen' as const }]
    expect(buildRepeat(mistakes, pools)).toHaveLength(0)
    expect(buildRepeat(mistakes, { ...pools, listening: true })).toHaveLength(1)
  })
})
