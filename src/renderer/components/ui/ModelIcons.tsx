import React from 'react';

// AI model provider icon component
// Prioritize using local provider brand icons, fallback to first letter circle when no matching icon

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

// Map category names to local provider icon resources
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
  Hunyuan: tencentCloudTiPng, // Map Hunyuan to Tencent icon
  ERNIE: '', // Placeholder for ERNIE
};

/**
 * Get category icon
 * 获取分类图标
 */
export function getCategoryIcon(category: string, size = 20): React.ReactNode {
  // 0. nanobananai 🍌 special icon
  if (category === 'nanobananai 🍌') {
    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          fontSize: size * 0.75,
          background: 'linear-gradient(135deg, #fefce8 0%, #fef08a 100%)',
          borderRadius: 6,
          border: '1px solid #fde047',
          lineHeight: 1,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}
      >
        🍌
      </div>
    );
  }

  // 1. Prioritize using local provider brand icons
  // 优先使用本地 provider 品牌图标
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
          // If no matching icon, generate a colored circle with the first letter as fallback
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }

  // 2. Fallback: use first letter of category name when no local icon is found
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
