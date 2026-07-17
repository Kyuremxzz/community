"use client";

/**
 * /perfil/[id] — perfil público: cabeçalho (avatar + selo de assinante),
 * squads (mesmo padrão visual de /meus-squads) e posts (via
 * `useCommunityFeed({ authorId })`, já com curtir/repostar de verdade).
 * Leitura pública — sem redirect pra /entrar.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Skeleton, Stamp, useToast } from "@/components/ui";
import { Avatar, PostCard } from "@/components/community";
import { SlotMeter } from "@/components/ascii";
import { StatusStamp } from "@/components/Stamps";
import { fmtDate, fmtRemaining } from "@/components/format";
import { useCommunityFeed } from "@/hooks/useCommunityFeed";
import { usePostActions } from "@/hooks/usePostActions";
import { useUser } from "@/components/UserContext";
import { api, errorMessage, errorStatus } from "@/lib/api-client";
import type { PublicProfile, Squad, SquadWithProjectResponse } from "@/lib/types";
import styles from "./page.module.css";

function squadInfo(s: Squad): string {
  if (s.status === "active") return `⏱ ${fmtRemaining(s.deadlineEndsAt ?? 0)}`;
  if (s.status === "delivered") return `✔ entregue em ${fmtDate(s.deliveredAt ?? 0)}`;
  return `${s.slotsFilled}/${s.slotsTotal} vagas — formando`;
}

export default function PerfilPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = raw ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isInteger(id) || id <= 0) {
    return <NotFound />;
  }

  return <ProfileDetail id={id} />;
}

function NotFound() {
  return (
    <div className="page-enter stack">
      <Card className="stack-sm">
        <p role="alert">Usuário não encontrado.</p>
        <div>
          <Link href="/comunidade" className="btn btn--ghost btn--sm">
            ← Comunidade
          </Link>
        </div>
      </Card>
    </div>
  );
}

function ProfileDetail({ id }: { id: number }) {
  const { user } = useUser();
  const { toast } = useToast();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [squads, setSquads] = useState<SquadWithProjectResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    try {
      const r = await api.userProfile(id);
      setProfile(r.profile);
      setSquads(r.squads);
    } catch (err) {
      if (errorStatus(err) === 404) setNotFound(true);
      else setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const feed = useCommunityFeed({ authorId: id });
  const actions = usePostActions(feed.applyPostPatch);

  function requireLogin(): boolean {
    if (user) return true;
    toast("Entre para curtir e repostar na comunidade.");
    return false;
  }

  if (notFound) return <NotFound />;

  if (error) {
    return (
      <div className="page-enter stack">
        <Card className="stack-sm">
          <p role="alert">{error}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => void load()}>
              Tentar de novo
            </Button>
            <Link href="/comunidade" className="btn btn--ghost btn--sm">
              ← Comunidade
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!profile || !squads) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="text" lines={2} />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );
  }

  return (
    <div className="page-enter stack-lg">
      <header className={styles.head}>
        <Avatar name={profile.name} size="lg" />
        <div className="stack-sm">
          <h1 className={styles.name}>
            {profile.name}
            {profile.subscribed && (
              <Stamp tone="gold" tilt="right">
                ★ assinante
              </Stamp>
            )}
          </h1>
        </div>
      </header>

      <section className="stack" aria-label="Squads">
        <h2 className="prompt">Squads</h2>
        {squads.length === 0 ? (
          <p className={styles.emptyText}>Ainda não entrou em nenhum squad.</p>
        ) : (
          squads.map(({ squad: s, project: p }) => (
            <Card key={s.id} className="stack-sm">
              <h3 className={styles.rowTitle}>
                {p.title} · {s.name} <StatusStamp squad={s} />
              </h3>
              <SlotMeter
                filled={s.slotsFilled}
                total={s.slotsTotal}
                roles={s.slots.map((x) => x.role)}
                className={styles.meter}
              />
              <p className={styles.info}>{squadInfo(s)}</p>
              <div>
                <Link href={`/squads/${s.id}`} className="btn btn--secondary btn--sm">
                  Abrir squad
                </Link>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="stack-lg" aria-label="Posts">
        <h2 className="prompt">Posts</h2>

        {feed.error ? (
          <Card className="stack-sm">
            <p role="alert">{feed.error}</p>
            <div>
              <Button variant="secondary" onClick={feed.refresh}>
                Tentar de novo
              </Button>
            </div>
          </Card>
        ) : feed.posts === null ? (
          <div className="stack-lg" aria-busy="true">
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
        ) : feed.posts.length === 0 ? (
          <p className={styles.emptyText}>Ainda não publicou nada na comunidade.</p>
        ) : (
          <>
            <div className="stack-lg">
              {feed.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  authorHref={`/perfil/${post.author.id}`}
                  projectHref={post.projectId ? `/projetos/${post.projectId}` : undefined}
                  getAuthorHref={(authorId) => `/perfil/${authorId}`}
                  getProjectHref={(projectId) => `/projetos/${projectId}`}
                  commentsHref={`/comunidade/${post.id}`}
                  onLike={() => {
                    if (requireLogin()) return actions.like(post);
                  }}
                  onRepost={() => {
                    if (requireLogin()) return actions.repost(post);
                  }}
                />
              ))}
            </div>

            {feed.hasMore && (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  loading={feed.loadingMore}
                  disabled={feed.loadingMore}
                  onClick={feed.loadMore}
                >
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
