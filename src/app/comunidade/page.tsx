"use client";

/**
 * /comunidade — feed principal da Comunidade (leitura pública, sem redirect
 * para /entrar). Filtros (busca/tag/ordenação) via `useCommunityFeed`;
 * curtir/repostar via `usePostActions`. Publicar exige login — sem sessão,
 * mostra um convite pra entrar no lugar do composer.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Skeleton, TerminalWindow, useToast } from "@/components/ui";
import { Mascot } from "@/components/ascii";
import {
  PostCard,
  PostComposer,
  SearchBar,
  SortToggle,
  TagFilter,
} from "@/components/community";
import type { PostComposerProject, PostSort } from "@/components/community";
import { useCommunityFeed } from "@/hooks/useCommunityFeed";
import { usePostActions } from "@/hooks/usePostActions";
import { useUser } from "@/components/UserContext";
import { api } from "@/lib/api-client";
import type { PostType } from "@/lib/types";
import styles from "./page.module.css";

export default function ComunidadePage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [type, setType] = useState<PostType | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<PostSort>("recent");
  const [projects, setProjects] = useState<PostComposerProject[]>([]);

  const feed = useCommunityFeed({ type: type ?? undefined, q: q || undefined, sort });
  const actions = usePostActions(feed.applyPostPatch);

  function requireLogin(): boolean {
    if (user) return true;
    toast("Entre para curtir e repostar na comunidade.");
    return false;
  }

  // Projetos do usuário pra marcar no composer — deduplicados por projeto
  // (um usuário pode ter squads em vários squads do mesmo projeto).
  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await api.mySquads();
        const seen = new Set<number>();
        const list: PostComposerProject[] = [];
        for (const { project } of r.squads) {
          if (seen.has(project.id)) continue;
          seen.add(project.id);
          list.push({ id: project.id, title: project.title });
        }
        if (!cancelled) setProjects(list);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleCreatePost(formData: FormData) {
    await api.createPost(formData);
    feed.refresh();
  }

  return (
    <div className="page-enter stack-lg">
      <header className="stack-sm">
        <h1 className="prompt">Comunidade</h1>
        <p>Squads mostrando no que estão trabalhando, tirando dúvidas e se ajudando.</p>
      </header>

      <div className={styles.filters}>
        <SearchBar onSearch={setQ} className={styles.search} />
        <TagFilter value={type} onChange={setType} />
        <SortToggle value={sort} onChange={setSort} />
      </div>

      {user ? (
        <PostComposer authorName={user.name} projects={projects} onSubmit={handleCreatePost} />
      ) : (
        <Card className="stack-sm">
          <p>Entre para publicar, curtir e comentar na comunidade.</p>
          <div>
            <Link href="/entrar" className="btn btn--primary btn--sm">
              Entrar
            </Link>
          </div>
        </Card>
      )}

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
          <Skeleton variant="card" />
        </div>
      ) : feed.posts.length === 0 ? (
        <div className={styles.empty}>
          <TerminalWindow tone="amber">
            <Mascot mood="idle" />
          </TerminalWindow>
          <div className="stack-sm">
            <h2>Nenhum post por aqui ainda</h2>
            <p>
              {type || q
                ? "Nada bateu com esse filtro — tente outra busca ou limpe os filtros."
                : "Seja a primeira pessoa a postar alguma coisa pra comunidade."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <section className="stack-lg" aria-label="Posts da comunidade">
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
          </section>

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

      {actions.error && (
        <p className={styles.actionError} role="alert">
          {actions.error}
        </p>
      )}
    </div>
  );
}
