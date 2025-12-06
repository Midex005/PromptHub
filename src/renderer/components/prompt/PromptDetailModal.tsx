import { useTranslation } from 'react-i18next';
import { StarIcon, HashIcon, ClockIcon, CopyIcon, CheckIcon, SparklesIcon, Maximize2Icon, Minimize2Icon } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { Prompt } from '../../../shared/types';
import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { defaultSchema } from 'hast-util-sanitize';

interface PromptDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: Prompt | null;
  onCopy?: (prompt: Prompt) => void;
}

export function PromptDetailModal({
  isOpen,
  onClose,
  prompt,
  onCopy,
}: PromptDetailModalProps) {
  const { t } = useTranslation();
  const [copiedSystem, setCopiedSystem] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  const renderMarkdownBlock = (text: string, className = '') => (
    <div className={`markdown-content text-sm leading-relaxed ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={rehypePlugins}>
        {text}
      </ReactMarkdown>
    </div>
  );

  if (!prompt) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // 提取变量
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{([^}]+)\}\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    return matches;
  };

  const allVariables = [
    ...extractVariables(prompt.systemPrompt || ''),
    ...extractVariables(prompt.userPrompt),
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const handleCopySystem = async () => {
    if (prompt.systemPrompt) {
      await navigator.clipboard.writeText(prompt.systemPrompt);
      setCopiedSystem(true);
      setTimeout(() => setCopiedSystem(false), 2000);
    }
  };

  const handleCopyUser = async () => {
    await navigator.clipboard.writeText(prompt.userPrompt);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 2000);
    if (onCopy) {
      onCopy(prompt);
    }
  };

  const handleCopyAi = async () => {
    if (prompt.lastAiResponse) {
      await navigator.clipboard.writeText(prompt.lastAiResponse);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={prompt.title}
      size={isFullscreen ? 'full' : '2xl'}
      extraActions={
        <button
          onClick={() => setIsFullscreen((v) => !v)}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={isFullscreen ? t('common.exitFull') || '退出全屏' : t('common.fullscreen') || '全屏'}
        >
          {isFullscreen ? <Minimize2Icon className="w-4 h-4" /> : <Maximize2Icon className="w-4 h-4" />}
        </button>
      }
    >
      <div className="space-y-6">
        {/* 基本信息 */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {prompt.isFavorite && (
            <div className="flex items-center gap-1">
              <StarIcon className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span>{t('nav.favorites')}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>{t('prompt.updatedAt')}: {formatDate(prompt.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{t('prompt.usageCount')}: {prompt.usageCount || 0}</span>
          </div>
        </div>

        {/* 描述 */}
        {prompt.description && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('prompt.description')}</h4>
            <p className="text-sm bg-muted/30 rounded-lg p-3">{prompt.description}</p>
          </div>
        )}

        {/* 标签 */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{t('prompt.tags')}</h4>
            <div className="flex flex-wrap gap-2">
              {prompt.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                >
                  <HashIcon className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 变量 */}
        {allVariables.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              {t('prompt.variables')} ({allVariables.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {allVariables.map((variable) => (
                <span
                  key={variable}
                  className="px-2 py-0.5 rounded bg-accent text-xs font-mono"
                >
                  {`{{${variable}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* System Prompt */}
        {prompt.systemPrompt && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">{t('prompt.systemPrompt')}</h4>
              <button
                onClick={handleCopySystem}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {copiedSystem ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copiedSystem ? t('prompt.copied') : t('prompt.copy')}
              </button>
            </div>
            <div className="bg-muted/30 rounded-lg p-4 max-h-56 overflow-y-auto border border-border/60">
              {renderMarkdownBlock(prompt.systemPrompt)}
            </div>
          </div>
        )}

        {/* User Prompt */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-muted-foreground">{t('prompt.userPrompt')}</h4>
            <button
              onClick={handleCopyUser}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {copiedUser ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
              {copiedUser ? t('prompt.copied') : t('prompt.copy')}
            </button>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 max-h-80 overflow-y-auto border border-border/60">
            {renderMarkdownBlock(prompt.userPrompt)}
          </div>
        </div>

        {/* AI 响应 */}
        {prompt.lastAiResponse && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-primary" />
                {t('prompt.aiResponse')}
              </h4>
              <button
                onClick={handleCopyAi}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {copiedAi ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                {copiedAi ? t('prompt.copied') : t('prompt.copyResponse')}
              </button>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 max-h-80 overflow-y-auto">
              {renderMarkdownBlock(prompt.lastAiResponse, 'text-sm')}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
