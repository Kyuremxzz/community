"use client";

/**
 * PostComposer — "No que você está trabalhando?": campo de criação de post,
 * colapsado por padrão, expande ao focar (composer estilo Twitter). Monta o
 * `FormData` (type/title/body/linkUrl/projectId/image) e delega a chamada de
 * API pra quem monta a tela via `onSubmit` — este componente não faz fetch.
 */
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Button, Card, Field, cx } from "@/components/ui";
import type { PostType } from "@/lib/types";
import { errorMessage } from "@/lib/api-client";
import Avatar from "./Avatar";
import { POST_TYPE_META, POST_TYPES_ORDER } from "./format";
import styles from "./PostComposer.module.css";

export interface PostComposerProject {
  id: number;
  title: string;
}

export interface PostComposerProps {
  /** Nome do autor logado — alimenta o avatar do composer. */
  authorName: string;
  /** Projetos do usuário disponíveis para marcar (omitido/vazio = esconde o seletor). */
  projects?: PostComposerProject[];
  /** Monta o FormData e delega a chamada de API real pra tela. Rejeita = erro inline. */
  onSubmit: (formData: FormData) => Promise<void>;
  className?: string;
}

export default function PostComposer({
  authorName,
  projects = [],
  onSubmit,
  className,
}: PostComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<PostType | "">("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [projectId, setProjectId] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // revoga a URL do preview local ao trocar de imagem ou desmontar (evita leak de memória)
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function expand() {
    if (expanded) return;
    setExpanded(true);
    window.setTimeout(() => titleRef.current?.focus(), 0);
  }

  function reset() {
    setType("");
    setTitle("");
    setBody("");
    setLinkUrl("");
    setProjectId("");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function collapse() {
    reset();
    setExpanded(false);
  }

  function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function removeImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = type !== "" && title.trim() !== "" && body.trim() !== "" && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    const form = new FormData();
    form.set("type", type);
    form.set("title", title.trim());
    form.set("body", body.trim());
    if (linkUrl.trim()) form.set("linkUrl", linkUrl.trim());
    if (projectId) form.set("projectId", projectId);
    if (imageFile) form.set("image", imageFile);

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
      collapse();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className={cx(styles.collapsed, className)}
        onClick={expand}
        onFocus={expand}
      >
        <Avatar name={authorName} size="sm" />
        No que você está trabalhando?
      </button>
    );
  }

  return (
    <Card className={cx(className)}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.head}>
          <Avatar name={authorName} size="md" />
          <div className={styles.headBody}>
            <div className={styles.pills} role="group" aria-label="Tipo do post">
              {POST_TYPES_ORDER.map((pt) => {
                const meta = POST_TYPE_META[pt];
                const active = type === pt;
                return (
                  <button
                    key={pt}
                    type="button"
                    className={cx(
                      "stamp",
                      `stamp--${meta.tone}`,
                      styles.pill,
                      active && styles.pillActive
                    )}
                    aria-pressed={active}
                    onClick={() => setType(pt)}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <input
              ref={titleRef}
              type="text"
              className={cx("field-control", styles.titleInput)}
              placeholder="Título"
              value={title}
              maxLength={140}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Título do post"
              required
            />

            <textarea
              className="field-control"
              placeholder="No que você está trabalhando?"
              rows={4}
              value={body}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
              aria-label="Corpo do post"
              required
            />

            <div className={styles.row}>
              <Field
                label="Link (opcional)"
                type="url"
                placeholder="https://…"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              {projects.length > 0 && (
                <Field
                  as="select"
                  label="Projeto (opcional)"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">Nenhum</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Field>
              )}
            </div>

            <div className={styles.imageField}>
              {imagePreview ? (
                <div className={styles.preview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Prévia da imagem selecionada" className={styles.previewImg} />
                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={removeImage}
                    aria-label="Remover imagem"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className={styles.imagePicker}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onPickImage}
                    aria-label="Anexar imagem"
                  />
                </div>
              )}
            </div>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <Button type="button" variant="ghost" size="sm" onClick={collapse} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" loading={submitting} disabled={!canSubmit}>
                Publicar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Card>
  );
}
