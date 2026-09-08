"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { X, Plus, Tag } from "lucide-react";


import { cn } from "@/lib/utils";

// Color palette for tag pills (deterministic per tag)
const TAG_COLORS = [
  { bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  { bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  { bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  { bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", border: "border-orange-200 dark:border-orange-800" },
  { bg: "bg-pink-100 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
  { bg: "bg-teal-100 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  { bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  { bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  { bg: "bg-indigo-100 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  { bg: "bg-cyan-100 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-200 dark:border-cyan-800" },
];

export function getTagColor(tag: string) {
  // Simple deterministic hash
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = ((hash << 5) - hash + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

interface TagSelectorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  /** All known tags from the user's cellar (for suggestions) */
  allTags?: string[];
  /** Max number of tags allowed */
  maxTags?: number;
  /** Compact mode for smaller display */
  compact?: boolean;
  /** Read-only display */
  readOnly?: boolean;
}

export function TagSelector({
  tags,
  onChange,
  allTags = [],
  maxTags = 10,
  compact = false,
  readOnly = false,
}: TagSelectorProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!inputValue.trim()) {
      // Show popular/existing tags when input is empty
      return allTags.filter((t) => !tags.includes(t)).slice(0, 8);
    }
    const q = inputValue.toLowerCase().trim();
    return allTags
      .filter((t) => t.toLowerCase().includes(q) && !tags.includes(t))
      .slice(0, 8);
  }, [inputValue, allTags, tags]);

  const addTag = (tag: string) => {
    const normalized = tag.toLowerCase().trim();
    if (!normalized || tags.includes(normalized) || tags.length >= maxTags) return;
    onChange([...tags, normalized]);
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) addTag(inputValue);
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  if (readOnly) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <TagPill key={tag} tag={tag} compact={compact} />
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex flex-wrap gap-1.5 items-center min-h-[2.25rem] px-2 py-1.5 rounded-md border border-input bg-background ring-offset-background",
          "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <TagPill
            key={tag}
            tag={tag}
            compact={compact}
            onRemove={() => removeTag(tag)}
          />
        ))}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "Add tags..." : ""}
            className="flex-1 min-w-[60px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (suggestions.length > 0 || inputValue.trim()) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border border-border rounded-md shadow-lg p-1 max-h-48 overflow-y-auto">
          {inputValue.trim() && !suggestions.includes(inputValue.toLowerCase().trim()) && (
            <button
              onClick={() => addTag(inputValue)}
              className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Plus className="h-3 w-3 text-muted-foreground" />
              Create &ldquo;{inputValue.trim()}&rdquo;
            </button>
          )}
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Tag className="h-3 w-3 text-muted-foreground" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Visual tag pill with optional remove button */
export function TagPill({
  tag,
  compact = false,
  onRemove,
}: {
  tag: string;
  compact?: boolean;
  onRemove?: () => void;
}) {
  const color = getTagColor(tag);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border font-medium transition-colors",
        color.bg,
        color.text,
        color.border,
        compact ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
            compact ? "p-0" : "p-0.5"
          )}
        >
          <X className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </button>
      )}
    </span>
  );
}
