import { useEffect, useRef } from 'react';

/** Calls `onFile` when a file is dropped anywhere on the page (IOX-010). */
export function useFileDrop(onFile: (file: File) => void, enabled = true) {
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  });
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) {
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };
    const onDrop = (event: DragEvent) => {
      const file = event.dataTransfer?.files[0];
      if (file) {
        event.preventDefault();
        onFileRef.current(file);
      }
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [enabled]);
}
