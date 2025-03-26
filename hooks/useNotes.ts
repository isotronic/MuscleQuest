import { fetchNote, saveNote } from "@/utils/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NoteType = "exercise" | "workout_exercise" | "workout" | "plan";

export const useNotes = (
  noteType: NoteType,
  referenceId: number,
  secondaryReferenceId?: number,
) => {
  const queryClient = useQueryClient();

  const queryKey = ["note", noteType, referenceId, secondaryReferenceId];

  const {
    data: note = "",
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchNote(referenceId, secondaryReferenceId ?? null, noteType),
    staleTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: (newNote: string) =>
      saveNote(referenceId, secondaryReferenceId ?? null, newNote, noteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    note,
    isLoading,
    isError,
    saveNote: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
};
