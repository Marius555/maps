"use client";

import { Button, Input, Label, Radio, RadioGroup, Spinner, TextField } from "@heroui/react";
import { Map as MapIcon, Plus } from "lucide-react";
import { useState } from "react";

import { ErrorMessage } from "@/components/ui/error-message";
import type { ConnectedMap } from "@/lib/connect/wordpress";
import { useConnectWordPress } from "@/lib/query/connect";
import { useMaps } from "@/lib/query/maps";
import type { AppMap } from "@/lib/repositories/types";
import { ConnectNote, connectBlocked } from "./connect-note";

const NEW = "new";
const NOTE_ID = "connect-note";

/**
 * A new map, or one the owner already has. New is first and is the default for
 * an empty account, which is who arrives from WordPress most of the time; an
 * account that already has maps starts on its first one, since the free plan's
 * single map would refuse a second.
 */
export function MapChoice({
  site,
  host,
  suggestedName,
  onConnected,
}: {
  site: string;
  host: string;
  suggestedName?: string;
  onConnected: (map: ConnectedMap) => void;
}) {
  const maps = useMaps();
  const connect = useConnectWordPress();
  const [picked, setPicked] = useState<string | null>(null);
  const [name, setName] = useState(suggestedName || "Our locations");

  if (maps.isPending) {
    return (
      <div className="flex justify-center py-2" aria-live="polite">
        <Spinner aria-label="Loading your maps" />
      </div>
    );
  }

  if (maps.isError) return <ErrorMessage error={maps.error} />;

  const choice = picked ?? maps.data[0]?.id ?? NEW;
  const chosen = maps.data.find((map) => map.id === choice) ?? null;
  const blocked = connectBlocked(chosen, host);
  const nameMissing = !chosen && name.trim() === "";

  const submit = () =>
    connect.mutate(
      { site, map: chosen ? { id: chosen.id } : { create: true, name: name.trim() } },
      { onSuccess: (result) => onConnected(result.map) },
    );

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked && !nameMissing) submit();
      }}
    >
      <RadioGroup
        aria-label={`Map to show on ${host}`}
        value={choice}
        onChange={setPicked}
        className="flex flex-col gap-2"
      >
        <ChoiceRow value={NEW} icon={Plus} label="Create a new map" />
        {maps.data.map((map) => (
          <ChoiceRow
            key={map.id}
            value={map.id}
            icon={MapIcon}
            label={map.name}
            detail={map.publishedAt ? "Published" : "Not published yet"}
          />
        ))}
      </RadioGroup>

      {chosen ? null : (
        <TextField fullWidth value={name} onChange={setName} isInvalid={nameMissing}>
          <Label>Map name</Label>
          <Input />
        </TextField>
      )}

      <ConnectNote id={NOTE_ID} map={chosen} host={host} />

      {connect.isError ? <ErrorMessage error={connect.error} /> : null}

      <Button
        type="submit"
        fullWidth
        isPending={connect.isPending}
        isDisabled={blocked || nameMissing}
        aria-describedby={NOTE_ID}
      >
        Connect
      </Button>
    </form>
  );
}

/** One answer, drawn as a card — the pattern `SourceChoice` uses on the import step. */
function ChoiceRow({
  value,
  icon: Icon,
  label,
  detail,
}: {
  value: string;
  icon: typeof Plus;
  label: AppMap["name"];
  detail?: string;
}) {
  return (
    <Radio value={value} className="group w-full min-w-0">
      <Radio.Content className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-border px-4 py-3 transition-[background-color,box-shadow] duration-[var(--duration-fast)] group-data-[hovered=true]:bg-surface/60 group-data-[selected=true]:bg-surface group-data-[selected=true]:shadow-sm group-data-[focus-visible=true]:outline-2 group-data-[focus-visible=true]:outline-offset-2 group-data-[focus-visible=true]:outline-focus">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-lg bg-default text-foreground"
        >
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium text-foreground">{label}</span>
          {detail ? <span className="block truncate text-xs text-muted">{detail}</span> : null}
        </span>

        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
      </Radio.Content>
    </Radio>
  );
}
