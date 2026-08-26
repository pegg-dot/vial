import { z } from "zod";

// Shared so the editing route and its tests validate against the same shape. It lives outside the
// route file because a route module may only export request handlers and the Next route config
// fields, so the schema could not be imported from there.
export const savedSearchPatchSchema=z.object({id:z.string().trim().min(1),name:z.string().trim().min(2).max(80).optional(),alertMode:z.enum(["off","important","all"]).optional()}).refine(value=>value.name!==undefined||value.alertMode!==undefined,{message:"Provide a name or an alert mode to update"});
export type SavedSearchPatch=z.output<typeof savedSearchPatchSchema>;
