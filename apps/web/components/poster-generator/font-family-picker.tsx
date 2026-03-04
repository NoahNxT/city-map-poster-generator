"use client";

import { Check, ChevronsUpDown, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { HomeDictionary } from "@/lib/i18n/dictionaries";
import type { FontSuggestion } from "@/lib/types";

type FontFamilyPickerProps = {
  controls: HomeDictionary["controls"];
  activePreviewHintField: string | null;
  getHintTriggerHandlers: (field: "fontFamily") => {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  };
  fontComboboxOpen: boolean;
  setFontComboboxOpen: (open: boolean) => void;
  selectedFontFamily: string;
  fontDescriptionId: string;
  fontSearchQuery: string;
  setFontSearchQuery: (value: string) => void;
  fontSuggestionsLoading: boolean;
  fontSuggestionsError: boolean;
  fontSuggestions?: FontSuggestion[];
  fallbackFontSuggestions: Array<{ family: string; category: string }>;
  clearFontSelection: () => void;
  handleFontSelect: (family: string) => void;
  fontCommandItemClassName: string;
};

export function FontFamilyPicker({
  controls,
  activePreviewHintField,
  getHintTriggerHandlers,
  fontComboboxOpen,
  setFontComboboxOpen,
  selectedFontFamily,
  fontDescriptionId,
  fontSearchQuery,
  setFontSearchQuery,
  fontSuggestionsLoading,
  fontSuggestionsError,
  fontSuggestions,
  fallbackFontSuggestions,
  clearFontSelection,
  handleFontSelect,
  fontCommandItemClassName,
}: FontFamilyPickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="fontFamily">{controls.googleFontFamily}</Label>
        <Popover open={activePreviewHintField === "fontFamily"}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={controls.explainGoogleFontFamily}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...getHintTriggerHandlers("fontFamily")}
            >
              <CircleHelp className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72" side="top">
            <p className="text-xs font-semibold text-foreground">
              {controls.googleFontHelpTitle}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {controls.googleFontHelpDescription}
            </p>
          </PopoverContent>
        </Popover>
      </div>
      <Popover
        open={fontComboboxOpen}
        onOpenChange={(open) => {
          setFontComboboxOpen(open);
          if (open) {
            setFontSearchQuery(selectedFontFamily);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id="fontFamily"
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={fontComboboxOpen}
            aria-describedby={fontDescriptionId}
            className="w-full justify-between font-normal hover:bg-muted hover:text-foreground"
          >
            <span
              className={
                selectedFontFamily
                  ? "truncate text-left"
                  : "truncate text-left text-muted-foreground"
              }
            >
              {selectedFontFamily || controls.selectGoogleFont}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              value={fontSearchQuery}
              placeholder={controls.searchGoogleFonts}
              aria-label={controls.searchGoogleFontsAria}
              onValueChange={setFontSearchQuery}
            />
            <CommandList>
              {fontSuggestionsLoading ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  {controls.searchingFonts}
                </p>
              ) : (
                <>
                  <CommandGroup heading={controls.selection}>
                    <CommandItem
                      className={fontCommandItemClassName}
                      value="theme-default-font"
                      onSelect={clearFontSelection}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          selectedFontFamily ? "opacity-0" : "opacity-100"
                        }`}
                      />
                      {controls.themeDefaultFont}
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  {fontSuggestionsError ? (
                    <>
                      <p className="px-3 py-2 text-xs text-red-700">
                        {controls.fontSearchUnavailable}
                      </p>
                      <CommandGroup heading={controls.fallbackFonts}>
                        {fallbackFontSuggestions.length ? (
                          fallbackFontSuggestions.map((font) => {
                            const isSelected =
                              selectedFontFamily.toLowerCase() ===
                              font.family.toLowerCase();
                            return (
                              <CommandItem
                                className={fontCommandItemClassName}
                                key={font.family}
                                value={`fallback-${font.family.toLowerCase()}`}
                                onSelect={() => handleFontSelect(font.family)}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    isSelected ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p className="truncate font-medium">
                                    {font.family}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {font.category}
                                  </p>
                                </div>
                              </CommandItem>
                            );
                          })
                        ) : (
                          <CommandEmpty>
                            {controls.noFallbackFonts}
                          </CommandEmpty>
                        )}
                      </CommandGroup>
                    </>
                  ) : fontSuggestions?.length ? (
                    <CommandGroup heading={controls.googleFonts}>
                      {fontSuggestions.map((font) => {
                        const isSelected =
                          selectedFontFamily.toLowerCase() ===
                          font.family.toLowerCase();
                        return (
                          <CommandItem
                            className={fontCommandItemClassName}
                            key={font.family}
                            value={`google-${font.family.toLowerCase()}`}
                            onSelect={() => handleFontSelect(font.family)}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                isSelected ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {font.family}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {font.category ?? controls.googleFonts}
                              </p>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ) : (
                    <CommandEmpty>{controls.noFontsFound}</CommandEmpty>
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p id={fontDescriptionId} className="text-xs text-muted-foreground">
        {controls.searchGoogleFontsHelp}
      </p>
    </div>
  );
}
