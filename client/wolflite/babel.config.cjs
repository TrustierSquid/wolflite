// Only used by Jest (Vite has its own JSX setup).
// "automatic" runtime matches Vite, so components don't need `import React`.
module.exports = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
};
