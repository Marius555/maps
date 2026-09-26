import type { EmbedLanguage } from "./types";

export const ES: EmbedLanguage = {
  id: "es",
  label: "Español",
  strings: {
    searchLabel: "Buscar ubicaciones",
    searchPlaceholder: "Busca una ubicación o un código postal",
    nearest: "Cerca de mí",
    nearestStop: "Dejar de medir desde aquí",
    nearestFound: "{place} — a {distance}",
    locating: "Buscando tu ubicación…",
    locationOff:
      "La ubicación está desactivada para este sitio. Actívala en tu navegador e inténtalo de nuevo.",
    locationTimeout: "No pudimos encontrarte a tiempo. Inténtalo de nuevo.",
    locationUnsupported: "Este navegador no puede compartir la ubicación.",
    locationFailed: "No se pudo obtener tu ubicación.",
    locations: "Ubicaciones",
    noMatch: "Ninguna ubicación coincide.",
    directions: "Cómo llegar",
    email: "Correo",
    website: "Sitio web",
    moreDetails: "Más detalles",
    openNow: "Abierto ahora",
    closedNow: "Cerrado ahora",
    closed: "Cerrado",
    previousPhoto: "Foto anterior",
    nextPhoto: "Foto siguiente",
    dismiss: "Cerrar",
  },
  badge: "Hecho con {brand}",
};
