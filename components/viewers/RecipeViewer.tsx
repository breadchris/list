import React from 'react';
import { RecipeData } from '../contentTypeSchemas';

interface RecipeViewerProps {
  data: RecipeData;
}

/**
 * Viewer component for recipe content type
 * Displays ingredients, instructions, and metadata in a kitchen-friendly format
 */
export const RecipeViewer: React.FC<RecipeViewerProps> = ({ data }) => {
  const totalTime = data.prep_time + data.cook_time;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.title}</h1>
        <p className="text-gray-600">{data.description}</p>
      </div>

      {/* Metadata badges */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          ⏱️ {totalTime} min
        </span>
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          🍽️ {data.servings} servings
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
          {data.difficulty === 'easy' ? '⭐' : data.difficulty === 'medium' ? '⭐⭐' : '⭐⭐⭐'} {data.difficulty}
        </span>
        {data.cuisine && (
          <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
            🌍 {data.cuisine}
          </span>
        )}
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Ingredients */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Ingredients</h2>
          <ul className="space-y-2">
            {data.ingredients.map((ingredient, index) => (
              <li key={index} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <div className="flex-1">
                  <span className="font-medium">{ingredient.amount}</span>{' '}
                  <span>{ingredient.item}</span>
                  {ingredient.notes && (
                    <p className="text-sm text-gray-500 mt-1">{ingredient.notes}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Instructions */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Instructions</h2>
          <ol className="space-y-4">
            {data.instructions.map((step) => (
              <li key={step.step_number} className="flex">
                <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">
                  {step.step_number}
                </span>
                <div className="flex-1">
                  <p className="text-gray-700">{step.instruction}</p>
                  {step.duration && (
                    <p className="text-sm text-gray-500 mt-1">⏱️ {step.duration} min</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Notes */}
      {data.notes && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">💡 Chef's Notes</h3>
          <p className="text-gray-700">{data.notes}</p>
        </div>
      )}
    </div>
  );
};
