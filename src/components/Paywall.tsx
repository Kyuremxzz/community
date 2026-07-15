"use client";

/**
 * Paywall (assinatura simulada) + fluxo de ocupar vaga.
 *
 * - <Paywall>: modal "Fim do projeto grátis!" com o Chico Caneca triste.
 *   Assinar → POST /api/me/subscribe → atualiza o usuário e retoma a ação
 *   pendente (mesma lógica do `pendingJoinSlot` do legado).
 * - useJoinSlot(): hook com toda a jornada de POST /api/slots/:id/join —
 *   402 abre o paywall e re-tenta após assinar; 401 manda para /entrar;
 *   sucesso mostra o toast certo e navega (ou recarrega, via `onJoined`).
 */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal, TerminalWindow, useToast } from "@/components/ui";
import { Mascot } from "@/components/ascii";
import { api, errorMessage, errorStatus } from "@/lib/api-client";
import type { Squad } from "@/lib/types";
import { useUser } from "./UserContext";
import styles from "./paywall.module.css";

export interface PaywallProps {
  open: boolean;
  onClose: () => void;
  /** Chamado após assinar com sucesso (retomar o join pendente etc.). */
  onSubscribed?: () => void | Promise<void>;
}

export default function Paywall({ open, onClose, onSubscribed }: PaywallProps) {
  const { toast } = useToast();
  const { setUser } = useUser();
  const [subscribing, setSubscribing] = useState(false);

  async function subscribe() {
    setSubscribing(true);
    try {
      const r = await api.subscribe();
      setUser(r.user);
      onClose();
      toast("★ Assinatura ativada! Bem-vindo ao clube.", "gold");
      await onSubscribed?.();
    } catch (err) {
      toast("Erro: " + errorMessage(err));
    } finally {
      setSubscribing(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Fim do projeto grátis!">
      <div className={styles.split}>
        <TerminalWindow tone="amber" title="chico@taskforge — triste">
          <Mascot mood="sad" />
        </TerminalWindow>
        <div className={styles.copy}>
          <p>
            Seu primeiro projeto foi por conta da casa. Para continuar entrando
            em novos projetos — quantos quiser — assine o TaskForge.
          </p>
          <p className={styles.price}>R$ 19/mês · cancele quando quiser</p>
          <p className={styles.fine}>
            (pagamento simulado neste protótipo — nenhuma cobrança real)
          </p>
          <div>
            <Button loading={subscribing} onClick={subscribe}>
              Assinar agora
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export interface JoinSlotFlow {
  /** Tenta ocupar a vaga (trata 401/402 e toasts). */
  joinSlot: (slotId: number) => Promise<void>;
  /** id da vaga em requisição (para o loading do botão certo). */
  joiningSlot: number | null;
  /** Renderize isto na tela: é o modal do paywall do fluxo. */
  paywall: ReactNode;
}

/**
 * @param onJoined se fornecido, é chamado no sucesso em vez da navegação
 * padrão para /squads/[id] (útil na própria tela do squad, que só recarrega).
 */
export function useJoinSlot(onJoined?: (squad: Squad) => void): JoinSlotFlow {
  const router = useRouter();
  const { toast } = useToast();
  const { user, setUser, refresh } = useUser();
  const [joiningSlot, setJoiningSlot] = useState<number | null>(null);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const joinSlot = useCallback(
    async (slotId: number) => {
      if (!user) {
        toast("Entre na sua conta para ocupar uma vaga.");
        router.push("/entrar");
        return;
      }
      setJoiningSlot(slotId);
      try {
        const r = await api.joinSlot(slotId);
        void refresh(); // badge do "1 projeto grátis" no topbar
        toast(
          r.deadlineStarted
            ? "⚑ SQUAD COMPLETO! O prazo começou a contar AGORA."
            : "Vaga ocupada! O prazo começa quando o squad fechar."
        );
        if (onJoined) onJoined(r.squad);
        else router.push(`/squads/${r.squad.id}`);
      } catch (err) {
        const status = errorStatus(err);
        if (status === 402) {
          setPendingSlot(slotId);
        } else if (status === 401) {
          toast("Sessão expirada — entre de novo.");
          setUser(null);
          router.push("/entrar");
        } else {
          toast("Erro: " + errorMessage(err));
        }
      } finally {
        setJoiningSlot(null);
      }
    },
    [user, router, toast, refresh, setUser, onJoined]
  );

  const paywall = (
    <Paywall
      open={pendingSlot != null}
      onClose={() => setPendingSlot(null)}
      onSubscribed={async () => {
        const slotId = pendingSlot;
        setPendingSlot(null);
        if (slotId != null) await joinSlot(slotId);
      }}
    />
  );

  return { joinSlot, joiningSlot, paywall };
}
