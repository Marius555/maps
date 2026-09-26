import type { EmbedLanguage } from "./types";

export const DE: EmbedLanguage = {
  id: "de",
  label: "Deutsch",
  strings: {
    searchLabel: "Standorte suchen",
    searchPlaceholder: "Standort oder Postleitzahl suchen",
    nearest: "In meiner Nähe",
    nearestStop: "Nicht mehr von hier messen",
    nearestFound: "{place} — {distance} entfernt",
    locating: "Standort wird ermittelt…",
    locationOff:
      "Die Standortfreigabe ist für diese Seite deaktiviert. Aktivieren Sie sie im Browser und versuchen Sie es erneut.",
    locationTimeout:
      "Ihr Standort konnte nicht rechtzeitig ermittelt werden. Bitte versuchen Sie es erneut.",
    locationUnsupported: "Dieser Browser kann keinen Standort teilen.",
    locationFailed: "Ihr Standort konnte nicht ermittelt werden.",
    locations: "Standorte",
    noMatch: "Keine passenden Standorte.",
    directions: "Route",
    email: "E-Mail",
    website: "Website",
    moreDetails: "Weitere Details",
    openNow: "Jetzt geöffnet",
    closedNow: "Jetzt geschlossen",
    closed: "Geschlossen",
    previousPhoto: "Vorheriges Foto",
    nextPhoto: "Nächstes Foto",
    dismiss: "Schließen",
  },
  badge: "Erstellt mit {brand}",
};
