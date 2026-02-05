/**
 * Daily inspirational quotes from great thinkers
 * Used to scaffold daily note pages with wisdom
 */

export interface DailyQuote {
  text: string;
  author: string;
  wiki_url: string;
}

const DAILY_QUOTES: DailyQuote[] = [
  {
    text: "The only true wisdom is in knowing you know nothing.",
    author: "Socrates",
    wiki_url: "https://en.wikipedia.org/wiki/Socrates",
  },
  {
    text: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein",
    wiki_url: "https://en.wikipedia.org/wiki/Albert_Einstein",
  },
  {
    text: "The unexamined life is not worth living.",
    author: "Socrates",
    wiki_url: "https://en.wikipedia.org/wiki/Socrates",
  },
  {
    text: "I think, therefore I am.",
    author: "Rene Descartes",
    wiki_url: "https://en.wikipedia.org/wiki/Ren%C3%A9_Descartes",
  },
  {
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    wiki_url: "https://en.wikipedia.org/wiki/Friedrich_Nietzsche",
  },
  {
    text: "The mind is everything. What you think you become.",
    author: "Buddha",
    wiki_url: "https://en.wikipedia.org/wiki/Gautama_Buddha",
  },
  {
    text: "We are what we repeatedly do. Excellence is not an act, but a habit.",
    author: "Aristotle",
    wiki_url: "https://en.wikipedia.org/wiki/Aristotle",
  },
  {
    text: "Life must be understood backward. But it must be lived forward.",
    author: "Soren Kierkegaard",
    wiki_url: "https://en.wikipedia.org/wiki/S%C3%B8ren_Kierkegaard",
  },
  {
    text: "Happiness is not something ready made. It comes from your own actions.",
    author: "Dalai Lama",
    wiki_url: "https://en.wikipedia.org/wiki/14th_Dalai_Lama",
  },
  {
    text: "The only thing we have to fear is fear itself.",
    author: "Franklin D. Roosevelt",
    wiki_url: "https://en.wikipedia.org/wiki/Franklin_D._Roosevelt",
  },
  {
    text: "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.",
    author: "Ralph Waldo Emerson",
    wiki_url: "https://en.wikipedia.org/wiki/Ralph_Waldo_Emerson",
  },
  {
    text: "The journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
    wiki_url: "https://en.wikipedia.org/wiki/Laozi",
  },
  {
    text: "One cannot step twice in the same river.",
    author: "Heraclitus",
    wiki_url: "https://en.wikipedia.org/wiki/Heraclitus",
  },
  {
    text: "Science is organized knowledge. Wisdom is organized life.",
    author: "Immanuel Kant",
    wiki_url: "https://en.wikipedia.org/wiki/Immanuel_Kant",
  },
  {
    text: "The greatest wealth is to live content with little.",
    author: "Plato",
    wiki_url: "https://en.wikipedia.org/wiki/Plato",
  },
  {
    text: "Freedom is nothing but a chance to be better.",
    author: "Albert Camus",
    wiki_url: "https://en.wikipedia.org/wiki/Albert_Camus",
  },
  {
    text: "No man is free who is not master of himself.",
    author: "Epictetus",
    wiki_url: "https://en.wikipedia.org/wiki/Epictetus",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
    wiki_url: "https://en.wikipedia.org/wiki/Walt_Disney",
  },
  {
    text: "Act as if what you do makes a difference. It does.",
    author: "William James",
    wiki_url: "https://en.wikipedia.org/wiki/William_James",
  },
  {
    text: "What we know is a drop, what we don't know is an ocean.",
    author: "Isaac Newton",
    wiki_url: "https://en.wikipedia.org/wiki/Isaac_Newton",
  },
];

/**
 * Get the day of year (1-366) for a given date
 */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get a deterministic daily quote based on the date
 * Same date always returns the same quote
 */
export function getDailyQuote(date: Date = new Date()): DailyQuote {
  const dayOfYear = getDayOfYear(date);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

/**
 * Format a date for display in daily note heading
 * e.g., "Thursday, January 30, 2025"
 */
export function formatDateDisplay(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
