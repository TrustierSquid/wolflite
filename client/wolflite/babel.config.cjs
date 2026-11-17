// Only used by Jest (Vite has its own JSX/TypeScript setup).
// "automatic" runtime matches Vite, so components don't need `import React`.
// preset-typescript strips type annotations so Jest can run .ts/.tsx files.
module.exports = {
  presets: [
    '@babel/preset-env',
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript'
  ],
};
