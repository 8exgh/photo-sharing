# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15 project with TypeScript and Tailwind CSS, intended for a photo-related application. The project uses the App Router architecture and includes React 19.

## Development Commands

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Project Structure

- `src/app/` - Next.js App Router directory
  - `layout.tsx` - Root layout with Geist font configuration
  - `page.tsx` - Homepage component
  - `globals.css` - Global styles with Tailwind CSS and CSS variables
- `public/` - Static assets (SVG icons)
- Configuration files use TypeScript (`.ts`/`.mjs` extensions)

## Key Technologies

- **Next.js 15** with App Router
- **TypeScript** with strict mode enabled
- **Tailwind CSS v4** with PostCSS integration
- **Geist fonts** (Sans and Mono variants)
- **React 19**

## Styling

- Uses Tailwind CSS v4 with inline theme configuration
- CSS variables for theming (light/dark mode support)
- Geist font variables configured in layout
- Dark mode support through CSS media queries

## TypeScript Configuration

- Path alias `@/*` maps to `./src/*`
- Strict mode enabled
- Incremental compilation enabled
- Next.js plugin configured for type checking