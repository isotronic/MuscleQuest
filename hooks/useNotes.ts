import { deleteNote, fetchNote, saveNote } from "@/utils/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type NoteType = "exercise" | "workout_exercise" | "workout" | "plan";

export const useNotes = (noteType: NoteType, referenceId: number) => {
  const queryClient = useQueryClient();

  const queryKey = ["note", noteType, referenceId];

  const {
    data: note = "",
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchNote(referenceId, noteType),
    staleTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: (newNote: string) => saveNote(referenceId, newNote, noteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteNote(referenceId, noteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    note,
    isLoading,
    isError,
    saveNote: saveMutation.mutate,
    deleteNote: deleteMutation.mutate,
    isSaving: saveMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
