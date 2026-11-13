import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = { turbopack: { root: path.resolve(process.cwd()) }, devIndicators: false };
export default config;
