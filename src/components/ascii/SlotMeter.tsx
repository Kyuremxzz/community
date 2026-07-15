/* ==========================================================================
   SlotMeter — fichas ASCII das vagas do squad. Server component estático
   (sem animação, sem "use client"): renderiza slotMeter() da engine com
   aria-label descritivo ("3 de 4 vagas ocupadas").
   ========================================================================== */

import { slotMeter } from '@/lib/ascii-engine';

export interface SlotMeterProps {
  /** Vagas ocupadas. */
  filled: number;
  /** Total de vagas. */
  total: number;
  /** Nome do papel de cada vaga, na ordem das fichas. */
  roles: string[];
  className?: string;
}

export function SlotMeter({ filled, total, roles, className }: SlotMeterProps) {
  const ocupadas = Math.max(0, Math.min(filled, total));
  return (
    <pre
      className={className}
      role="img"
      aria-label={`${ocupadas} de ${total} vagas ocupadas`}
    >
      {slotMeter(filled, total, roles)}
    </pre>
  );
}
