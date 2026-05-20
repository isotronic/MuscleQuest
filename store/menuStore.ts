import { create } from "zustand";

type MenuStore = {
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
};

export const useMenuStore = create<MenuStore>((set) => ({
  isMenuOpen: false,
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
}));
