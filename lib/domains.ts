export interface DomainPreset {
  id: 'math' | 'planning' | 'coding';
  label: string;
  emoji: string;
  question: string;
}

export const DOMAINS: DomainPreset[] = [
  {
    id: 'math',
    label: 'Math',
    emoji: '🧮',
    question:
      'Given vectors a = (2, -1, 3) and b = (1, 4, -2), compute the cross product a × b, then find the angle between a × b and a. Express the angle in degrees.',
  },
  {
    id: 'planning',
    label: 'Planning',
    emoji: '🗺️',
    question:
      "I'm visiting Corvallis, Oregon for 24 hours starting Saturday morning. Budget: $150 total. Must include: one outdoor activity, one local food experience, one quiet/reflective spot. Driving distance: stay within 30 miles. Suggest a concrete itinerary with times and approximate costs.",
  },
  {
    id: 'coding',
    label: 'Coding',
    emoji: '🐛',
    question: `Here's a Python function:

def find_duplicates(items):
    seen = []
    duplicates = []
    for item in items:
        if item in seen:
            duplicates.append(item)
        seen.append(item)
    return duplicates

Calling find_duplicates([1, 2, 2, 3, 4, 4, 4]) returns [2, 4, 4]. The intent was to return each duplicated value exactly once, e.g. [2, 4]. Explain why the bug happens and provide a fixed version.`,
  },
];
