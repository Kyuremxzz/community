"use client";

/**
 * PostCard — card de post no feed da Comunidade. Puramente apresentacional:
 * recebe o `Post` já hidratado via props e delega toda ação de rede
 * (curtir/repostar/abrir comentários) pra quem monta a tela via callbacks.
 * Cada botão de ação tem seu próprio estado de loading — nunca trava o
 * card inteiro.
 */
import { useState } from "react";
import Link from "next/link";
import { Button, Card, cx } from "@/components/ui";
import type { Post, PostSummary } from "@/lib/types";
import Avatar from "./Avatar";
import TagStamp from "./TagStamp";
import { fmtRelativeDate, shortHost } from "./format";
import styles from "./PostCard.module.css";

/** Corpo mais longo que isso vira "ver mais" no feed. */
const TRUNCATE_AT = 320;

type PendingAction = "like" | "repost" | null;

export interface PostCardProps {
  post: Post;
  /** href do perfil do autor deste post (ex.: `/perfil/${post.author.id}`). */
  authorHref: string;
  /** href do projeto marcado, se `post.projectId` existir. */
  projectHref?: string;
  /** Resolve o href de perfil de qualquer autor — usado no mini-card do repost original. */
  getAuthorHref?: (authorId: number) => string;
  /** Resolve o href de projeto de qualquer post — usado no mini-card do repost original. */
  getProjectHref?: (projectId: number) => string;
  /** href para a tela de detalhe/comentários (renderiza o botão de comentar como link). */
  commentsHref?: string;
  onLike?: (postId: number) => Promise<void> | void;
  onRepost?: (postId: number) => Promise<void> | void;
  onOpenComments?: (postId: number) => void;
  className?: string;
}

export default function PostCard({
  post,
  authorHref,
  projectHref,
  getAuthorHref,
  getProjectHref,
  commentsHref,
  onLike,
  onRepost,
  onOpenComments,
  className,
}: PostCardProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [expanded, setExpanded] = useState(false);

  const isRepost = post.repostOf !== null;

  async function runAction(action: "like" | "repost", handler?: (id: number) => Promise<void> | void) {
    if (!handler || pending) return;
    setPending(action);
    try {
      await handler(post.id);
    } finally {
      setPending(null);
    }
  }

  const bodyIsLong = post.body.length > TRUNCATE_AT;
  const shownBody = expanded || !bodyIsLong ? post.body : `${post.body.slice(0, TRUNCATE_AT).trimEnd()}…`;

  return (
    <Card className={cx(styles.card, className)}>
      {isRepost && (
        <p className={styles.repostHeader}>
          🔁{" "}
          <Link href={authorHref}>{post.author.name}</Link> repostou
        </p>
      )}

      <div className={styles.head}>
        <Avatar name={post.author.name} size="md" />
        <div className={styles.headMeta}>
          <div className={styles.headTop}>
            <Link href={authorHref} className={styles.authorName}>
              {post.author.name}
            </Link>
            <span className={styles.date}>{fmtRelativeDate(post.createdAt)}</span>
            {!isRepost && <TagStamp type={post.type} />}
          </div>

          {isRepost ? (
            post.repostComment && <p className={styles.text}>{post.repostComment}</p>
          ) : (
            <div className={styles.body}>
              <h3 className={styles.title}>{post.title}</h3>
              <p className={styles.text}>{shownBody}</p>
              {bodyIsLong && (
                <button type="button" className={styles.moreBtn} onClick={() => setExpanded((v) => !v)}>
                  {expanded ? "ver menos" : "ver mais"}
                </button>
              )}
            </div>
          )}

          {!isRepost && post.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.imageUrl} alt={post.title} loading="lazy" className={styles.image} />
          )}

          {!isRepost && (post.linkUrl || post.projectTitle) && (
            <div className={styles.chipRow}>
              {post.linkUrl && (
                <a
                  href={post.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.chip}
                >
                  🔗 {shortHost(post.linkUrl)}
                </a>
              )}
              {post.projectTitle &&
                (projectHref ? (
                  <Link href={projectHref} className={styles.chip}>
                    📁 {post.projectTitle}
                  </Link>
                ) : (
                  <span className={styles.chip}>📁 {post.projectTitle}</span>
                ))}
            </div>
          )}

          {isRepost && post.repostOf && (
            <RepostEmbed post={post.repostOf} authorHref={getAuthorHref} projectHref={getProjectHref} />
          )}
        </div>
      </div>

      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          className={cx(styles.actionBtn, post.likedByMe && styles.actionBtnLiked)}
          loading={pending === "like"}
          aria-pressed={post.likedByMe}
          onClick={() => void runAction("like", onLike)}
        >
          {post.likedByMe ? "♥" : "♡"} {post.likeCount}
        </Button>

        {commentsHref ? (
          <Link
            href={commentsHref}
            className={cx("btn", "btn--ghost", "btn--sm", styles.actionBtn)}
            onClick={() => onOpenComments?.(post.id)}
          >
            💬 {post.commentCount}
          </Link>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className={styles.actionBtn}
            onClick={() => onOpenComments?.(post.id)}
          >
            💬 {post.commentCount}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className={cx(styles.actionBtn, post.repostedByMe && styles.actionBtnReposted)}
          loading={pending === "repost"}
          aria-pressed={post.repostedByMe}
          onClick={() => void runAction("repost", onRepost)}
        >
          🔁 {post.repostCount}
        </Button>
      </div>
    </Card>
  );
}

/** Mini-card não interativo do post original repostado (estilo "quote tweet"). */
function RepostEmbed({
  post,
  authorHref,
  projectHref,
}: {
  post: PostSummary;
  authorHref?: (authorId: number) => string;
  projectHref?: (projectId: number) => string;
}) {
  const href = authorHref?.(post.author.id);
  const bodyIsLong = post.body.length > TRUNCATE_AT;
  const body = bodyIsLong ? `${post.body.slice(0, TRUNCATE_AT).trimEnd()}…` : post.body;

  return (
    <div className={styles.embed}>
      <div className={styles.embedHead}>
        <Avatar name={post.author.name} size="sm" />
        {href ? (
          <Link href={href} className={styles.embedAuthor}>
            {post.author.name}
          </Link>
        ) : (
          <span className={styles.embedAuthor}>{post.author.name}</span>
        )}
        <span className={styles.embedDate}>{fmtRelativeDate(post.createdAt)}</span>
        <TagStamp type={post.type} />
      </div>
      <h4 className={styles.embedTitle}>{post.title}</h4>
      <p className={styles.embedText}>{body}</p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt={post.title} loading="lazy" className={styles.embedImage} />
      )}
      {post.projectTitle && (
        <div className={styles.chipRow}>
          {projectHref && post.projectId ? (
            <Link href={projectHref(post.projectId)} className={styles.chip}>
              📁 {post.projectTitle}
            </Link>
          ) : (
            <span className={styles.chip}>📁 {post.projectTitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
