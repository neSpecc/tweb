Media Editor

- Implemented using Canvas.
- I have created a layers system for combining canvas and div-overlay layers.
- The Enhance and Draw tabs manipulate the canvas data directly, while Text and Stickers are added to a "DivLayer" to prevent them from accepting filters and to allow editing.
- "DivLayers" merge with the original canvas upon submission.
- OffscreenCanvas is used to preserve the original image quality and for performance reasons.
- Filters are implemented manually since CanvasRenderingContext2D.filter is not supported in Safari.
- Filters have limited strength to prevent users from creating excessive distortion
- Fonts are added only during Editor initialization and are not stored in the main CSS bundle.
- There is a CommandsManager for Undo/Redo. Each manipulation is a Command with "execute" and "undo" methods.
- I had to implement some components from scratch, such as the Stickers selector and SliderTabs, to stay within the contest timeline, as I couldn’t decouple them in a reasonable time.

It was a great experience. Thank you.

Sadly, I was not able to complete the remaining two tasks within the timeline.

