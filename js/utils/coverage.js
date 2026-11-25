// coverage.js — week coverage logic, no DOM

import { CATEGORY_LABELS, ACTIVITIES } from '../data.js';

// Returns Set of category keys covered across the given array of day objects
export function getWeekCoverage(weekDays) {
  const covered = new Set();
  for (const day of weekDays) {
    for (const a of (day.activities || [])) {
      for (const c of (a.categories || [])) {
        covered.add(c);
      }
    }
  }
  return covered;
}

// Returns array of {key, label} for categories not in the covered Set
export function getMissingCategories(covered) {
  return Object.entries(CATEGORY_LABELS)
    .filter(([key]) => !covered.has(key))
    .map(([key, label]) => ({ key, label }));
}

// Returns up to 3 activity names that include the given category
export function getSuggestionsForCategory(catKey) {
  return ACTIVITIES
    .filter(a => a.categories.includes(catKey))
    .slice(0, 3)
    .map(a => a.name);
}

// Returns count of activities in a category across the given day objects
export function countForCategory(weekDays, catKey) {
  let n = 0;
  for (const day of weekDays) {
    for (const a of (day.activities || [])) {
      if ((a.categories || []).includes(catKey)) n++;
    }
  }
  return n;
}

// Short display labels for rings (space is tight at 38px)
export const CAT_SHORT = {
  gross:   'Gross',
  fine:    'Fine',
  cog:     'Cognitive',
  exec:    'Executive',
  comm:    'Comm.',
  social:  'Social',
  emo:     'Emotional',
  sensory: 'Sensory',
  acad:    'Academic',
  create:  'Creative',
  life:    'Life Skills',
};
