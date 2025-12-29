"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useYDoc } from "@y-sweet/react";
import type { WikiTemplate } from "@/types/wiki";
import { DEFAULT_TEMPLATE_MODEL } from "@/types/wiki";

interface UseWikiTemplatesOptions {
  wiki_id: string;
}

interface UseWikiTemplatesReturn {
  /** All templates in the wiki */
  templates: Map<string, WikiTemplate>;
  /** Templates as array for easy iteration */
  templatesList: WikiTemplate[];
  /** Whether Y.js doc is ready */
  isReady: boolean;
  /** Get a template by ID */
  getTemplate: (id: string) => WikiTemplate | undefined;
  /** Get a template by name */
  getTemplateByName: (name: string) => WikiTemplate | undefined;
  /** Create a new template */
  createTemplate: (
    name: string,
    prompt?: string,
    description?: string
  ) => WikiTemplate;
  /** Update a template */
  updateTemplate: (
    templateId: string,
    updates: {
      name?: string;
      prompt?: string;
      prompt_format?: 'text' | 'blocknote';
      model?: string;
      description?: string;
      aliases?: string[];
    }
  ) => void;
  /** Delete a template */
  deleteTemplate: (templateId: string) => void;
  /** Check if a template name exists */
  templateExists: (name: string) => boolean;
}

/**
 * Hook for managing wiki templates
 *
 * All state is stored in Y.js Y.Map('wiki-templates').
 * No database operations - templates are only persisted via Y.js (IndexedDB + Y-Sweet).
 * Templates are NOT included in published wiki blob.
 */
export function useWikiTemplates({
  wiki_id,
}: UseWikiTemplatesOptions): UseWikiTemplatesReturn {
  const doc = useYDoc();

  // Templates state (derived from Y.js)
  const [templates, setTemplates] = useState<Map<string, WikiTemplate>>(
    new Map()
  );

  // Y.js map for templates
  const templatesMap = useMemo(() => {
    if (!doc) return null;
    return doc.getMap<WikiTemplate>("wiki-templates");
  }, [doc]);

  // Sync templates from Y.js map to React state
  useEffect(() => {
    if (!templatesMap) return;

    const syncFromYjs = () => {
      const newTemplates = new Map<string, WikiTemplate>();
      templatesMap.forEach((template, id) => {
        newTemplates.set(id, template);
      });
      setTemplates(newTemplates);
    };

    // Initial sync
    syncFromYjs();

    // Listen for changes
    templatesMap.observe(syncFromYjs);
    return () => templatesMap.unobserve(syncFromYjs);
  }, [templatesMap]);

  // Convert to array for easy iteration (sorted by name)
  const templatesList = useMemo(() => {
    return Array.from(templates.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [templates]);

  // Get template by ID
  const getTemplate = useCallback(
    (id: string): WikiTemplate | undefined => {
      return templates.get(id);
    },
    [templates]
  );

  // Get template by name (case-insensitive)
  const getTemplateByName = useCallback(
    (name: string): WikiTemplate | undefined => {
      const lowerName = name.toLowerCase();
      for (const template of templates.values()) {
        if (template.name.toLowerCase() === lowerName) {
          return template;
        }
      }
      return undefined;
    },
    [templates]
  );

  // Check if template name exists
  const templateExists = useCallback(
    (name: string): boolean => {
      return getTemplateByName(name) !== undefined;
    },
    [getTemplateByName]
  );

  // Create a new template (Y.js only, no database)
  const createTemplate = useCallback(
    (
      name: string,
      prompt: string = "",
      description?: string
    ): WikiTemplate => {
      if (!templatesMap) {
        throw new Error("Y.js document not ready");
      }

      // Check for existing template with same name
      if (templateExists(name)) {
        throw new Error(`A template named '${name}' already exists`);
      }

      const templateId = crypto.randomUUID();

      const newTemplate: WikiTemplate = {
        id: templateId,
        name,
        wiki_id,
        prompt,
        prompt_format: 'blocknote',
        model: DEFAULT_TEMPLATE_MODEL,
        description,
        created_at: new Date().toISOString(),
      };

      // Add to Y.js map (this triggers the observer and updates React state)
      templatesMap.set(templateId, newTemplate);

      return newTemplate;
    },
    [wiki_id, templatesMap, templateExists]
  );

  // Update a template
  const updateTemplate = useCallback(
    (
      templateId: string,
      updates: {
        name?: string;
        prompt?: string;
        prompt_format?: 'text' | 'blocknote';
        model?: string;
        description?: string;
        aliases?: string[];
      }
    ): void => {
      if (!templatesMap) {
        throw new Error("Y.js document not ready");
      }

      const existing = templatesMap.get(templateId);
      if (!existing) {
        throw new Error("Template not found");
      }

      // Check if renaming to an existing name
      if (updates.name && updates.name !== existing.name) {
        if (templateExists(updates.name)) {
          throw new Error(`A template named '${updates.name}' already exists`);
        }
      }

      // Update in Y.js
      templatesMap.set(templateId, {
        ...existing,
        name: updates.name ?? existing.name,
        prompt: updates.prompt ?? existing.prompt,
        prompt_format: updates.prompt_format ?? existing.prompt_format,
        model: updates.model ?? existing.model,
        description: updates.description ?? existing.description,
        aliases: updates.aliases ?? existing.aliases,
      });
    },
    [templatesMap, templateExists]
  );

  // Delete a template
  const deleteTemplate = useCallback(
    (templateId: string): void => {
      if (!templatesMap) {
        throw new Error("Y.js document not ready");
      }

      if (!templatesMap.has(templateId)) {
        throw new Error("Template not found");
      }

      // Delete from Y.js map
      templatesMap.delete(templateId);
    },
    [templatesMap]
  );

  return {
    templates,
    templatesList,
    isReady: !!doc,
    getTemplate,
    getTemplateByName,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    templateExists,
  };
}
