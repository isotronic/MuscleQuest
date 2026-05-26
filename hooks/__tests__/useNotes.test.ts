import { useNotes } from "../useNotes";
import { fetchNote, saveNote } from "@/utils/database";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

jest.mock("@/utils/database", () => ({
  fetchNote: jest.fn(),
  saveNote: jest.fn(),
}));
jest.mock("@bugsnag/expo", () => ({
  __esModule: true,
  default: { notify: jest.fn() },
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

const mockInvalidateQueries = jest.fn();

function setupMocks() {
  (useQueryClient as jest.Mock).mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  });
  (useQuery as jest.Mock).mockReturnValue({ data: null, isLoading: false });
  (useMutation as jest.Mock).mockReturnValue({ mutate: jest.fn() });
}

// ---------------------------------------------------------------------------
// useNotes — query side
// ---------------------------------------------------------------------------

describe("useNotes — query", () => {
  let capturedQueryArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedQueryArgs = args;
      return { data: null, isLoading: false };
    });
    useNotes("workout", 1);
  });

  it("uses queryKey [note, noteType, referenceId, secondaryReferenceId]", () => {
    expect(capturedQueryArgs.queryKey).toEqual([
      "note",
      "workout",
      1,
      undefined,
    ]);
  });

  it("queryKey includes secondaryReferenceId when provided", () => {
    jest.clearAllMocks();
    setupMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedQueryArgs = args;
      return { data: null };
    });
    useNotes("exercise", 5, 10);
    expect(capturedQueryArgs.queryKey).toEqual(["note", "exercise", 5, 10]);
  });

  it("queryFn calls fetchNote with correct args", async () => {
    (fetchNote as jest.Mock).mockResolvedValue("my note");
    await capturedQueryArgs.queryFn();
    expect(fetchNote).toHaveBeenCalledWith(1, null, "workout");
  });

  it("queryFn passes secondaryReferenceId when provided", async () => {
    jest.clearAllMocks();
    setupMocks();
    (useQuery as jest.Mock).mockImplementation((args: any) => {
      capturedQueryArgs = args;
      return { data: null };
    });
    useNotes("exercise", 5, 10);
    (fetchNote as jest.Mock).mockResolvedValue("note2");
    await capturedQueryArgs.queryFn();
    expect(fetchNote).toHaveBeenCalledWith(5, 10, "exercise");
  });

  it("sets staleTime to Infinity", () => {
    expect(capturedQueryArgs.staleTime).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// useNotes — mutation side
// ---------------------------------------------------------------------------

describe("useNotes — mutation", () => {
  let capturedMutationArgs: any;

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
    (useMutation as jest.Mock).mockImplementation((args: any) => {
      capturedMutationArgs = args;
      return { mutate: jest.fn() };
    });
    useNotes("workout", 7);
  });

  it("mutationFn calls saveNote with correct args", async () => {
    (saveNote as jest.Mock).mockResolvedValue(undefined);
    await capturedMutationArgs.mutationFn("new note text");
    expect(saveNote).toHaveBeenCalledWith(7, null, "new note text", "workout");
  });

  it("onSuccess invalidates the query key", () => {
    capturedMutationArgs.onSuccess();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({
      queryKey: ["note", "workout", 7, undefined],
    });
  });
});
