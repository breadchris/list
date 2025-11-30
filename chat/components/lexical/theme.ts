import { EditorThemeClasses } from "lexical";

export const theme: EditorThemeClasses = {
  paragraph: "mb-2 text-base",
  quote: "border-l-4 border-neutral-700 pl-4 italic text-neutral-400 my-4",
  heading: {
    h1: "text-4xl font-bold mb-4 mt-6",
    h2: "text-3xl font-bold mb-3 mt-5",
    h3: "text-2xl font-bold mb-3 mt-4",
    h4: "text-xl font-bold mb-2 mt-3",
    h5: "text-lg font-bold mb-2 mt-2",
    h6: "text-base font-bold mb-2 mt-2",
  },
  list: {
    nested: {
      listitem: "list-none",
    },
    ol: "list-decimal list-inside my-2",
    ul: "list-disc list-inside my-2",
    listitem: "ml-4 my-1",
  },
  text: {
    bold: "font-bold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
    underlineStrikethrough: "underline line-through",
    code: "bg-neutral-800 text-cyan-400 px-1 py-0.5 rounded font-mono text-sm",
  },
  code: "bg-neutral-900 border border-neutral-800 p-4 rounded-lg my-4 font-mono text-sm overflow-x-auto block",
  codeHighlight: {},
  link: "text-cyan-400 hover:underline cursor-pointer",
};
