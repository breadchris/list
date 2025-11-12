import React, { useState } from 'react';
import { BookSummaryData } from '../contentTypeSchemas';

interface BookSummaryViewerProps {
  data: BookSummaryData;
}

/**
 * Viewer component for book summary content type
 * Displays book info, chapter summaries, themes, characters, and quotes
 */
export const BookSummaryViewer: React.FC<BookSummaryViewerProps> = ({ data }) => {
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set([1]));

  const toggleChapter = (chapterNum: number) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterNum)) {
        next.delete(chapterNum);
      } else {
        next.add(chapterNum);
      }
      return next;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto">
      {/* Book Header */}
      <div className="mb-6 border-b border-gray-200 pb-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-20 h-28 bg-gradient-to-br from-blue-500 to-purple-600 rounded shadow-lg flex items-center justify-center text-white text-4xl">
            📚
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">{data.title}</h1>
            <p className="text-lg text-gray-600 mb-2">by {data.author}</p>
            <div className="flex flex-wrap gap-2 items-center">
              {data.publication_year && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                  📅 {data.publication_year}
                </span>
              )}
              {data.genre && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm">
                  🎭 {data.genre}
                </span>
              )}
              {data.rating && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-sm">
                  ⭐ {data.rating}/5
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Synopsis */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">📖 Synopsis</h2>
        <p className="text-gray-700 leading-relaxed">{data.synopsis}</p>
      </div>

      {/* Key Themes */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">💡 Key Themes</h2>
        <div className="flex flex-wrap gap-2">
          {data.key_themes.map((theme, index) => (
            <span
              key={index}
              className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm"
            >
              {theme}
            </span>
          ))}
        </div>
      </div>

      {/* Main Characters */}
      {data.main_characters && data.main_characters.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">👤 Main Characters</h2>
          <div className="space-y-3">
            {data.main_characters.map((character, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-1">{character.name}</h3>
                <p className="text-sm text-gray-700">{character.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chapter Summaries */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">📑 Chapter Summaries</h2>
        <div className="space-y-2">
          {data.chapters.map((chapter) => {
            const isExpanded = expandedChapters.has(chapter.chapter_number);

            return (
              <div
                key={chapter.chapter_number}
                className="border border-gray-200 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleChapter(chapter.chapter_number)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {chapter.chapter_number}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {chapter.title || `Chapter ${chapter.chapter_number}`}
                      </h3>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-200">
                    <p className="text-gray-700 mb-3">{chapter.summary}</p>
                    {chapter.key_points && chapter.key_points.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">Key Points:</h4>
                        <ul className="space-y-1">
                          {chapter.key_points.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                              <span className="text-blue-600 mt-1">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Quotes */}
      {data.key_quotes && data.key_quotes.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">💬 Key Quotes</h2>
          <div className="space-y-4">
            {data.key_quotes.map((quoteObj, index) => (
              <div key={index} className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-purple-600 rounded-r-lg">
                <p className="text-gray-800 italic mb-2">"{quoteObj.quote}"</p>
                {quoteObj.context && (
                  <p className="text-sm text-gray-600 mb-1">{quoteObj.context}</p>
                )}
                {quoteObj.page && (
                  <p className="text-xs text-gray-500">— Page {quoteObj.page}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Takeaways */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">✨ Key Takeaways</h2>
        <ul className="space-y-2">
          {data.takeaways.map((takeaway, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-semibold mt-0.5">
                {index + 1}
              </span>
              <span className="text-gray-700 flex-1">{takeaway}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Review */}
      {data.review && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">📝 Review</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{data.review}</p>
        </div>
      )}

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {data.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
