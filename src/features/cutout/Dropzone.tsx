"use client";

// Zona donde soltar fotos (escritorio, screens.md 13.1: "También puedes
// soltarlas aquí."). Envuelve la página: solo reacciona a arrastres con
// archivos y pasa a `onFiles` las imágenes soltadas (las valida quien llama).
import { useRef, useState, type DragEvent, type ReactNode } from "react";

export type DropzoneProps = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  /** `dragging`: hay archivos encima (para resaltar la zona). */
  children: (dragging: boolean) => ReactNode;
  className?: string;
};

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

export function Dropzone({ onFiles, disabled = false, children, className }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave saltan en cada hijo: se cuentan para saber si sigue encima.
  const depth = useRef(0);

  return (
    <div
      className={className}
      onDragEnter={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (depth.current === 0) return;
        depth.current--;
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        if (disabled) return;
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      }}
    >
      {children(dragging)}
    </div>
  );
}
