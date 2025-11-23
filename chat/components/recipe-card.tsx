"use client";

import { memo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChefHat } from "lucide-react";
import { motion } from "framer-motion";
import { DeepPartial } from "ai";
import { Recipe } from "@/lib/schema";

export const RecipeCard = memo(function RecipeCard({
  recipe,
}: {
  recipe: DeepPartial<Recipe> | undefined;
}) {
  return (
    <div className="w-full">
      {/* Use layout animation instead of opacity to prevent re-triggering on content updates */}
      <motion.div
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="w-full border shadow-lg bg-neutral-800 border-neutral-700 transition-colors duration-200">
          <CardHeader className="border-b bg-neutral-800 border-neutral-700 transition-colors duration-200">
            <div className="flex items-center space-x-3">
              <ChefHat className="h-6 w-6 text-orange-400" />
              <CardTitle className="text-2xl font-bold text-neutral-100 transition-colors duration-200">
                {recipe?.name || "Loading recipe..."}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Description */}
            {recipe?.description && (
              <div>
                <p className="text-neutral-300 transition-colors duration-200">
                  {recipe.description}
                </p>
              </div>
            )}

            {/* Ingredients and Steps Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Ingredients */}
              {recipe?.ingredients && recipe.ingredients.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-neutral-100 transition-colors duration-200">
                    Ingredients
                  </h3>
                  <ul className="space-y-2">
                    {recipe.ingredients.map((ingredient, index) => (
                      <li
                        key={index}
                        className="flex items-start text-neutral-300 transition-colors duration-200"
                      >
                        <span className="mr-2 text-orange-400">•</span>
                        <span>{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Steps */}
              {recipe?.steps && recipe.steps.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-neutral-100 transition-colors duration-200">
                    Instructions
                  </h3>
                  <ol className="space-y-3">
                    {recipe.steps.map((step, index) => (
                      <li
                        key={index}
                        className="flex items-start text-neutral-300 transition-colors duration-200"
                      >
                        <span className="mr-3 font-semibold text-orange-400 min-w-[1.5rem]">
                          {index + 1}.
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
});
