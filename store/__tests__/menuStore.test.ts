import { act } from "@testing-library/react-native";
import { useMenuStore } from "../menuStore";

describe("useMenuStore", () => {
  beforeEach(() => {
    useMenuStore.setState({ isMenuOpen: false });
  });

  it("initial state: isMenuOpen is false", () => {
    expect(useMenuStore.getState().isMenuOpen).toBe(false);
  });

  it("openMenu sets isMenuOpen to true", () => {
    act(() => {
      useMenuStore.getState().openMenu();
    });
    expect(useMenuStore.getState().isMenuOpen).toBe(true);
  });

  it("closeMenu sets isMenuOpen to false", () => {
    act(() => {
      useMenuStore.setState({ isMenuOpen: true });
      useMenuStore.getState().closeMenu();
    });
    expect(useMenuStore.getState().isMenuOpen).toBe(false);
  });

  it("openMenu then closeMenu returns to closed", () => {
    act(() => {
      useMenuStore.getState().openMenu();
      useMenuStore.getState().closeMenu();
    });
    expect(useMenuStore.getState().isMenuOpen).toBe(false);
  });
});
