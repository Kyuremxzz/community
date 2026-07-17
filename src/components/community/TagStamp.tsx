/**
 * TagStamp — carimbo visual do tipo de post (projeto/dúvida/discussão/ajuda),
 * reaproveitando <Stamp> de components/ui. A tag de dúvida é intencionalmente
 * destacada (tom coral + prefixo "?") pra chamar atenção de quem pode ajudar.
 * Server-friendly: sem estado, sem "use client".
 */
import { Stamp } from "@/components/ui";
import type { PostType } from "@/lib/types";
import { POST_TYPE_META } from "./format";

export interface TagStampProps {
  type: PostType;
  className?: string;
}

export default function TagStamp({ type, className }: TagStampProps) {
  const meta = POST_TYPE_META[type];
  return (
    <Stamp tone={meta.tone} className={className}>
      {meta.label}
    </Stamp>
  );
}
