/**
 * Recommended resources
 * 推荐资源链接
 */

export interface Resource {
  title: string;
  url: string;
  description: string;
}

export const RECOMMENDED_RESOURCES = {
  learning: [
    {
      title: 'Prompt Engineering Guide',
      url: 'https://www.promptingguide.ai/',
      description: 'Comprehensive prompt engineering guide / 最全面的 Prompt 工程指南',
    },
    {
      title: 'Learn Prompting',
      url: 'https://learnprompting.org/',
      description: 'Free prompt course / 免费 Prompt 课程',
    },
    {
      title: 'OpenAI Prompt Engineering',
      url: 'https://platform.openai.com/docs/guides/prompt-engineering',
      description: 'Official OpenAI guide / OpenAI 官方指南',
    },
    {
      title: 'Anthropic Prompt Library',
      url: 'https://docs.anthropic.com/claude/prompt-library',
      description: 'Official Claude prompt library / Claude 官方 Prompt 库',
    },
  ] as Resource[],

  collections: [
    {
      title: 'Awesome ChatGPT Prompts',
      url: 'https://github.com/f/awesome-chatgpt-prompts',
      description: 'GitHub 10w+ Star',
    },
    {
      title: 'FlowGPT',
      url: 'https://flowgpt.com/',
      description: 'Prompt sharing community / Prompt 分享社区',
    },
    {
      title: 'PromptHero',
      url: 'https://prompthero.com/',
      description: 'AI image prompt library / AI 图像 Prompt 库',
    },
    {
      title: 'Snack Prompt',
      url: 'https://snackprompt.com/',
      description: 'Prompt collection & sharing / Prompt 收藏分享',
    },
  ] as Resource[],

  tools: [
    {
      title: 'PromptLayer',
      url: 'https://www.promptlayer.com/',
      description: 'Enterprise prompt management / 企业级 Prompt 管理',
    },
    {
      title: 'PromptWorks',
      url: 'https://github.com/YellowSeaa/PromptWorks',
      description: 'Open-source prompt tooling / 开源 Prompt 工具',
    },
    {
      title: 'Langfuse',
      url: 'https://langfuse.com/',
      description: 'Open-source LLM observability platform / 开源 LLM 观测平台',
    },
  ] as Resource[],
};
