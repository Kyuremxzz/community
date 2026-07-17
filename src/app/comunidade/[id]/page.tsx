"use client";

/**
 * /comunidade/[id] — detalhe de um post: card completo + comentários em
 * árvore (raiz + respostas aninhadas). Leitura pública; comentar/curtir
 * exige login (convite pra entrar no lugar do formulário quando deslogado).
 */
import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Field, Skeleton, useToast } from "@/components/ui";
import { CommentItem, PostCard } from "@/components/community";
import { usePost } from "@/hooks/usePost";
import { usePostActions } from "@/hooks/usePostActions";
import { useComments } from "@/hooks/useComments";
import { useUser } from "@/components/UserContext";
import { errorMessage } from "@/lib/api-client";
import type { Comment } from "@/lib/types";
import styles from "./page.module.css";

function findComment(comments: Comment[], id: number): Comment | null {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies.length > 0) {
      const found = findComment(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}

export default function ComunidadePostPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = raw ? Number.parseInt(raw, 10) : NaN;

  if (!Number.isInteger(id) || id <= 0) {
    return (
      <div className="page-enter stack">
        <Card className="stack-sm">
          <p role="alert">Post não encontrado.</p>
          <div>
            <Link href="/comunidade" className="btn btn--ghost btn--sm">
              ← Comunidade
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <PostDetail id={id} />;
}

function PostDetail({ id }: { id: number }) {
  const { user } = useUser();
  const { toast } = useToast();
  const post = usePost(id);
  const actions = usePostActions(post.applyPostPatch);
  const comments = useComments(id);

  function requireLogin(): boolean {
    if (user) return true;
    toast("Entre para curtir na comunidade.");
    return false;
  }

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = commentBody.trim();
    if (!body) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      await comments.addComment(body);
      setCommentBody("");
    } catch (err) {
      setCommentError(errorMessage(err));
    } finally {
      setSubmittingComment(false);
    }
  }

  if (post.error) {
    return (
      <div className="page-enter stack">
        <Card className="stack-sm">
          <p role="alert">{post.error}</p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={post.refresh}>
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

  if (!post.post) {
    return (
      <div className="page-enter stack-lg" aria-busy="true">
        <Skeleton variant="card" />
        <Skeleton variant="text" lines={4} />
      </div>
    );
  }

  const p = post.post;

  return (
    <div className="page-enter stack-lg">
      <div>
        <Link href="/comunidade" className={styles.back}>
          ← Comunidade
        </Link>
      </div>

      <PostCard
        post={p}
        authorHref={`/perfil/${p.author.id}`}
        projectHref={p.projectId ? `/projetos/${p.projectId}` : undefined}
        getAuthorHref={(authorId) => `/perfil/${authorId}`}
        getProjectHref={(projectId) => `/projetos/${projectId}`}
        onLike={() => {
          if (requireLogin()) return actions.like(p);
        }}
        onRepost={() => {
          if (requireLogin()) return actions.repost(p);
        }}
      />

      <section className="stack-sm" aria-labelledby="comentarios-heading">
        <h2 id="comentarios-heading" className="prompt">
          Comentários
        </h2>

        {user ? (
          <form className={styles.commentForm} onSubmit={submitComment}>
            <Field
              as="textarea"
              label="Novo comentário"
              rows={3}
              placeholder="Escreva um comentário…"
              value={commentBody}
              maxLength={2000}
              onChange={(e) => setCommentBody(e.target.value)}
              error={commentError ?? undefined}
              required
            />
            <div>
              <Button
                type="submit"
                size="sm"
                loading={submittingComment}
                disabled={!commentBody.trim()}
              >
                Comentar
              </Button>
            </div>
          </form>
        ) : (
          <Card className="stack-sm">
            <p>Entre para comentar neste post.</p>
            <div>
              <Link href="/entrar" className="btn btn--primary btn--sm">
                Entrar
              </Link>
            </div>
          </Card>
        )}

        {comments.error && (
          <p className={styles.commentsError} role="alert">
            {comments.error}
          </p>
        )}

        {comments.comments === null ? (
          <Skeleton variant="text" lines={4} />
        ) : comments.comments.length === 0 ? (
          <p className={styles.emptyComments}>Nenhum comentário ainda — seja a primeira pessoa.</p>
        ) : (
          <ul className={styles.commentList}>
            {comments.comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                getAuthorHref={(authorId) => `/perfil/${authorId}`}
                onLike={(commentId) => {
                  if (!requireLogin()) return;
                  const target = comments.comments && findComment(comments.comments, commentId);
                  return target ? comments.likeComment(target) : undefined;
                }}
                onReply={
                  user ? (parentId, body) => comments.addComment(body, parentId) : undefined
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
