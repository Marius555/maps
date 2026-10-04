"use client";

import { Description, FieldError, Label, Tabs, TextArea, TextField } from "@heroui/react";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";

import { NewsMarkdown } from "@/components/news/news-markdown";
import { NewsProse } from "@/components/news/news-prose";
import type { AdminNewsForm } from "@/lib/validation/news.schema";

/**
 * The post's body: Markdown on the Write tab, the public page's own renderer on
 * Preview — `NewsMarkdown` inside `NewsProse`, the same two components the
 * article uses, so what is previewed is what is published.
 *
 * Its own field rather than `FormTextArea`, which is sized for a sentence. Bound
 * through `Controller` all the same (React Aria owns the value, form-field.tsx).
 */
export function NewsBodyField({ control }: { control: Control<AdminNewsForm> }) {
  const [tab, setTab] = useState("write");

  return (
    <Controller
      control={control}
      name="body"
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;

        return (
          <div className="space-y-2">
            <Tabs variant="secondary" selectedKey={tab} onSelectionChange={(key) => setTab(String(key))}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label elementType="span" className="text-sm font-medium">
                  Post
                </Label>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Post editor" className="w-max">
                    <Tabs.Tab id="write" className="w-auto px-3">
                      Write
                    </Tabs.Tab>
                    <Tabs.Tab id="preview" className="w-auto px-3">
                      Preview
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </div>

              <Tabs.Panel id="write" className="mt-2 p-0">
                <TextField
                  fullWidth
                  aria-label="Post, in Markdown"
                  isInvalid={Boolean(error)}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                >
                  <TextArea
                    ref={field.ref}
                    rows={20}
                    className="min-h-80 font-mono text-sm/6"
                  />
                  {error ? (
                    <FieldError>{error}</FieldError>
                  ) : (
                    <Description>
                      Markdown: ## for a heading, **bold**, [a link](https://…), - for a list,
                      ![description](https://…image) for an image.
                    </Description>
                  )}
                </TextField>
              </Tabs.Panel>

              <Tabs.Panel id="preview" className="mt-2 p-0">
                <div className="min-h-80 rounded-xl border border-border p-4 sm:p-6">
                  {field.value?.trim() ? (
                    <NewsProse>
                      <NewsMarkdown markdown={field.value} />
                    </NewsProse>
                  ) : (
                    <p className="text-sm text-muted">Nothing to preview yet. Write the post first.</p>
                  )}
                </div>
              </Tabs.Panel>
            </Tabs>
          </div>
        );
      }}
    />
  );
}
