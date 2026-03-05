import React, { useState } from 'react';
import { Recipe } from './types';
import { Clock, Users, Flame, ChefHat, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface RecipeCardProps {
  recipe: Recipe;
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => 
      prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]
    );
  };

  const difficultyColor = {
    easy: 'text-green-500 bg-green-50 border-green-200',
    medium: 'text-yellow-500 bg-yellow-50 border-yellow-200',
    hard: 'text-red-500 bg-red-50 border-red-200'
  };

  return (
    <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden my-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-orange-50 p-6 border-b border-orange-100">
        <div className="flex items-start justify-between mb-4">
          <div>
             <h2 className="text-2xl font-bold text-foreground font-serif mb-2">{recipe.title}</h2>
             <p className="text-muted-foreground text-sm italic">{recipe.description}</p>
          </div>
          <div className="bg-white p-2 rounded-full shadow-sm">
            <ChefHat className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-foreground bg-white/60 px-2 py-1 rounded-md">
            <Clock className="w-4 h-4 text-orange-400" />
            <span className="font-semibold">Prep:</span> {recipe.prepTime}
          </div>
          <div className="flex items-center gap-1.5 text-foreground bg-white/60 px-2 py-1 rounded-md">
             <Flame className="w-4 h-4 text-red-400" />
            <span className="font-semibold">Cook:</span> {recipe.cookTime}
          </div>
          <div className="flex items-center gap-1.5 text-foreground bg-white/60 px-2 py-1 rounded-md">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="font-semibold">Serves:</span> {recipe.servings}
          </div>
          <div className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${difficultyColor[recipe.difficulty]}`}>
            {recipe.difficulty}
          </div>
          {recipe.calories && (
             <div className="flex items-center gap-1.5 text-muted-foreground text-xs mt-1">
                <span>{recipe.calories} kcal</span>
             </div>
          )}
        </div>
      </div>

      <div className="p-6 grid md:grid-cols-[1fr,1.5fr] gap-8">
        {/* Ingredients */}
        <div>
           <h3 className="font-bold text-foreground mb-4 border-b pb-2">Ingredients</h3>
           <ul className="space-y-2">
             {recipe.ingredients.map((ing, i) => (
               <li key={i} className="text-sm text-foreground flex items-start gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-orange-300 mt-1.5 shrink-0" />
                 <span>
                    <span className="font-semibold">{ing.quantity} {ing.unit}</span> {ing.item}
                 </span>
               </li>
             ))}
           </ul>
        </div>

        {/* Instructions */}
        <div>
           <h3 className="font-bold text-foreground mb-4 border-b pb-2">Instructions</h3>
           <div className="space-y-4">
             {recipe.instructions.map((inst) => {
               const isCompleted = completedSteps.includes(inst.step);
               return (
                 <div 
                    key={inst.step} 
                    className={`flex gap-3 cursor-pointer group transition-all duration-300 ${isCompleted ? 'opacity-50 grayscale' : ''}`}
                    onClick={() => toggleStep(inst.step)}
                 >
                    <div className="shrink-0 mt-0.5">
                       {isCompleted ? (
                           <CheckCircle2 className="w-5 h-5 text-green-500" />
                       ) : (
                           <div className="w-5 h-5 rounded-full border-2 border-border text-muted-foreground flex items-center justify-center text-xs group-hover:border-orange-400 group-hover:text-orange-500 transition-colors">
                             {inst.step}
                           </div>
                       )}
                    </div>
                    <p className={`text-sm leading-relaxed ${isCompleted ? 'text-muted-foreground line-through decoration-muted-foreground' : 'text-foreground'}`}>
                        {inst.text}
                    </p>
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    </div>
  );
}
