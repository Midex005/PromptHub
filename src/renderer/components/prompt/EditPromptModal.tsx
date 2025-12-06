import { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Input, Textarea } from '../ui';
import { Select } from '../ui/Select';
import { HashIcon, XIcon, Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { usePromptStore } from '../../stores/prompt.store';
import { useFolderStore } from '../../stores/folder.store';
import { useTranslation } from 'react-i18next';
import type { Prompt } from '../../../shared/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { defaultSchema } from 'hast-util-sanitize';

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt;
}

export function EditPromptModal({ isOpen, onClose, prompt }: EditPromptModalProps) {
  const { t } = useTranslation();
  const updatePrompt = usePromptStore((state) => state.updatePrompt);
  const prompts = usePromptStore((state) => state.prompts);
  const folders = useFolderStore((state) => state.folders);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isSplit = isFullscreen;
  const [previewEnabled, setPreviewEnabled] = useState(false);
  
  // 获取所有已存在的标签
  const existingTags = [...new Set(prompts.flatMap((p) => p.tags))];

  // 当 prompt 变化时更新表单
  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setDescription(prompt.description || '');
      setSystemPrompt(prompt.systemPrompt || '');
      setUserPrompt(prompt.userPrompt);
      setTags(prompt.tags || []);
      setFolderId(prompt.folderId);
    }
  }, [prompt]);

  const handleSubmit = async () => {
    if (!title.trim() || !userPrompt.trim()) return;
    
    try {
      await updatePrompt(prompt.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        systemPrompt: systemPrompt.trim() || undefined,
        userPrompt: userPrompt.trim(),
        tags,
        folderId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const sanitizeSchema: any = useMemo(() => {
    const schema = { ...defaultSchema, attributes: { ...defaultSchema.attributes } };
    schema.attributes.code = [...(schema.attributes.code || []), ['className']];
    schema.attributes.span = [...(schema.attributes.span || []), ['className']];
    schema.attributes.pre = [...(schema.attributes.pre || []), ['className']];
    return schema;
  }, []);

  const rehypePlugins = useMemo(
    () => [
      [rehypeHighlight, { ignoreMissing: true }] as any,
      [rehypeSanitize, sanitizeSchema] as any,
    ],
    [sanitizeSchema],
  );

  const markdownComponents = {
    h1: (props: any) => <h1 className="text-2xl font-bold mb-4 text-foreground" {...props} />,
    h2: (props: any) => <h2 className="text-xl font-semibold mb-3 mt-5 text-foreground" {...props} />,
    h3: (props: any) => <h3 className="text-lg font-semibold mb-3 mt-4 text-foreground" {...props} />,
    h4: (props: any) => <h4 className="text-base font-semibold mb-2 mt-3 text-foreground" {...props} />,
    p: (props: any) => <p className="mb-3 leading-relaxed text-foreground/90" {...props} />,
    ul: (props: any) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
    ol: (props: any) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
    li: (props: any) => <li className="leading-relaxed" {...props} />,
    code: (props: any) => <code className="px-1 py-0.5 rounded bg-muted font-mono text-[13px]" {...props} />,
    pre: (props: any) => (
      <pre className="p-3 rounded-lg bg-muted overflow-x-auto text-[13px] leading-relaxed" {...props} />
    ),
    blockquote: (props: any) => (
      <blockquote className="border-l-4 border-border pl-3 text-muted-foreground italic mb-3" {...props} />
    ),
    hr: () => <hr className="my-4 border-border" />,
    table: (props: any) => <table className="table-auto border-collapse w-full text-sm mb-3" {...props} />,
    th: (props: any) => (
      <th className="border border-border px-2 py-1 bg-muted text-left font-medium" {...props} />
    ),
    td: (props: any) => <td className="border border-border px-2 py-1" {...props} />,
    a: (props: any) => <a className="text-primary hover:underline" {...props} target="_blank" rel="noreferrer" />,
    strong: (props: any) => <strong className="font-semibold text-foreground" {...props} />,
    em: (props: any) => <em className="italic text-foreground/90" {...props} />,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('prompt.editPrompt')}
      size={isFullscreen ? 'full' : 'xl'}
      extraActions={
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={isFullscreen ? '退出全屏' : '全屏编辑'}
        >
          {isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
        </button>
      }
    >
      <div className="space-y-5">
        {/* 标题 */}
        <Input
          label={t('prompt.titleLabel')}
          placeholder={t('prompt.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* 描述 */}
        <Input
          label={t('prompt.descriptionOptional')}
          placeholder={t('prompt.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* 文件夹 */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t('prompt.folderOptional')}
          </label>
          <Select
            value={folderId || ''}
            onChange={(val) => setFolderId(val || undefined)}
            placeholder={t('prompt.noFolder')}
            options={[
              { value: '', label: t('prompt.noFolder') },
              ...folders.map((folder) => ({
                value: folder.id,
                label: `${folder.icon || '📁'} ${folder.name}`,
              })),
            ]}
          />
        </div>

        {/* 标签 */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t('prompt.tagsOptional')}
          </label>
          {/* 已选标签 */}
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-white"
              >
                <HashIcon className="w-3 h-3" />
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-white/70"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          {/* 已有标签选择 */}
          {existingTags.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-muted-foreground mb-1.5">{t('prompt.selectExistingTags')}</div>
              <div className="flex flex-wrap gap-1.5">
                {existingTags.filter(t => !tags.includes(t)).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags([...tags, tag])}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-accent transition-colors"
                  >
                    <HashIcon className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* 新建标签 */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('prompt.enterTagHint')}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="flex-1 h-10 px-4 rounded-xl bg-muted/50 border-0 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-background transition-all duration-200"
            />
            <Button variant="secondary" size="md" onClick={handleAddTag}>
              {t('prompt.addTag')}
            </Button>
          </div>
        </div>

        {/* System Prompt */}
        <Textarea
          label={t('prompt.systemPromptOptional')}
          placeholder={t('prompt.systemPromptPlaceholder')}
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />

        {/* User Prompt 编辑/预览 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-foreground">{t('prompt.userPromptLabel')}</label>
            {!isSplit && (
              <button
                onClick={() => setPreviewEnabled((v) => !v)}
                className="px-3 py-1 rounded-md text-xs font-medium border border-border bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                {previewEnabled ? '隐藏预览' : '显示预览'}
              </button>
            )}
          </div>

          {isSplit ? (
              <div className="grid grid-cols-2 gap-4">
              <Textarea
                placeholder={t('prompt.userPromptPlaceholder')}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="min-h-[360px]"
              />
              <div className="p-4 rounded-xl bg-card border border-border text-[15px] leading-[1.7] markdown-content break-words space-y-3 min-h-[360px]">
                {userPrompt ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={rehypePlugins}
                    components={markdownComponents}
                  >
                    {userPrompt}
                  </ReactMarkdown>
                ) : (
                  <div className="text-muted-foreground text-sm">{t('prompt.noContent')}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Textarea
                placeholder={t('prompt.userPromptPlaceholder')}
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="min-h-[200px]"
              />
              {previewEnabled && (
                <div className="p-4 rounded-xl bg-card border border-border text-[15px] leading-[1.7] markdown-content break-words space-y-3">
                  {userPrompt ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                          rehypePlugins={rehypePlugins}
                      components={markdownComponents}
                    >
                      {userPrompt}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-muted-foreground text-sm">{t('prompt.noContent')}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!title.trim() || !userPrompt.trim()}
          >
            {t('prompt.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
