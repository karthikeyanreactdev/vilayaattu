import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import userReducer from "./slices/userSlice";
import settingsReducer from "./slices/settingsSlice";
import roomReducer from "./slices/roomSlice";
import gameReducer from "./slices/gameSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      user: userReducer,
      settings: settingsReducer,
      room: roomReducer,
      game: gameReducer,
    },
    middleware: (getDefault) =>
      getDefault({
        // Game views are plain JSON but can be large; skip the dev-only deep checks.
        serializableCheck: { ignoredPaths: ["game.view"] },
        immutableCheck: { ignoredPaths: ["game.view"] },
      }),
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
