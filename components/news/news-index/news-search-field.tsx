"use client";

import { InputGroup, TextField } from "@heroui/react";
import { Search } from "lucide-react";

/** The index's search box. Filters the rows already on the page; no request. */
export function NewsSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      aria-label="Search news"
      type="search"
      value={value}
      onChange={onChange}
      className="w-full sm:max-w-xs"
    >
      <InputGroup fullWidth className="rounded-xl">
        <InputGroup.Prefix className="pr-1 pl-3 text-muted">
          <Search aria-hidden="true" className="size-4" />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder="Search" />
      </InputGroup>
    </TextField>
  );
}
