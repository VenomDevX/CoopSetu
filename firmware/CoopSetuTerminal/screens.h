// Touch-navigable screen-stack architecture for the CoopSetu terminal.
//
// Replaces the flat enum State switch in CoopSetuTerminal.ino with a small
// stack of screens, each with its own enter/draw/touch/tick handlers. Back
// works uniformly via popScreen() rather than ad-hoc state resets.
//
// The stack depth is tiny (~4) because the device has no heap to spare and the
// UI never nests deeper than Home -> Menu -> Method -> Result.

#ifndef COOPSETU_SCREENS_H
#define COOPSETU_SCREENS_H

#include <Arduino.h>

enum ScreenId {
  SCR_HOME,
  SCR_ATTENDANCE_MENU,
  SCR_RFID,
  SCR_QR,
  SCR_FACE,
  SCR_CAMERA_PREVIEW,
  SCR_STATUS,
  SCR_SETTINGS,
  SCR_ADMIN_LOGIN,
  SCR_ADMIN_RFID_REGISTER,
  SCR_ADMIN_USER_LIST,
  SCR_RESULT,
  SCR_ARM,
  SCR_DEVICE_STATUS,  // diagnostics page opened from Home > Status
  SCR_COUNT
};

// Called exactly once when the screen becomes active. Draw the full layout
// (header, buttons, static labels) here — they don't need to be redrawn on
// every tick.
typedef void (*ScreenEnterFn)();

// Called from the main loop on every iteration while this screen is active.
// Only redraw regions that changed (e.g. status text, spinner position,
// countdown timer) — never clear-and-redraw the whole screen, because that
// causes visible flicker on the ILI9341.
typedef void (*ScreenTickFn)();

// Called when a touch event is dispatched. Coordinates are already mapped to
// screen space (0..W, 0..H). The handler should hit-test against its own
// buttons and act accordingly.
typedef void (*ScreenTouchFn)(int16_t x, int16_t y);

// Called when the screen is about to be deactivated (popScreen or
// replaceScreen). Clean up timers, cancel pending operations, etc.
typedef void (*ScreenExitFn)();

struct Screen {
  ScreenEnterFn onEnter;
  ScreenTickFn  onTick;
  ScreenTouchFn onTouch;
  ScreenExitFn  onExit;
};

// Call once from setup() after displayBegin().
void screensBegin();

// Push a screen onto the stack. Its onEnter is called immediately.
void pushScreen(ScreenId id);

// Pop the current screen. Its onExit is called, then the previous screen's
// onEnter is called to restore it. If the stack has only one screen, this is
// a no-op (can't pop Home).
void popScreen();

// Replace the current screen without growing the stack. Useful for
// transitions like RFID -> RESULT where Back should skip RFID and go to the
// menu, not back to the scan-waiting screen.
void replaceScreen(ScreenId id);

// The active screen at the top of the stack.
ScreenId currentScreen();
Screen*  activeScreen();

// Convenience: set a result that the result screen will display, then push
// or replace with SCR_RESULT. Auto-pops after RESULT_DWELL_MS or on tap.
void showResultScreen(bool ok, const char *title, const char *detail);

#endif  // COOPSETU_SCREENS_H
