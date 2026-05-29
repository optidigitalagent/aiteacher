import type { LearningObject } from './types.js';

export const ANIMALS: LearningObject[] = [
  {
    id: 'SMS-U4-N001',
    word: 'cat',
    topic: 'Animals',
    forms: ['a cat', 'the cat', 'cats'],
    soundCueId: 'sfx_meow',
    visualCueId: 'img_cat_001',
    tprGesture: 'mime_stroking_cat',
    difficulty: 1,
    semanticCluster: ['SMS-U4-N002', 'SMS-U4-N003', 'SMS-U4-N004', 'SMS-U4-N005'],
    l1Translations: { uk: 'кіт', ru: 'кот' },
    rescueLadderScripts: {
      level1: "It's a BIG cat! Look — CAT!",
      level2: 'Look! Cat! What is it?',
      level3: 'Meow! A cat! CAT! What animal?',
    },
  },
  {
    id: 'SMS-U4-N002',
    word: 'dog',
    topic: 'Animals',
    forms: ['a dog', 'the dog', 'dogs'],
    soundCueId: 'sfx_woof',
    visualCueId: 'img_dog_001',
    tprGesture: 'mime_petting_dog',
    difficulty: 1,
    semanticCluster: ['SMS-U4-N001', 'SMS-U4-N003', 'SMS-U4-N004', 'SMS-U4-N005'],
    l1Translations: { uk: 'собака', ru: 'собака' },
    rescueLadderScripts: {
      level1: "It's a big dog! Look — DOG!",
      level2: 'Look! Dog! What is it?',
      level3: 'Woof woof! A dog! DOG! What animal?',
    },
  },
  {
    id: 'SMS-U4-N003',
    word: 'elephant',
    topic: 'Animals',
    forms: ['an elephant', 'the elephant', 'elephants'],
    soundCueId: 'sfx_trumpet',
    visualCueId: 'img_elephant_001',
    tprGesture: 'mime_elephant_trunk',
    difficulty: 3,
    semanticCluster: ['SMS-U4-N001', 'SMS-U4-N002', 'SMS-U4-N004', 'SMS-U4-N005'],
    l1Translations: { uk: 'слон', ru: 'слон' },
    rescueLadderScripts: {
      level1: "It's a huge elephant! Look — ELEPHANT!",
      level2: 'Look! Elephant! What is it?',
      level3: 'Paaarp! Big trunk! ELEPHANT! What animal?',
    },
  },
  {
    id: 'SMS-U4-N004',
    word: 'tiger',
    topic: 'Animals',
    forms: ['a tiger', 'the tiger', 'tigers'],
    soundCueId: 'sfx_roar',
    visualCueId: 'img_tiger_001',
    tprGesture: 'mime_tiger_claws',
    difficulty: 2,
    semanticCluster: ['SMS-U4-N001', 'SMS-U4-N002', 'SMS-U4-N003', 'SMS-U4-N006'],
    l1Translations: { uk: 'тигр', ru: 'тигр' },
    rescueLadderScripts: {
      level1: "It's a stripy tiger! Look — TIGER!",
      level2: 'Look! Tiger! What is it?',
      level3: 'ROAAAR! Stripes! TIGER! What animal?',
    },
  },
  {
    id: 'SMS-U4-N005',
    word: 'monkey',
    topic: 'Animals',
    forms: ['a monkey', 'the monkey', 'monkeys'],
    soundCueId: 'sfx_monkey',
    visualCueId: 'img_monkey_001',
    tprGesture: 'mime_monkey_swing',
    difficulty: 2,
    semanticCluster: ['SMS-U4-N001', 'SMS-U4-N002', 'SMS-U4-N003', 'SMS-U4-N006'],
    l1Translations: { uk: 'мавпа', ru: 'обезьяна' },
    rescueLadderScripts: {
      level1: "It's a funny monkey! Look — MONKEY!",
      level2: 'Look! Monkey! What is it?',
      level3: 'Ooh ooh aah! MONKEY! What animal?',
    },
  },
  {
    id: 'SMS-U4-N006',
    word: 'lion',
    topic: 'Animals',
    forms: ['a lion', 'the lion', 'lions'],
    soundCueId: 'sfx_roar',
    visualCueId: 'img_lion_001',
    tprGesture: 'mime_lion_shake_mane',
    difficulty: 2,
    semanticCluster: ['SMS-U4-N001', 'SMS-U4-N002', 'SMS-U4-N004', 'SMS-U4-N005'],
    l1Translations: { uk: 'лев', ru: 'лев' },
    rescueLadderScripts: {
      level1: "It's a big lion! Look — LION!",
      level2: 'Look! Lion! What is it?',
      level3: 'ROAAAR! Big mane! LION! What animal?',
    },
  },
];

export const ANIMALS_BY_ID = new Map(ANIMALS.map(a => [a.id, a]));

export function getDistractor(itemId: string): LearningObject {
  const others = ANIMALS.filter(a => a.id !== itemId);
  return others[Math.floor(Math.random() * others.length)];
}

export function getFirstPhoneme(word: string): string {
  const phonemes: Record<string, string> = {
    cat: 'c-c-c',
    dog: 'd-d-d',
    elephant: 'e-e-e',
    tiger: 't-t-t',
    monkey: 'm-m-m',
    lion: 'l-l-l',
  };
  return phonemes[word] ?? word[0];
}
