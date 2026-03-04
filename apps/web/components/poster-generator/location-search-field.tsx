"use client";

import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction,
} from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocationSuggestion } from "@/lib/types";

type LocationSearchFieldProps = {
  inputId: string;
  hintId: string;
  statusId: string;
  listboxId: string;
  label: string;
  placeholder: string;
  helpText: string;
  searchingText: string;
  noResultsText: string;
  locationQuery: string;
  setLocationQuery: Dispatch<SetStateAction<string>>;
  locationAutocompleteOpen: boolean;
  setLocationAutocompleteOpen: Dispatch<SetStateAction<boolean>>;
  debouncedLocationQuery: string;
  locationSuggestions: LocationSuggestion[];
  activeLocationIndex: number;
  setActiveLocationIndex: Dispatch<SetStateAction<number>>;
  activeLocationSuggestion: LocationSuggestion | null;
  onLocationSelect: (suggestion: LocationSuggestion) => void;
  onLocationInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  isLoading: boolean;
  locationStatusMessage: string;
};

export function LocationSearchField({
  inputId,
  hintId,
  statusId,
  listboxId,
  label,
  placeholder,
  helpText,
  searchingText,
  noResultsText,
  locationQuery,
  setLocationQuery,
  locationAutocompleteOpen,
  setLocationAutocompleteOpen,
  debouncedLocationQuery,
  locationSuggestions,
  activeLocationIndex,
  setActiveLocationIndex,
  activeLocationSuggestion,
  onLocationSelect,
  onLocationInputKeyDown,
  isLoading,
  locationStatusMessage,
}: LocationSearchFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        <Input
          id={inputId}
          value={locationQuery}
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={
            locationAutocompleteOpen && debouncedLocationQuery.length >= 3
          }
          aria-controls={
            locationAutocompleteOpen && debouncedLocationQuery.length >= 3
              ? listboxId
              : undefined
          }
          aria-activedescendant={
            activeLocationSuggestion
              ? `location-option-${activeLocationSuggestion.placeId}`
              : undefined
          }
          aria-describedby={`${hintId} ${statusId}`}
          onFocus={() => {
            setLocationAutocompleteOpen(true);
          }}
          onBlur={() =>
            setTimeout(() => {
              setLocationAutocompleteOpen(false);
              setActiveLocationIndex(-1);
            }, 120)
          }
          onKeyDown={onLocationInputKeyDown}
          onChange={(event) => {
            setLocationQuery(event.currentTarget.value);
            setLocationAutocompleteOpen(true);
            setActiveLocationIndex(-1);
          }}
        />
        {locationAutocompleteOpen && debouncedLocationQuery.length >= 3 ? (
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          >
            {isLoading ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {searchingText}
              </p>
            ) : locationSuggestions.length ? (
              locationSuggestions.map((suggestion, index) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  id={`location-option-${suggestion.placeId}`}
                  role="option"
                  aria-selected={index === activeLocationIndex}
                  tabIndex={-1}
                  className={`w-full rounded-sm px-3 py-2 text-left text-sm ${
                    index === activeLocationIndex
                      ? "bg-muted text-foreground"
                      : "hover:bg-muted"
                  }`}
                  onMouseEnter={() => setActiveLocationIndex(index)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onLocationSelect(suggestion);
                  }}
                >
                  <p className="truncate font-medium">
                    {suggestion.city}, {suggestion.country}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {suggestion.displayName}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {noResultsText}
              </p>
            )}
          </div>
        ) : null}
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        {helpText}
      </p>
      <p id={statusId} className="sr-only" aria-live="polite">
        {locationStatusMessage}
      </p>
    </div>
  );
}
