import type { Accessor } from 'solid-js';
import { onCleanup, onMount } from 'solid-js';
import type { useCanvasLayers } from '../services/useCanvasLayers';

interface StickersProps {
  layerMaganer: Accessor<ReturnType<typeof useCanvasLayers>>;
}

export default function Stickers(props: StickersProps) {
  function init() {}
  function destroy() {}

  onMount(() => {
    init();
  });

  onCleanup(() => {
    destroy();
  });

  return (
    <div class="pe-stickers">
      stickers
    </div>
  );
}
