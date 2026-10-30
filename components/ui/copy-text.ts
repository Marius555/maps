import { toast } from "@heroui/react";

/**
 * Copy to the clipboard and say so. Clipboard access is refused over plain
 * http and in some embedded browsers; the text is on screen, so the warning
 * says to copy it by hand rather than pretending it worked.
 */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied", { description: what });
  } catch {
    toast.warning("Couldn't copy", { description: "Select it and copy it manually." });
  }
}
