import React from 'react';

// AI 模型提供商图标组件
// 优先使用本地 provider 品牌图标，无对应图标时使用首字母圆圈

import openaiPng from '../../assets/providers/openai.png';
import anthropicPng from '../../assets/providers/anthropic.png';
import geminiPng from '../../assets/providers/gemini.png';
import deepseekPng from '../../assets/providers/deepseek.png';
import dashscopePng from '../../assets/providers/dashscope.png';
import doubaoPng from '../../assets/providers/doubao.png';
import zhipuPng from '../../assets/providers/zhipu.png';
import moonshotPng from '../../assets/providers/moonshot.png';
import mistralPng from '../../assets/providers/mistral.png';
import zeroOnePng from '../../assets/providers/zero-one.png';
import baichuanPng from '../../assets/providers/baichuan.png';
import tencentCloudTiPng from '../../assets/providers/tencent-cloud-ti.png';

interface IconProps {
  className?: string;
  size?: number;
}

// 按模型分类名称映射到本地 provider 图标资源
const CATEGORY_ICON_SRC: Record<string, string> = {
  GPT: openaiPng,
  Claude: anthropicPng,
  Gemini: geminiPng,
  DeepSeek: deepseekPng,
  Qwen: dashscopePng,
  Doubao: doubaoPng,
  GLM: zhipuPng,
  Moonshot: moonshotPng,
  Mistral: mistralPng,
  Yi: zeroOnePng,
  Baichuan: baichuanPng,
  Spark: tencentCloudTiPng,
};

// 根据分类名获取对应图标组件
export function getCategoryIcon(category: string, size = 20): React.ReactNode {
  // 1. 优先使用本地 provider 品牌图标
  const src = CATEGORY_ICON_SRC[category];

  if (src) {
    return (
      <img
        src={src}
        alt={category}
        width={size}
        height={size}
        style={{ borderRadius: 6, objectFit: 'contain', display: 'block' }}
        onError={(e) => {
          // 图标加载失败时隐藏 img，由首字母圆圈兜底
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // 2. 找不到对应本地图标时，使用首字母圆圈徽标
  const letter = (category && category[0]) || '?';
  const fontSize = size * 0.55;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '999px',
        background:
          'linear-gradient(135deg, rgba(148,163,184,0.9), rgba(148,163,184,0.4))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0f172a',
        fontSize,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      {letter}
    </div>
  );
}
