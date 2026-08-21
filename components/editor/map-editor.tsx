"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GroupEditDialog } from "@/components/groups/group-form/group-edit-dialog";
import { usePruneEmptyGroups } from "@/components/groups/use-prune-empty-groups";
import type { DraggedObject } from "@/components/groups/use-row-drag";
import { MapCanvas } from "@/components/map/map-canvas";
import type { MapHandle } from "@/components/map/map-canvas-impl";
import { MapHintBar } from "@/components/map/map-hint-bar";
import { MapSearch } from "@/components/map/map-search/map-search";
import { MapToolbar } from "@/components/map/map-toolbar";
import { PinStudio } from "@/components/map/pin-studio/pin-studio";
import { SelectionBar } from "@/components/map/selection-bar";
import { PlaceEditDialog } from "@/components/places/place-form/place-edit-dialog";
import { PreviewDialog } from "@/components/preview/preview-dialog";
import type { GeocodeCandidate } from "@/lib/geocoding/types";
import { roundCoord } from "@/lib/map/geo";
import { groupAction, groupActionLabel } from "@/lib/map/group-action";
import { membersOf } from "@/lib/map/group-members";
import { nextGroupDefaults } from "@/lib/map/next-group-defaults";
import { recentPinIcons } from "@/lib/map/recent-pins";
import { selectionBounds } from "@/lib/map/selection-bounds";
import { nextPlaceDefaults } from "@/lib/places/next-place-defaults";
import {
  isOptimisticGroupId,
  useAssignToGroup,
  useCreateGroup,
  useGroups,
  useGroupsSnapshot,
  type GroupMembers,
} from "@/lib/query/groups";
import { useMap, useUpdateMap } from "@/lib/query/maps";
import { readMapAppearance } from "@/lib/validation/map-appearance.schema";
import { isPlanLimit, toastPlanLimit } from "@/lib/query/plan-limit-toast";
import {
  useCreatePlace,
  usePlaces,
  usePlacesSnapshot,
  useUpdatePlace,
} from "@/lib/query/places";
import {
  useCreateShape,
  useShapes,
  useShapesSnapshot,
  useUpdateShape,
} from "@/lib/query/shapes";
import { nextShapeDefaults } from "@/lib/map/next-shape-defaults";
import type { AppMap, Group, Place, Shape } from "@/lib/repositories/types";
import {
  drawKindOf,
  selectionSize,
  useEditorStore,
} from "@/lib/stores/editor-store";
import { shapeBounds, type ShapeGeometry } from "@/packages/shared/shapes";
import { DEFAULT_SHAPE_OPACITY } from "@/lib/validation/shape.schema";
import { ShapeEditDialog } from "@/components/shapes/shape-form/shape-edit-dialog";
import { EditorSidebar } from "./editor-sidebar";
import { useAddressResolution } from "./use-address-resolution";

/**
 * Composes the canvas, toolbar and place list. Data comes from the query cache;
 * the only local state is which mode the editor is in and what's selected.
 *
 * The map's name and section tabs live in the route layout, so this owns the
 * canvas and nothing above it.
 */
