const assetUrl = (file: string): string => `${import.meta.env.BASE_URL}assets/${file}`;

export const assetManifest = {
  bundles: [
    {
      name: 'core',
      assets: [
        { alias: 'moradon', src: assetUrl('moradon-background-v1.png') },
        { alias: 'symbols', src: assetUrl('ko-symbols-atlas-v1.png') },
        { alias: 'wild-animation', src: assetUrl('trina-wild-animation-v2.png') },
        { alias: 'raptor-animation', src: assetUrl('raptor-win-animation-v2.png') },
        { alias: 'bow-animation', src: assetUrl('iron-bow-win-animation-v1.png') },
        { alias: 'shard-animation', src: assetUrl('shard-win-animation-v1.png') },
        { alias: 'scroll-animation', src: assetUrl('scroll-win-animation-v1.png') },
        { alias: 'hp-animation', src: assetUrl('hp-potion-win-animation-v1.png') },
        { alias: 'mp-animation', src: assetUrl('mp-potion-win-animation-v1.png') },
        { alias: 'coin-animation', src: assetUrl('noah-win-animation-v1.png') },
        { alias: 'scatter-animation', src: assetUrl('scatter-anvil-animation-v3.png') },
      ],
    },
    {
      name: 'bonus',
      assets: [
        { alias: 'magic-anvil', src: assetUrl('magic-anvil-bonus-v1.png') },
      ],
    },
  ],
};
