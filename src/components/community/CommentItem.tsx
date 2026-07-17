"use client";

/**
 * CommentItem — um comentário com suas respostas aninhadas, renderizadas
 * recursivamente. A árvore já vem pronta em `comment.replies` (montada no
 * backend) — este componente só desenha. A partir de `MAX_INDENT_DEPTH` a
 * indentação para de crescer (mobile-safe), mas a linha de conexão
 * (border-left) continua indicando a thread, como no Reddit.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Button, cx } from "@/components/ui";
import { errorMessage } from "@/lib/api-client";
import type { Comment } from "@/lib/types";
import Avatar from "./Avatar";
import { fmtRelativeDate } from "./format";
import styles from "./CommentItem.module.css";

/** Profundidade a partir da qual a indentação visual para de crescer. */
const MAX_INDENT_DEPTH = 4;
const INDENT_STEP = 16;
const INDENT_FLAT = 8;

export interface CommentItemProps {
  comment: Comment;
  /** Resolve o href de perfil de qualquer autor da thread (raiz e respostas). */
  getAuthorHref?: (authorId: number) => string;
  onLike?: (commentId: number) => Promise<void> | void;
  onReply?: (parentId: number, body: string) => Promise<void> | void;
  /** Profundidade atual — uso interno da recursão, não precisa passar na raiz. */
  depth?: number;
  className?: string;
}

export default function CommentItem({
  comment,
  getAuthorHref,
  onLike,
  onReply,
  depth = 0,
  className,
}: CommentItemProps) {
  const [liking, setLiking] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const authorHref = getAuthorHref?.(comment.author.id);

  async function handleLike() {
    if (!onLike || liking) return;
    setLiking(true);
    try {
      await onLike(comment.id);
    } finally {
      setLiking(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    const body = replyBody.trim();
    if (!body || !onReply) return;
    setSubmittingReply(true);
    setReplyError(null);
    try {
      await onReply(comment.id, body);
      setReplyBody("");
      setReplying(false);
    } catch (err) {
      setReplyError(errorMessage(err));
    } finally {
      setSubmittingReply(false);
    }
  }

  function cancelReply() {
    setReplying(false);
    setReplyBody("");
    setReplyError(null);
  }

  const nextIndent = depth < MAX_INDENT_DEPTH ? INDENT_STEP : INDENT_FLAT;

  return (
    <li className={cx(styles.item, className)}>
      <div className={styles.row}>
        <Avatar name={comment.author.name} size="sm" />
        <div className={styles.body}>
          <div className={styles.meta}>
            {authorHref ? (
              <Link href={authorHref} className={styles.author}>
                {comment.author.name}
              </Link>
            ) : (
              <span className={styles.author}>{comment.author.name}</span>
            )}
            <span className={styles.date}>{fmtRelativeDate(comment.createdAt)}</span>
          </div>

          <p className={styles.text}>{comment.body}</p>

          <div className={styles.actions}>
            <button
              type="button"
              className={cx(styles.actionBtn, comment.likedByMe && styles.actionBtnLiked)}
              onClick={() => void handleLike()}
              disabled={liking}
              aria-pressed={comment.likedByMe}
            >
              {comment.likedByMe ? "♥" : "♡"} {comment.likeCount}
            </button>
            {onReply && (
              <button type="button" className={styles.actionBtn} onClick={() => setReplying((v) => !v)}>
                {replying ? "cancelar" : "responder"}
              </button>
            )}
          </div>

          {replying && (
            <form className={styles.replyForm} onSubmit={submitReply}>
              <textarea
                className="field-control"
                rows={2}
                placeholder={`Responder para ${comment.author.name}…`}
                value={replyBody}
                maxLength={2000}
                onChange={(e) => setReplyBody(e.target.value)}
                aria-label={`Responder o comentário de ${comment.author.name}`}
                required
                autoFocus
              />
              {replyError && (
                <p className={styles.replyError} role="alert">
                  {replyError}
                </p>
              )}
              <div className={styles.replyActions}>
                <Button type="submit" size="sm" loading={submittingReply} disabled={!replyBody.trim()}>
                  Responder
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelReply} disabled={submittingReply}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {comment.replies.length > 0 && (
            <ul className={styles.replies} style={{ paddingLeft: nextIndent }}>
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  getAuthorHref={getAuthorHref}
                  onLike={onLike}
                  onReply={onReply}
                  depth={depth + 1}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