export function MapEditor({
  map: initialMap,
  initialPlaces,
  initialShapes,
  initialGroups,
  placeLimit,
}: {
  map: AppMap;
  initialPlaces: Place[];
  initialShapes: Shape[];
  initialGroups: Group[];
  placeLimit: number;
}) {
  /*
   * Read through the cache rather than straight off the prop, the same way the
   * places below are. The prop is the server render, and it is frozen: saving a
   * pin in the studio writes the new map into the query cache, and a component
   * holding the prop would go on drawing the map as it was when the page loaded
   * — a pin you just made, invisible until a reload.
   */
  const { data: map = initialMap } = useMap(initialMap.id, initialMap);
  const { data: places = [] } = usePlaces(map.id, initialPlaces);
  const { data: shapes = [] } = useShapes(map.id, initialShapes);
  const { data: groups = [] } = useGroups(map.id, initialGroups);
  const createPlace = useCreatePlace(map.id);
  const updatePlace = useUpdatePlace(map.id);
  const createShape = useCreateShape(map.id);
  const updateShape = useUpdateShape(map.id);
  const createGroup = useCreateGroup(map.id);
  const assignToGroup = useAssignToGroup(map.id);
  const updateMap = useUpdateMap(map.id);
  const readPlaces = usePlacesSnapshot(map.id);
  const readShapes = useShapesSnapshot(map.id);
  const readGroups = useGroupsSnapshot(map.id);

  const {
    pendingIds: pendingAddressIds,
    failedIds: failedAddressIds,
    resolveAddress,
    retainOnly,
  } = useAddressResolution(map.id);

  const mode = useEditorStore((state) => state.mode);
  const addIcon = useEditorStore((state) => state.addIcon);
  const selectedPlaceId = useEditorStore((state) => state.selectedPlaceId);
  const selectedShapeId = useEditorStore((state) => state.selectedShapeId);
  const selection = useEditorStore((state) => state.selection);
  const setMode = useEditorStore((state) => state.setMode);
  const startAdding = useEditorStore((state) => state.startAdding);
  const startDrawing = useEditorStore((state) => state.startDrawing);
  const startSelecting = useEditorStore((state) => state.startSelecting);
  const selectPlace = useEditorStore((state) => state.selectPlace);
  const selectShape = useEditorStore((state) => state.selectShape);
  const setSelection = useEditorStore((state) => state.setSelection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const reset = useEditorStore((state) => state.reset);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingShapeId, setEditingShapeId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  const isAdding = mode === "add";
  const drawMode = drawKindOf(mode);
  const isSelecting = mode === "select";

  const selectedPlaceIds = useMemo(
    () => new Set(selection.placeIds),
    [selection.placeIds],
  );
  const selectedShapeIds = useMemo(
    () => new Set(selection.shapeIds),
    [selection.shapeIds],
  );

  // Leaving the editor with mode: 'add' still set would arm the next map.
  useEffect(() => reset, [reset]);

  const categoriesById = useMemo(
    () => new Map(map.categories.map((category) => [category.id, category])),
    [map.categories],
  );

  /**
   * A group's colour, for everything in it.
   *
   * Membership is the one thing the editor could not show on the map. The
   * sidebar knows which locations are in a group; the map — where the user is
   * actually looking — drew them in their category colours like everything else,
   * so a group was a fact you could only read indoors.
   *
   * It wins over the category and over a custom pin's own colour, because a
   * group whose members are three different colours communicates nothing. Taking
   * an object out gives its own colour straight back.
   */
  const groupColorById = useMemo(
    () => new Map(groups.map((group) => [group.id, group.color])),
    [groups],
  );

  // Memoised because its identity is load-bearing: both the marker layer and the
  // shape layer repaint when it changes, which is how recolouring a group reaches
  // objects whose own rows have not changed at all.
  const colorFor = useCallback(
    (place: Place, pinColor?: string) =>
      groupColorById.get(place.groupId) ??
      pinColor ??
      categoriesById.get(place.category)?.color,
    [groupColorById, categoriesById],
  );

  /** The same rule for shapes, whose own colour is the one being overridden. */
  const shapeColorFor = useCallback(
    (shape: Shape) => groupColorById.get(shape.groupId) ?? shape.color,
    [groupColorById],
  );

  // The card needs the label too, not just the colour the pins take.
  const categoryFor = useCallback(
    (place: Place) => categoriesById.get(place.category),
    [categoriesById],
  );

  /*
   * The pins the add menu puts on its first page. Derived here rather than stored
   * on the map: a "recently used" column would be a third thing to keep in step
   * with the places and the pins.
   */
  const recentIcons = useMemo(
    () => recentPinIcons(places, map.pinIcons),
    [places, map.pinIcons],
  );

  /*
   * The stored blob, filled in. Read through the same helper the snapshot
   * generator uses, so the switches in the appearance menu show what would
   * actually be published rather than a second opinion — and memoised because
   * the toolbar passes it straight into a control that saves on change.
   *
   * The canvas gets `map.appearance` raw instead: it normalises internally, and
   * handing it the same object here would only add a second thing to keep in
   * step.
   */
  const appearance = useMemo(
    () => readMapAppearance(map.appearance),
    [map.appearance],
  );

  /*
   * Both depend on `.mutate`/`.mutateAsync`, not on the mutation object: the
   * object is a new identity every render, which would re-run the marker effect
   * (and now the canvas's handle effect) on each one.
   */
  const createMutate = createPlace.mutateAsync;
  const moveMutate = updatePlace.mutate;

  /**
   * Forget the addresses of locations that have since been deleted. The lookup
   * state is keyed by place id and nothing else prunes it.
   */
  useEffect(() => {
    retainOnly(new Set(places.map((place) => place.id)));
  }, [places, retainOnly]);

  /*
   * Declared above the callbacks that use it, not beside the canvas it belongs
   * to: `streetAt` goes in their dependency arrays, and those arrays are built
   * during render — a `const` further down the component would still be in its
   * temporal dead zone when they are evaluated.
   */
  const mapHandle = useRef<MapHandle | null>(null);
  const handleReady = useCallback((handle: MapHandle) => {
    mapHandle.current = handle;
  }, []);

  /**
   * The street under a coordinate, measured against the tiles already on screen.
   *
   * Null whenever the map cannot say — before it is ready, or zoomed out past the
   * road data — and null is fine: the geocoder then answers alone, exactly as it
   * did before this existed. See lib/map/nearest-road.ts for why the geocoder
   * cannot be trusted with this question on its own.
   */
  const streetAt = useCallback(
    (lng: number, lat: number) => mapHandle.current?.streetAt(lng, lat) ?? null,
    [],
  );

  /**
   * Drop a pin, then find out where it landed.
   *
   * The place is created first and addressed second, rather than the other way
   * round, because a pin that takes a second to appear reads as a broken map. So
   * the row arrives instantly under a placeholder name and the street fills itself
   * in behind it.
   */
  const addPlace = useCallback(
    async (
      coords: { lng: number; lat: number },
      known?: GeocodeCandidate,
      icon = "",
    ) => {
      const lat = roundCoord(coords.lat);
      const lng = roundCoord(coords.lng);

      let created: string;

      try {
        // Read at drop time, not at render time: two pins dropped in quick
        // succession would otherwise both see the same list and land as two
        // "Location 4"s sharing a sortOrder.
        const { name, sortOrder } = nextPlaceDefaults(readPlaces());

        const place = await createMutate({
          name,
          lat,
          lng,
          address: known?.title ?? "",
          category: "",
          icon,
          sortOrder,
          geocodeStatus: "manual",
          /*
           * The whole of what the search found, not just the line it printed.
           * Only the formatted address used to be kept, so a location added from
           * the address bar had no postcode and its row went on showing the
           * placeholder name — the geocoder had already answered, we were simply
           * throwing most of the answer away.
           */
          addressParts: known?.parts ?? null,
          geocodeConfidence: known?.confidence ?? null,
        });

        created = place.id;
      } catch (error) {
        /*
         * A plan limit is the case that matters, and it now says so out here.
         * All three ways of adding a location funnel through this function, so
         * one toast covers dragging a pin, clicking the map in add mode and the
         * search's `+` — none of which has anywhere inline to put a sentence.
         *
         * Anything else still surfaces as the panel's alert, from
         * `createPlace.error`; see the sidebar's `error` prop below.
         */
        toastPlanLimit(error);
        return;
      }

      // Picked from a search result: we already know the address, so asking the
      // geocoder to tell us what it just told us would be a wasted second.
      if (known) return;

      // Only from here. Before this point the row is the optimistic one, which
      // the list recognises by its temporary id and skeletons on its own.
      await resolveAddress(created, { lat, lng }, "", streetAt(lng, lat));
    },
    [createMutate, resolveAddress, readPlaces, streetAt],
  );

  /**
   * Dragging a pin is how a wrong position gets corrected, so a drop is a save.
   * A moved pin was placed deliberately, which makes its coordinates 'manual' —
   * a later geocode pass must not overwrite them.
   *
   * The address is looked up again for the same reason it was looked up on the
   * way in: it describes where the pin is, and the pin is somewhere else now.
   * Leaving the old one is how a location ends up filed under a street it was
   * dragged away from — which is exactly what a correcting drag was meant to fix.
   *
   * Position is saved without waiting for it. The two are separate writes because
   * they finish a second apart, and the pin must not hang in the air meanwhile.
   */
  const movePlace = useCallback(
    (placeId: string, coords: { lng: number; lat: number }) => {
      const lat = roundCoord(coords.lat);
      const lng = roundCoord(coords.lng);

      moveMutate({ placeId, input: { lat, lng, geocodeStatus: "manual" } });

      // The address it has now, so a lookup that finds nothing knows there is a
      // stale one to clear rather than leaving the pin filed under where it was.
      const current = places.find((place) => place.id === placeId)?.address ?? "";

      void resolveAddress(placeId, { lat, lng }, current, streetAt(lng, lat));
    },
    [moveMutate, resolveAddress, places, streetAt],
  );

  /**
   * Try the address again for a location whose lookup came back with nothing.
   *
   * Coordinates come from the place rather than from the row that asked, so a
   * retry always describes where the pin is now — including if it was dragged
   * while the first attempt was failing.
   */
  const retryAddress = useCallback(
    (placeId: string) => {
      const place = places.find((candidate) => candidate.id === placeId);
      if (!place) return;

      void resolveAddress(
        placeId,
        { lat: place.lat, lng: place.lng },
        place.address,
        streetAt(place.lng, place.lat),
      );
    },
    [places, resolveAddress, streetAt],
  );

  /*
   * Both depend on `.mutateAsync`/`.mutate`, not on the mutation object, for the
   * same reason the place ones do: the object is a new identity every render, and
   * these go into the canvas's prop group.
   */
  const createShapeMutate = createShape.mutateAsync;
  const updateShapeMutate = updateShape.mutate;

  /**
   * A shape has just been drawn.
   *
   * Saved immediately under a generated name rather than opening a form first.
   * The alternative is a modal over the outline the moment the last click lands,
   * which hides the thing it is asking you to name — and the name is the least
   * urgent decision about a shape you have only just seen. Renaming it is one
   * click on the card that opens right beside it.
   *
   * Selecting it is what puts its handles on the map, so the shape arrives ready
   * to be adjusted. Leaving the tool armed afterwards would mean the next click —
   * very likely on a handle — started drawing a second shape instead.
   */
  const addShape = useCallback(
    async (geometry: ShapeGeometry) => {
      setMode("browse");

      try {
        // Read at draw time, not at render time: two circles drawn in quick
        // succession would otherwise both see the same list and land as two
        // "Circle 1"s sharing a sortOrder. Same reason the pins read theirs here.
        const created = await createShapeMutate({
          ...nextShapeDefaults(readShapes(), geometry.kind),
          geometry,
          opacity: DEFAULT_SHAPE_OPACITY,
        });

        selectShape(created.id);
      } catch (error) {
        // Same reasoning as addPlace: the plan limit is the case that matters and
        // there is nowhere inline on a map to put a sentence about it. Named,
        // because "Location limit reached" over a circle you just drew is a
        // heading about the wrong thing.
        toastPlanLimit(error, "Shape");
      }
    },
    [createShapeMutate, readShapes, selectShape, setMode],
  );

  /**
   * A handle has been released.
   *
   * Only the geometry is sent. A PATCH carrying the whole shape would race the
   * rename in the edit dialog — see lib/query/shape-cache.ts, which is what makes
   * the two writes commute.
   */
  const moveShape = useCallback(
    (shapeId: string, geometry: ShapeGeometry) => {
      updateShapeMutate({ shapeId, input: { geometry } });
    },
    [updateShapeMutate],
  );

  /** Picking a shape in the sidebar flies to it, as picking a location does. */
  const focusShape = useCallback(
    (shapeId: string) => {
      selectShape(shapeId);

      const shape = shapes.find((candidate) => candidate.id === shapeId);
      if (!shape) return;

      const bounds = shapeBounds(shape.geometry);
      if (bounds) mapHandle.current?.fitBounds(bounds);
    },
    [shapes, selectShape],
  );

  /**
   * Clicking a group's row: light up everything in it and frame the lot.
   *
   * The two halves answer different questions, which is why it does both. The
   * highlight says *which* objects are in this group — on the map, where the
   * sidebar's list of names cannot help. Framing them says *where*.
   */
  const focusGroup = useCallback(
    (groupId: string) => {
      const members = membersOf({ id: groupId }, places, shapes);

      setSelection({
        placeIds: members.places.map((place) => place.id),
        shapeIds: members.shapes.map((shape) => shape.id),
      });

      const bounds = selectionBounds({
        points: members.places,
        geometries: members.shapes.map((shape) => shape.geometry),
      });

      if (bounds) mapHandle.current?.fitBounds(bounds);
    },
    [places, shapes, setSelection],
  );

  const createGroupMutate = createGroup.mutateAsync;

  /**
   * True from the moment a group is asked for to the moment it holds anything.
   *
   * The sidebar hides empty groups while it is set — see GroupList. Local state
   * rather than `createGroup.isPending`, because the gap that matters runs past
   * the create and through the member PATCHes behind it.
   */
  const [isGrouping, setIsGrouping] = useState(false);

  /**
   * How many membership PATCHes are in the air.
   *
   * Separate from `isGrouping`, which is doing a different job — it hides empty
   * groups for the length of a create-then-fill, and reusing it here would make a
   * group vanish the instant its last member was taken out, with no animation and
   * before the write that emptied it had landed.
   *
   * This one exists only to hold the sweep below. Membership is optimistic, so a
   * group reads as empty from the moment the drag ends; deleting it right then
   * would strand the member if its PATCH failed, and would also yank the group
   * off screen while its rows were still travelling out of it.
   */
  const [membershipWrites, setMembershipWrites] = useState(0);

  /**
   * Every membership write, wrapped so the sweep waits for it.
   *
   * Wrapping here rather than inside `useAssignToGroup` because the mutation is
   * shared with paths that do their own book-keeping (`groupTogether` holds
   * `isGrouping` across a create *and* the PATCHes behind it), and a counter
   * buried in the hook would double-count them.
   */
  const assignMembers = useCallback(
    async (members: GroupMembers, groupId: string) => {
      setMembershipWrites((count) => count + 1);

      try {
        await assignToGroup(members, groupId);
      } finally {
        setMembershipWrites((count) => count - 1);
      }
    },
    [assignToGroup],
  );

  /*
   * Every path that empties a group ends here.
   *
   * Paused while one is being made, because a group is created and *then* filled
   * — for that third of a second it is legitimately empty, and without the pause
   * this would delete every group at the moment of its creation. And paused while
   * any membership write is out, for the reason `membershipWrites` gives.
   */
  usePruneEmptyGroups({
    mapId: map.id,
    groups,
    places,
    shapes,
    isPaused: isGrouping || membershipWrites > 0,
  });

  /**
   * Make a group and put things in it.
   *
   * Two writes, in order, because the members need an id to point at: the group
   * is created first, and only the real id from the reply is assigned. The
   * optimistic `temp-` id exists so the create feels immediate, but writing it
   * onto forty locations would leave forty rows naming a group that never
   * existed once the reply landed.
   */
  const groupTogether = useCallback(
    async (members: { placeIds: string[]; shapeIds: string[] }) => {
      if (members.placeIds.length + members.shapeIds.length === 0) return;

      setIsGrouping(true);

      try {
        // Read through the cache, not the render's array — two groups made in
        // quick succession would otherwise both read the same list and both land
        // as "Group 1". Same reason the shapes and pins read their defaults here.
        const created = await createGroupMutate(nextGroupDefaults(readGroups()));

        await assignToGroup(members, created.id);
      } catch (error) {
        toastPlanLimit(error, "Group");
      } finally {
        setIsGrouping(false);
      }
    },
    [assignToGroup, createGroupMutate, readGroups],
  );

  /**
   * What the selection can be turned into — and whether the bar offers anything.
   *
   * Derived rather than decided in the handler, because the button's label has to
   * come from the same answer that the press acts on. See `groupAction` for the
   * four cases; the one that matters is "exactly one group", which is what
   * clicking a group's row produces and where there is nothing to do.
   */
  const action = useMemo(
    () => groupAction(selection, groups, places, shapes),
    [selection, groups, places, shapes],
  );

  /** The Group/Merge button under a marquee. */
  const groupSelection = useCallback(async () => {
    if (!action.kind) return;

    if (action.targetGroupId) {
      /*
       * Into a group that already exists, so it keeps its name and its colour.
       *
       * The groups this empties are not deleted here — `usePruneEmptyGroups`
       * sweeps them, along with every other way a group ends up empty. Held busy
       * for the length of the writes so the sweep waits for them to settle: a
       * source group is optimistically empty the instant its last member is
       * PATCHed, and deleting it before that PATCH lands would strand the member
       * if the PATCH then failed.
       */
      setIsGrouping(true);

      try {
        await assignToGroup(action.members, action.targetGroupId);
      } finally {
        setIsGrouping(false);
      }
    } else {
      await groupTogether(action.members);
    }

    clearSelection();
    setMode("browse");
  }, [action, assignToGroup, clearSelection, groupTogether, setMode]);

  /**
   * One row dropped on another loose row: a new group holding both.
   *
   * The target is passed as an object rather than looked up, because it is the
   * row that received the drop and the sidebar already knows which one that was.
   */
  const groupObjects = useCallback(
    (target: DraggedObject, dragged: DraggedObject) => {
      const members = { placeIds: [] as string[], shapeIds: [] as string[] };

      for (const object of [target, dragged]) {
        if (object.type === "place") {
          members.placeIds.push(object.id);
        } else {
          members.shapeIds.push(object.id);
        }
      }

      void groupTogether(members);
    },
    [groupTogether],
  );

  /** One row dropped on something already in a group: join that group. */
  const addToGroup = useCallback(
    (groupId: string, dragged: DraggedObject) => {
      if (!groupId) return;

      void assignMembers(asMembers(dragged), groupId);
    },
    [assignMembers],
  );

  /**
   * One object out of whatever group it is in.
   *
   * `""` is how a member says "no group" — see group.schema.ts. Both ways of
   * asking for it end up here: the row menu's "Remove from group", and dropping
   * the row on the strip under the panel.
   */
  const removeFromGroup = useCallback(
    (object: DraggedObject) => {
      void assignMembers(asMembers(object), "");
    },
    [assignMembers],
  );

  /**
   * One group dropped on another.
   *
   * A merge is not its own operation: it is every member of the source being
   * assigned to the target, after which the source is a group with nothing in it
   * and `usePruneEmptyGroups` deletes it. So there is no endpoint for this, no
   * repository method, and nothing that could leave a half-merged pair behind —
   * the failure mode of a partial write is some members moved and a group that
   * still exists, which is a state the panel can already draw.
   *
   * The *target* survives, keeping its name and colour. That is what dropping
   * onto something means everywhere else in this panel, and it is what the Merge
   * button under a marquee does with the first group in sidebar order.
   *
   * Held busy for the length of the writes, like every other path that empties a
   * group: the source reads as empty the instant its first member is optimistically
   * PATCHed, and sweeping it then would strand the rest if the writes failed.
   */
  const mergeGroups = useCallback(
    async (targetGroupId: string, sourceGroupId: string) => {
      if (!targetGroupId || targetGroupId === sourceGroupId) return;

      // Neither end can be a row that exists only in the cache: the server has
      // never heard of a `temp-` id, and it is about to be replaced by a real one.
      if (isOptimisticGroupId(targetGroupId) || isOptimisticGroupId(sourceGroupId)) {
        return;
      }

      const members = membersOf({ id: sourceGroupId }, places, shapes);
      if (members.places.length + members.shapes.length === 0) return;

      setIsGrouping(true);

      try {
        await assignMembers(
          {
            placeIds: members.places.map((place) => place.id),
            shapeIds: members.shapes.map((shape) => shape.id),
          },
          targetGroupId,
        );
      } finally {
        setIsGrouping(false);
      }
    },
    [assignMembers, places, shapes],
  );

  // Escape leaves add mode — the toolbar toggle stays sticky so several pins can
  // be dropped in a row.
  useEffect(() => {
    if (!isAdding) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMode("browse");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdding, setMode]);

  /*
   * Escape drops a selection.
   *
   * `useSelectBox` already handles Escape *during* a drag; this is the one after
   * it, when there is a selection sitting there and the user wants out. Bound
   * while there is something selected rather than while the tool is armed,
   * because clicking a group's row makes a selection with no tool involved.
   */
  useEffect(() => {
    if (selectionSize(selection) === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      clearSelection();
      setMode("browse");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selection, clearSelection, setMode]);

  const [isDraggingPin, setIsDraggingPin] = useState(false);

  /**
   * A pin dragged off the toolbar and let go.
   *
   * The toolbar reports where the pointer was; what is underneath it is the map's
   * question to answer, and `null` is a real answer — a pin dropped on the
   * locations panel or off the edge of the frame was not dropped on the map, and
   * quietly placing it at the nearest coordinate would be inventing an intent.
   */
  const dropPin = useCallback(
    (clientX: number, clientY: number, icon: string) => {
      const coords = mapHandle.current?.pointToLngLat(clientX, clientY);
      if (coords) void addPlace(coords, undefined, icon);
    },
    [addPlace],
  );

  /**
   * Picking a location in the Locations panel flies the camera to it.
   *
   * Only from the panel. Clicking a pin selects the same place and deliberately
   * does *not* move the map: the pin is already under the cursor, and pulling the
   * ground out from under a click is how a map stops feeling direct. Keeping the
   * two paths separate here is what makes that distinction possible at all —
   * `selectedPlaceId` alone cannot say where the selection came from.
   */
  const focusPlace = useCallback(
    (placeId: string) => {
      selectPlace(placeId);

      const place = places.find((candidate) => candidate.id === placeId);
      if (place) mapHandle.current?.flyTo(place);
    },
    [places, selectPlace],
  );

  const [savedViewAt, setSavedViewAt] = useState<number | null>(null);

  /**
   * The confirmation is a reply, not a status: it used to be set on the first
   * save and never cleared, so "View saved" sat on the map for the rest of the
   * session and stopped meaning anything. Keyed on the timestamp so saving twice
   * restarts the timer rather than being swallowed by the first one.
   */
  useEffect(() => {
    if (savedViewAt === null) return;

    const timer = setTimeout(() => setSavedViewAt(null), 2500);
    return () => clearTimeout(timer);
  }, [savedViewAt]);

  const saveCurrentView = async () => {
    const viewport = mapHandle.current?.getViewport();
    if (!viewport) return;

    await updateMap.mutateAsync({
      defaultLat: roundCoord(viewport.lat),
      defaultLng: roundCoord(viewport.lng),
      // Appwrite's column is bounded 0–24 and MapLibre reports fractional zoom.
      defaultZoom: Math.round(viewport.zoom * 100) / 100,
    });

    setSavedViewAt(Date.now());
  };

  const editingPlace = places.find((place) => place.id === editingId) ?? null;
  const editingShape =
    shapes.find((shape) => shape.id === editingShapeId) ?? null;
  const editingGroup =
    groups.find((group) => group.id === editingGroupId) ?? null;

  return (
    /*
     * `lg`, not `md`: with a 240px nav sidebar and a 320px locations panel, a
     * 768px viewport would leave the map about 200px wide. It stacks until there
     * is genuinely room for both.
     *
     * **`lg:h-[...]` is a definite height, and that is the whole point.** Every
     * other step from `<body>` down to the locations list is `min-h-*` or
     * `flex-1` — a floor or a ratio, never a ceiling — and a percentage
     * flex-basis against an indefinite parent resolves to `content`. So the
     * panel's `overflow-y: auto` sat on a box that always grew to fit, adding a
     * location scrolled the *page*, and the map got taller with it. One real
     * height here gives everything below something to divide up.
     *
     * **`lg:flex-none` is what makes that height apply at all**, and its absence
     * fails silently. This row is a flex item of `Container`, which is a column,
     * so its height *is* its main size — and `flex-1` sets `flex-basis: 0%`,
     * which beats `height` on the main axis. With both, the height is simply
     * ignored and everything above grows exactly as it did before. `flex-none`
     * restores `flex-basis: auto`, and below `lg` the row goes back to `flex-1`
     * because there it stacks and has nothing to fill.
     *
     * `100dvh - 3rem` is exact rather than approximate: 3rem is `Container`'s
     * own `py-6` top and bottom, and at `lg` there is nothing else above this —
     * `MobileHeader` is `md:hidden` and `PageTitle` is `sr-only`, which is
     * absolutely positioned and contributes no height. dvh, not vh, so mobile
     * browser chrome doesn't push the bottom of the panel out of reach.
     */
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:h-[calc(100dvh-3rem)] lg:flex-none lg:flex-row">
      {/*
       * A framed panel rather than a slab bled to the window edges. dvh, not vh:
       * mobile browser chrome would clip the canvas otherwise.
       */}
      <div className="relative h-[55dvh] min-h-64 w-full overflow-hidden rounded-xl border border-border lg:h-auto lg:min-h-0 lg:flex-1">
        <MapToolbar
          isAdding={isAdding}
          addIcon={addIcon}
          recentIcons={recentIcons}
          pinIcons={map.pinIcons}
          isBusy={createPlace.isPending}
          isDrawingBusy={createShape.isPending}
          drawMode={drawMode}
          isSelecting={isSelecting}
          isSavingView={updateMap.isPending}
          hasSavedView={savedViewAt !== null}
          style={map.style}
          appearance={appearance}
          search={
            <MapSearch
              mapId={map.id}
              onPick={(candidate) => mapHandle.current?.flyTo(candidate)}
              onAdd={(candidate) => {
                // The whole match, so this pin skips the reverse lookup it would
                // otherwise make to learn what we already know — and keeps the
                // postcode and landmark the search already told us.
                void addPlace(candidate, candidate);
                mapHandle.current?.flyTo(candidate);
              }}
            />
          }
          onPickIcon={startAdding}
          onStopAdding={() => setMode("browse")}
          onPickTool={startDrawing}
          onStopDrawing={() => setMode("browse")}
          onStartSelecting={startSelecting}
          onStopSelecting={() => setMode("browse")}
          onDropPin={dropPin}
          onDraggingChange={setIsDraggingPin}
          onOpenStudio={() => setIsStudioOpen(true)}
          onSaveView={() => void saveCurrentView()}
          onPreview={() => setIsPreviewOpen(true)}
          onChangeStyle={(style) => updateMap.mutate({ style })}
          onChangeAppearance={(next) => updateMap.mutate({ appearance: next })}
        />

        {/* One bar, five instructions: a pin already in the air needs a different
            sentence from an armed click-to-place mode, and each drawing tool is a
            different gesture again. Dragging wins over everything, because it is
            the thing happening right now.

            It stands down once there is a selection to act on — the hint and the
            selection bar occupy the same strip, and the bar is the more urgent
            of the two because it is about something that already happened. */}
        <MapHintBar
          isVisible={
            (isAdding || isDraggingPin || drawMode !== null || isSelecting) &&
            selectionSize(selection) === 0
          }
          message={
            isDraggingPin
              ? "Drop the pin where the location is."
              : drawMode === "circle"
                ? "Drag out from the centre to draw a circle. Press Esc to stop."
                : drawMode === "polygon"
                  ? "Click each corner. Click the first point or press Enter to finish, Esc to stop."
                  : isSelecting
                    ? "Drag a box around the locations and shapes you want. Press Esc to stop."
                    : undefined
          }
        />

        <SelectionBar
          count={selectionSize(selection)}
          actionLabel={groupActionLabel(action)}
          // The whole gesture, not just the create: the members are still being
          // assigned after that returns, and the button should stay busy until
          // there is a full group to show for it.
          isBusy={isGrouping}
          onGroup={() => void groupSelection()}
          onClear={clearSelection}
        />

        <MapCanvas
          center={{ lng: map.defaultLng, lat: map.defaultLat }}
          zoom={map.defaultZoom}
          style={map.style}
          appearance={map.appearance}
          places={places}
          selectedPlaceId={selectedPlaceId}
          isAdding={isAdding}
          colorFor={colorFor}
          pinIcons={map.pinIcons}
          categoryFor={categoryFor}
          showPlaceCard
          onSelectPlace={selectPlace}
          onEditPlace={setEditingId}
          // Sticky add mode keeps the icon it was armed with, so dropping forty
          // cafés is one choice and forty clicks, not forty choices.
          onMapClick={(coords) => void addPlace(coords, undefined, addIcon)}
          onMovePlace={movePlace}
          onReady={handleReady}
          shapes={{
            shapes,
            selectedShapeId,
            drawMode,
            colorFor: shapeColorFor,
            onSelectShape: selectShape,
            onEditShape: setEditingShapeId,
            onCreateShape: (geometry) => void addShape(geometry),
            onUpdateShape: moveShape,
            onStopDrawing: () => setMode("browse"),
          }}
          selection={{
            selected: selection,
            isSelecting,
            onSelect: setSelection,
            onStopSelecting: () => setMode("browse"),
          }}
        />
      </div>

      <EditorSidebar
        mapId={map.id}
        places={places}
        shapes={shapes}
        groups={groups}
        categoriesById={categoriesById}
        pinIcons={map.pinIcons}
        placeLimit={placeLimit}
        selectedPlaceId={selectedPlaceId}
        selectedShapeId={selectedShapeId}
        selectedPlaceIds={selectedPlaceIds}
        selectedShapeIds={selectedShapeIds}
        isGrouping={isGrouping}
        onSelectShape={focusShape}
        onEditShape={(shapeId) => {
          focusShape(shapeId);
          setEditingShapeId(shapeId);
        }}
        onFocusGroup={focusGroup}
        onEditGroup={setEditingGroupId}
        onGroupObjects={groupObjects}
        onAddToGroup={addToGroup}
        onMergeGroups={(targetGroupId, sourceGroupId) => {
          void mergeGroups(targetGroupId, sourceGroupId);
        }}
        onRemoveFromGroup={removeFromGroup}
        pendingAddressIds={pendingAddressIds}
        failedAddressIds={failedAddressIds}
        onRetryAddress={retryAddress}
        /* The plan limit is the toast's now. Saying it here as well would put the
           same sentence in two places at once, which is the thing publish-action
           declines to do. Every other create failure still lands in the panel. */
        error={isPlanLimit(createPlace.error) ? null : createPlace.error}
        onSelect={focusPlace}
        onEdit={(placeId) => {
          focusPlace(placeId);
          setEditingId(placeId);
        }}
      />

      <PlaceEditDialog
        map={map}
        place={editingPlace}
        onClose={() => setEditingId(null)}
      />

      <ShapeEditDialog
        mapId={map.id}
        shape={editingShape}
        onClose={() => setEditingShapeId(null)}
      />

      <GroupEditDialog
        mapId={map.id}
        group={editingGroup}
        onClose={() => setEditingGroupId(null)}
      />

      <PinStudio
        map={map}
        places={places}
        isOpen={isStudioOpen}
        onOpenChange={setIsStudioOpen}
        // Finishing a pin in the studio arms add mode with it, exactly as
        // pressing a tile in the row does — so the sheet closes onto a map that
        // is ready to be clicked.
        onPick={startAdding}
      />

      <PreviewDialog
        map={map}
        places={places}
        shapes={shapes}
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </div>
  );
}

/**
 * One dragged object, as the pair of id lists every membership write takes.
 *
 * A group is not a member of anything, so it has none — and returning empty
 * rather than throwing is deliberate: `assignMembers` already declines a write
 * with nothing in it, and every caller that could hand this a group has resolved
 * the drop to a merge long before reaching here.
 */
function asMembers(object: DraggedObject): GroupMembers {
  if (object.type === "group") return { placeIds: [], shapeIds: [] };

  return object.type === "place"
    ? { placeIds: [object.id], shapeIds: [] }
    : { placeIds: [], shapeIds: [object.id] };
}
